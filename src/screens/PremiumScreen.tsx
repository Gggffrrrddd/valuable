import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Check, Crown, Lock, Sparkles } from 'lucide-react';

interface PremiumScreenProps {
  onBack: () => void;
}

const PREMIUM_PRICE = 4900;

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface PaymentResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  [key: string]: unknown;
  handler: (response: PaymentResponse) => Promise<void>;
}

interface RazorpayInstance {
  on: (event: string, handler: () => void) => void;
  open: () => void;
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.body.appendChild(script);
  });
}

export default function PremiumScreen({ onBack }: PremiumScreenProps) {
  const { profile, session, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPremium = !!(profile?.is_premium && profile.premium_expires_at && new Date(profile.premium_expires_at) > new Date());

  async function handlePay() {
    if (!session) return;
    setError(null);
    setLoading(true);
    try {
      await loadRazorpayScript();

      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/razorpay/create-order`;
      const orderRes = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: PREMIUM_PRICE }),
      });
      if (!orderRes.ok) throw new Error('Could not start payment');
      const order = await orderRes.json();
      if (order.error) throw new Error(order.error);

      if (!window.Razorpay) throw new Error('Payment service is unavailable');
      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: 'Valuable Premium',
        description: '1 month of premium focus',
        method: {
          upi: true,
          card: false,
          netbanking: false,
          wallet: false,
        },
        config: {
          display: {
            blocks: {
              upi: {
                name: 'Pay via UPI',
                instruments: [{ method: 'upi' }],
              },
            },
            sequence: ['block.upi'],
            preferences: { show_default_blocks: false },
          },
        },
        handler: async (response: PaymentResponse) => {
          try {
            const verifyRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/razorpay/verify-payment`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            if (!verifyRes.ok) throw new Error('Verification failed');
            const result = await verifyRes.json();
            if (result.success) {
              await refreshProfile();
            } else {
              setError('Payment verification failed. Please contact support.');
            }
          } catch {
            setError('Payment verification failed. Please contact support.');
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
        theme: { color: '#D4AF7F' },
      });

      rzp.on('payment.failed', () => {
        setError('Payment failed. Please try again.');
        setLoading(false);
      });

      rzp.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed');
      setLoading(false);
    }
  }

  if (isPremium) {
    const expiry = new Date(profile!.premium_expires_at!);
    return (
      <div className="px-5 py-6 animate-fade-in">
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 mb-4">
            <Crown className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">You're Premium</h2>
          <p className="text-slate-400 text-sm">
            Active until {expiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <button
            onClick={onBack}
            className="mt-8 px-6 py-3 rounded-xl bg-slate-800 text-white font-medium hover:bg-slate-700 transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap relative pb-24">
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-80 w-80 -translate-x-1/2 rounded-full bg-lime-300/[.07] blur-[100px]" />
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 mb-4">
          <Sparkles className="w-8 h-8 text-emerald-400" />
        </div>
        <div className="page-kicker">The complete practice</div>
        <h2 className="font-editorial text-4xl font-semibold text-white sm:text-5xl">Invest in your <span className="gold-text italic">attention</span>.</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">Deeper insights, unlimited break content, and every tool we build next.</p>
      </div>

      <div className="surface relative mx-auto mb-7 max-w-xl overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-lime-300/60 to-transparent" />
        <ul className="space-y-3">
          {[
            'Full content library — every category, all items',
            '30-day stats history with detailed charts',
            'Longest streak tracking',
            'No rotation limits on break content',
            'Support independent development',
          ].map((feat) => (
            <li key={feat} className="flex items-start gap-3">
              <div className="shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center mt-0.5">
                <Check className="w-3 h-3 text-emerald-400" />
              </div>
              <span className="text-slate-200 text-sm">{feat}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="text-center mb-6">
        <div className="font-display gold-text text-5xl font-extrabold">₹49<span className="text-base text-slate-400 font-normal"> / month</span></div>
        <p className="text-xs text-slate-500 mt-1">UPI only · Test mode — no real charge</p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      <button
        onClick={handlePay}
        disabled={loading}
        className="primary-button mx-auto flex w-full max-w-xl items-center justify-center gap-2 py-4"
      >
        <Lock className="w-4 h-4" />
        {loading ? 'Opening payment…' : 'Upgrade with UPI'}
      </button>

      <p className="text-center text-xs text-slate-500 mt-4">
        Currently in test mode. You'll see a test UPI ID in the checkout.
      </p>

      <button
        onClick={onBack}
        className="w-full mt-4 py-2.5 text-slate-400 text-sm hover:text-white transition-colors"
      >
        Maybe later
      </button>
    </div>
  );
}
