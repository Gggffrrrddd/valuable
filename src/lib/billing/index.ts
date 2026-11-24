import { revenueCatBilling } from "./revenuecat";
import { webBilling } from "./web";

export const billing = revenueCatBilling.available
  ? revenueCatBilling
  : webBilling;
export type { BillingPackage, BillingPeriod, PurchaseResult } from "./types";
