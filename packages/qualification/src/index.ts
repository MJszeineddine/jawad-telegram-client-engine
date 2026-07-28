import type { Intake, QualificationResult, PackageName, RiskLevel } from "../../domain/src/index.ts";

const unsafeTerms = ["hack", "steal", "malware", "seed phrase", "private key", "bypass captcha", "spam bot", "credential recovery"];
function textOf(i: Intake) { return [i.brokenBehaviour, i.expectedBehaviour, i.errorMessage ?? "", ...(i.reproductionSteps ?? [])].join(" ").toLowerCase(); }
function acceptance(i: Intake): string[] {
  if (i.acceptanceCriteria?.length) return i.acceptanceCriteria.slice(0, 8);
  const checks = [`Reproduce the reported behaviour before the change`, `Implement a bounded repair without unrelated redesign`, `Verify: ${i.expectedBehaviour || "the expected behaviour is restored"}`];
  if (i.environment === "production") checks.push("Verify a safe deployment or rollback procedure");
  return checks;
}
export function qualify(i: Intake): QualificationResult {
  const text = textOf(i);
  const manual: string[] = [];
  const missing: string[] = [];
  if (!i.ownershipConfirmed) missing.push("permission/ownership confirmation");
  if (!i.brokenBehaviour.trim()) missing.push("exact broken behaviour");
  if (!i.expectedBehaviour.trim()) missing.push("expected behaviour");
  if (!i.reproductionSteps.length) missing.push("reproduction steps");
  if (i.requiredAccessAvailable === false) missing.push("required access method");
  const unsafe = i.unsafeRequest || unsafeTerms.some(t => text.includes(t));
  if (unsafe) return result(i, "REJECT", "UNSAFE", missing, ["Unsafe or prohibited request"], 100);
  if (i.asksJawadToPayFirst) return result(i, "REJECT", "HIGH", missing, ["Request requires Jawad to send money first"], 100);
  if (!i.ownershipConfirmed) manual.push("Ownership not confirmed");
  if (i.securityIncident) manual.push("Potential security incident requires written authorisation and manual handling");
  if (i.productionDown) manual.push("Production outage");
  if (i.kind === "agency-overflow" && !i.approvedAndFunded) manual.push("Agency task is not confirmed funded");

  let pkg: PackageName;
  const minutes = i.estimatedMinutes ?? 240;
  const oneBoundedDefect = i.reproductionSteps.length > 0 && !i.requiresNewMajorIntegration && !i.requiresRedesign && !i.securityIncident;
  if (i.kind === "quick-fix" && oneBoundedDefect && minutes <= 90) pkg = "QUICK_FIX";
  else if (minutes <= 360 && !i.requiresRedesign && !i.requiresNewMajorIntegration && !i.securityIncident) pkg = "RESCUE";
  else pkg = "PRODUCTION_SPRINT";

  let risk: RiskLevel = "LOW";
  if (i.environment === "production" || i.kind === "production-rescue") risk = "MEDIUM";
  if (i.productionDown || i.securityIncident || i.safeRollbackAvailable === false) risk = "HIGH";
  const confidence = Math.max(20, Math.min(98, 95 - missing.length * 15 - manual.length * 7));
  return result(i, pkg, risk, missing, manual, confidence);
}
function result(i: Intake, pkg: PackageName, risk: RiskLevel, missing: string[], flags: string[], confidence: number): QualificationResult {
  const price = pkg === "QUICK_FIX" ? { min: 100, max: 150, currency: "USDT/USDC" as const, manual: false }
    : pkg === "RESCUE" ? { min: 300, max: 600, currency: "USDT/USDC" as const, manual: false }
    : pkg === "PRODUCTION_SPRINT" ? { min: 600, currency: "USDT/USDC" as const, manual: true }
    : { min: 0, currency: "USDT/USDC" as const, manual: true };
  const window = pkg === "QUICK_FIX" ? "After approval: usually within one focused working session" : pkg === "RESCUE" ? "After approval: same day to two working days" : pkg === "PRODUCTION_SPRINT" ? "Manual delivery plan required" : "Not applicable";
  return {
    requestSummary: `${i.kind}: ${i.brokenBehaviour.slice(0, 220)}`,
    riskLevel: risk, missingInformation: missing, recommendedPackage: pkg, recommendedPrice: price,
    proposedAcceptanceTest: acceptance(i), proposedDeliveryWindow: window,
    scopeExclusions: ["Unrelated feature work", "Unapproved production access", "Third-party fees", "Automatic refunds or payouts"],
    confidenceScore: confidence, manualReviewFlags: flags
  };
}

/** Optional, non-authoritative enhancement boundary. Implementations may suggest clearer copy,
 * but may never alter deterministic package, price, risk, confidence, or approval requirements. */
export interface QualificationEnhancer {
  enhance(input: { intake: Intake; deterministicResult: QualificationResult }): Promise<{
    summarySuggestion?: string;
    acceptanceSuggestions?: string[];
    notes?: string[];
  }>;
}

export interface EnhancedQualification {
  deterministicResult: QualificationResult;
  enhancement: Awaited<ReturnType<QualificationEnhancer["enhance"]>> | null;
  enhancementError?: string;
}

export async function qualifyWithOptionalEnhancer(intake: Intake, enhancer?: QualificationEnhancer): Promise<EnhancedQualification> {
  const deterministicResult = qualify(intake);
  if (!enhancer) return { deterministicResult, enhancement: null };
  try {
    const suggestion = await enhancer.enhance({ intake, deterministicResult });
    return {
      deterministicResult,
      enhancement: {
        ...(suggestion.summarySuggestion?.trim() ? { summarySuggestion: suggestion.summarySuggestion.trim().slice(0, 500) } : {}),
        ...(suggestion.acceptanceSuggestions?.length ? { acceptanceSuggestions: suggestion.acceptanceSuggestions.map(value => value.trim()).filter(Boolean).slice(0, 8) } : {}),
        ...(suggestion.notes?.length ? { notes: suggestion.notes.map(value => value.trim()).filter(Boolean).slice(0, 8) } : {})
      }
    };
  } catch (error) {
    return {
      deterministicResult,
      enhancement: null,
      enhancementError: error instanceof Error ? error.message.slice(0, 200) : "Enhancer failed"
    };
  }
}
