import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { fetchCirclePresence, type CirclePresenceStatus } from '@/lib/presence';
import { readLocalFocusState, type LocalFocusState } from '@/lib/localSession';
import TableScene, { type SeatOccupant } from '@/components/circle-table/TableScene';
import { ArrowLeft, BookOpen } from 'lucide-react';

/** Friend-status poll cadence while this screen is open in the foreground. */
const POLL_MS = 6000;
/** Own seat reads local session state directly — cheap local re-check cadence. */
const OWN_STATE_POLL_MS = 1000;

const OWN_STATUS_BY_STATE: Record<LocalFocusState, CirclePresenceStatus> = {
  idle: 'online-idle',
  focusing: 'focusing',
  paused: 'paused',
};

interface StudyTableScreenProps {
  onBack: () => void;
}

interface CircleFriend {
  id: string;
  display_name: string;
}

async function fetchCircleFriends(userId: string): Promise<CircleFriend[]> {
  const { data: friendships, error } = await supabase
    .from('friendships')
    .select('user_id, friend_id, status')
    .eq('status', 'accepted')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
  if (error) throw error;

  const ids = (friendships || []).map((f) => (f.user_id === userId ? f.friend_id : f.user_id));
  if (ids.length === 0) return [];

  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', ids);
  if (pErr) throw pErr;
  // Deterministic order keeps friends in stable seats across polls/reloads.
  return ((profiles || []) as CircleFriend[]).sort((a, b) => a.id.localeCompare(b.id));
}

export default function StudyTableScreen({ onBack }: StudyTableScreenProps) {
  const { profile, session } = useAuth();
  const [friends, setFriends] = useState<CircleFriend[] | null>(null);
  const [statuses, setStatuses] = useState<Record<string, CirclePresenceStatus>>({});
  const [ownState, setOwnState] = useState<LocalFocusState>(() => readLocalFocusState());

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetchCircleFriends(session.user.id)
      .then((list) => {
        if (!cancelled) setFriends(list);
      })
      .catch((e) => {
        console.error('Circle friends load error:', e);
        if (!cancelled) setFriends([]);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const friendIdsKey = useMemo(() => (friends || []).map((f) => f.id).join(','), [friends]);

  // Pull-based presence: poll every few seconds while foregrounded; skip ticks
  // entirely while hidden and refresh immediately on returning visible.
  useEffect(() => {
    if (!friendIdsKey) return;
    const ids = friendIdsKey.split(',');
    let cancelled = false;
    const tick = async () => {
      if (document.hidden) return;
      const result = await fetchCirclePresence(ids);
      if (!cancelled) setStatuses(result);
    };
    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    const onVisibility = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [friendIdsKey]);

  // Own seat mirrors the local session state driving the flip-clock — never polled.
  useEffect(() => {
    const read = () => setOwnState(readLocalFocusState());
    const timer = setInterval(read, OWN_STATE_POLL_MS);
    const onVisibility = () => {
      if (!document.hidden) read();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const self: SeatOccupant = {
    id: 'self',
    name: profile?.display_name || 'You',
    status: OWN_STATUS_BY_STATE[ownState],
  };

  const seatedFriends: SeatOccupant[] = (friends || []).map((f) => ({
    id: f.id,
    name: f.display_name,
    status: statuses[f.id] ?? 'offline',
  }));

  const counts = useMemo(() => {
    const all = [self.status, ...seatedFriends.map((f) => f.status)];
    return {
      focusing: all.filter((s) => s === 'focusing').length,
      online: all.filter((s) => s === 'online-idle' || s === 'paused').length,
      away: all.filter((s) => s === 'offline').length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [self.status, friendIdsKey, statuses]);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#1A0E2E]">
      <TableScene self={self} friends={seatedFriends} />

      {/* Chrome floats over the full-bleed scene */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4 sm:p-6">
        <button
          onClick={onBack}
          className="icon-button pointer-events-auto flex h-10 items-center gap-2 px-3.5 text-xs font-bold"
          aria-label="Back to Circle"
        >
          <ArrowLeft className="h-4 w-4" />
          Circle
        </button>

        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/[.07] bg-black/30 px-4 py-2 text-[11px] font-bold tracking-wide text-stone-400 backdrop-blur-xl">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-300 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-lime-300" />
          </span>
          <span className="text-lime-300">{counts.focusing}</span> focusing
          <span className="text-stone-700">·</span>
          <span className="text-stone-200">{counts.online}</span> online
          <span className="text-stone-700">·</span>
          <span>{counts.away}</span> away
        </div>
      </div>

      {friends !== null && friends.length === 0 && (
        <div className="absolute bottom-8 left-1/2 z-20 w-[min(26rem,calc(100%-2rem))] -translate-x-1/2">
          <div className="surface-soft p-4 text-center backdrop-blur-xl">
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-stone-200">
              <BookOpen className="h-4 w-4 text-lime-300" /> Your table is quiet
            </div>
            <p className="mt-1.5 text-xs leading-5 text-stone-500">
              Add friends in Circle — up to five can join you at the table.
            </p>
          </div>
        </div>
      )}

      {friends !== null && friends.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4 sm:bottom-5">
          <div className="flex items-center gap-4 rounded-full border border-white/[.06] bg-black/30 px-5 py-2 text-[10px] font-bold uppercase tracking-[.14em] text-stone-500 backdrop-blur-xl">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-lime-300 shadow-[0_0_8px_rgba(212,175,127,.7)]" /> Open book — focusing</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-stone-600" /> Closed — resting</span>
          </div>
        </div>
      )}
    </div>
  );
}
