import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { DEFAULT_PREMIUM_CONFIG, DEFAULT_PREMIUM_FLAGS } from "./defaults";
import type {
  FeatureId,
  PremiumConfig,
  PremiumFlags,
  PremiumContent,
} from "./types";

const CACHE_KEY = "valuable.premium-config.v1";
const CACHE_TTL_MS = 60_000;
const REFRESH_MS = 5 * 60_000;

interface CachedConfig {
  at: number;
  value: PremiumConfig;
}

function mergeFlags(value: unknown): PremiumFlags {
  if (!value || typeof value !== "object") return DEFAULT_PREMIUM_FLAGS;
  const raw = value as Partial<PremiumFlags> & {
    locked_features?: Record<string, unknown>;
  };
  const locked = { ...DEFAULT_PREMIUM_FLAGS.locked_features };
  for (const key of Object.keys(locked) as FeatureId[]) {
    if (typeof raw.locked_features?.[key] === "boolean") {
      locked[key] = raw.locked_features[key] as boolean;
    }
  }
  return {
    premium_locks: raw.premium_locks === true,
    purchase_enabled: raw.purchase_enabled === true,
    locked_features: locked,
  };
}

function normalizeContent(content: PremiumContent): PremiumContent {
  const oneYear = "One-year exam tracking";
  const benefits: string[] = [];
  for (const benefit of content.benefits) {
    if (benefit === "Support independent, ad-free development") continue;
    if (benefit === "Unlimited focus music and break content") {
      if (!benefits.includes(oneYear)) benefits.push(oneYear);
      continue;
    }
    if (!benefits.includes(benefit)) benefits.push(benefit);
  }
  if (!benefits.includes(oneYear)) benefits.push(oneYear);

  const comparison = content.comparison
    .filter((row) => row.feature !== "Break content")
    .map((row) => {
      if (row.feature === "Stats history")
        return { ...row, free: "Limited", premium: "Full access" };
      if (row.feature === "Friends")
        return { ...row, free: "Locked", premium: "Open" };
      return row;
    });
  if (!comparison.some((row) => row.feature === "Friends")) {
    comparison.push({ feature: "Friends", free: "Locked", premium: "Open" });
  }

  return { ...content, benefits, comparison };
}

function mergeContent(value: unknown): PremiumContent {
  if (!value || typeof value !== "object")
    return DEFAULT_PREMIUM_CONFIG.content;
  const raw = value as Partial<PremiumContent>;
  const products = raw.products ?? DEFAULT_PREMIUM_CONFIG.content.products;
  return normalizeContent({
    ...DEFAULT_PREMIUM_CONFIG.content,
    ...raw,
    benefits: Array.isArray(raw.benefits)
      ? raw.benefits
      : DEFAULT_PREMIUM_CONFIG.content.benefits,
    comparison: Array.isArray(raw.comparison)
      ? raw.comparison
      : DEFAULT_PREMIUM_CONFIG.content.comparison,
    preview: Array.isArray(raw.preview)
      ? raw.preview
      : DEFAULT_PREMIUM_CONFIG.content.preview,
    faq: Array.isArray(raw.faq) ? raw.faq : DEFAULT_PREMIUM_CONFIG.content.faq,
    products: {
      monthly:
        products.monthly ?? DEFAULT_PREMIUM_CONFIG.content.products.monthly,
      yearly: products.yearly ?? DEFAULT_PREMIUM_CONFIG.content.products.yearly,
    },
    legal: {
      ...DEFAULT_PREMIUM_CONFIG.content.legal,
      ...(raw.legal ?? {}),
    },
  });
}

function readCache(): PremiumConfig | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedConfig;
    if (!parsed || Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return {
      ...parsed.value,
      content: normalizeContent(parsed.value.content),
    };
  } catch {
    return null;
  }
}

function writeCache(value: PremiumConfig) {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ at: Date.now(), value }),
    );
  } catch {
    /* private mode */
  }
}

interface PremiumConfigContextValue {
  config: PremiumConfig;
  loading: boolean;
  refresh: () => Promise<void>;
}

const PremiumConfigContext = createContext<PremiumConfigContextValue | null>(
  null,
);

export function PremiumConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PremiumConfig>(
    () => readCache() ?? DEFAULT_PREMIUM_CONFIG,
  );
  const [loading, setLoading] = useState(true);
  const inFlight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (inFlight.current) return inFlight.current;
    const task = (async () => {
      try {
        const { data, error } = await supabase
          .from("app_config")
          .select("key, value")
          .in("key", ["premium_flags", "premium_content"]);
        if (error) throw error;
        const rows = new Map((data ?? []).map((row) => [row.key, row.value]));
        const next: PremiumConfig = {
          flags: rows.has("premium_flags")
            ? mergeFlags(rows.get("premium_flags"))
            : DEFAULT_PREMIUM_FLAGS,
          content: rows.has("premium_content")
            ? mergeContent(rows.get("premium_content"))
            : DEFAULT_PREMIUM_CONFIG.content,
        };
        setConfig(next);
        writeCache(next);
      } catch {
        // Fail open: no locks, no purchase CTA.
        setConfig((prev) => ({
          flags: DEFAULT_PREMIUM_FLAGS,
          content: prev.content,
        }));
      } finally {
        setLoading(false);
        inFlight.current = null;
      }
    })();
    inFlight.current = task;
    return task;
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, REFRESH_MS);
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ config, loading, refresh }),
    [config, loading, refresh],
  );
  return (
    <PremiumConfigContext.Provider value={value}>
      {children}
    </PremiumConfigContext.Provider>
  );
}

export function usePremiumConfig(): PremiumConfigContextValue {
  return (
    useContext(PremiumConfigContext) ?? {
      config: DEFAULT_PREMIUM_CONFIG,
      loading: false,
      refresh: async () => undefined,
    }
  );
}
