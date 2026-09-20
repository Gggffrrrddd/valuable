import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { fetchCirclePresence, type CirclePresenceStatus } from '@/lib/presence';
import { readLocalFocusState, type LocalFocusState } from '@/lib/localSession';
import TableScene3D, {
  type SeatOccupant,
} from '@/components/circle-table/TableScene3D';
import {
  DEFAULT_TABLE_TRANSFORM,
  replicateChairs,
  SLIDER_ROWS,
  type ObjectTransform,
} from '@/components/circle-table/transformConfig';
import { ArrowLeft } from 'lucide-react';

/** Friend-status poll cadence while this screen is open in the foreground. */
const POLL_MS = 6000;
/** Own seat reads local session state directly — cheap local re-check cadence. */
const OWN_STATE_POLL_MS = 1000;

const OWN_STATUS_BY_STATE: Record<LocalFocusState, CirclePresenceStatus> = {
  idle: 'online-idle',
  focusing: 'focusing',
  paused: 'paused',
};

const INITIAL_CHARACTER: ObjectTransform = {
  scale: 1,
  positionX: 1.15,
  positionY: 0.86,
  positionZ: 0.94,
  rotationX: 0,
  rotationY: -1.82,
  rotationZ: 0,
};

const INITIAL_CHAIR: ObjectTransform = {
  scale: 1,
  positionX: 1.15,
  positionY: 0.86,
  positionZ: 0.94,
  rotationX: 0,
  rotationY: -1.82,
  rotationZ: 0,
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
  const [characterTransform, setCharacterTransform] = useState<ObjectTransform>(INITIAL_CHARACTER);
  const [chairTransform, setChairTransform] = useState<ObjectTransform>(INITIAL_CHAIR);
  const [spin, setSpin] = useState(false);
  const dragOrigin = useRef<{ x: number; y: number } | null>(null);
  const chairDragOrigin = useRef<{ x: number; y: number } | null>(null);

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

  // The six character chairs are built from the single reference chair,
  // replicated in 60° steps around the table center.
  const characterTransforms = useMemo(
    () =>
      replicateChairs(characterTransform, {
        x: DEFAULT_TABLE_TRANSFORM.positionX,
        z: DEFAULT_TABLE_TRANSFORM.positionZ,
      }),
    [characterTransform],
  );

  // The six original chairs are driven the same way, from their own reference.
  const chairTransforms = useMemo(
    () =>
      replicateChairs(chairTransform, {
        x: DEFAULT_TABLE_TRANSFORM.positionX,
        z: DEFAULT_TABLE_TRANSFORM.positionZ,
      }),
    [chairTransform],
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#090b0a]">
      <div className="absolute inset-0">
        <TableScene3D
          self={self}
          friends={seatedFriends}
          transform={DEFAULT_TABLE_TRANSFORM}
          chairs={chairTransforms}
          characterTransforms={characterTransforms}
          spin={spin}
        />
      </div>

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

      <div className="pointer-events-auto absolute right-4 top-20 z-30 w-72 rounded-2xl border border-white/[.08] bg-black/60 p-4 text-stone-300 shadow-2xl backdrop-blur-xl sm:right-6 sm:top-24">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[.18em] text-lime-300">Character chairs</div>
            <div className="mt-1 text-xs text-stone-400">Reference chair tuner — six replicas follow</div>
          </div>
          <button
            type="button"
            className="rounded-lg border border-lime-300/30 px-2.5 py-1.5 text-[10px] font-bold text-lime-200 hover:bg-lime-300/10"
            onClick={() => setSpin((value) => !value)}
          >
            {spin ? 'Rotate: on' : 'Rotate: off'}
          </button>
        </div>

        <div
          className="mb-3 cursor-move rounded-lg border border-dashed border-lime-300/30 bg-lime-300/[.04] px-3 py-2 text-[10px] text-stone-400"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            dragOrigin.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerMove={(event) => {
            if (!dragOrigin.current) return;
            const dx = event.clientX - dragOrigin.current.x;
            const dy = event.clientY - dragOrigin.current.y;
            dragOrigin.current = { x: event.clientX, y: event.clientY };
            setCharacterTransform((current) => ({
              ...current,
              positionX: current.positionX + dx * 0.01,
              positionZ: current.positionZ + dy * 0.01,
            }));
          }}
          onPointerUp={() => {
            dragOrigin.current = null;
          }}
          onPointerCancel={() => {
            dragOrigin.current = null;
          }}
        >
          Drag here to position X / Z — moves the reference chair, all six follow
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            className="rounded-lg border border-lime-300/30 px-2.5 py-1.5 text-[10px] font-bold text-lime-200 hover:bg-lime-300/10"
            onClick={() => setSpin((value) => !value)}
          >
            {spin ? 'Rotate: on' : 'Rotate: off'}
          </button>
          <button
            type="button"
            className="rounded-lg border border-lime-300/30 px-2.5 py-1.5 text-[10px] font-bold text-lime-200 hover:bg-lime-300/10"
            onClick={() => {
              console.log('SITTING_CHARACTER_START');
              console.log('reference:', JSON.stringify(characterTransform, null, 2));
              console.log('replicas:', JSON.stringify(characterTransforms, null, 2));
              console.log('SITTING_CHARACTER_END');
            }}
          >
            Save
          </button>
        </div>
        <div className="space-y-2">
          {SLIDER_ROWS.map(({ key, label, min, max, step }) => (
            <label key={key} className="grid grid-cols-[4.5rem_1fr_2.5rem] items-center gap-2 text-[10px]">
              <span className="text-stone-500">{label}</span>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={characterTransform[key]}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setCharacterTransform((current) => ({ ...current, [key]: value }));
                }}
                className="h-1 accent-lime-300"
              />
              <span className="text-right tabular-nums text-stone-400">{characterTransform[key].toFixed(2)}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="pointer-events-auto absolute right-4 top-[34rem] z-30 w-72 rounded-2xl border border-white/[.08] bg-black/60 p-4 text-stone-300 shadow-2xl backdrop-blur-xl sm:right-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[.18em] text-lime-300">Chairs</div>
            <div className="mt-1 text-xs text-stone-400">Reference chair tuner — six replicas follow</div>
          </div>
        </div>

        <div
          className="mb-3 cursor-move rounded-lg border border-dashed border-lime-300/30 bg-lime-300/[.04] px-3 py-2 text-[10px] text-stone-400"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            chairDragOrigin.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerMove={(event) => {
            if (!chairDragOrigin.current) return;
            const dx = event.clientX - chairDragOrigin.current.x;
            const dy = event.clientY - chairDragOrigin.current.y;
            chairDragOrigin.current = { x: event.clientX, y: event.clientY };
            setChairTransform((current) => ({
              ...current,
              positionX: current.positionX + dx * 0.01,
              positionZ: current.positionZ + dy * 0.01,
            }));
          }}
          onPointerUp={() => {
            chairDragOrigin.current = null;
          }}
          onPointerCancel={() => {
            chairDragOrigin.current = null;
          }}
        >
          Drag here to position X / Z — moves the reference chair, all six follow
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            className="rounded-lg border border-lime-300/30 px-2.5 py-1.5 text-[10px] font-bold text-lime-200 hover:bg-lime-300/10"
            onClick={() => {
              console.log('CHAIR_START');
              console.log('reference:', JSON.stringify(chairTransform, null, 2));
              console.log('replicas:', JSON.stringify(chairTransforms, null, 2));
              console.log('CHAIR_END');
            }}
          >
            Save
          </button>
        </div>
        <div className="space-y-2">
          {SLIDER_ROWS.map(({ key, label, min, max, step }) => (
            <label key={key} className="grid grid-cols-[4.5rem_1fr_2.5rem] items-center gap-2 text-[10px]">
              <span className="text-stone-500">{label}</span>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={chairTransform[key]}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setChairTransform((current) => ({ ...current, [key]: value }));
                }}
                className="h-1 accent-lime-300"
              />
              <span className="text-right tabular-nums text-stone-400">{chairTransform[key].toFixed(2)}</span>
            </label>
          ))}
        </div>
      </div>

    </div>
  );
}
