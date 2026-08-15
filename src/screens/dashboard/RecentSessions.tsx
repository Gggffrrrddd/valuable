import { Hourglass, Sprout, Fish, Disc3, Star, Check, X } from 'lucide-react';
import type { FocusSession } from '@/types';
import type { FocusVisualTheme } from '@/components/focus-visuals/types';

interface RecentSessionsProps {
  sessions: FocusSession[];
  loading: boolean;
}

function getThemeIcon(themeId: string) {
  switch (themeId as FocusVisualTheme) {
    case 'hourglass': return <Hourglass className="h-4 w-4" />;
    case 'tree': return <Sprout className="h-4 w-4" />;
    case 'jar': return <Fish className="h-4 w-4" />;
    case 'blade': return <Disc3 className="h-4 w-4" />;
    case 'horse': return <Star className="h-4 w-4" />;
    default: return <Hourglass className="h-4 w-4" />;
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;

  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function RecentSessions({ sessions, loading }: RecentSessionsProps) {
  if (loading) {
    return (
      <div className="surface p-5 sm:p-6">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-[.14em] text-stone-500">Recent sessions</h3>
        <div className="animate-pulse-soft text-sm text-stone-500">Loading sessions…</div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="surface flex min-h-48 flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[.04]">
          <Hourglass className="h-5 w-5 text-stone-600" />
        </div>
        <div className="text-sm font-semibold text-stone-400">No sessions yet</div>
        <div className="mt-1 text-xs text-stone-600">Your focus history will appear here.</div>
      </div>
    );
  }

  return (
    <div className="surface p-5 sm:p-6">
      <h3 className="mb-4 text-sm font-bold uppercase tracking-[.14em] text-stone-500">Recent sessions</h3>
      <div className="space-y-2">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="flex items-center justify-between rounded-xl border border-white/[.06] bg-white/[.025] px-4 py-3 transition hover:border-white/10 hover:bg-white/[.04]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-lime-300/[.08] text-lime-300">
                {getThemeIcon(session.visual_theme || 'hourglass')}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-stone-200">
                  {session.subject_tag || 'Focus session'}
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <span>{formatDuration(session.duration_seconds)}</span>
                  <span className="h-3 w-px bg-white/[.08]" />
                  <span>{formatTime(session.started_at)}</span>
                </div>
              </div>
            </div>
            <div className="shrink-0">
              {session.completed_fully ? (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-lime-300/10 text-lime-300">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                </div>
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-500/10 text-stone-500">
                  <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
