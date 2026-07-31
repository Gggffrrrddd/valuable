import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { fetchStats, type Stats } from '@/lib/stats';
import { Flame, TrendingUp, Calendar, Lock, Sprout } from 'lucide-react';

interface StatsScreenProps {
  onStartTimer: () => void;
  onUpgrade: () => void;
}

function plantStage(totalMinutes: number): { label: string; color: string } {
  if (totalMinutes < 30) return { label: 'Seed', color: '#c5ff54' };
  if (totalMinutes < 120) return { label: 'Sprout', color: '#b6f248' };
  if (totalMinutes < 300) return { label: 'Sapling', color: '#9bdd3e' };
  if (totalMinutes < 600) return { label: 'Young Tree', color: '#83c432' };
  if (totalMinutes < 1200) return { label: 'Growing Tree', color: '#70ad2c' };
  return { label: 'Mighty Tree', color: '#c5ff54' };
}

export default function StatsScreen({ onStartTimer, onUpgrade }: StatsScreenProps) {
  const { profile, session } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const isPremium = !!(profile?.is_premium && profile.premium_expires_at && new Date(profile.premium_expires_at) > new Date());

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    fetchStats(session.user.id, isPremium)
      .then(setStats)
      .catch((e) => console.error('Stats error:', e))
      .finally(() => setLoading(false));
  }, [session, isPremium]);

  if (loading || !stats) {
    return (
      <div className="px-5 py-6">
        <div className="animate-pulse-soft text-slate-500 text-sm">Loading your stats…</div>
      </div>
    );
  }

  const plant = plantStage(stats.totalMinutes);
  const chartData = isPremium ? stats.last30Days : stats.last7Days;
  const maxMinutes = Math.max(...chartData.map((d) => d.minutes), 1);

  return (
    <div className="page-wrap pb-24">
      <div className="page-kicker">Performance</div>
      <h2 className="page-title">Your progress</h2>
      <p className="page-copy mb-7">A clear view of the practice you're building, one focused minute at a time.</p>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={<Calendar className="w-4 h-4" />} label="Today" value={`${stats.todayMinutes}m`} />
        <StatCard icon={<TrendingUp className="w-4 h-4" />} label="This Week" value={`${stats.weekMinutes}m`} />
        <StatCard
          icon={<Calendar className="w-4 h-4" />}
          label={isPremium ? 'This Month' : '30 Days'}
          value={`${isPremium ? stats.monthMinutes : '🔒'}`}
          locked={!isPremium}
        />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <StatCard
          icon={<Flame className="w-4 h-4" />}
          label="Current Streak"
          value={`${stats.currentStreak} day${stats.currentStreak !== 1 ? 's' : ''}`}
          accent
        />
        <StatCard
          icon={<Flame className="w-4 h-4" />}
          label="Longest Streak"
          value={isPremium ? `${stats.longestStreak} days` : '🔒'}
          locked={!isPremium}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[.85fr_1.5fr]">
      <div className="surface p-6">
        <div className="flex items-center justify-center mb-4">
          <div className="relative flex h-32 w-32 items-center justify-center rounded-full border border-lime-300/15 bg-lime-300/[.045] shadow-[inset_0_0_50px_rgba(197,255,84,.04)]">
            <div className="absolute inset-3 rounded-full border border-dashed border-lime-300/10" />
            <Sprout className="h-12 w-12 text-lime-300" strokeWidth={1.5} />
          </div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-white">{plant.label}</div>
          <div className="text-sm text-slate-400 mt-1">
            {stats.totalMinutes} total focus minutes
          </div>
          <div className="mt-3 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, (stats.totalMinutes / 1200) * 100)}%`,
                backgroundColor: plant.color,
              }}
            />
          </div>
          <div className="text-xs text-slate-500 mt-2 flex items-center justify-center gap-1">
            <Sprout className="w-3 h-3" />
            Your tree grows with every minute of focus
          </div>
        </div>
      </div>

      <div className="surface p-6 sm:p-7">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">
            {isPremium ? 'Last 30 days' : 'Last 7 days'}
          </h3>
          {!isPremium && (
            <button onClick={onUpgrade} className="text-xs text-emerald-400 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Unlock 30-day history
            </button>
          )}
        </div>
        <div className="flex items-end gap-1 h-32">
          {chartData.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="w-full flex-1 flex items-end">
                <div
                  className="w-full rounded-t bg-emerald-500/70 hover:bg-emerald-400 transition-colors min-h-[2px]"
                  style={{ height: `${(d.minutes / maxMinutes) * 100}%` }}
                  title={`${d.date}: ${d.minutes}m`}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-slate-500">
          <span>{chartData[0]?.date.slice(5)}</span>
          <span>{chartData[chartData.length - 1]?.date.slice(5)}</span>
        </div>
      </div>
      </div>

      <button
        onClick={onStartTimer}
        className="primary-button mt-6 w-full py-3.5 lg:ml-auto lg:block lg:w-auto lg:px-8"
      >
        Start a Focus Session
      </button>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
  locked,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
  locked?: boolean;
}) {
  return (
    <div
      className={`min-h-28 rounded-2xl border p-4 ${
        accent
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : 'bg-slate-900 border-slate-800'
      }`}
    >
      <div className={`flex items-center gap-1.5 text-xs mb-1 ${accent ? 'text-emerald-400' : 'text-slate-400'}`}>
        {icon}
        {label}
      </div>
      <div className={`mt-3 font-display text-2xl font-extrabold ${locked ? 'text-slate-600' : 'text-white'}`}>{value}</div>
    </div>
  );
}
