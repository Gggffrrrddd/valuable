import { supabase } from "./supabase";

/**
 * Single place for Google OAuth. Web uses Supabase's hosted OAuth flow; a
 * future Capacitor build can swap the implementation here without changing
 * the auth screen or AuthProvider.
 */
export async function continueWithGoogle(): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) return { error: error.message };
    // Success navigates away to Google; the redirect completes on return.
    return { error: null };
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "Google sign-in could not start. Please try again.",
    };
  }
}
