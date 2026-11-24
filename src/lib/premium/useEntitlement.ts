import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

export interface Entitlement {
  isPremium: boolean;
  plan: "free" | "premium";
  premiumUntil: string | null;
  source: "play" | "trial" | "founder" | null;
  loading: boolean;
}

function activeUntil(value?: string | null): boolean {
  if (!value) return true;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms > Date.now() : false;
}

export function useEntitlement(): Entitlement {
  const { profile, loading } = useAuth();
  const [, setTick] = useState(0);

  // Expiry can pass while the tab stays open; re-evaluate once a minute.
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const plan = profile?.plan === "premium" ? "premium" : "free";
  const legacyPremium = Boolean(
    profile?.is_premium && activeUntil(profile.premium_expires_at),
  );
  const isPremium =
    plan === "premium"
      ? activeUntil(profile?.premium_until)
      : !profile?.plan && legacyPremium;

  return {
    isPremium,
    plan: isPremium ? "premium" : "free",
    premiumUntil: profile?.premium_until ?? profile?.premium_expires_at ?? null,
    source: profile?.source ?? null,
    loading,
  };
}
