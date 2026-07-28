import test from "node:test"; import assert from "node:assert/strict"; import {canTransition,transition,capacityDecision,parseAttribution,resolveReferral,referralCommission} from "../packages/domain/src/index.ts";
test("job transitions enforce the lifecycle",()=>{assert.equal(canTransition("AWAITING_REVIEW","QUOTE_SENT"),true);assert.equal(canTransition("NEW_LEAD","PAID"),false);assert.throws(()=>transition("NEW_LEAD","PAID"));assert.equal(transition("PAID","IN_PROGRESS"),"IN_PROGRESS")});
test("capacity collects leads but blocks payment",()=>{assert.deepEqual(capacityDecision("QUICK_FIX",{maxQuickFixes:2,maxRescueJobs:1,activeQuickFixes:2,activeRescueJobs:0,checkoutPaused:false,awayMode:false,nextAvailableDate:"2026-08-01"}),{canTakePayment:false,reason:"QUICK_FIX_CAPACITY_FULL",nextAvailableDate:"2026-08-01"});assert.equal(capacityDecision("RESCUE",{maxQuickFixes:2,maxRescueJobs:1,activeQuickFixes:0,activeRescueJobs:0,checkoutPaused:false,awayMode:false}).canTakePayment,true)});
test("deep links preserve safe attribution",()=>{assert.deepEqual(parseAttribution("partner_good-agency"),{source:"partner",partnerSlug:"good-agency"});assert.equal(parseAttribution("group_name<script>").campaign,"namescript");assert.deepEqual(parseAttribution(),{source:"direct"})});

test("referral attribution is first-touch, self-referral safe, and manually payable", () => {
  const accepted = resolveReferral({ partnerSlug:"agency-a",partnerOwnerTelegramId:"1",clientTelegramId:"2",candidateStartedAt:100 });
  assert.equal(accepted.accepted,true);
  const duplicate = resolveReferral({ partnerSlug:"agency-b",existingPartnerSlug:"agency-a",candidateStartedAt:200 });
  assert.equal(duplicate.partnerSlug,"agency-a");
  const self = resolveReferral({ partnerSlug:"agency-a",partnerOwnerTelegramId:"1",clientTelegramId:"1",candidateStartedAt:100 });
  assert.deepEqual(self.fraudFlags,["SELF_REFERRAL"]);
  assert.deepEqual(referralCommission({collectedMinor:100_000_000n,commissionBps:2000,delivered:true,clientAccepted:true}),{eligible:true,amountMinor:20_000_000n,payoutStatus:"PENDING_MANUAL_APPROVAL"});
});
