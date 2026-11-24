import { useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  LogOut,
  Shield,
  Trash2,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import SettingsSubjects from "@/components/SettingsSubjects";

interface SettingsScreenProps {
  onBack: () => void;
}

const LEGAL = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Refund Policy", href: "/refund" },
];

export default function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { profile, signOut } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    if (typed.trim().toUpperCase() !== "DELETE") return;
    setDeleting(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "delete-account",
        {
          body: { confirm: "DELETE" },
        },
      );
      if (fnError) throw fnError;
      if (!data?.ok) throw new Error(data?.error ?? "Could not delete account");
      await signOut();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not delete account. Please try again.",
      );
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-[#090b0a] px-4 pb-28 pt-5 text-stone-100 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-stone-500 transition hover:text-stone-200"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="mt-7">
          <div className="page-kicker">Account</div>
          <h1 className="page-title mt-1">Settings</h1>
          <p className="page-copy mt-2">
            Your account, legal information and data controls.
          </p>
        </div>

        <section className="mt-7 rounded-[1.5rem] border border-white/[.07] bg-white/[.025] p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-300/10 text-lime-300">
              <UserRound className="h-5 w-5" />
            </span>
            <div>
              <div className="text-sm font-bold text-stone-200">
                {profile?.display_name ?? "Student"}
              </div>
              <div className="text-[11px] text-stone-600">
                Signed in account
              </div>
            </div>
          </div>
        </section>

        <SettingsSubjects />

        <section className="mt-4 rounded-[1.5rem] border border-white/[.07] bg-white/[.025] p-2">
          {LEGAL.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-stone-300 transition hover:bg-white/[.04]"
            >
              <span className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-stone-600" />
                {item.label}
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-stone-600" />
            </a>
          ))}
        </section>

        <section className="mt-4 rounded-[1.5rem] border border-white/[.07] bg-white/[.025] p-2">
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-stone-300 transition hover:bg-white/[.04]"
          >
            <LogOut className="h-4 w-4 text-stone-600" /> Sign out
          </button>
        </section>

        <section className="mt-4 rounded-[1.5rem] border border-rose-300/15 bg-rose-300/[.035] p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-300/10 text-rose-200/80">
              <Shield className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-rose-100/90">
                Delete account
              </h2>
              <p className="mt-1 text-xs leading-5 text-stone-500">
                Permanently removes your auth account, profile, focus sessions,
                goals, tracker history, friendships, presence and dream images.
                This cannot be undone.
              </p>
              {!confirming ? (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-300/25 bg-rose-300/[.06] px-3 py-2 text-xs font-bold text-rose-200 transition hover:bg-rose-300/10"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete my account
                </button>
              ) : (
                <div className="mt-3 rounded-xl border border-rose-300/20 bg-black/20 p-3">
                  <label className="text-[10px] font-bold uppercase tracking-[.14em] text-stone-500">
                    Type DELETE to confirm
                  </label>
                  <input
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoComplete="off"
                    className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-stone-100 outline-none focus:border-rose-300/40"
                    placeholder="DELETE"
                  />
                  {error && (
                    <p className="mt-2 text-xs text-rose-200">{error}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void deleteAccount()}
                      disabled={
                        typed.trim().toUpperCase() !== "DELETE" || deleting
                      }
                      className="rounded-lg bg-rose-300 px-3 py-2 text-xs font-extrabold text-[#1a0d10] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {deleting ? "Deleting…" : "Delete permanently"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirming(false);
                        setTyped("");
                        setError(null);
                      }}
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-stone-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
