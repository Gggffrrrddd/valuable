import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Crown,
  Lock,
  Sparkles,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { billing } from "@/lib/billing";
import { usePremiumConfig } from "@/lib/premium/PremiumConfigProvider";
import { useEntitlement } from "@/lib/premium/useEntitlement";
import type { BillingPeriod } from "@/lib/billing";

interface PremiumScreenProps {
  onBack: () => void;
}

type PurchaseState = "idle" | "processing" | "success" | "cancelled" | "error";

function priceText(label: string | null): string {
  return label?.trim() || "Pricing coming soon";
}

function periodLabel(period: BillingPeriod): string {
  return period === "yearly" ? "Year" : "Month";
}

export default function PremiumScreen({ onBack }: PremiumScreenProps) {
  const { profile, refreshProfile } = useAuth();
  const { config } = usePremiumConfig();
  const entitlement = useEntitlement();
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [purchaseState, setPurchaseState] = useState<PurchaseState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const content = config.content;
  const product = content.products[period];
  const purchaseEnabled = config.flags.purchase_enabled;
  const showPremiumMarks = config.flags.premium_locks && !entitlement.isPremium;
  const savings = useMemo(() => {
    const m = content.products.monthly.amount_minor;
    const y = content.products.yearly.amount_minor;
    if (!m || !y || m <= 0 || y <= 0) return null;
    return Math.max(0, Math.round((1 - y / (m * 12)) * 100));
  }, [content.products]);

  async function handlePurchase() {
    if (!purchaseEnabled) return;
    setPurchaseState("processing");
    setMessage(null);
    const result = await billing.purchase(period);
    if (result.status === "success") {
      setPurchaseState("success");
      await refreshProfile();
    } else if (result.status === "cancelled") {
      setPurchaseState("cancelled");
    } else {
      setPurchaseState("error");
      setMessage(result.message ?? "Purchase could not be completed.");
    }
  }

  async function handleRestore() {
    setMessage(null);
    const result = await billing.restore();
    if (result.active) {
      await refreshProfile();
      setPurchaseState("success");
      setMessage("Your Premium access has been restored.");
    } else if (!billing.available) {
      setMessage("Restore purchases is available in the Android app.");
    } else {
      setMessage("No active Premium purchase was found on this account.");
    }
  }

  if (entitlement.isPremium) {
    const until = entitlement.premiumUntil
      ? new Date(entitlement.premiumUntil).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "Lifetime access";
    return (
      <div className="min-h-screen overflow-y-auto bg-[#090b0a] px-5 py-8 text-stone-100">
        <div className="mx-auto max-w-lg text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.4rem] border border-lime-300/25 bg-lime-300/10 text-lime-300">
            <Crown className="h-8 w-8" />
          </div>
          <div className="page-kicker mt-6">Premium active</div>
          <h1 className="mt-2 font-display text-3xl font-extrabold">
            You&apos;re all in.
          </h1>
          <p className="mt-3 text-sm text-stone-500">
            {profile?.display_name ? `${profile.display_name}, your` : "Your"}{" "}
            Premium access is active until {until}.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-8 w-full rounded-2xl bg-[#f6e3ba] px-5 py-3.5 text-sm font-extrabold text-[#11130f] transition hover:bg-[#fff0d6]"
          >
            Back to focus
          </button>
        </div>
      </div>
    );
  }

  if (purchaseState === "success") {
    return (
      <div className="min-h-screen overflow-y-auto bg-[#090b0a] px-5 py-8 text-stone-100">
        <div className="mx-auto max-w-lg text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.4rem] border border-lime-300/25 bg-lime-300/10 text-lime-300">
            <Check className="h-8 w-8" />
          </div>
          <div className="page-kicker mt-6">Welcome in</div>
          <h1 className="mt-2 font-display text-3xl font-extrabold">
            Premium is active.
          </h1>
          <p className="mt-3 text-sm text-stone-500">
            {message ?? "Everything is unlocked on this account."}
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-8 w-full rounded-2xl bg-[#f6e3ba] px-5 py-3.5 text-sm font-extrabold text-[#11130f] transition hover:bg-[#fff0d6]"
          >
            Start focusing
          </button>
        </div>
      </div>
    );
  }

  if (purchaseState === "cancelled" || purchaseState === "error") {
    const isError = purchaseState === "error";
    return (
      <div className="min-h-screen overflow-y-auto bg-[#090b0a] px-5 py-8 text-stone-100">
        <div className="mx-auto max-w-lg text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.4rem] border border-[#f6e3ba]/20 bg-[#f6e3ba]/[.06] text-[#f6e3ba]">
            {isError ? <Lock className="h-7 w-7" /> : <X className="h-7 w-7" />}
          </div>
          <div className="page-kicker mt-6">
            {isError ? "Something went wrong" : "No charge made"}
          </div>
          <h1 className="mt-2 font-display text-3xl font-extrabold">
            {isError ? "Purchase didn't complete." : "Purchase cancelled."}
          </h1>
          <p className="mt-3 text-sm text-stone-500">
            {message ??
              (isError
                ? "Please try again in a moment."
                : "You can come back anytime. Everything you have is still here.")}
          </p>
          <div className="mt-8 grid gap-2">
            <button
              type="button"
              onClick={() => {
                setPurchaseState("idle");
                setMessage(null);
              }}
              className="w-full rounded-2xl bg-[#f6e3ba] px-5 py-3.5 text-sm font-extrabold text-[#11130f] transition hover:bg-[#fff0d6]"
            >
              {isError ? "Try again" : "Back to Premium"}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="w-full rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-stone-400"
            >
              Back to focus
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-[#090b0a] text-stone-100">
      <div className="mx-auto max-w-6xl px-4 pb-28 pt-4 sm:px-6 sm:pt-6 lg:px-10 lg:pb-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-stone-600">
            <Sparkles className="h-4 w-4 text-[#f6e3ba]" /> Valuable Premium
          </div>
          <button
            type="button"
            onClick={onBack}
            aria-label="Close premium"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[.03] text-stone-400 transition hover:border-[#f6e3ba]/40 hover:text-[#f6e3ba]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mt-8 overflow-hidden rounded-[2rem] border border-[#f6e3ba]/15 bg-[radial-gradient(circle_at_20%_0%,rgba(246,227,186,.13),transparent_38%),#11130f] p-6 sm:p-10 lg:p-12">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-lime-300/[.06] blur-3xl" />
          <div className="relative lg:grid lg:grid-cols-[1.1fr_.9fr] lg:items-end lg:gap-12">
            <div>
              <div className="page-kicker">The complete practice</div>
              <h1 className="mt-2 max-w-2xl font-display text-4xl font-extrabold leading-[1.02] tracking-[-.04em] sm:text-6xl">
                {content.headline}
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-stone-400 sm:text-base">
                {content.subline}
              </p>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3 lg:mt-0">
              <div className="rounded-2xl border border-white/[.07] bg-black/20 p-3">
                <div className="text-[10px] font-bold uppercase tracking-[.16em] text-stone-600">
                  Focus
                </div>
                <div className="mt-2 font-display text-2xl font-extrabold text-lime-300">
                  No ads
                </div>
              </div>
              <div className="rounded-2xl border border-white/[.07] bg-black/20 p-3">
                <div className="text-[10px] font-bold uppercase tracking-[.16em] text-stone-600">
                  Your data
                </div>
                <div className="mt-2 font-display text-2xl font-extrabold text-[#f6e3ba]">
                  Yours
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="mt-5 rounded-[1.6rem] border border-white/[.07] bg-white/[.025] p-4 sm:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="page-kicker">A look inside</div>
              <h2 className="mt-1 font-display text-lg font-extrabold">
                Built for attention.
              </h2>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[.16em] text-stone-600">
              {showPremiumMarks ? "Free · Premium" : "All free"}
            </span>
          </div>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
            {content.preview.map((item) => {
              const premiumOnly = showPremiumMarks && item.tier === "premium";
              return (
                <div
                  key={`${item.label}-${item.image}`}
                  className="relative w-36 shrink-0 overflow-hidden rounded-2xl border border-white/[.07] bg-black/30 sm:w-44"
                >
                  <div className="h-24 overflow-hidden bg-black/40 sm:h-28">
                    <img
                      src={item.image}
                      alt={item.label}
                      className="h-full w-full object-contain p-2"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                    <span className="truncate text-[10px] font-bold text-stone-300">
                      {item.label}
                    </span>
                    {premiumOnly ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#f6e3ba]/10 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-[#f6e3ba]">
                        <Lock className="h-2.5 w-2.5" /> Premium
                      </span>
                    ) : (
                      <span className="rounded-full bg-lime-300/10 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-lime-300">
                        Free
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_.9fr]">
          <section className="rounded-[1.6rem] border border-white/[.07] bg-white/[.025] p-5 sm:p-6">
            <div className="page-kicker">Why premium</div>
            <ul className="mt-4 space-y-3">
              {content.benefits.map((benefit) => (
                <li
                  key={benefit}
                  className="flex items-start gap-3 text-sm leading-5 text-stone-300"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime-300/10 text-lime-300">
                    <Check className="h-3 w-3" />
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-[1.6rem] border border-[#f6e3ba]/15 bg-[#f6e3ba]/[.04] p-5 sm:p-6">
            <div className="page-kicker">Free vs Premium</div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[360px] text-left text-xs">
                <thead>
                  <tr className="text-[9px] uppercase tracking-[.16em] text-stone-600">
                    <th className="pb-2 font-bold">Feature</th>
                    <th className="pb-2 font-bold">Free</th>
                    <th className="pb-2 font-bold text-[#f6e3ba]">Premium</th>
                  </tr>
                </thead>
                <tbody>
                  {content.comparison.map((row) => (
                    <tr
                      key={row.feature}
                      className="border-t border-white/[.06]"
                    >
                      <td className="py-2.5 pr-2 font-semibold text-stone-300">
                        {row.feature}
                      </td>
                      <td className="py-2.5 pr-2 text-stone-600">{row.free}</td>
                      <td className="py-2.5 font-semibold text-[#f6e3ba]">
                        {row.premium}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section className="mt-5 rounded-[1.6rem] border border-white/[.07] bg-white/[.025] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="page-kicker">Choose your pace</div>
              <h2 className="mt-1 font-display text-xl font-extrabold">
                One subscription. Full access.
              </h2>
            </div>
            <div className="inline-flex rounded-xl border border-white/10 bg-black/30 p-1">
              {(["monthly", "yearly"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`rounded-lg px-4 py-2 text-[10px] font-extrabold uppercase tracking-[.14em] transition ${period === p ? "bg-[#f6e3ba] text-[#11130f]" : "text-stone-500 hover:text-stone-300"}`}
                >
                  {periodLabel(p)}
                  {p === "yearly" && savings !== null && (
                    <span className="ml-1.5 rounded-full bg-lime-300/15 px-1.5 py-0.5 text-[8px] text-lime-300">
                      Save {savings}%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/[.07] bg-black/20 p-4">
            <div className="text-[10px] font-bold uppercase tracking-[.18em] text-stone-600">
              {periodLabel(period)}ly plan
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <span className="font-display text-3xl font-extrabold text-stone-50">
                {priceText(product.price_label)}
              </span>
              {product.price_label && (
                <span className="text-xs text-stone-500">/ {period}</span>
              )}
            </div>
            {savings !== null && period === "yearly" && (
              <div className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-lime-300">
                Best value · save {savings}%
              </div>
            )}
          </div>

          {message && (
            <div className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[.06] px-3 py-2 text-xs text-rose-200">
              {message}
            </div>
          )}

          <button
            type="button"
            onClick={handlePurchase}
            disabled={!purchaseEnabled || purchaseState === "processing"}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f6e3ba] px-5 py-4 text-sm font-extrabold text-[#11130f] transition hover:bg-[#fff0d6] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-stone-500"
          >
            {purchaseState === "processing" ? (
              "Starting purchase…"
            ) : purchaseEnabled ? (
              <>
                Continue with {periodLabel(period)}ly{" "}
                <ArrowRight className="h-4 w-4" />
              </>
            ) : (
              "Coming soon — everything is free right now"
            )}
          </button>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] text-stone-600">
            <button
              type="button"
              onClick={handleRestore}
              className="hover:text-stone-300"
            >
              Restore purchases
            </button>
            <a href={content.legal.terms} className="hover:text-stone-300">
              Terms
            </a>
            <a href={content.legal.privacy} className="hover:text-stone-300">
              Privacy
            </a>
            <a href={content.legal.refund} className="hover:text-stone-300">
              Refunds
            </a>
          </div>
          <p className="mt-4 text-center text-[10px] leading-5 text-stone-600">
            {content.disclosure}
          </p>
        </section>

        <section className="mt-5 rounded-[1.6rem] border border-white/[.07] bg-white/[.025] p-5 sm:p-6">
          <div className="page-kicker">Questions</div>
          <div className="mt-3 divide-y divide-white/[.06]">
            {content.faq.map((item, index) => (
              <div key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="flex w-full items-center justify-between gap-4 py-3 text-left text-sm font-semibold text-stone-300"
                >
                  {item.q}
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition ${openFaq === index ? "rotate-180" : ""}`}
                  />
                </button>
                {openFaq === index && (
                  <p className="pb-3 text-xs leading-5 text-stone-500">
                    {item.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <p className="mt-5 text-center text-[10px] leading-5 text-stone-600">
          Purchases are processed by Google Play. Valuable never stores card
          details.
        </p>
      </div>
    </div>
  );
}
