import type { Intake, JobStatus, QualificationResult } from "../../../packages/domain/src/index.ts";
export interface Lead {
  id:string; intake:Intake; qualification:QualificationResult; status:JobStatus; createdAt:string;
  quote?:{price:number;network:"TRON_TRC20"|"BASE_USDC";approved:boolean}; invoiceId?:string;
  paymentEvidence?:{txHash:string;code:string}; deliveryMessage?:string; testimonialRequested?:boolean;
  referral?:{partnerSlug:string;commissionPercent:number;eligible:boolean};
}
export const leads=new Map<string,Lead>();
