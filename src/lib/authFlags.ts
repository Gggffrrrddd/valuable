import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/**
 * Remote switch for the Google button. Failure or a missing row hides it
 * without affecting the email/password flow.
 */
export function useAuthGoogleEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("app_config")
          .select("value")
          .eq("key", "auth_google_enabled")
          .maybeSingle();
        if (cancelled) return;
        setEnabled(!error && data?.value === true);
      } catch {
        if (!cancelled) setEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return enabled;
}
