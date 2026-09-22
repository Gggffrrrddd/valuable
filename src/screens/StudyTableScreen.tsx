import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { fetchCirclePresence, type CirclePresenceStatus } from '@/lib/presence';
import { readLocalFocusState, type LocalFocusState } from '@/lib/localSession';
import TableScene3D, {
  DEFAULT_FLOOR_TRANSFORM,
  DEFAULT_WALL_TRANSFORM,
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

/** Tuned reference for the sitting-character chairs (final hardcoded values). */
const CHARACTER_REFERENCE: ObjectTransform = {
  scale: 0.74,
  positionX: 1.15,
  positionY: 0.5,
  positionZ: 0.94,
  rotationX: 0,
  rotationY: -1.82,
  rotationZ: 0,
};

/** Tuned reference for the empty OBJ chairs (kept invisible, still in scene). */
const CHAIR_REFERENCE: ObjectTransform = {
  scale: 0.74,
  positionX: 1.18,
  positionY: 0.84,
  positionZ: 0.95,
  rotationX: 0,
  rotationY: -1.82,
  rotationZ: 0,
};

const TABLE_CENTER = {
  x: DEFAULT_TABLE_TRANSFORM.positionX,
  z: DEFAULT_TABLE_TRANSFORM.positionZ,
};

/** Six character chairs and six empty chairs, replicated 60° apart around the table. */
const CHARACTER_CHAIRS = replicateChairs(CHARACTER_REFERENCE, TABLE_CENTER);
const CHAIR_SEATS = replicateChairs(CHAIR_REFERENCE, TABLE_CENTER);

/** Final hand-tuned books, one per seat (values captured from the live tuner). */
const BOOK_TRANSFORMS: ObjectTransform[] = [
  {
    scale: 0.5,
    positionX: 0.85,
    positionY: 1.09,
    positionZ: 0.8201923788646686,
    rotationX: 1.55,
    rotationY: -3.14,
    rotationZ: -1.81,
  },
  {
    scale: 0.5,
    positionX: 0.53,
    positionY: 1.09,
    positionZ: -0.01980762113533141,
    rotationX: 1.52,
    rotationY: -3.13,
    rotationZ: -0.81,
  },
  {
    scale: 0.5,
    positionX: -0.34999999999999987,
    positionY: 1.09,
    positionZ: -0.17999999999999994,
    rotationX: 1.58,
    rotationY: -3.14,
    rotationZ: 0.31,
  },
  {
    scale: 0.5,
    positionX: -0.9274613391789284,
    positionY: 1.09,
    positionZ: 0.49980762113533117,
    rotationX: 1.55,
    rotationY: -3.14,
    rotationZ: 1.14,
  },
  {
    scale: 0.5,
    positionX: -0.6,
    positionY: 1.09,
    positionZ: 1.38,
    rotationX: 1.55,
    rotationY: -3.14,
    rotationZ: 2.31,
  },
  {
    scale: 0.5,
    positionX: 0.25,
    positionY: 1.09,
    positionZ: 1.5,
    rotationX: 1.55,
    rotationY: -3.14,
    rotationZ: -2.86,
  },
];

/** Final hand-tuned plant on the table (values captured from the live tuner). */
const PLANT_TRANSFORM: ObjectTransform = {
  scale: 0.99,
  positionX: -0.02,
  positionY: 1.15,
  positionZ: 0.65,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
};

/** Reference pen holder (slot 1); slots 2-6 replicate it 60 degrees apart. */
const PEN_HOLDER_REFERENCE: ObjectTransform = {
  scale: 0.9,
  positionX: 0.67,
  positionY: 1.09,
  positionZ: 0.96,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
};

/** Final hand-tuned pen holders, one per seat (replicas + slot 5 overridden). */
const PEN_HOLDER_TRANSFORMS: ObjectTransform[] = (() => {
  const seats = replicateChairs(PEN_HOLDER_REFERENCE, TABLE_CENTER);
  seats[4] = {
    scale: 0.9,
    positionX: -0.67,
    positionY: 1.08,
    positionZ: 1.17,
    rotationX: 0,
    rotationY: 4.19,
    rotationZ: 0,
  };
  return seats;
})();

/** Final hand-tuned open books, one per seat (Book 5 overridden by hand). */
const OPEN_BOOK_TRANSFORMS: ObjectTransform[] = (() => {
  const seats = replicateChairs(
    { scale: 1.12, positionX: 0.25, positionY: 1.07, positionZ: 1.54, rotationX: -0.03, rotationY: -2.81, rotationZ: 0.03 },
    TABLE_CENTER,
  );
  // The tuned reference lands in slot 6; shift the rest up.
  const ordered = [...seats.slice(1), seats[0]];
  ordered[4] = {
    scale: 1.12,
    positionX: -0.69,
    positionY: 1.07,
    positionZ: 1.36,
    rotationX: -0.03,
    rotationY: 2.43,
    rotationZ: 0.03,
  };
  return ordered;
})();

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
  const openBookTransforms = OPEN_BOOK_TRANSFORMS;
  const [floorTransform, setFloorTransform] = useState<ObjectTransform>(DEFAULT_FLOOR_TRANSFORM);
  const [floorZoom, setFloorZoom] = useState(1);
  const [wallTransform, setWallTransform] = useState<ObjectTransform>(DEFAULT_WALL_TRANSFORM);
  const [wallZoom, setWallZoom] = useState(1);
  const [surface, setSurface] = useState<'floor' | 'wall'>('floor');
  const dragOrigin = useRef<{ x: number; y: number } | null>(null);

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
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#090b0a]">
      <div className="absolute inset-0">
        <TableScene3D
          self={self}
          friends={seatedFriends}
          transform={DEFAULT_TABLE_TRANSFORM}
          chairs={CHAIR_SEATS}
          characterTransforms={CHARACTER_CHAIRS}
          bookTransforms={BOOK_TRANSFORMS}
          openBookTransforms={openBookTransforms}
          plantTransforms={[PLANT_TRANSFORM]}
          penHolderTransforms={PEN_HOLDER_TRANSFORMS}
          floorTransform={floorTransform}
          floorZoom={floorZoom}
          wallTransform={wallTransform}
          wallZoom={wallZoom}
          spin={false}
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
        <div className="mb-3">
          <div className="text-[10px] font-bold uppercase tracking-[.18em] text-lime-300">Surface tuner</div>
          <div className="mt-1 text-xs text-stone-400">Move, tilt and zoom the floor / wall image</div>
        </div>

        <div className="mb-3 flex gap-1">
          {(['floor', 'wall'] as const).map((target) => (
            <button
              key={target}
              type="button"
              onClick={() => setSurface(target)}
              className={`flex-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[.1em] ${
                surface === target
                  ? 'border-lime-300 bg-lime-300 text-[#11130f]'
                  : 'border-lime-300/30 text-lime-200 hover:bg-lime-300/10'
              }`}
            >
              {target}
            </button>
          ))}
        </div>

        <SurfaceSliders
          transform={surface === 'floor' ? floorTransform : wallTransform}
          onTransformChange={surface === 'floor' ? setFloorTransform : setWallTransform}
          zoom={surface === 'floor' ? floorZoom : wallZoom}
          onZoomChange={surface === 'floor' ? setFloorZoom : setWallZoom}
          onDrag={(dx, dy) => {
            const apply = (current: ObjectTransform) => ({
              ...current,
              positionX: current.positionX + dx,
              positionY: current.positionY - dy,
            });
            if (surface === 'floor') setFloorTransform(apply);
            else setWallTransform(apply);
          }}
          dragOrigin={dragOrigin}
        />

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-lg border border-lime-300/40 bg-lime-300/10 px-2.5 py-1.5 text-[10px] font-bold text-lime-200 hover:bg-lime-300/20"
            onClick={() => {
              if (surface === 'floor') {
                console.log('FLOOR_START');
                console.log(JSON.stringify({ ...floorTransform, zoom: floorZoom }, null, 2));
                console.log('FLOOR_END');
              } else {
                console.log('WALL_START');
                console.log(JSON.stringify({ ...wallTransform, zoom: wallZoom }, null, 2));
                console.log('WALL_END');
              }
            }}
          >
            Save
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-bold text-stone-400 hover:bg-white/5"
            onClick={() => {
              if (surface === 'floor') {
                setFloorTransform(DEFAULT_FLOOR_TRANSFORM);
                setFloorZoom(1);
              } else {
                setWallTransform(DEFAULT_WALL_TRANSFORM);
                setWallZoom(1);
              }
            }}
          >
            Reset
          </button>
        </div>
      </div>

    </div>
  );
}

