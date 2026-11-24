import type { FeatureId, PremiumConfig, PremiumFlags } from "./types";

export const ALL_FEATURES_UNLOCKED: Record<FeatureId, boolean> = {
  jar: false,
  solar_system: false,
  particle_painting: false,
  study_table: false,
  garden: false,
  stats_history_90: false,
  share_report: false,
  unlimited_friends: false,
  focus_music: false,
  break_content: false,
};

/** Safe defaults: no locks, no purchases, no paywall. */
export const DEFAULT_PREMIUM_FLAGS: PremiumFlags = {
  premium_locks: false,
  purchase_enabled: false,
  locked_features: ALL_FEATURES_UNLOCKED,
};

export const DEFAULT_PREMIUM_CONTENT: PremiumConfig["content"] = {
  headline: "Invest in your attention.",
  subline:
    "Every visual, insight and ritual — built to protect the hours that matter.",
  benefits: [
    "Every focus visual, including future releases",
    "90-day performance history and deeper trends",
    "Shareable reports for your streak and milestones",
    "Unlimited focus music and break content",
    "Support independent, ad-free development",
  ],
  comparison: [
    { feature: "Focus visuals", free: "Core visuals", premium: "Every visual" },
    { feature: "Stats history", free: "30 days", premium: "90 days" },
    { feature: "Share reports", free: "—", premium: "Included" },
    { feature: "Focus music", free: "Limited", premium: "Unlimited" },
    { feature: "Break content", free: "Rotating", premium: "Full library" },
  ],
  preview: [
    {
      label: "Hourglass",
      image: "/visuals/hourglass/hourglass-preview.png",
      tier: "free",
    },
    {
      label: "Growing Tree",
      image: "/visuals/tree/tree-preview.png",
      tier: "free",
    },
    {
      label: "Water Jar",
      image: "/visuals/jar/jar-preview.png",
      tier: "premium",
    },
    {
      label: "Particle Painting",
      image: "/visuals/blade/particle-painting-preview.png",
      tier: "premium",
    },
    {
      label: "Starlight Butterfly",
      image: "/visuals/butterfly/butterfly-preview.png",
      tier: "premium",
    },
    {
      label: "Solar System",
      image: "/visuals/solar-system/solar-preview.png",
      tier: "premium",
    },
  ],
  products: {
    monthly: {
      id: "valuable_premium_monthly",
      price_label: null,
      amount_minor: null,
      currency: null,
    },
    yearly: {
      id: "valuable_premium_yearly",
      price_label: null,
      amount_minor: null,
      currency: null,
    },
  },
  faq: [
    {
      q: "What happens when I subscribe?",
      a: "Premium unlocks the selected extras immediately and stays active while the subscription is valid.",
    },
    {
      q: "Can I cancel anytime?",
      a: "Yes. Cancel from Google Play Store → Subscriptions. Access continues until the paid period ends.",
    },
    {
      q: "How do I restore a purchase?",
      a: "Open Premium and tap Restore purchases. Use the same account that made the purchase.",
    },
    {
      q: "Is my study data private?",
      a: "Your focus data belongs to you. See the Privacy Policy for what is stored and how to delete your account.",
    },
  ],
  disclosure:
    "Subscriptions renew automatically unless cancelled at least 24 hours before the renewal date. Manage or cancel anytime in Google Play Store → Subscriptions. Prices are shown by the store for your country and currency.",
  legal: {
    privacy: "/privacy",
    terms: "/terms",
    refund: "/refund",
    delete_account: "/delete-account",
  },
};

export const DEFAULT_PREMIUM_CONFIG: PremiumConfig = {
  flags: DEFAULT_PREMIUM_FLAGS,
  content: DEFAULT_PREMIUM_CONTENT,
};
