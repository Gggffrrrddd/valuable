import type {
  BillingAdapter,
  BillingPackage,
  EntitlementSnapshot,
  PurchaseResult,
} from "./types";

const unavailable = (): PurchaseResult => ({
  status: "unavailable",
  message: "Purchases are available in the Android app.",
});

/** Web/PWA is intentionally a no-op: no browser payment flow exists. */
export const webBilling: BillingAdapter = {
  available: false,
  async init() {},
  async getOfferings(): Promise<BillingPackage[]> {
    return [];
  },
  async purchase() {
    return unavailable();
  },
  async restore(): Promise<EntitlementSnapshot> {
    return { active: false, expiresAt: null };
  },
  onEntitlementChange() {
    return () => undefined;
  },
};
