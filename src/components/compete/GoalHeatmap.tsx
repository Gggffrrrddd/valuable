import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Sprout, Flame, CalendarDays, X } from "lucide-react";
import {
  addDays,
  daysBetween,
  formatFocusDuration as formatDuration,
  parseDay,
  todayKey,
  type DayRecord,
} from "@/lib/compete";
import DayDetailSheet, { type DayStatus } from "./DayDetailSheet";

const MIN_CELL = 7;
const MAX_CELL = 46;
const GAP = 4;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const WEEKDAYS = ["Sun", "", "", "Wed", "", "", "Sat"];
const CELEBRATED_PREFIX = "valuable.tracker-celebrated.v1";
const fmtDay = new Intl.DateTimeFormat("en", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

interface Props {
  userId: string;
  startDate: string;
  examDate: string;
  targetHours: number;
  records: DayRecord[];
  /** Live today minutes from CompeteScreen (records may be up to 45s old). */
  todayMinutes?: number;
}

interface Tip {
  date: string;
  cx: number;
  top: number;
  bottom: number;
  below: boolean;
}

const STATUS_LABEL: Record<DayStatus, string> = {
  progress: "In progress",
  met: "Target met",
  partial: "Partial",
  missed: "Missed",
  future: "Upcoming",
};

/**
 * Calendar of tended days. Each square is a small glass: the gold fill is
 * the real fraction of that day's target, and a full day turns into a green
 * check. Past days keep their saved target snapshot.
 */
export default function GoalHeatmap({
  userId,
  startDate,
  examDate,
  targetHours,
  records,
  todayMinutes,
}: Props) {
  const [tip, setTip] = useState<Tip | null>(null);
  const [detailDate, setDetailDate] = useState<string | null>(null);
  /** Which 5-month window is on screen (0 = first). */
  const [page, setPage] = useState(0);
  const [cell, setCell] = useState(16);
  const [celebrate, setCelebrate] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const today = todayKey();
  const fallbackTarget = Math.max(1, targetHours * 60);

  const byDate = useMemo(() => {
    const m = new Map<string, DayRecord>();
    for (const r of records) m.set(r.date, r);
    return m;
  }, [records]);

  const targetFor = (rec?: DayRecord) => {
    const saved = rec?.targetMinutes;
    return saved && saved > 0 ? saved : fallbackTarget;
  };

  const minutesFor = (date: string) => {
    if (date === today && typeof todayMinutes === "number") {
      return Math.max(0, todayMinutes);
    }
    return Math.max(0, byDate.get(date)?.minutesCompleted ?? 0);
  };

  const progressFor = (date: string) => {
    const rec = byDate.get(date);
    return Math.min(1, minutesFor(date) / targetFor(rec));
  };

  const statusFor = (date: string): DayStatus => {
    if (date > today) return "future";
    const progress = progressFor(date);
    if (progress >= 1) return "met";
    if (date === today) return "progress";
    if (progress <= 0) return "missed";
    return "partial";
  };

  const todayMet = statusFor(today) === "met";
  const wasMetRef = useRef(todayMet);
  const celebrateKey = `${CELEBRATED_PREFIX}.${userId}.${today}`;

  useEffect(() => {
    if (todayMet && !wasMetRef.current) {
      let seen = false;
      try {
        seen = window.localStorage.getItem(celebrateKey) === "1";
      } catch {
        /* private mode */
      }
      if (!seen) {
        setCelebrate(true);
        try {
          window.localStorage.setItem(celebrateKey, "1");
        } catch {
          /* non-fatal */
        }
        const timer = window.setTimeout(() => setCelebrate(false), 1400);
        wasMetRef.current = true;
        return () => window.clearTimeout(timer);
      }
    }
    wasMetRef.current = todayMet;
  }, [celebrateKey, todayMet]);

  // 2-year cap: never track more than 24 months — the window ends on exam
  // day and reaches back at most 2 years (older history is not shown).
  const cappedStart = useMemo(() => {
    const exam = parseDay(examDate);
    const earliest = new Date(
      Date.UTC(
        exam.getUTCFullYear() - 2,
        exam.getUTCMonth(),
        exam.getUTCDate(),
      ),
    )
      .toISOString()
      .slice(0, 10);
    return startDate > earliest ? startDate : earliest;
  }, [startDate, examDate]);

  // One module shows at most 5 calendar months → page count for the range.
  const pageCount = useMemo(() => {
    const s = parseDay(cappedStart);
    const e = parseDay(examDate);
    const months =
      (e.getUTCFullYear() - s.getUTCFullYear()) * 12 +
      (e.getUTCMonth() - s.getUTCMonth()) +
      1;
    return Math.max(1, Math.ceil(months / 5));
  }, [cappedStart, examDate]);

  const safePage = Math.min(page, pageCount - 1);

  const { pageStart, pageEnd } = useMemo(() => {
    const anchor = parseDay(cappedStart);
    const startOf = (m: number) =>
      new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + m, 1))
        .toISOString()
        .slice(0, 10);
    const endOf = (m: number) =>
      new Date(
        Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + m + 1, 0),
      )
        .toISOString()
        .slice(0, 10);
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

  // Fill the available section width with square day cells instead of
  // stranding a fixed 16px grid in the corner.
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      if (width <= 0) return;
      const available = width - 40 - GAP * Math.max(0, columns - 1);
      const next = Math.floor(available / columns);
      setCell(Math.max(MIN_CELL, Math.min(MAX_CELL, next)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [columns]);

  const stats = useMemo(() => {
    const met = (date: string) => {
      if (date > today) return false;
      const rec = byDate.get(date);
      return progressFor(date) >= 1 && Boolean(rec || date === today);
    };

    // Stats cover the whole (capped) range, not just the visible page.
    let daysCompleted = 0;
    for (const r of records) {
      if (met(r.date) && r.date >= cappedStart && r.date <= examDate)
        daysCompleted++;
    }

    let streak = 0;
    let cursor = met(today) ? today : addDays(today, -1);
    while (met(cursor)) {
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
    // progressFor depends on todayMinutes/records; keep the live value in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cappedStart,
    examDate,
    records,
    byDate,
    today,
    todayMinutes,
    fallbackTarget,
  ]);

  const showTip = (date: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const below = r.top < 150;
    setTip({
      date,
      cx: Math.min(
        Math.max(r.left + r.width / 2, 100),
        window.innerWidth - 100,
      ),
      top: r.top,
      bottom: r.bottom,
      below,
    });
  };

  const hideTip = () => setTip(null);

  const tipMinutes = tip ? minutesFor(tip.date) : 0;
  const tipTarget = tip ? targetFor(byDate.get(tip.date)) : 0;
  const tipStatus = tip ? statusFor(tip.date) : "progress";
  const detailRec = detailDate ? byDate.get(detailDate) : undefined;
  const detailMinutes = detailDate ? minutesFor(detailDate) : 0;
  const detailTarget = detailDate ? targetFor(detailRec) : 0;
  const detailStatus = detailDate ? statusFor(detailDate) : "progress";

  const renderCell = (date: string) => {
    const status = statusFor(date);
    const progress = progressFor(date);
    const isToday = date === today;
    const iconSize = Math.max(6, Math.min(15, cell * 0.58));
    const label = `${fmtDay.format(parseDay(date))}: ${STATUS_LABEL[status]} — ${formatDuration(
      minutesFor(date),
    )} of ${formatDuration(targetFor(byDate.get(date)))}`;
    const fill =
      status === "partial" || (status === "progress" && progress > 0)
        ? progress
        : status === "met"
          ? 1
          : 0;

    return (
      <button
        key={date}
        type="button"
        disabled={status === "future"}
        aria-label={label}
        onClick={() => {
          if (status !== "future") {
            setDetailDate(date);
            hideTip();
          }
        }}
        onMouseEnter={(e) => {
          if (status !== "future") showTip(date, e.currentTarget);
        }}
        onMouseLeave={hideTip}
        className="tracker-day"
      >
        <span
          className={[
            "tracker-cell",
            isToday ? "tracker-cell-today" : "",
            status === "met" ? "tracker-cell-met" : "",
            status === "missed" ? "tracker-cell-missed" : "",
            status === "future" ? "tracker-cell-future" : "",
            isToday && celebrate ? "tracker-cell-celebrate" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{
            width: cell,
            height: cell,
            borderRadius: Math.max(4, Math.round(cell * 0.2)),
          }}
        >
          {status !== "met" && status !== "missed" && fill > 0 && (
            <span
              className={`tracker-fill ${isToday ? "tracker-fill-live" : ""}`}
              style={{ transform: `scaleY(${Math.max(0.02, fill)})` }}
            />
          )}
          {status === "met" && (
            <Check
              aria-hidden="true"
              strokeWidth={3}
              style={{ width: iconSize, height: iconSize }}
              className="relative z-10 text-lime-300"
            />
          )}
          {status === "missed" && (
            <X
              aria-hidden="true"
              strokeWidth={2.5}
              style={{ width: iconSize, height: iconSize }}
              className="relative z-10 text-rose-300/60"
            />
          )}
        </span>
      </button>
    );
  };

  return (
    <section className="relative overflow-hidden rounded-[1.6rem] border border-white/[.07] bg-white/[.025] p-5 shadow-[0_30px_80px_rgba(0,0,0,.4)] sm:p-7">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#f6e3ba]/[.07] to-transparent" />

      <div className="relative">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="page-kicker">Discipline tracker</div>
            <p className="mt-1 max-w-lg text-sm leading-6 text-stone-500">
              Every tended day, from {cappedStart} through exam day on{" "}
              {examDate}. One glass per day — the gold rises with that
              day&apos;s focus, and a full day becomes a green check. Shows 5
              months at a time, up to 2 years of history.
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

        <div ref={gridRef} className="relative mt-6 pb-1">
          <div className="flex w-full gap-2">
            <div
              className="w-7 pt-[22px] text-[9px] font-bold uppercase tracking-wider text-stone-600"
              style={{
                display: "grid",
                gridTemplateRows: `repeat(7, ${cell}px)`,
                rowGap: GAP,
              }}
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
                  display: "grid",
                  gridTemplateColumns: `repeat(${columns}, ${cell}px)`,
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
                  display: "grid",
                  gridAutoFlow: "column",
                  gridTemplateRows: `repeat(7, ${cell}px)`,
                  gridAutoColumns: `${cell}px`,
                  gap: GAP,
                }}
              >
                {cells.map((date, i) => {
                  if (!date)
                    return <span key={`pad-${i}`} className="invisible" />;
                  return renderCell(date);
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 5-month pagination: old tracker navigation, unchanged. */}
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

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-[10px] font-bold uppercase tracking-[.16em] text-stone-600">
          <span className="flex items-center gap-2">
            Empty <span className="tracker-legend tracker-legend-empty" />
          </span>
          <span className="flex items-center gap-2">
            Partial <span className="tracker-legend tracker-legend-partial" />
          </span>
          <span className="flex items-center gap-2">
            Target met{" "}
            <span className="tracker-legend tracker-legend-met">
              <Check className="h-2.5 w-2.5" />
            </span>
          </span>
          <span className="flex items-center gap-2">
            Missed{" "}
            <span className="tracker-legend tracker-legend-missed">
              <X className="h-2.5 w-2.5" />
            </span>
          </span>
          <span className="flex items-center gap-2">
            Today <span className="tracker-legend tracker-legend-today" />
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
            transform: "translateX(-50%)",
          }}
        >
          <div className="text-[10px] font-bold uppercase tracking-[.18em] text-stone-500">
            {fmtDay.format(parseDay(tip.date))}
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="font-display text-lg font-extrabold text-stone-50">
              {formatDuration(tipMinutes)}
            </span>
            <span className="text-[11px] text-stone-500">
              target {formatDuration(tipTarget)}
            </span>
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-lime-300 to-[#f6e3ba]"
              style={{
                width: `${Math.min(100, Math.round((tipMinutes / tipTarget) * 100))}%`,
              }}
            />
          </div>
          <div className="mt-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#f6e3ba]">
            {STATUS_LABEL[tipStatus]}
          </div>
        </div>
      )}

      {detailDate && (
        <DayDetailSheet
          userId={userId}
          date={detailDate}
          minutes={detailMinutes}
          targetMinutes={detailTarget}
          status={detailStatus}
          onClose={() => setDetailDate(null)}
        />
      )}
    </section>
  );
}

function StatChip({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string;
  label: string;
}) {
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
