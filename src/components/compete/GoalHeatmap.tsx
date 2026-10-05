import { useMemo, useState, type ReactNode } from 'react';
import { Sprout, Flame, CalendarDays } from 'lucide-react';
import { addDays, daysBetween, dateKey, parseDay, type DayRecord } from '@/lib/compete';

const CELL = 16;
const GAP = 4;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', '', '', 'Wed', '', '', 'Sat'];
const fmtDay = new Intl.DateTimeFormat('en', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

interface Props {
  startDate: string;
  examDate: string;
  targetHours: number;
  records: DayRecord[];
}

interface Tip {
  date: string;
  cx: number;
  top: number;
  bottom: number;
  below: boolean;
}

/**
 * GitHub-style calendar heatmap for the daily-tree goal: one cell per day
 * from start to exam, week columns, Sun→Sat rows. Gold intensity reflects
 * how much of that day's target was tracked; full days glow.
 */
export default function GoalHeatmap({ startDate, examDate, targetHours, records }: Props) {
  const [tip, setTip] = useState<Tip | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  /** Which 5-month window is on screen (0 = first). */
  const [page, setPage] = useState(0);

  const today = dateKey(new Date());
  const targetMinutes = targetHours * 60;

  const byDate = useMemo(() => {
    const m = new Map<string, DayRecord>();
    for (const r of records) m.set(r.date, r);
    return m;
  }, [records]);

  // 2-year cap: never track more than 24 months — the window ends on exam
  // day and reaches back at most 2 years (older history is not shown).
  const cappedStart = useMemo(() => {
    const exam = parseDay(examDate);
    const earliest = dateKey(
      new Date(Date.UTC(exam.getUTCFullYear() - 2, exam.getUTCMonth(), exam.getUTCDate())),
    );
    return startDate > earliest ? startDate : earliest;
  }, [startDate, examDate]);

  // One module shows at most 5 calendar months → page count for the range.
  const pageCount = useMemo(() => {
    const s = parseDay(cappedStart);
    const e = parseDay(examDate);
    const months =
      (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth()) + 1;
    return Math.max(1, Math.ceil(months / 5));
  }, [cappedStart, examDate]);

  const safePage = Math.min(page, pageCount - 1);

  const { pageStart, pageEnd } = useMemo(() => {
    const anchor = parseDay(cappedStart);
    const startOf = (m: number) =>
      dateKey(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + m, 1)));
    const endOf = (m: number) =>
      dateKey(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + m + 1, 0)));
    const s = safePage === 0 ? cappedStart : startOf(safePage * 5);
    const rawEnd = endOf(safePage * 5 + 4);
    return { pageStart: s, pageEnd: rawEnd < examDate ? rawEnd : examDate };
  }, [cappedStart, examDate, safePage]);

  const { columns, cells, monthLabels } = useMemo(() => {
    const totalDays = Math.max(1, daysBetween(pageStart, pageEnd) + 1);
    const offset = parseDay(pageStart).getUTCDay();
    const columns = Math.max(1, Math.ceil((offset + totalDays) / 7));

    const cells: (string | null)[] = [];
    for (let i = 0; i < columns * 7; i++) {
      if (i < offset) {
        cells.push(null);
        continue;
      }
      const idx = i - offset;
      cells.push(idx < totalDays ? addDays(pageStart, idx) : null);
    }

    const monthLabels: (string | null)[] = [];
    for (let c = 0; c < columns; c++) {
      let label: string | null = null;
      if (c === 0) {
        label = MONTHS[parseDay(pageStart).getUTCMonth()];
      } else {
        for (let r = 0; r < 7; r++) {
          const d = cells[c * 7 + r];
          if (d && parseDay(d).getUTCDate() === 1) {
            label = MONTHS[parseDay(d).getUTCMonth()];
            break;
          }
        }
      }
      monthLabels.push(label);
    }

    return { columns, cells, monthLabels };
  }, [pageStart, pageEnd]);

  const stats = useMemo(() => {
    // Stats cover the whole (capped) range, not just the visible page.
    let daysCompleted = 0;
    for (const r of records) {
      if (r.targetMet && r.date >= cappedStart && r.date <= examDate) daysCompleted++;
    }

    let streak = 0;
    let cursor = byDate.get(today)?.targetMet ? today : addDays(today, -1);
    while (byDate.get(cursor)?.targetMet) {
      streak++;
      cursor = addDays(cursor, -1);
    }

    const totalDays = Math.max(1, daysBetween(cappedStart, examDate) + 1);
    return {
      daysCompleted,
      totalDays,
      streak,
      daysLeft: Math.max(0, daysBetween(today, examDate)),
    };
  }, [cappedStart, examDate, records, byDate, today]);

  const showTip = (date: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const below = r.top < 150;
    setTip({
      date,
      cx: Math.min(Math.max(r.left + r.width / 2, 100), window.innerWidth - 100),
      top: r.top,
      bottom: r.bottom,
      below,
    });
  };

  const hideTip = () => setTip(null);

  const cellClass = (date: string) => {
    const isFuture = date > today;
    const rec = byDate.get(date);
    const base = 'block h-4 w-4 rounded-[4px] transition duration-150';
    let cls: string;
    if (isFuture) cls = 'bg-white/[.03] ring-1 ring-inset ring-white/[.05]';
    else if (!rec || rec.minutesCompleted <= 0) cls = 'bg-[#f6e3ba]/[.08]';
    else {
      const f = rec.minutesCompleted / targetMinutes;
      if (f >= 1) cls = 'bg-[#f6e3ba] shadow-[0_0_10px_rgba(246,227,186,0.6)]';
      else if (f >= 0.5) cls = 'bg-[#f6e3ba]/60';
      else cls = 'bg-[#f6e3ba]/30';
    }
    if (date === today) cls += ' ring-2 ring-lime-300/80';
    return `${base} ${cls}`;
  };

  const tipRecord = tip ? byDate.get(tip.date) : undefined;
  const tipMinutes = tipRecord?.minutesCompleted ?? 0;

  return (
    <section className="relative overflow-hidden rounded-[1.6rem] border border-white/[.07] bg-white/[.025] p-5 shadow-[0_30px_80px_rgba(0,0,0,.4)] sm:p-7">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#f6e3ba]/[.07] to-transparent" />

      <div className="relative">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="page-kicker">Daily tree</div>
            <h3 className="font-display text-2xl font-extrabold tracking-[-.02em] text-stone-50 sm:text-3xl">
              Discipline tracker
            </h3>
            <p className="mt-1 max-w-lg text-sm leading-6 text-stone-500">
              Every tended day, from {cappedStart} through exam day on {examDate}. One square per
              day — the fuller the gold, the closer you were to your daily target. Shows 5 months
              at a time, up to 2 years of history.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <StatChip
              icon={<Sprout className="h-4 w-4" />}
              value={`${stats.daysCompleted} / ${stats.totalDays}`}
              label="Days completed"
            />
            <StatChip
              icon={<Flame className="h-4 w-4" />}
              value={String(stats.streak)}
              label="Current streak"
            />
            <StatChip
              icon={<CalendarDays className="h-4 w-4" />}
              value={String(stats.daysLeft)}
              label="Days left"
            />
          </div>
        </div>

        <div className="relative mt-6 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2">
            <div
              className="w-7 pt-[22px] text-[9px] font-bold uppercase tracking-wider text-stone-600"
              style={{ display: 'grid', gridTemplateRows: `repeat(7, ${CELL}px)`, rowGap: GAP }}
            >
              {WEEKDAYS.map((d, i) => (
                <span key={i} className="leading-4">
                  {d}
                </span>
              ))}
            </div>

            <div>
              <div
                className="mb-1 h-4 text-[9px] font-bold uppercase tracking-wider text-stone-600"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${columns}, ${CELL}px)`,
                  columnGap: GAP,
                }}
              >
                {monthLabels.map((m, i) => (
                  <span key={i} className="overflow-visible whitespace-nowrap">
                    {m}
                  </span>
                ))}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridAutoFlow: 'column',
                  gridTemplateRows: `repeat(7, ${CELL}px)`,
                  gridAutoColumns: `${CELL}px`,
                  gap: GAP,
                }}
              >
                {cells.map((date, i) => {
                  if (!date) return <span key={`pad-${i}`} className="invisible" />;
                  const future = date > today;
                  return (
                    <span
                      key={date}
                      className={cellClass(date)}
                      onMouseEnter={(e) => {
                        if (!future && !pinned) showTip(date, e.currentTarget);
                      }}
                      onMouseLeave={() => {
                        if (!pinned) hideTip();
                      }}
                      onClick={(e) => {
                        if (future) return;
                        if (pinned === date) {
                          setPinned(null);
                          hideTip();
                        } else {
                          setPinned(date);
                          showTip(date, e.currentTarget);
                        }
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 5-month pagination: gold "Next" like the tracker link, a smaller
            "Previous" beside it; hidden while there is nowhere to go. */}
        {pageCount > 1 && (
          <div className="mt-4 flex items-center gap-5">
            {safePage > 0 && (
              <button
                type="button"
                onClick={() => setPage(safePage - 1)}
                className="text-[10px] font-semibold uppercase tracking-[.14em] text-stone-500 transition hover:text-stone-300"
              >
                Previous
              </button>
            )}
            {safePage < pageCount - 1 && (
              <button
                type="button"
                onClick={() => setPage(safePage + 1)}
                className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#f6e3ba]/70 transition hover:text-[#f6e3ba] hover:underline hover:underline-offset-4"
              >
                Next
              </button>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[.18em] text-stone-600">
          <span className="flex items-center gap-2">
            Less
            <span className="h-3 w-3 rounded-[3px] bg-[#f6e3ba]/[.08]" />
            <span className="h-3 w-3 rounded-[3px] bg-[#f6e3ba]/30" />
            <span className="h-3 w-3 rounded-[3px] bg-[#f6e3ba]/60" />
            <span className="h-3 w-3 rounded-[3px] bg-[#f6e3ba] shadow-[0_0_8px_rgba(246,227,186,0.6)]" />
            More
          </span>
          <span className="flex items-center gap-4 text-stone-500">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-[3px] ring-2 ring-lime-300/80" /> Today
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-[3px] bg-[#f6e3ba] shadow-[0_0_8px_rgba(246,227,186,0.6)]" />{' '}
              Target met
            </span>
          </span>
        </div>
      </div>

      {tip && (
        <div
          className="pointer-events-none fixed z-50 w-44 rounded-xl border border-white/10 bg-[#12140f]/95 p-3 shadow-[0_18px_50px_rgba(0,0,0,.6)] backdrop-blur"
          style={{
            left: tip.cx,
            top: tip.below ? tip.bottom + 8 : undefined,
            bottom: tip.below ? undefined : window.innerHeight - tip.top + 8,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="text-[10px] font-bold uppercase tracking-[.18em] text-stone-500">
            {fmtDay.format(parseDay(tip.date))}
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="font-display text-lg font-extrabold text-stone-50">
              {(tipMinutes / 60).toFixed(1)}h
            </span>
            <span className="text-[11px] text-stone-500">target {targetHours}h</span>
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-lime-300 to-[#f6e3ba]"
              style={{
                width: `${Math.min(100, Math.round((tipMinutes / targetMinutes) * 100))}%`,
              }}
            />
          </div>
          {tipRecord?.targetMet && (
            <div className="mt-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#f6e3ba]">
              Target met
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function StatChip({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#f6e3ba]/15 bg-[#f6e3ba]/[.06] px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f6e3ba]/10 text-[#f6e3ba]">
        {icon}
      </span>
      <span>
        <span className="block font-display text-lg font-extrabold leading-none text-stone-50">
          {value}
        </span>
        <span className="mt-1 block whitespace-nowrap text-[10px] font-bold uppercase tracking-[.16em] text-stone-500">
          {label}
        </span>
      </span>
    </div>
  );
}
