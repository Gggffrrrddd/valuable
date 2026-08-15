import { Users, Flame, Clock, ArrowRight } from 'lucide-react';
import type { FriendStat } from '@/lib/stats';

interface FriendsPreviewProps {
  friends: FriendStat[];
  loading: boolean;
  onViewAll: () => void;
}

export default function FriendsPreview({ friends, loading, onViewAll }: FriendsPreviewProps) {
  const previewFriends = friends.slice(0, 4);

  if (loading) {
    return (
      <div className="surface p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-[.14em] text-stone-500">Your circle</h3>
        </div>
        <div className="animate-pulse-soft text-sm text-stone-500">Loading friends…</div>
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="surface flex min-h-48 flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[.04]">
          <Users className="h-5 w-5 text-stone-600" />
        </div>
        <div className="text-sm font-semibold text-stone-400">Your circle is quiet</div>
        <div className="mt-1 text-xs text-stone-600">Add friends to see their focus activity.</div>
        <button
          onClick={onViewAll}
          className="mt-4 flex items-center gap-1.5 rounded-xl border border-lime-300/20 bg-lime-300/[.06] px-4 py-2 text-xs font-bold text-lime-300 transition hover:border-lime-300/40 hover:bg-lime-300/[.10]"
        >
          Add a friend
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="surface p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-[.14em] text-stone-500">Your circle</h3>
        {friends.length > 4 && (
          <button
            onClick={onViewAll}
            className="flex items-center gap-1 text-xs font-semibold text-lime-300 transition hover:text-lime-200"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="space-y-2">
        {previewFriends.map((friend) => (
          <div
            key={friend.profile.id}
            className="flex items-center justify-between rounded-xl border border-white/[.06] bg-white/[.025] px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-stone-700 to-stone-900 font-display text-sm font-extrabold text-lime-300 ring-1 ring-white/10">
                {friend.profile.display_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-semibold text-stone-200">{friend.profile.display_name}</div>
                <div className="text-xs text-stone-500">{friend.profile.friend_code}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-stone-400">
                <Clock className="h-3 w-3 text-stone-500" />
                <span className="font-semibold text-stone-300">{friend.todayMinutes}m</span>
              </span>
              <span className="flex items-center gap-1 text-stone-400">
                <Flame className="h-3 w-3 text-orange-400/70" />
                <span className="font-semibold text-stone-300">{friend.currentStreak}d</span>
              </span>
            </div>
          </div>
        ))}
      </div>
      {friends.length > 4 && (
        <button
          onClick={onViewAll}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/[.07] bg-white/[.03] px-4 py-2.5 text-sm font-medium text-stone-400 transition hover:border-white/15 hover:bg-white/[.06] hover:text-stone-200"
        >
          View all {friends.length} friends
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
