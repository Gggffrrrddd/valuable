export const EMAIL_SEND_FALLBACK =
  "Email option is temporarily unavailable. Please continue with Google or try again later.";

type AuthErrorLike = {
  code?: string | null;
  message?: string | null;
  status?: number | null;
  name?: string | null;
};

/**
 * Only email-sending/rate-limit/network failures should show the fallback.
 * Invalid credentials, wrong codes, weak passwords, etc. stay untouched.
 */
export function isEmailSendError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === "string") return matches(error);
  const e = error as AuthErrorLike;
  const haystack = [e.code, e.name, e.message, e.status?.toString()]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (e.status === 429) return true;
  if (e.name === "AuthRetryableFetchError") return true;
  return matches(haystack);
}

function matches(value: string): boolean {
  const text = value.toLowerCase();
  return (
    text.includes("over_email_send_rate_limit") ||
    text.includes("over_request_rate_limit") ||
    text.includes("email rate limit") ||
    text.includes("rate limit exceeded") ||
    text.includes("error sending confirmation email") ||
    text.includes("error sending recovery email") ||
    text.includes("error sending email") ||
    text.includes("failed to send email") ||
    text.includes("unexpected_failure") ||
    text.includes("failed to fetch") ||
    text.includes("network error") ||
    text.includes("network request failed") ||
    text.includes("temporarily unavailable")
  );
}
