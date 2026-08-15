import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { fetchStats, fetchRecentSessions, fetchAcceptedFriends, getLastQuickStart, type Stats, type FriendStat } from '@/lib/stats';
import type { FocusSession, QuickStartConfig } from '@/types';
import StreakHero from './StreakHero';
import QuickStartSection from './QuickStartSection';
import RecentSessions from './RecentSessions';
import FriendsPreview from './FriendsPreview';

interface DashboardScreenProps {
  onStartTimer: () => void;
  onGoToFriends: () => void;
}

export default function DashboardScreen({ onStartTimer, onGoToFriends }: DashboardScreenProps) {
  const { profile, session } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentSessions, setRecentSessions] = useState<FocusSession[]>([]);
  const [friends, setFriends] = useState<FriendStat[]>([]);
  const [lastSession, setLastSession] = useState<QuickStartConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;

    async function loadData() {
      setLoading(true);
      try {
        const [statsData, sessionsData, friendsData] = await Promise.all([
          fetchStats(session!.user.id, false),
          fetchRecentSessions(session!.user.id, 6),
          fetchAcceptedFriends(session!.user.id),
        ]);
        setStats(statsData);
        setRecentSessions(sessionsData);
        setFriends(friendsData);
        setLastSession(getLastQuickStart());
      } catch (e) {
        console.error('Dashboard load error:', e);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [session]);

  const greeting = getGreeting();
  const displayName = profile?.display_name || 'there';

  return (
    <div className="page-wrap pb-24">
      <div className="mb-8">
        <div className="page-kicker">Your home base</div>
        <h1 className="text-3xl font-extrabold text-stone-50 sm:text-4xl">
          {greeting}, {displayName}
        </h1>
        <p className="mt-2 text-sm text-stone-400">Here's where your focus journey lives.</p>
      </div>

      {loading || !stats ? (
        <div className="animate-pulse-soft text-sm text-stone-500">Loading your dashboard…</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-6">
            <StreakHero
              currentStreak={stats.currentStreak}
              todayMinutes={stats.todayMinutes}
              weekMinutes={stats.weekMinutes}
            />
            <QuickStartSection
              lastSession={lastSession}
              onStartTimer={onStartTimer}
            />
          </div>
          <div className="flex flex-col gap-6">
            <RecentSessions sessions={recentSessions} loading={loading} />
            <FriendsPreview
              friends={friends}
              loading={loading}
              onViewAll={onGoToFriends}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
