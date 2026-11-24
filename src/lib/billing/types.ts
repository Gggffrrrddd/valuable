export type BillingPeriod = "monthly" | "yearly";

export interface BillingPackage {
  identifier: string;
  productId: string;
  period: BillingPeriod;
  priceLabel: string | null;
}

export interface PurchaseResult {
  status: "success" | "cancelled" | "unavailable" | "error";
  message?: string;
}

export interface EntitlementSnapshot {
  active: boolean;
  expiresAt: string | null;
}

export interface BillingAdapter {
  readonly available: boolean;
  init(userId: string): Promise<void>;
  getOfferings(): Promise<BillingPackage[]>;
  purchase(period: BillingPeriod): Promise<PurchaseResult>;
  restore(): Promise<EntitlementSnapshot>;
  onEntitlementChange(cb: (snapshot: EntitlementSnapshot) => void): () => void;
}
