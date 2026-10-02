/**
 * Temporary owner-only access gate for the whole app.
 * To remove the restriction later, set RESTRICTION_ENABLED to false —
 * every check (sign-up, sign-in, active sessions, banners) reads from here.
 */
export const RESTRICTION_ENABLED = true;

/** Only this display name (case/space-insensitive) may use the app. */
export const ALLOWED_USERNAME = 'Naman';

export const RESTRICTION_MESSAGE =
  'The owner has restricted everyone from use of this app';

export function isAllowedUser(displayName: string | null | undefined): boolean {
  if (!RESTRICTION_ENABLED) return true;
  return (displayName ?? '').trim().toLowerCase() === ALLOWED_USERNAME.trim().toLowerCase();
}
