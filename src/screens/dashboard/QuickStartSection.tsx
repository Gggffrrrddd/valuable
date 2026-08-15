import { Play, Settings } from 'lucide-react';
import { FOCUS_VISUAL_THEMES } from '@/components/focus-visuals/types';
import { requestQuickStart, type QuickStartConfig } from '@/lib/stats';

interface QuickStartSectionProps {
  lastSession: QuickStartConfig | null;
  onStartTimer: () => void;
}

function getThemeLabel(themeId: string): string {
  const theme = FOCUS_VISUAL_THEMES.find((t) => t.id === themeId);
  return theme?.label || 'Hourglass';
}

export default function QuickStartSection({ lastSession, onStartTimer }: QuickStartSectionProps) {
  function handleQuickStart() {
    if (!lastSession) {
      onStartTimer();
      return;
    }
    requestQuickStart(lastSession);
    onStartTimer();
  }

  if (lastSession) {
    return (
      <div className="surface p-5 sm:p-6">
        <div className="mb-3 text-[10px] font-bold uppercase tracking-[.18em] text-stone-500">Quick start</div>
        <button
          onClick={handleQuickStart}
          className="group flex w-full items-center justify-between rounded-2xl border border-lime-300/20 bg-lime-300/[.06] p-4 text-left transition hover:border-lime-300/40 hover:bg-lime-300/[.10]"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-lime-300 text-[#11130f] shadow-[0_0_24px_rgba(197,255,84,.15)] transition group-hover:scale-105">
              <Play className="h-5 w-5 ml-0.5" strokeWidth={2.2} />
            </div>
            <div>
              <div className="text-base font-bold text-stone-50">
                {lastSession.focusMinutes}m {getThemeLabel(lastSession.visualTheme)}
              </div>
              <div className="text-xs text-stone-500">
                {lastSession.breakMinutes}m break · {lastSession.subjectTag || 'No subject'}
              </div>
            </div>
          </div>
        </button>
        <button
          onClick={onStartTimer}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/[.07] bg-white/[.03] px-4 py-2.5 text-sm font-medium text-stone-400 transition hover:border-white/15 hover:bg-white/[.06] hover:text-stone-200"
        >
          <Settings className="h-4 w-4" />
          Customize session
        </button>
      </div>
    );
  }

  return (
    <div className="surface p-5 sm:p-6">
      <div className="mb-3 text-[10px] font-bold uppercase tracking-[.18em] text-stone-500">Ready to focus?</div>
      <button
        onClick={onStartTimer}
        className="primary-button flex w-full items-center justify-center gap-2 py-4 text-base"
      >
        <Play className="h-5 w-5" />
        Start your first session
      </button>
    </div>
  );
}
