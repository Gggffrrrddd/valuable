import { useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import AuthScreen from '@/screens/AuthScreen';
import FocusTimer from '@/screens/FocusTimer';
import StatsScreen from '@/screens/StatsScreen';
import BreakScreen from '@/screens/BreakScreen';
import PremiumScreen from '@/screens/PremiumScreen';
import FriendsScreen from '@/screens/FriendsScreen';
import { Home, BarChart3, Users, Crown, LogOut, Timer, Sparkles, ArrowUpRight, Command } from 'lucide-react';

type Tab = 'home' | 'stats' | 'friends';
type Screen = 'tab' | 'timer' | 'break' | 'premium';

function AppContent() {
  const { session, profile, loading, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('home');
  const [screen, setScreen] = useState<Screen>('tab');
  const [breakMinutes, setBreakMinutes] = useState(5);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#090b0a]">
        <div className="flex flex-col items-center gap-4 text-stone-500 animate-pulse-soft">
          <div className="h-11 w-11 rounded-2xl bg-lime-300/10 p-3"><Timer className="h-full w-full text-lime-300" /></div>
          <span className="text-sm">Preparing your space</span>
        </div>
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthScreen />;
  }

  async function handleSessionComplete(durationSeconds: number, subjectTag: string | null, completedFully: boolean, breakMins: number) {
    if (!session || durationSeconds < 10) {
      setScreen('tab');
      return;
    }
    try {
      await supabase.from('focus_sessions').insert({
        user_id: session.user.id,
        subject_tag: subjectTag,
        started_at: new Date(Date.now() - durationSeconds * 1000).toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        completed_fully: completedFully,
      });
    } catch (e) {
      console.error('Session log error:', e);
    }

    if (completedFully) {
      setBreakMinutes(breakMins);
      setScreen('break');
    } else {
      setScreen('tab');
    }
  }

  if (screen === 'timer') {
    return <FocusTimer onComplete={handleSessionComplete} />;
  }

  if (screen === 'break') {
    return <BreakScreen breakMinutes={breakMinutes} onDone={() => setScreen('tab')} />;
  }

  if (screen === 'premium') {
    return <PremiumScreen onBack={() => setScreen('tab')} />;
  }

  return (
    <div className="app-bg min-h-screen">
      <div className="mx-auto min-h-screen max-w-[1600px] lg:grid lg:grid-cols-[260px_1fr]">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-white/[.07] bg-[#0d0f0c]/90 p-5 backdrop-blur-2xl lg:flex xl:left-[max(0px,calc((100vw-1600px)/2))]">
          <div className="flex items-center gap-3 px-2 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-lime-300 text-[#11130f] shadow-[0_0_34px_rgba(197,255,84,.15)]"><Timer className="h-5 w-5" strokeWidth={2.5} /></div>
            <span className="font-display text-xl font-extrabold tracking-[-.05em] text-stone-50">Valuable<span className="text-lime-300">.</span></span>
          </div>

          <div className="mt-10 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-stone-600">Workspace</div>
          <nav className="mt-3 space-y-1.5">
            <SideNavButton active={tab === 'home' && screen === 'tab'} onClick={() => { setTab('home'); setScreen('tab'); }} icon={<Home className="h-[18px] w-[18px]" />} label="Focus space" />
            <SideNavButton active={tab === 'stats' && screen === 'tab'} onClick={() => { setTab('stats'); setScreen('tab'); }} icon={<BarChart3 className="h-[18px] w-[18px]" />} label="Performance" />
            <SideNavButton active={tab === 'friends' && screen === 'tab'} onClick={() => { setTab('friends'); setScreen('tab'); }} icon={<Users className="h-[18px] w-[18px]" />} label="Circle" />
          </nav>

          <button onClick={() => setScreen('premium')} className="group relative mt-8 overflow-hidden rounded-[1.5rem] border border-lime-300/15 bg-lime-300/[.06] p-4 text-left transition hover:border-lime-300/30 hover:bg-lime-300/[.09]">
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-lime-300/10 blur-2xl" />
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-lime-300 text-[#11130f]"><Crown className="h-4 w-4" /></div>
            <div className="relative mt-4 font-display text-sm font-bold text-stone-100">Unlock your full potential</div>
            <div className="relative mt-1 text-xs leading-5 text-stone-500">Deeper insights and unlimited content.</div>
            <div className="relative mt-4 flex items-center gap-1 text-xs font-bold text-lime-300">Explore Premium <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></div>
          </button>

          <div className="mt-auto border-t border-white/[.06] pt-4">
            <div className="flex items-center gap-3 rounded-2xl p-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-stone-700 to-stone-900 font-display text-sm font-extrabold text-lime-300 ring-1 ring-white/10">{profile.display_name.charAt(0).toUpperCase()}</div>
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold text-stone-200">{profile.display_name}</div><div className="text-[11px] text-stone-600">Focus member</div></div>
              <button onClick={signOut} className="icon-button h-9 w-9 shrink-0" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
            </div>
          </div>
        </aside>

        <div className="relative flex min-h-screen min-w-0 flex-col lg:col-start-2">
        <header className="safe-top sticky top-0 z-40 flex items-center justify-between border-b border-white/[.06] bg-[#090b0a]/80 px-5 pb-4 backdrop-blur-xl sm:px-8 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-300 text-[#11130f] shadow-[0_0_30px_rgba(197,255,84,.12)]">
              <Timer className="h-[18px] w-[18px]" strokeWidth={2.4} />
            </div>
            <span className="font-display text-lg font-extrabold tracking-[-.04em] text-stone-50">Valuable<span className="text-lime-300">.</span></span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setScreen('premium')} className="hidden items-center gap-2 rounded-xl border border-lime-300/20 bg-lime-300/[.06] px-3 py-2 text-xs font-bold text-lime-300 sm:flex">
              <Sparkles className="h-3.5 w-3.5" /> Go Premium
            </button>
            <button onClick={signOut} className="icon-button h-9 w-9" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
          </div>
        </header>

        <main className="app-main lg:px-10 lg:pb-12 xl:px-16">
          {tab === 'home' && (
            <div className="mx-auto max-w-6xl animate-fade-in pt-7 sm:pt-12 lg:pt-16">
              <div className="grid items-end gap-8 px-1 pb-3 sm:pb-7 lg:grid-cols-[1fr_280px]">
                <div>
                  <div className="page-kicker">Your focus space</div>
                  <h1 className="text-4xl font-extrabold leading-[1.08] text-stone-50 sm:text-6xl xl:text-7xl">
                    Make this hour <span className="text-stone-600">count.</span>
                  </h1>
                  <p className="mt-5 max-w-xl text-sm leading-6 text-stone-400 sm:text-base">Welcome back, {profile.display_name}. Remove the noise and give one meaningful thing your complete attention.</p>
                </div>
                <div className="hidden rounded-[1.4rem] border border-white/[.07] bg-white/[.025] p-4 lg:block">
                  <div className="flex items-center justify-between text-xs text-stone-500"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-lime-300 shadow-[0_0_10px_rgba(197,255,84,.6)]" /> Ready</span><Command className="h-3.5 w-3.5" /></div>
                  <div className="mt-4 font-display text-sm font-bold text-stone-200">One task. Full presence.</div>
                  <div className="mt-1 text-xs leading-5 text-stone-600">Your session will be quietly logged when you finish.</div>
                </div>
              </div>
              <FocusTimer onComplete={handleSessionComplete} />
            </div>
          )}
          {tab === 'stats' && (
            <StatsScreen
              onStartTimer={() => setScreen('timer')}
              onUpgrade={() => setScreen('premium')}
            />
          )}
          {tab === 'friends' && (
            <FriendsScreen />
          )}
        </main>

        <nav className="safe-bottom fixed bottom-3 left-1/2 z-40 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-center justify-around rounded-[1.4rem] border border-white/10 bg-[#171a16]/90 px-2 py-1.5 shadow-[0_20px_60px_rgba(0,0,0,.55)] backdrop-blur-2xl lg:hidden">
          <NavButton
            active={tab === 'home'}
            onClick={() => setTab('home')}
            icon={<Home className="w-5 h-5" />}
            label="Focus"
          />
          <NavButton
            active={tab === 'stats'}
            onClick={() => setTab('stats')}
            icon={<BarChart3 className="w-5 h-5" />}
            label="Stats"
          />
          <NavButton
            active={tab === 'friends'}
            onClick={() => setTab('friends')}
            icon={<Users className="w-5 h-5" />}
            label="Friends"
          />
          <NavButton
            active={false}
            onClick={() => setScreen('premium')}
            icon={<Crown className="w-5 h-5" />}
            label="Premium"
          />
        </nav>
        </div>
      </div>
    </div>
  );
}

function SideNavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`group flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition-all ${active ? 'bg-white/[.075] text-stone-50 shadow-[inset_0_0_0_1px_rgba(255,255,255,.04)]' : 'text-stone-500 hover:bg-white/[.035] hover:text-stone-200'}`}>
      <span className={`transition ${active ? 'text-lime-300' : 'text-stone-600 group-hover:text-stone-300'}`}>{icon}</span>
      <span>{label}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-lime-300 shadow-[0_0_10px_rgba(197,255,84,.7)]" />}
    </button>
  );
}

function NavButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex min-w-[64px] flex-col items-center gap-1 rounded-2xl px-3 py-2 transition-all ${
        active ? 'bg-lime-300/[.09] text-lime-300' : 'text-stone-500 hover:text-stone-200'
      }`}
    >
      {icon}
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
