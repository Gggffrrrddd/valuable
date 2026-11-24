export const OPEN_PREMIUM_EVENT = "valuable:open-premium";

/** Opens the premium screen from any nested component without prop drilling. */
export function openPremiumPage(context?: string) {
  window.dispatchEvent(
    new CustomEvent(OPEN_PREMIUM_EVENT, { detail: { context } }),
  );
}
