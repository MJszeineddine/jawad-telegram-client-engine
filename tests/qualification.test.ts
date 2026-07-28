import test from "node:test"; import assert from "node:assert/strict"; import {qualify} from "../packages/qualification/src/index.ts"; import type {Intake} from "../packages/domain/src/index.ts";
const base:Intake={id:"1",kind:"quick-fix",name:"Client",stack:["Next.js"],environment:"staging",brokenBehaviour:"Button fails",expectedBehaviour:"Button saves",reproductionSteps:["Open","Click"],ownershipConfirmed:true,estimatedMinutes:75,requiredAccessAvailable:true,safeRollbackAvailable:true};
test("qualifies a bounded defect as quick fix",()=>{const q=qualify(base);assert.equal(q.recommendedPackage,"QUICK_FIX");assert.equal(q.recommendedPrice.min,100);assert.equal(q.missingInformation.length,0);assert.ok(q.confidenceScore>=90)});
test("escalates broader work",()=>{assert.equal(qualify({...base,estimatedMinutes:240,kind:"production-rescue"}).recommendedPackage,"RESCUE");assert.equal(qualify({...base,estimatedMinutes:800,requiresRedesign:true}).recommendedPackage,"PRODUCTION_SPRINT")});
test("rejects unsafe and pay-first requests",()=>{assert.equal(qualify({...base,brokenBehaviour:"Build malware to steal credentials"}).recommendedPackage,"REJECT");assert.equal(qualify({...base,asksJawadToPayFirst:true}).recommendedPackage,"REJECT")});
test("reports missing information without auto acceptance",()=>{const q=qualify({...base,ownershipConfirmed:false,reproductionSteps:[]});assert.ok(q.missingInformation.includes("permission/ownership confirmation"));assert.ok(q.manualReviewFlags.length>0)});

test("optional enhancer cannot replace deterministic commercial decision", async () => {
  const intake = {id:"llm-boundary",kind:"quick-fix" as const,name:"Client",stack:["React"],environment:"staging" as const,brokenBehaviour:"Button fails",expectedBehaviour:"Button submits",reproductionSteps:["Open form","Click submit"],ownershipConfirmed:true,estimatedMinutes:45,requiredAccessAvailable:true};
  const { qualifyWithOptionalEnhancer } = await import("../packages/qualification/src/index.ts");
  const output = await qualifyWithOptionalEnhancer(intake, { async enhance() { return { summarySuggestion:"Polished wording", acceptanceSuggestions:["Suggested check"] }; } });
  assert.equal(output.deterministicResult.recommendedPackage,"QUICK_FIX");
  assert.equal(output.deterministicResult.recommendedPrice.min,100);
  assert.equal(output.enhancement?.summarySuggestion,"Polished wording");
});

test("optional enhancer failure leaves qualification fully usable", async () => {
  const intake = {id:"llm-fail",kind:"quick-fix" as const,name:"Client",stack:["Node.js"],environment:"local" as const,brokenBehaviour:"API fails",expectedBehaviour:"API responds",reproductionSteps:["Call endpoint"],ownershipConfirmed:true,estimatedMinutes:60,requiredAccessAvailable:true};
  const { qualifyWithOptionalEnhancer } = await import("../packages/qualification/src/index.ts");
  const output = await qualifyWithOptionalEnhancer(intake, { async enhance() { throw new Error("provider unavailable"); } });
  assert.equal(output.deterministicResult.recommendedPackage,"QUICK_FIX");
  assert.equal(output.enhancement,null);
  assert.match(output.enhancementError ?? "",/provider unavailable/);
});
