import { useAuth } from '@/lib/auth';
import { RESTRICTION_MESSAGE } from '@/lib/restriction';
import { Lock, LogOut, Timer } from 'lucide-react';

/** Full-screen gate shown to any signed-in user who is not the owner. */
export default function RestrictedScreen() {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#090b0a] p-5">
      <div className="w-full max-w-md rounded-[2rem] border border-white/[.07] bg-[#11130f] p-8 text-center shadow-2xl sm:p-10">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-300 text-[#11130f]">
          <Timer className="h-6 w-6" strokeWidth={2.5} />
        </div>
        <div className="mt-5 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-stone-500">
          <Lock className="h-3.5 w-3.5" /> Access restricted
        </div>
        <p className="mt-4 text-xl font-extrabold leading-snug text-stone-50">
          {RESTRICTION_MESSAGE}
        </p>
        <p className="mt-3 text-sm leading-6 text-stone-500">
          This account cannot use the app right now. Contact the owner for access.
        </p>
        <button
          onClick={() => signOut()}
          className="mt-7 inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 py-2.5 text-sm font-bold text-stone-300 transition hover:bg-white/10"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}
