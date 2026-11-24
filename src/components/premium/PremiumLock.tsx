import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { usePremiumConfig } from "@/lib/premium/PremiumConfigProvider";
import { useEntitlement } from "@/lib/premium/useEntitlement";
import { FEATURE_LABELS, isFeatureLocked } from "@/lib/premium/features";
import { openPremiumPage } from "@/lib/premium/openPremium";
import type { FeatureId } from "@/lib/premium/types";

export default function PremiumLock({
  feature,
  children,
  className = "",
  compact = false,
}: {
  feature: FeatureId;
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const { config } = usePremiumConfig();
  const { isPremium } = useEntitlement();
  if (!isFeatureLocked(feature, config.flags, isPremium)) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={`relative ${className}`}>
      <div className="pointer-events-none select-none opacity-45">
        {children}
      </div>
      <button
        type="button"
        onClick={() => openPremiumPage(FEATURE_LABELS[feature])}
        className={`absolute inset-0 flex items-center justify-center rounded-[inherit] bg-[#090b0a]/45 backdrop-blur-[2px] ${
          compact ? "gap-1.5 text-[10px]" : "gap-2 text-xs"
        } font-bold text-[#f6e3ba]`}
        aria-label={`Unlock ${FEATURE_LABELS[feature]} with Premium`}
      >
        <Lock className={compact ? "h-3 w-3" : "h-4 w-4"} />
        <span>Premium</span>
      </button>
    </div>
  );
}
