import { BILLING_CONFIG } from "@/config/billing";
import type {
  BillingAdapter,
  BillingPackage,
  BillingPeriod,
  EntitlementSnapshot,
  PurchaseResult,
} from "./types";

type RevenueCatModule = {
  Purchases: {
    configure(options: {
      apiKey: string;
      appUserID?: string;
    }): Promise<void> | void;
    getOfferings(): Promise<unknown>;
    purchasePackage(pkg: unknown): Promise<unknown>;
    restorePurchases(): Promise<unknown>;
    getCustomerInfo(): Promise<unknown>;
    addCustomerInfoUpdateListener(
      cb: (info: unknown) => void,
    ): (() => void) | void;
  };
};

function isNative(): boolean {
  const cap = (
    window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }
  ).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

function normalizeOfferings(raw: unknown): BillingPackage[] {
  const out: BillingPackage[] = [];
  const data = raw as {
    current?: {
      availablePackages?: Array<{
        identifier?: string;
        product?: { identifier?: string; priceString?: string | null };
      }>;
    } | null;
  };
  for (const pkg of data?.current?.availablePackages ?? []) {
    const productId = pkg.product?.identifier ?? "";
    const period: BillingPeriod = productId.includes("year")
      ? "yearly"
      : "monthly";
    out.push({
      identifier: pkg.identifier ?? productId,
      productId,
      period,
      priceLabel: pkg.product?.priceString ?? null,
    });
  }
  return out;
}

function normalizeCustomerInfo(raw: unknown): EntitlementSnapshot {
  const info = raw as {
    entitlements?: {
      active?: Record<string, { expiresDate?: string | null }>;
    };
  };
  const ent = info?.entitlements?.active?.[BILLING_CONFIG.entitlementId];
  return { active: Boolean(ent), expiresAt: ent?.expiresDate ?? null };
}

async function loadSdk(): Promise<RevenueCatModule | null> {
  if (!isNative() || !BILLING_CONFIG.revenueCatApiKey) return null;
  try {
    // Variable specifier keeps the web build free of the native package. Once
    // Capacitor is bundled, install @revenuecat/purchases-capacitor.
    const moduleName = "@revenuecat/purchases-capacitor";
    return (await import(/* @vite-ignore */ moduleName)) as RevenueCatModule;
  } catch {
    return null;
  }
}

export const revenueCatBilling: BillingAdapter = {
  available: isNative(),
  async init(userId: string) {
    const sdk = await loadSdk();
    if (!sdk) return;
    await sdk.Purchases.configure({
      apiKey: BILLING_CONFIG.revenueCatApiKey,
      appUserID: userId,
    });
  },
  async getOfferings() {
    const sdk = await loadSdk();
    if (!sdk) return [];
    try {
      return normalizeOfferings(await sdk.Purchases.getOfferings());
    } catch {
      return [];
    }
  },
  async purchase(period: BillingPeriod): Promise<PurchaseResult> {
    const sdk = await loadSdk();
    if (!sdk) {
      return {
        status: "unavailable",
        message: "Purchases are available in the Android app.",
      };
    }
    try {
      const offerings = await sdk.Purchases.getOfferings();
      const packages = normalizeOfferings(offerings);
      const wanted = packages.find((p) => p.period === period);
      if (!wanted)
        return { status: "error", message: "This plan is not available yet." };
      const raw = normalizeOfferings(offerings);
      void raw;
      const data = offerings as {
        current?: { availablePackages?: unknown[] };
      };
      const pkg = data.current?.availablePackages?.find(
        (p) =>
          normalizeOfferings({ current: { availablePackages: [p] } })[0]
            ?.period === period,
      );
      if (!pkg)
        return { status: "error", message: "This plan is not available yet." };
      await sdk.Purchases.purchasePackage(pkg);
      return { status: "success" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (/cancel/i.test(message)) return { status: "cancelled" };
      return {
        status: "error",
        message: message || "Purchase could not be completed.",
      };
    }
  },
  async restore() {
    const sdk = await loadSdk();
    if (!sdk) return { active: false, expiresAt: null };
    try {
      return normalizeCustomerInfo(await sdk.Purchases.restorePurchases());
    } catch {
      return { active: false, expiresAt: null };
    }
  },
  onEntitlementChange(cb) {
    let cleanup: (() => void) | void;
    void loadSdk().then((sdk) => {
      if (!sdk) return;
      cleanup = sdk.Purchases.addCustomerInfoUpdateListener((info) =>
        cb(normalizeCustomerInfo(info)),
      );
    });
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  },
};
