import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { ArrowRight, Check, Eye, EyeOff, MailCheck, RotateCw, Timer } from 'lucide-react';

type Mode = 'signin' | 'signup' | 'verify';

export default function AuthScreen() {
  const { signIn, signUp, verifyEmailCode, resendVerification } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    const result =
      mode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password, displayName);
    setSubmitting(false);

    if (result.error) {
      if (result.needsVerification) {
        setPendingEmail(email);
        setMode('verify');
        setCode('');
        setNotice(`Enter the 6-digit code sent to ${email}.`);
        return;
      }
      setError(result.error);
      return;
    }

    if (result.needsVerification) {
      setPendingEmail(email);
      setMode('verify');
      setCode('');
      setNotice(`We sent a 6-digit code to ${email}.`);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setSubmitting(true);
    const result = await verifyEmailCode(pendingEmail, code);
    setSubmitting(false);
    if (result.error) setError(result.error);
  }

  async function handleResend() {
    setResending(true);
    setError(null);
    setNotice(null);
    const result = await resendVerification(pendingEmail);
    setResending(false);
    if (result.error) setError(result.error);
    else setNotice('A new code is on its way. Check your inbox.');
  }

  function backToAuth() {
    setMode('signin');
    setCode('');
    setError(null);
    setNotice(null);
    setPendingEmail('');
  }

  return (
    <div className="min-h-screen bg-[#090b0a] p-3 sm:p-5">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-white/[.07] bg-[#11130f] shadow-2xl sm:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[1.1fr_.9fr]">
        <section className="relative hidden overflow-hidden border-r border-white/[.06] p-12 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(197,255,84,.18),transparent_34%),radial-gradient(circle_at_70%_85%,rgba(197,255,84,.08),transparent_35%)]" />
          <div className="absolute -right-20 top-1/3 h-80 w-80 rounded-full border border-lime-300/10" />
          <div className="absolute -right-5 top-[38%] h-56 w-56 rounded-full border border-lime-300/10" />
          <div className="relative flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-300 text-[#11130f]"><Timer className="h-5 w-5" /></div><span className="font-display text-xl font-extrabold">Valuable<span className="text-lime-300">.</span></span></div>
          <div className="relative max-w-lg">
            <div className="mb-5 inline-flex rounded-full border border-lime-300/20 bg-lime-300/[.07] px-3 py-1.5 text-xs font-bold uppercase tracking-[.18em] text-lime-300">Attention is your edge</div>
            <h1 className="text-6xl font-extrabold leading-[1.02]">Less noise.<br /><span className="text-stone-500">More meaningful work.</span></h1>
            <p className="mt-6 max-w-md text-base leading-7 text-stone-400">A calm place to focus deeply, measure consistency, and build a practice that lasts.</p>
          </div>
          <div className="relative flex gap-6 text-sm text-stone-500"><span className="flex items-center gap-2"><Check className="h-4 w-4 text-lime-300" /> No feeds</span><span className="flex items-center gap-2"><Check className="h-4 w-4 text-lime-300" /> No distractions</span></div>
        </section>
        <section className="flex items-center justify-center px-6 py-10 sm:px-12">
          <div className="w-full max-w-sm">
            <div className="mb-10 lg:hidden"><div className="mb-7 flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-300 text-[#11130f]"><Timer className="h-4 w-4" /></div><span className="font-display text-xl font-extrabold">Valuable<span className="text-lime-300">.</span></span></div></div>

            {mode === 'verify' ? (
              <div>
                <div className="mb-8">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-300/20 bg-lime-300/[.08] text-lime-300">
                    <MailCheck className="h-5 w-5" />
                  </div>
                  <div className="page-kicker">Verify your email</div>
                  <h2 className="text-3xl font-extrabold text-stone-50">Check your inbox.</h2>
                  <p className="mt-2 text-sm leading-6 text-stone-500">
                    We sent a 6-digit verification code to{' '}
                    <span className="font-bold text-stone-200">{pendingEmail}</span>. Enter it below to finish
                    creating your Valuable account.
                  </p>
                </div>

                <form onSubmit={handleVerify} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">Verification code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="premium-input text-center font-display text-3xl font-extrabold tracking-[.42em]"
                      autoFocus
                      required
                    />
                  </div>

                  {notice && (
                    <div className="rounded-xl border border-lime-300/20 bg-lime-300/[.07] px-4 py-3 text-sm text-lime-200">
                      {notice}
                    </div>
                  )}
                  {error && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || code.length !== 6}
                    className="primary-button flex w-full items-center justify-center gap-2 py-3.5 disabled:opacity-60"
                  >
                    {submitting ? 'Verifying...' : 'Verify & continue'}
                    {!submitting && <ArrowRight className="h-4 w-4" />}
                  </button>
                </form>

                <div className="mt-6 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    className="flex items-center gap-1.5 text-xs font-bold text-stone-500 transition hover:text-stone-200 disabled:opacity-50"
                  >
                    <RotateCw className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} />
                    {resending ? 'Sending...' : 'Resend code'}
                  </button>
                  <button
                    type="button"
                    onClick={backToAuth}
                    className="text-xs font-bold text-stone-600 underline decoration-stone-700 underline-offset-4 transition hover:text-stone-300"
                  >
                    Use another email
                  </button>
                </div>

                <p className="mt-8 text-center text-xs leading-5 text-stone-600">
                  Sent by Valuable via Supabase. Check spam if it doesn&apos;t arrive.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <div className="page-kicker">Welcome {mode === 'signin' ? 'back' : 'in'}</div>
                  <h2 className="text-3xl font-extrabold text-stone-50">{mode === 'signin' ? 'Continue your practice.' : 'Build your focus ritual.'}</h2>
                  <p className="mt-2 text-sm text-stone-500">{mode === 'signin' ? 'Sign in to return to your focus space.' : 'A calmer, more intentional workday starts here.'}</p>
                </div>

                <div className="mb-7 flex gap-1 rounded-2xl border border-white/[.06] bg-black/20 p-1">
                  <button
                    type="button"
                    onClick={() => { setMode('signin'); setError(null); setNotice(null); }}
                    className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                      mode === 'signin' ? 'bg-white/[.09] text-stone-50 shadow-sm' : 'text-stone-500 hover:text-stone-200'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('signup'); setError(null); setNotice(null); }}
                    className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                      mode === 'signup' ? 'bg-white/[.09] text-stone-50 shadow-sm' : 'text-stone-500 hover:text-stone-200'
                    }`}
                  >
                    Sign Up
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === 'signup' && (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-300">Display name</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="What should friends call you?"
                        className="premium-input"
                        required
                      />
                    </div>
                  )}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="premium-input"
                      required
                    />
                  </div>
                  <div className="relative">
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">Password</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      minLength={6}
                      className="premium-input pr-12"
                      required
                    />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute bottom-3.5 right-4 text-stone-500 hover:text-stone-200" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  </div>

                  {error && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                      {error}
                    </div>
                  )}
                  {notice && (
                    <div className="rounded-xl border border-lime-300/20 bg-lime-300/[.07] px-4 py-3 text-sm text-lime-200">
                      {notice}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="primary-button flex w-full items-center justify-center gap-2 py-3.5"
                  >
                    {submitting ? 'Please wait...' : mode === 'signin' ? 'Enter focus space' : 'Create account'}
                    {!submitting && <ArrowRight className="h-4 w-4" />}
                  </button>
                </form>

                {mode === 'signup' && (
                  <p className="mt-4 text-center text-[11px] leading-5 text-stone-600">
                    We&apos;ll email you a 6-digit verification code from Valuable.
                  </p>
                )}
              </>
            )}

            <p className="mt-8 text-center text-xs leading-5 text-stone-600">Private by design. No social feeds. No infinite scroll.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
