import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createPostgresRepository } from "../../packages/database/src/index.ts";
import { qualify } from "../../packages/qualification/src/index.ts";
import type { Intake } from "../../packages/domain/src/index.ts";

const enabled = process.env.RUN_DATABASE_TESTS === "true";
const databaseUrl = process.env.DATABASE_URL ?? "";
const encryptionKey = process.env.DATA_ENCRYPTION_KEY ?? "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

function intake(id: string, telegramUserId: string): Intake {
  return {
    id,
    kind: "quick-fix",
    name: `Integration client ${telegramUserId}`,
    stack: ["Next.js", "PostgreSQL"],
    environment: "staging",
    brokenBehaviour: "Checkout submit button remains disabled after valid input",
    expectedBehaviour: "Checkout submits exactly once",
    reproductionSteps: ["Open checkout", "Enter valid data", "Submit"],
    ownershipConfirmed: true,
    estimatedMinutes: 60,
    requiredAccessAvailable: true
  };
}

async function createOpenInvoice(repo: Awaited<ReturnType<typeof createPostgresRepository>>, suffix: string) {
  const telegramUserId = `${Math.floor(100_000_000 + Math.random() * 800_000_000)}`;
  const request = intake(`db-${suffix}-${randomUUID()}`, telegramUserId);
  const leadId = await repo.createLead({
    telegramUserId,
    telegramUsername: `db_${suffix}`.slice(0, 30),
    intake: request,
    qualification: qualify(request),
    attributionSource: "integration_test",
    status: "awaiting_review"
  });
  const quoteId = await repo.createApprovedQuote({
    leadId,
    scope: "Repair the bounded checkout submission defect.",
    acceptanceTest: ["A valid checkout submits exactly once"],
    priceMinor: 100_000_000n,
    currency: "USDC",
    network: "BASE_USDC",
    deliveryWindow: "One focused working session after approval",
    exclusions: ["Unrelated redesign"],
    includedWork: ["Diagnosis", "Repair", "Regression check"],
    refundTerms: "Manual review only; no automatic refund or transfer.",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    approvedBy: "ci-integration"
  });
  const invoiceId = await repo.createInvoiceForQuote({
    quoteId,
    network: "BASE_USDC",
    recipientAddress: "0x1111111111111111111111111111111111111111",
    tokenContract: "0x2222222222222222222222222222222222222222",
    decimals: 6,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    actor: "ci-integration"
  });
  return { leadId, invoiceId };
}

test("PostgreSQL payment confirmation is concurrent, idempotent, and transaction-unique", { skip: !enabled }, async () => {
  assert.ok(databaseUrl, "DATABASE_URL is required when RUN_DATABASE_TESTS=true");
  const repo = await createPostgresRepository(databaseUrl, encryptionKey);
  try {
    const first = await createOpenInvoice(repo, "first");
    const txHash = `0x${"ab".repeat(32)}`;
    const transfer = {
      txHash,
      network: "BASE_USDC" as const,
      success: true,
      tokenContract: "0x2222222222222222222222222222222222222222",
      from: "0x3333333333333333333333333333333333333333",
      to: "0x1111111111111111111111111111111111111111",
      amountMinor: 100_000_000n,
      confirmations: 20,
      timestamp: Date.now()
    };
    const concurrent = await Promise.all([
      repo.confirmPayment({ invoiceId: first.invoiceId, transfer, minConfirmations: 12, actor: "ci-provider" }),
      repo.confirmPayment({ invoiceId: first.invoiceId, transfer, minConfirmations: 12, actor: "ci-provider" })
    ]);
    assert.equal(concurrent[0].jobId, concurrent[1].jobId);
    assert.deepEqual(new Set(concurrent.map(result => result.code)), new Set(["PAYMENT_CONFIRMED", "ALREADY_PAID_IDEMPOTENT"]));
    const ticket = await repo.getLead(first.leadId);
    assert.equal(ticket?.status, "paid");
    assert.equal(ticket?.latestInvoice?.txHash, txHash);
    assert.equal(ticket?.job?.id, concurrent[0].jobId);

    const second = await createOpenInvoice(repo, "second");
    await assert.rejects(
      repo.confirmPayment({ invoiceId: second.invoiceId, transfer, minConfirmations: 12, actor: "ci-provider" }),
      /DUPLICATE_TX_HASH/
    );
  } finally {
    await repo.close();
  }
});
