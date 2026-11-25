import type { FeatureId, PremiumFlags } from "./types";

export const FEATURE_LABELS: Record<FeatureId, string> = {
  jar: "Water Jar visual",
  solar_system: "Solar System visual",
  particle_painting: "Particle Painting visual",
  study_table: "Study table",
  garden: "Starlight Butterfly visual",
  stats_history_90: "90-day stats history",
  share_report: "Shareable reports",
  unlimited_friends: "Friends circle",
  focus_music: "Focus music",
  break_content: "Full break library",
};

export function isFeatureLocked(
  feature: FeatureId,
  flags: PremiumFlags,
  isPremium: boolean,
): boolean {
  if (!flags.premium_locks || isPremium) return false;
  return flags.locked_features[feature] === true;
}

export function visualFeature(id: string): FeatureId | null {
  if (id === "jar") return "jar";
  if (id === "solar-system") return "solar_system";
  if (id === "blade") return "particle_painting";
  if (id === "butterfly") return "garden";
  return null;
}
