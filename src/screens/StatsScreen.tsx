import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { fetchStats, type Stats } from '@/lib/stats';
import {
  fetchActiveGoal,
  buildDayRecords,
  fetchMinutesByDate,
  dateKey as competeDateKey,
} from '@/lib/compete';
import type { CompeteGoal } from '@/types';
import { generateShareImage } from '@/lib/shareImage';
import {
  Flame,
  TrendingUp,
  Calendar,
  Clock,
  CheckCircle2,
  Share2,
  Star,
  Trophy,
  Hourglass,
  Target,
  Sparkles,
  ChevronRight,
  BookOpen,
  Sunrise,
  Sun,
  Sunset,
  Moon,
} from 'lucide-react';

interface StatsScreenProps {
  onStartTimer: () => void;
  onUpgrade: () => void;
  onNavigateToCompete?: () => void;
}

interface CompeteSummary {
  goal: CompeteGoal;
  todayPct: number;
  pacePct: number;
  metDays: number;
  totalDays: number;
}

function formatMinutes(total: number): string {
  const m = Math.max(0, Math.round(total));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}

function ChangeBadge({ current, previous, label }: { current: number; previous: number; label: string }) {
  if (previous <= 0) {
    if (current <= 0) return null;
    return (
      <span title={label} className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
        new
      </span>
    );
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  return (
    <span
      title={`${label}: ${up ? '+' : ''}${pct}%`}
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
        up ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/5 text-slate-400'
      }`}
    >
      {up ? '↑' : '↓'} {Math.abs(pct)}%
    </span>
  );
}

function Donut({ value, size = 132, stroke = 13, children }: { value: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(246,227,186,.12)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#f6e3ba"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length < 3) return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function TrendChart({ data }: { data: { date: string; minutes: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = 190;
  const PAD = 10;
  const max = Math.max(...data.map((d) => d.minutes), 1);
  const pts = data.map((d, i) => ({
    ...d,
    x: PAD + (data.length > 1 ? (i / (data.length - 1)) * (W - PAD * 2) : (W - PAD * 2) / 2),
    y: H - PAD - (d.minutes / max) * (H - PAD * 2),
  }));
  const line = smoothPath(pts);
  const area = pts.length > 0 ? `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${H - PAD} L ${pts[0].x.toFixed(1)} ${H - PAD} Z` : '';

  const pickIndex = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * (data.length - 1));
  };

  const fmtDate = (iso: string) => iso.slice(5).replace('-', '/');
  const hovered = hover !== null ? pts[hover] : null;
  const leftPct = hover !== null && data.length > 1 ? (hover / (data.length - 1)) * 100 : 0;

  return (
    <div>
      <div
        className="relative h-44 w-full cursor-crosshair touch-none select-none"
        onMouseMove={(e) => setHover(pickIndex(e.clientX, e.currentTarget))}
        onMouseLeave={() => setHover(null)}
        onTouchMove={(e) => {
          if (e.touches.length > 0) setHover(pickIndex(e.touches[0].clientX, e.currentTarget));
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" style={{ overflow: 'visible' }}>
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1={PAD}
              x2={W - PAD}
              y1={H * f}
              y2={H * f}
              stroke="rgba(148,163,184,.12)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              strokeDasharray="3 4"
            />
          ))}
          {area && <path d={area} fill="rgba(96,165,250,.12)" stroke="none" />}
          {line && (
            <path
              d={line}
              fill="none"
              stroke="#60a5fa"
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {hovered && (
            <g>
              <line
                x1={hovered.x}
                x2={hovered.x}
                y1={PAD}
                y2={H - PAD}
                stroke="rgba(96,165,250,.4)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <circle cx={hovered.x} cy={hovered.y} r={5} fill="#60a5fa" stroke="#0f172a" strokeWidth={2} />
            </g>
          )}
        </svg>
        {hovered && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl border border-blue-400/30 bg-[#0f172a]/95 px-3 py-1.5 text-center shadow-xl backdrop-blur"
            style={{ left: `${Math.max(9, Math.min(91, leftPct))}%` }}
          >
            <div className="text-sm font-extrabold text-white">{formatMinutes(hovered.minutes)}</div>
            <div className="text-[10px] font-semibold text-slate-400">{fmtDate(hovered.date)}</div>
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-semibold text-slate-500">
        <span>{data[0] ? fmtDate(data[0].date) : ''}</span>
        <span>{data.length > 2 ? fmtDate(data[Math.floor(data.length / 2)].date) : ''}</span>
        <span>{data.length > 0 ? fmtDate(data[data.length - 1].date) : ''}</span>
      </div>
    </div>
  );
}

function MilestoneIcon({ icon, className }: { icon: string; className?: string }) {
  const cls = className ?? 'h-5 w-5';
  if (icon === 'flame') return <Flame className={cls} />;
  if (icon === 'hourglass') return <Hourglass className={cls} />;
  if (icon === 'check') return <CheckCircle2 className={cls} />;
  if (icon === 'star') return <Star className={cls} />;
  return <Trophy className={cls} />;
}

export default function StatsScreen({ onStartTimer, onNavigateToCompete }: StatsScreenProps) {
  const { session } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<30 | 90>(30);
  const [sharing, setSharing] = useState<string | null>(null);
  const [compete, setCompete] = useState<CompeteSummary | null>(null);
  const [hasGoal, setHasGoal] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    fetchStats(session.user.id)
      .then(setStats)
      .catch((e) => console.error('Stats error:', e))
      .finally(() => setLoading(false));
  }, [session]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const goal = await fetchActiveGoal(session.user.id);
        if (!goal) {
          setHasGoal(false);
          setCompete(null);
          return;
        }
        setHasGoal(true);
        const start = goal.start_date || goal.created_at.slice(0, 10);
        const minutes = await fetchMinutesByDate(session.user.id, start);
        const today = competeDateKey(new Date());
        const records = buildDayRecords(goal, minutes, today);
        const target = Number(goal.daily_target_hours) * 60;
        const last = records[records.length - 1];
        const todayPct = target > 0 && last ? Math.min(100, Math.round((last.minutesCompleted / target) * 100)) : 0;
        const met = records.filter((r) => r.targetMet).length;
        setCompete({
          goal,
          todayPct,
          pacePct: records.length > 0 ? Math.round((met / records.length) * 100) : 0,
          metDays: met,
          totalDays: records.length,
        });
      } catch (e) {
        console.error('Compete summary error:', e);
      }
    })();
  }, [session]);

  if (loading || !stats) {
    return (
      <div className="px-5 py-6">
        <div className="animate-pulse-soft text-sm text-slate-500">Loading your stats…</div>
      </div>
    );
  }

  const trendData = range === 30 ? stats.last30Days : stats.last90Days;
  const completionPct = stats.sessionsTotal > 0 ? Math.round((stats.sessionsCompleted / stats.sessionsTotal) * 100) : 0;

  const topSubjects = stats.subjects.slice(0, 5);
  const otherMinutes = stats.subjects.slice(5).reduce((a, s) => a + s.minutes, 0);
  const otherPct = stats.totalMinutes > 0 ? (stats.subjects.slice(5).reduce((a, s) => a + s.minutes, 0) / stats.totalMinutes) * 100 : 0;

  const tod = stats.timeOfDay;
  const todTotal = tod.morning + tod.afternoon + tod.evening + tod.night;
  const buckets = [
    { key: 'Morning', label: 'Morning', sub: '6 AM – 12 PM', minutes: tod.morning, icon: <Sunrise className="h-4 w-4" /> },
    { key: 'Afternoon', label: 'Afternoon', sub: '12 – 5 PM', minutes: tod.afternoon, icon: <Sun className="h-4 w-4" /> },
    { key: 'Evening', label: 'Evening', sub: '5 – 10 PM', minutes: tod.evening, icon: <Sunset className="h-4 w-4" /> },
    { key: 'Night', label: 'Night', sub: '10 PM – 6 AM', minutes: tod.night, icon: <Moon className="h-4 w-4" /> },
  ];
  const todMax = Math.max(tod.morning, tod.afternoon, tod.evening, tod.night, 1);

  async function doShare(type: 'full' | 'streak' | 'milestone' | 'weekly', milestone?: Stats['milestones'][number]) {
    if (!stats || sharing) return;
    const key = type + (milestone ? `-${milestone.id}` : '');
    setSharing(key);
    try {
      await generateShareImage({ type, stats, milestone });
    } catch (e) {
      console.error('Share failed:', e);
    } finally {
      setSharing(null);
    }
  }

  const secondaryInsight =
    topSubjects.length > 0
      ? `Most of your time goes to ${topSubjects[0].name} (${Math.round(topSubjects[0].percentage)}% of all focus).`
      : 'Tag your sessions with a subject to see where your time goes.';

  return (
    <div className="page-wrap pb-24">
      <div className="mb-1 flex items-start justify-between gap-3">
        <div>
          <div className="page-kicker">Performance</div>
          <h2 className="page-title">Your progress</h2>
        </div>
        <button
          onClick={() => doShare('full')}
          disabled={sharing !== null}
          className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#f6e3ba]/30 bg-[#f6e3ba]/10 px-3 py-2 text-xs font-bold text-[#f6e3ba] transition hover:bg-[#f6e3ba]/20 disabled:opacity-50"
        >
          <Share2 className="h-3.5 w-3.5" />
          {sharing === 'full' ? 'Preparing…' : 'Share report'}
        </button>
      </div>
      <p className="page-copy mb-7">A clear view of the practice you&apos;re building, one focused minute at a time.</p>

      {/* 1. HEADER STATS ROW */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="h-3.5 w-3.5" /> Today
          </div>
          <div className="mt-2 font-display text-2xl font-extrabold text-white">{formatMinutes(stats.todayMinutes)}</div>
          <div className="mt-1 text-[11px] text-slate-500">focused today</div>
        </div>
        <div className="relative rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <button
            onClick={() => doShare('weekly')}
            disabled={sharing !== null}
            title="Share weekly summary"
            aria-label="Share weekly summary"
            className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-[#f6e3ba]"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
          <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
            <TrendingUp className="h-3.5 w-3.5" /> This Week
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-display text-2xl font-extrabold text-white">{formatMinutes(stats.weekMinutes)}</span>
            <ChangeBadge current={stats.weekMinutes} previous={stats.lastWeekMinutes} label="Week over week" />
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {sharing === 'weekly' ? 'Preparing image…' : 'vs last week'}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
            <Calendar className="h-3.5 w-3.5" /> 30 Days
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-display text-2xl font-extrabold text-white">{formatMinutes(stats.monthMinutes)}</span>
            <ChangeBadge current={stats.monthMinutes} previous={stats.lastMonthMinutes} label="30 days vs prior 30" />
          </div>
          <div className="mt-1 text-[11px] text-slate-500">vs prior 30 days</div>
        </div>
        <div className="rounded-2xl border border-[#f6e3ba]/25 bg-[#f6e3ba]/[.05] p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-[#f6e3ba]">
            <Hourglass className="h-3.5 w-3.5" /> All-time
          </div>
          <div className="mt-2 font-display text-2xl font-extrabold text-white">{formatMinutes(stats.totalMinutes)}</div>
          <div className="mt-1 text-[11px] text-slate-500">total focus</div>
        </div>
      </div>

      {/* 2. STREAK ROW */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="relative min-h-28 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <button
            onClick={() => doShare('streak')}
            disabled={sharing !== null}
            title="Share streak"
            aria-label="Share streak"
            className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-emerald-500/70 transition hover:bg-white/5 hover:text-emerald-300"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
          <div className="mb-1 flex items-center gap-1.5 text-xs text-emerald-400">
            <Flame className="h-4 w-4" /> Current Streak
          </div>
          <div className="mt-3 font-display text-2xl font-extrabold text-white">
            {stats.currentStreak} day{stats.currentStreak !== 1 ? 's' : ''}
          </div>
          <div className="mt-1 text-[11px] text-emerald-500/70">
            {sharing && sharing.startsWith('streak') ? 'Preparing image…' : 'keep it burning'}
          </div>
        </div>
        <div className="min-h-28 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
            <Flame className="h-4 w-4" /> Longest Streak
          </div>
          <div className="mt-3 font-display text-2xl font-extrabold text-white">
            {stats.longestStreak} day{stats.longestStreak !== 1 ? 's' : ''}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">your personal best run</div>
        </div>
      </div>

      {/* 3. COMPLETION RATE CARD */}
      <div className="surface mb-4 p-6 sm:p-7">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
          <Donut value={completionPct}>
            <div className="font-display text-2xl font-extrabold text-[#f6e3ba]">{completionPct}%</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">complete</div>
          </Donut>
          <div className="text-center sm:text-left">
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <CheckCircle2 className="h-4 w-4 text-[#f6e3ba]" />
              <h3 className="font-semibold text-white">Completion rate</h3>
            </div>
            <p className="mt-2 font-display text-xl font-extrabold text-white">
              {stats.sessionsCompleted} <span className="text-sm font-semibold text-slate-400">of {stats.sessionsTotal} sessions completed</span>
            </p>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
              Finishing what you start is the habit that compounds. Every completed session counts — abandoned ones simply don&apos;t.
            </p>
          </div>
        </div>
      </div>

      {/* 4. TREND CHART */}
      <div className="surface mb-4 p-6 sm:p-7">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-white">Focus trend</h3>
          <div className="flex rounded-xl border border-slate-800 bg-slate-900 p-0.5 text-xs font-bold">
            {([30, 90] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-[10px] px-3 py-1.5 transition ${
                  range === r ? 'bg-blue-400/15 text-blue-300' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {r}D
              </button>
            ))}
          </div>
        </div>
        <TrendChart data={trendData} />
        <p className="mt-2 text-[11px] text-slate-500">Daily focused minutes · hover or tap the line for exact values</p>
      </div>

      {/* 5. SUBJECT BREAKDOWN */}
      <div className="surface mb-4 p-6 sm:p-7">
        <div className="mb-1 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-[#f6e3ba]" />
          <h3 className="font-semibold text-white">Subject breakdown</h3>
        </div>
        <p className="mb-4 text-[11px] text-slate-500">Based on your session tags · all-time</p>
        {topSubjects.length === 0 ? (
          <p className="text-sm text-slate-400">Tag your focus sessions with a subject to see where your time goes.</p>
        ) : (
          <div className="space-y-3.5">
            {topSubjects.map((s, i) => (
              <div key={s.name}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="font-semibold text-slate-200">{s.name}</span>
                  <span className="text-xs text-slate-400">
                    {formatMinutes(s.minutes)} · <span className="font-bold text-[#f6e3ba]">{Math.round(s.percentage)}%</span>
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.max(2, Math.min(100, s.percentage))}%`,
                      background: `linear-gradient(90deg, rgba(246,227,186,${0.45 + 0.1 * (5 - i)}), #f6e3ba)`,
                    }}
                  />
                </div>
              </div>
            ))}
            {otherMinutes > 0 && (
              <div>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="font-semibold text-slate-400">Other</span>
                  <span className="text-xs text-slate-500">
                    {formatMinutes(otherMinutes)} · {Math.round(otherPct)}%
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-slate-600" style={{ width: `${Math.max(2, Math.min(100, otherPct))}%` }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 6. TIME-OF-DAY DISTRIBUTION */}
      <div className="surface mb-4 p-6 sm:p-7">
        <div className="mb-1 flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#f6e3ba]" />
          <h3 className="font-semibold text-white">When you focus best</h3>
        </div>
        <p className="mb-4 text-[11px] text-slate-500">Share of focused minutes by time of day</p>
        {todTotal === 0 ? (
          <p className="text-sm text-slate-400">Complete a session and your rhythm will appear here.</p>
        ) : (
          <div className="space-y-3">
            {buckets.map((b) => {
              const isPeak = tod.peak === b.key;
              const pct = todTotal > 0 ? Math.round((b.minutes / todTotal) * 100) : 0;
              return (
                <div
                  key={b.key}
                  className={`rounded-2xl border p-3.5 transition ${
                    isPeak ? 'border-[#f6e3ba]/40 bg-[#f6e3ba]/[.06] shadow-[0_0_30px_rgba(246,227,186,.07)]' : 'border-slate-800 bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`flex items-center gap-2 text-sm font-bold ${isPeak ? 'text-[#f6e3ba]' : 'text-slate-300'}`}>
                      {b.icon}
                      {b.label}
                      <span className="text-[11px] font-medium text-slate-500">{b.sub}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isPeak && (
                        <span className="rounded-full bg-[#f6e3ba]/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#f6e3ba]">
                          Peak
                        </span>
                      )}
                      <span className="text-xs text-slate-400">
                        {formatMinutes(b.minutes)} · <span className="font-bold text-slate-200">{pct}%</span>
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${isPeak ? '' : 'bg-slate-500/70'}`}
                      style={{
                        width: `${Math.max(2, (b.minutes / todMax) * 100)}%`,
                        ...(isPeak ? { background: 'linear-gradient(90deg, rgba(246,227,186,.55), #f6e3ba)' } : {}),
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 7. WRITTEN INSIGHTS */}
      <div className="surface mb-4 border-[#f6e3ba]/20 bg-gradient-to-br from-[#f6e3ba]/[.07] to-transparent p-6 sm:p-7">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#f6e3ba]" />
          <h3 className="font-semibold text-white">Insights for you</h3>
        </div>
        <p className="mt-3 text-[15px] leading-7 text-slate-200">{stats.writtenInsight}</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">{secondaryInsight}</p>
      </div>

      {/* 8. MILESTONES / BADGES */}
      <div className="surface mb-4 p-6 sm:p-7">
        <div className="mb-1 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-[#f6e3ba]" />
          <h3 className="font-semibold text-white">Milestones</h3>
        </div>
        <p className="mb-4 text-[11px] text-slate-500">Unlocked badges glow — locked ones show what&apos;s ahead</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.milestones.map((m) => (
            <div
              key={m.id}
              className={`relative rounded-2xl border p-4 transition ${
                m.unlocked
                  ? 'border-[#f6e3ba]/40 bg-[#f6e3ba]/[.07] shadow-[0_0_36px_rgba(246,227,186,.10)]'
                  : 'border-slate-800 bg-slate-900/60 opacity-60 grayscale'
              }`}
            >
              {m.unlocked && (
                <button
                  onClick={() => doShare('milestone', m)}
                  disabled={sharing !== null}
                  title={`Share ${m.title}`}
                  aria-label={`Share ${m.title}`}
                  className="absolute right-2 top-2 rounded-lg p-1.5 text-[#f6e3ba]/70 transition hover:bg-white/5 hover:text-[#f6e3ba]"
                >
                  <Share2 className="h-3.5 w-3.5" />
                </button>
              )}
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${m.unlocked ? 'bg-[#f6e3ba]/15 text-[#f6e3ba]' : 'bg-slate-800 text-slate-600'}`}>
                <MilestoneIcon icon={m.icon} />
              </div>
              <div className={`mt-3 text-sm font-bold ${m.unlocked ? 'text-white' : 'text-slate-400'}`}>{m.title}</div>
              <div className="mt-1 text-[11px] leading-4 text-slate-500">{m.description}</div>
              <div className={`mt-2 text-[10px] font-extrabold uppercase tracking-wider ${m.unlocked ? 'text-[#f6e3ba]' : 'text-slate-600'}`}>
                {m.unlocked ? (sharing === `milestone-${m.id}` ? 'Preparing…' : 'Unlocked') : 'Locked'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 9. COMPETE CONNECTION */}
      {compete ? (
        <div className="surface mb-4 flex flex-col gap-3 border-emerald-500/20 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Compete connection</h3>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Today&apos;s goal: <span className="font-bold text-emerald-300">{compete.todayPct}% complete</span>
                {' · '}On pace to finish <span className="font-bold text-slate-200">{compete.pacePct}% of days</span> ({compete.metDays}/{compete.totalDays}) by exam date.
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateToCompete}
            className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-400/10 px-3.5 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-400/20"
          >
            Open Compete <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        hasGoal === false && (
          <div className="surface mb-4 flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-slate-400">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Race yourself</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Set a Compete goal with an exam date and daily target — your tree grows one day at a time.
                </p>
              </div>
            </div>
            <button
              onClick={onNavigateToCompete}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[#f6e3ba]/30 bg-[#f6e3ba]/10 px-3.5 py-2 text-xs font-bold text-[#f6e3ba] transition hover:bg-[#f6e3ba]/20"
            >
              Set a goal <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      )}

      <button onClick={onStartTimer} className="primary-button mt-6 w-full py-3.5 lg:ml-auto lg:block lg:w-auto lg:px-8">
        Start a Focus Session
      </button>
    </div>
  );
}
