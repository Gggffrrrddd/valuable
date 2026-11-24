/** Placeholders — replace with RevenueCat / Play Console values at launch. */
export const BILLING_CONFIG = {
  entitlementId: "premium",
  offeringId: "default",
  packageName: "com.valuable.app",
  products: {
    monthly: "valuable_premium_monthly",
    yearly: "valuable_premium_yearly",
  },
  /** Public RevenueCat SDK keys are added later in the native build config. */
  revenueCatApiKey: "",
} as const;
