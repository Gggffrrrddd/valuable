import { Flame, Clock, Calendar } from 'lucide-react';

interface StreakHeroProps {
  currentStreak: number;
  todayMinutes: number;
  weekMinutes: number;
}

export default function StreakHero({ currentStreak, todayMinutes, weekMinutes }: StreakHeroProps) {
  const streakLabel = currentStreak === 1 ? 'day' : 'days';

  return (
    <div className="surface relative overflow-hidden p-6 sm:p-8 lg:p-10">
      <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-lime-300/[.06] blur-3xl" />
      <div className="relative">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.22em] text-lime-300">
          <Flame className="h-3.5 w-3.5" />
          Current streak
        </div>

        <div className="flex items-baseline gap-3">
          <span className="font-display text-[4.5rem] font-extrabold leading-none tracking-tight text-stone-50 sm:text-[6rem] lg:text-[7.5rem]">
            {currentStreak}
          </span>
          <span className="text-lg font-semibold text-stone-500 sm:text-xl">{streakLabel}</span>
        </div>

        <div className="mt-6 flex items-center gap-4 text-sm text-stone-400">
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-stone-500" />
            <span className="text-stone-300 font-semibold">{todayMinutes}m</span> today
          </span>
          <span className="h-3.5 w-px bg-white/[.08]" />
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-stone-500" />
            <span className="text-stone-300 font-semibold">{weekMinutes}m</span> this week
          </span>
        </div>
      </div>
    </div>
  );
}
