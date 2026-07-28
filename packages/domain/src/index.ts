export type IntakeKind = "quick-fix" | "agency-overflow" | "production-rescue";
export type PackageName = "QUICK_FIX" | "RESCUE" | "PRODUCTION_SPRINT" | "REJECT";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "UNSAFE";
export type JobStatus =
  | "NEW_LEAD" | "AWAITING_INFORMATION" | "AWAITING_REVIEW" | "QUOTE_SENT"
  | "AWAITING_PAYMENT" | "PAID" | "IN_PROGRESS" | "AWAITING_CLIENT_ACCEPTANCE"
  | "COMPLETED" | "REJECTED" | "REFUNDED";

export interface Intake {
  id: string;
  kind: IntakeKind;
  name: string;
  company?: string;
  contactPreference?: string;
  applicationUrl?: string;
  accessMethodPreference?: string;
  agencyWebsite?: string;
  contactRole?: string;
  endClientRequirement?: string;
  whiteLabelRequired?: boolean;
  communicationArrangement?: string;
  confidentialityLevel?: string;
  businessImpact?: string;
  productionStatus?: string;
  existingTests?: string[];
  repositoryDescription?: string;
  deploymentProvider?: string;
  database?: string;
  urgency?: string;
  requiredAccess?: string;
  stack: string[];
  environment?: "local" | "staging" | "production";
  brokenBehaviour: string;
  expectedBehaviour: string;
  reproductionSteps: string[];
  errorMessage?: string;
  deadline?: string;
  budget?: string;
  ownershipConfirmed: boolean;
  approvedAndFunded?: boolean;
  productionDown?: boolean;
  usersAffected?: number;
  recentChange?: string;
  safeRollbackAvailable?: boolean;
  acceptanceCriteria?: string[];
  requiresNewMajorIntegration?: boolean;
  requiresRedesign?: boolean;
  estimatedMinutes?: number;
  requiredAccessAvailable?: boolean;
  securityIncident?: boolean;
  asksJawadToPayFirst?: boolean;
  unsafeRequest?: boolean;
  referralSlug?: string;
}

export interface QualificationResult {
  requestSummary: string;
  riskLevel: RiskLevel;
  missingInformation: string[];
  recommendedPackage: PackageName;
  recommendedPrice: { min: number; max?: number; currency: "USDT/USDC"; manual: boolean };
  proposedAcceptanceTest: string[];
  proposedDeliveryWindow: string;
  scopeExclusions: string[];
  confidenceScore: number;
  manualReviewFlags: string[];
}

const transitions: Record<JobStatus, readonly JobStatus[]> = {
  NEW_LEAD: ["AWAITING_INFORMATION", "AWAITING_REVIEW", "REJECTED"],
  AWAITING_INFORMATION: ["AWAITING_REVIEW", "REJECTED"],
  AWAITING_REVIEW: ["QUOTE_SENT", "AWAITING_INFORMATION", "REJECTED"],
  QUOTE_SENT: ["AWAITING_PAYMENT", "REJECTED"],
  AWAITING_PAYMENT: ["PAID", "REJECTED", "REFUNDED"],
  PAID: ["IN_PROGRESS", "REFUNDED"],
  IN_PROGRESS: ["AWAITING_CLIENT_ACCEPTANCE", "REFUNDED"],
  AWAITING_CLIENT_ACCEPTANCE: ["COMPLETED", "IN_PROGRESS", "REFUNDED"],
  COMPLETED: [], REJECTED: [], REFUNDED: []
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return transitions[from].includes(to);
}
export function transition(from: JobStatus, to: JobStatus): JobStatus {
  if (!canTransition(from, to)) throw new Error(`Illegal job transition: ${from} -> ${to}`);
  return to;
}

export interface CapacitySettings {
  maxQuickFixes: number; maxRescueJobs: number; activeQuickFixes: number; activeRescueJobs: number;
  checkoutPaused: boolean; awayMode: boolean; nextAvailableDate?: string;
}
export function capacityDecision(packageName: PackageName, settings: CapacitySettings) {
  if (settings.checkoutPaused || settings.awayMode) return { canTakePayment: false, reason: "CHECKOUT_PAUSED", nextAvailableDate: settings.nextAvailableDate };
  if (packageName === "QUICK_FIX" && settings.activeQuickFixes >= settings.maxQuickFixes) return { canTakePayment: false, reason: "QUICK_FIX_CAPACITY_FULL", nextAvailableDate: settings.nextAvailableDate };
  if (packageName === "RESCUE" && settings.activeRescueJobs >= settings.maxRescueJobs) return { canTakePayment: false, reason: "RESCUE_CAPACITY_FULL", nextAvailableDate: settings.nextAvailableDate };
  return { canTakePayment: true, reason: "AVAILABLE", nextAvailableDate: settings.nextAvailableDate };
}

export interface PartnerAttribution { partnerSlug?: string; campaign?: string; source: "direct"|"partner"|"channel"|"group"|"campaign"; }
export function parseAttribution(start?: string): PartnerAttribution {
  if (!start || start === "direct") return { source: "direct" };
  if (start === "channel") return { source: "channel" };
  if (start.startsWith("partner_")) return { source: "partner", partnerSlug: start.slice(8).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) };
  if (start.startsWith("group_")) return { source: "group", campaign: start.slice(6).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) };
  return { source: "campaign", campaign: start.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) };
}

export interface ReferralCandidate {
  partnerSlug: string;
  partnerOwnerTelegramId?: string;
  clientTelegramId?: string;
  existingPartnerSlug?: string;
  candidateStartedAt: number;
  firstAttributedAt?: number;
}
export function resolveReferral(candidate: ReferralCandidate) {
  const fraudFlags: string[] = [];
  if (candidate.partnerOwnerTelegramId && candidate.clientTelegramId && candidate.partnerOwnerTelegramId === candidate.clientTelegramId) fraudFlags.push("SELF_REFERRAL");
  if (candidate.existingPartnerSlug && candidate.existingPartnerSlug !== candidate.partnerSlug) return { accepted: false, partnerSlug: candidate.existingPartnerSlug, rule: "FIRST_VALID_ATTRIBUTION_WINS", fraudFlags };
  if (candidate.firstAttributedAt && candidate.candidateStartedAt - candidate.firstAttributedAt > 30 * 86_400_000) fraudFlags.push("ATTRIBUTION_WINDOW_EXPIRED");
  return { accepted: fraudFlags.length === 0, partnerSlug: candidate.partnerSlug, rule: "FIRST_VALID_ATTRIBUTION_WINS", fraudFlags };
}
export function referralCommission(input: { collectedMinor: bigint; commissionBps: number; delivered: boolean; clientAccepted: boolean; fraudFlags?: string[] }) {
  const eligible = input.delivered && input.clientAccepted && !(input.fraudFlags?.length);
  return { eligible, amountMinor: eligible ? input.collectedMinor * BigInt(input.commissionBps) / 10_000n : 0n, payoutStatus: eligible ? "PENDING_MANUAL_APPROVAL" as const : "NOT_ELIGIBLE" as const };
}
