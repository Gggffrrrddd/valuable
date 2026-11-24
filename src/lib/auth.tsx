import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { continueWithGoogle as startGoogleOAuth } from "./googleAuth";
import type { AvatarCharacter, Profile } from "../types";

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  continueWithGoogle: () => Promise<AuthResult>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  verifyEmailCode: (email: string, token: string) => Promise<AuthResult>;
  resendVerification: (email: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateAvatarCharacter: (
    character: AvatarCharacter,
  ) => Promise<{ error: string | null }>;
}

interface AuthResult {
  error: string | null;
  /** True when Supabase sent a code and the user must verify before signing in. */
  needsVerification?: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Remove OAuth code/hash after a successful redirect without touching app state. */
function cleanAuthUrl() {
  try {
    const url = new URL(window.location.href);
    const hasAuthCode =
      url.searchParams.has("code") ||
      url.searchParams.has("error") ||
      /access_token=|refresh_token=|error_description=/.test(url.hash);
    if (!hasAuthCode) return;
    window.history.replaceState({}, document.title, url.origin + url.pathname);
  } catch {
    /* history unavailable */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUserIdRef = useRef<string | null>(null);

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.error("Profile load error:", error.message);
      return null;
    }
    setProfile(data as Profile | null);
    return data as Profile | null;
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      currentUserIdRef.current = data.session?.user?.id ?? null;
      if (data.session) {
        cleanAuthUrl();
        loadProfile(data.session.user.id).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (!mounted) return;
      if (event === "TOKEN_REFRESHED") {
        setSession(sess);
        return;
      }
      if (
        event !== "INITIAL_SESSION" &&
        event !== "SIGNED_IN" &&
        event !== "SIGNED_OUT"
      ) {
        setSession(sess);
        return;
      }
      if (event === "SIGNED_IN" && sess) {
        cleanAuthUrl();
        const incomingUserId = sess.user?.id ?? null;
        if (
          currentUserIdRef.current &&
          currentUserIdRef.current === incomingUserId
        ) {
          setSession(sess);
          return;
        }
        currentUserIdRef.current = incomingUserId;
        setSession(sess);
        setLoading(true);
        (async () => {
          await loadProfile(sess.user.id);
          if (mounted) setLoading(false);
        })();
        return;
      }
      if (event === "INITIAL_SESSION" && sess) {
        currentUserIdRef.current = sess.user?.id ?? null;
      }
      if (event === "SIGNED_OUT") {
        currentUserIdRef.current = null;
      }
      setSession(sess);
      if (sess) {
        setLoading(true);
        (async () => {
          await loadProfile(sess.user.id);
          if (mounted) setLoading(false);
        })();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Keep server-owned entitlement fields reasonably fresh after webhook updates.
  useEffect(() => {
    if (!session) return;
    const id = window.setInterval(() => {
      if (!document.hidden) void loadProfile(session.user.id);
    }, 60_000);
    const onVisible = () => {
      if (!document.hidden) void loadProfile(session.user.id);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  async function continueWithGoogle(): Promise<AuthResult> {
    const result = await startGoogleOAuth();
    return { error: result.error };
  }

  async function signUp(
    email: string,
    password: string,
    displayName: string,
  ): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) return { error: error.message };
    // Supabase returns an empty identities array when the email already exists.
    if (
      data.user &&
      Array.isArray(data.user.identities) &&
      data.user.identities.length === 0
    ) {
      return {
        error: "An account with this email already exists. Sign in instead.",
      };
    }
    if (data.session) {
      if (data.user) await loadProfile(data.user.id);
      return { error: null, needsVerification: false };
    }
    // Email confirmation is on: no session until the code is verified.
    return { error: null, needsVerification: true };
  }

  async function signIn(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("email not confirmed")) {
        return {
          error:
            "Your email is not verified yet. Enter the code we sent to your inbox.",
          needsVerification: true,
        };
      }
      if (message.includes("invalid login credentials")) {
        return { error: "Email or password is incorrect." };
      }
      return { error: error.message };
    }
    if (data.user) await loadProfile(data.user.id);
    return { error: null };
  }

  async function verifyEmailCode(
    email: string,
    token: string,
  ): Promise<AuthResult> {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: token.trim(),
      type: "signup",
    });
    if (error) return { error: error.message };
    if (data.session?.user) await loadProfile(data.session.user.id);
    return { error: null };
  }

  async function resendVerification(email: string): Promise<AuthResult> {
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) return { error: error.message };
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  async function refreshProfile() {
    if (session) await loadProfile(session.user.id);
  }

  async function updateAvatarCharacter(character: AvatarCharacter) {
    if (!session) return { error: "Not signed in" };
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_character: character, character_chosen: true })
      .eq("id", session.user.id);
    if (error) return { error: error.message };
    await loadProfile(session.user.id);
    return { error: null };
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        continueWithGoogle,
        signUp,
        signIn,
        verifyEmailCode,
        resendVerification,
        signOut,
        refreshProfile,
        updateAvatarCharacter,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Context and hook stay together to keep the authentication API self-contained.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