function SurfaceSliders({
  transform,
  onTransformChange,
  zoom,
  onZoomChange,
  onDrag,
  dragOrigin,
}: {
  transform: ObjectTransform;
  onTransformChange: (next: ObjectTransform) => void;
  zoom: number;
  onZoomChange: (next: number) => void;
  onDrag: (dx: number, dy: number) => void;
  dragOrigin: React.MutableRefObject<{ x: number; y: number } | null>;
}) {
  return (
    <>
      <div
        className="mb-3 cursor-move rounded-lg border border-dashed border-lime-300/30 bg-lime-300/[.04] px-3 py-2 text-[10px] text-stone-400"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragOrigin.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerMove={(event) => {
          if (!dragOrigin.current) return;
          const dx = (event.clientX - dragOrigin.current.x) * 0.01;
          const dy = (event.clientY - dragOrigin.current.y) * 0.01;
          dragOrigin.current = { x: event.clientX, y: event.clientY };
          onDrag(dx, dy);
        }}
        onPointerUp={() => {
          dragOrigin.current = null;
        }}
        onPointerCancel={() => {
          dragOrigin.current = null;
        }}
      >
        Drag here to move X / Y
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
              value={transform[key]}
              onChange={(event) => onTransformChange({ ...transform, [key]: Number(event.target.value) })}
              className="h-1 accent-lime-300"
            />
            <NumericInput
              value={transform[key]}
              onCommit={(value) => onTransformChange({ ...transform, [key]: value })}
              min={min}
              max={max}
            />
          </label>
        ))}

        <label className="grid grid-cols-[4.5rem_1fr_2.5rem] items-center gap-2 text-[10px]">
          <span className="text-stone-500">Zoom</span>
          <input
            type="range"
            min={0.5}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(event) => onZoomChange(Number(event.target.value))}
            className="h-1 accent-lime-300"
          />
          <span className="text-right tabular-nums text-stone-400">{zoom.toFixed(2)}</span>
        </label>
      </div>
    </>
  );
}

interface NumericInputProps {
  value: number;
  onCommit: (value: number) => void;
  min: number;
  max: number;
}

function NumericInput({ value, onCommit, min, max }: NumericInputProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  function commit() {
    const parsed = Number(draft);
    if (Number.isFinite(parsed)) {
      onCommit(Math.max(min, Math.min(max, parsed)));
    }
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(String(value));
          setEditing(true);
        }}
        className="w-full rounded border border-transparent text-right tabular-nums text-stone-400 hover:border-lime-300/30 hover:text-lime-200"
      >
        {value.toFixed(2)}
      </button>
    );
  }

  return (
    <input
      type="text"
      value={draft}
      autoFocus
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') setEditing(false);
      }}
      onBlur={commit}
      className="w-full rounded border border-lime-300/40 bg-black/60 px-1 text-right tabular-nums text-lime-200 outline-none"
    />
  );
}
