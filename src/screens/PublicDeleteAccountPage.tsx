import { useState } from "react";
import { ArrowLeft, Check, Mail, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function PublicDeleteAccountPage() {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "request-account-deletion",
        {
          body: {
            email: email.trim().toLowerCase(),
            reason: reason.trim() || null,
          },
        },
      );
      if (fnError) throw fnError;
      if (!data?.ok) throw new Error(data?.error ?? "Could not submit request");
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not submit request. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#090b0a] px-4 py-8 text-stone-100 sm:px-6">
      <div className="mx-auto max-w-lg">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-stone-500 hover:text-stone-200"
        >
          <ArrowLeft className="h-4 w-4" /> Valuable
        </a>

        <div className="mt-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-300/20 bg-rose-300/[.06] text-rose-200/80">
            <Shield className="h-7 w-7" />
          </div>
          <div className="page-kicker mt-5">Account deletion</div>
          <h1 className="mt-2 font-display text-3xl font-extrabold">
            Request deletion
          </h1>
          <p className="mt-3 text-sm leading-6 text-stone-500">
            Logged out? Submit the email linked to your Valuable account. We
            will verify ownership and process the deletion request. Deleting
            removes your profile, focus history, Compete goals, friendships,
            presence and dream images.
          </p>
        </div>

        {sent ? (
          <div className="mt-8 rounded-2xl border border-lime-300/20 bg-lime-300/[.06] p-5 text-center">
            <Check className="mx-auto h-6 w-6 text-lime-300" />
            <h2 className="mt-3 text-sm font-bold text-lime-100">
              Request received
            </h2>
            <p className="mt-2 text-xs leading-5 text-stone-400">
              We&apos;ll verify the email and process the deletion. Do not
              create a new account with this email until it is complete.
            </p>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="mt-8 rounded-2xl border border-white/[.07] bg-white/[.025] p-5"
          >
            <label className="text-[10px] font-bold uppercase tracking-[.16em] text-stone-500">
              Account email
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3">
              <Mail className="h-4 w-4 text-stone-600" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="min-w-0 flex-1 bg-transparent py-3 text-sm text-stone-100 outline-none placeholder:text-stone-600"
              />
            </div>
            <label className="mt-4 block text-[10px] font-bold uppercase tracking-[.16em] text-stone-500">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-stone-100 outline-none placeholder:text-stone-600 focus:border-[#f6e3ba]/40"
              placeholder="Anything you want us to know"
            />
            {error && <p className="mt-3 text-xs text-rose-200">{error}</p>}
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="mt-4 w-full rounded-xl border border-rose-300/25 bg-rose-300/[.08] px-4 py-3 text-xs font-extrabold uppercase tracking-[.14em] text-rose-200 transition hover:bg-rose-300/[.12] disabled:opacity-40"
            >
              {busy ? "Submitting…" : "Submit deletion request"}
            </button>
            <p className="mt-3 text-center text-[10px] leading-5 text-stone-600">
              Signed in? Use Settings → Delete account for immediate deletion.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
