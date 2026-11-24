import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  Check,
  CircleDashed,
  Loader2,
  Target,
  Timer,
  X,
  XCircle,
} from "lucide-react";
import {
  fetchDaySessions,
  formatFocusDuration as formatDuration,
  parseDay,
  type DaySession,
} from "@/lib/compete";

export type DayStatus = "progress" | "met" | "partial" | "missed" | "future";

interface Props {
  userId: string;
  date: string;
  minutes: number;
  targetMinutes: number;
  status: DayStatus;
  onClose: () => void;
}

const dayFmt = new Intl.DateTimeFormat("en", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const STATUS_META: Record<
  DayStatus,
  { label: string; className: string; icon: typeof Check }
> = {
  met: {
    label: "Target met",
    className: "border-lime-300/30 bg-lime-300/10 text-lime-200",
    icon: Check,
  },
  partial: {
    label: "Partial",
    className: "border-[#f6e3ba]/30 bg-[#f6e3ba]/10 text-[#f6e3ba]",
    icon: CircleDashed,
  },
  missed: {
    label: "Missed",
    className: "border-rose-300/20 bg-rose-300/[.07] text-rose-200/70",
    icon: XCircle,
  },
  progress: {
    label: "In progress",
    className: "border-[#f6e3ba]/25 bg-[#f6e3ba]/[.07] text-[#f6e3ba]/80",
    icon: Timer,
  },
  future: {
    label: "Upcoming",
    className: "border-white/10 bg-white/[.04] text-stone-500",
    icon: CalendarDays,
  },
};

export default function DayDetailSheet({
  userId,
  date,
  minutes,
  targetMinutes,
  status,
  onClose,
}: Props) {
  const [sessions, setSessions] = useState<DaySession[] | null>(null);
  const [failed, setFailed] = useState(false);
  const meta = STATUS_META[status];
  const StatusIcon = meta.icon;
  const progress = targetMinutes > 0 ? Math.min(1, minutes / targetMinutes) : 0;
  const percent = Math.round(progress * 100);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setSessions(null);
    setFailed(false);
    fetchDaySessions(userId, date)
      .then((rows) => {
        if (!cancelled) setSessions(rows);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [date, userId]);

  const subjectBreakdown = useMemo(() => {
    if (!sessions) return [];
    const map = new Map<string, { minutes: number; count: number }>();
    for (const s of sessions) {
      if (!s.subject) continue;
      const row = map.get(s.subject) ?? { minutes: 0, count: 0 };
      row.minutes += s.minutes;
      row.count += 1;
      map.set(s.subject, row);
    }
    return [...map.entries()]
      .map(([subject, row]) => ({ subject, ...row }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [sessions]);

  const taggedCount = subjectBreakdown.reduce((sum, row) => sum + row.count, 0);

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Study details for ${dayFmt.format(parseDay(date))}`}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[88dvh] w-full overflow-y-auto rounded-t-[1.7rem] border border-white/10 bg-[#11130d] p-5 shadow-[0_-24px_80px_rgba(0,0,0,.65)] sm:max-w-md sm:rounded-[1.7rem] sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[.22em] text-stone-500">
              Day detail
            </div>
            <h3 className="mt-1 font-display text-lg font-extrabold tracking-[-.01em] text-stone-50">
              {dayFmt.format(parseDay(date))}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close day detail"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[.04] text-stone-400 transition hover:border-[#f6e3ba]/40 hover:text-[#f6e3ba]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/[.07] bg-white/[.025] p-3">
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.16em] text-stone-600">
              <Timer className="h-3 w-3" /> Study
            </div>
            <div className="mt-1.5 font-display text-xl font-extrabold text-stone-50">
              {formatDuration(minutes)}
            </div>
          </div>
          <div className="rounded-2xl border border-white/[.07] bg-white/[.025] p-3">
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.16em] text-stone-600">
              <Target className="h-3 w-3" /> Target
            </div>
            <div className="mt-1.5 font-display text-xl font-extrabold text-stone-50">
              {formatDuration(targetMinutes)}
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-white/[.07] bg-white/[.025] p-3">
          <div className="flex items-center justify-between gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] ${meta.className}`}
            >
              <StatusIcon className="h-3 w-3" />
              {meta.label}
            </span>
            <span className="text-xs font-semibold tabular-nums text-stone-500">
              {percent}%
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#f6e3ba]/60 to-[#f6e3ba] transition-[width] duration-700 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {!failed && sessions === null && (
          <div className="mt-4 flex items-center gap-2 text-xs text-stone-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading sessions
          </div>
        )}

        {!failed && sessions && sessions.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[.18em] text-stone-600">
              <span>Sessions</span>
              <span>{sessions.length}</span>
            </div>
            {subjectBreakdown.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {subjectBreakdown.map((row) => (
                  <div
                    key={row.subject}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/[.06] bg-white/[.02] px-3 py-2"
                  >
                    <span className="truncate text-xs font-semibold text-stone-300">
                      {row.subject}
                    </span>
                    <span className="shrink-0 text-[10px] text-stone-500">
                      {formatDuration(row.minutes)} · {row.count}
                    </span>
                  </div>
                ))}
                {taggedCount < sessions.length && (
                  <div className="px-1 text-[10px] text-stone-600">
                    {sessions.length - taggedCount} untagged session
                    {sessions.length - taggedCount === 1 ? "" : "s"}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
