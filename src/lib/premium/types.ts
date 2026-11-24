export type FeatureId =
  | "jar"
  | "solar_system"
  | "particle_painting"
  | "study_table"
  | "garden"
  | "stats_history_90"
  | "share_report"
  | "unlimited_friends"
  | "focus_music"
  | "break_content";

export interface PremiumFlags {
  premium_locks: boolean;
  purchase_enabled: boolean;
  locked_features: Record<FeatureId, boolean>;
}

export interface PremiumProduct {
  id: string;
  price_label: string | null;
  amount_minor: number | null;
  currency: string | null;
}

export interface PremiumPreviewItem {
  label: string;
  image: string;
  tier: "free" | "premium";
}

export interface PremiumComparisonRow {
  feature: string;
  free: string;
  premium: string;
}

export interface PremiumFaqItem {
  q: string;
  a: string;
}

export interface PremiumContent {
  headline: string;
  subline: string;
  benefits: string[];
  comparison: PremiumComparisonRow[];
  preview: PremiumPreviewItem[];
  products: {
    monthly: PremiumProduct;
    yearly: PremiumProduct;
  };
  faq: PremiumFaqItem[];
  disclosure: string;
  legal: {
    privacy: string;
    terms: string;
    refund: string;
    delete_account: string;
  };
}

export interface PremiumConfig {
  flags: PremiumFlags;
  content: PremiumContent;
}
