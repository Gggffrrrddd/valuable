import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { fetchFriendStat, type FriendStat } from '@/lib/stats';
import { UserPlus, Copy, Check, Flame, Clock, Users, RefreshCw, BookOpen, ArrowUpRight } from 'lucide-react';

interface FriendsScreenProps {
  onOpenStudyTable?: () => void;
}

// TEMPORARY demo friends for UI preview — remove before release.
const TEMP_FRIENDS: FriendStat[] = [
  { profile: { id: 'temp-1', display_name: 'Aarav', friend_code: 'ARV001' }, todayMinutes: 30, currentStreak: 12 },
  { profile: { id: 'temp-2', display_name: 'Diya', friend_code: 'DIYA02' }, todayMinutes: 30, currentStreak: 7 },
  { profile: { id: 'temp-3', display_name: 'Kabir', friend_code: 'KBR003' }, todayMinutes: 30, currentStreak: 21 },
  { profile: { id: 'temp-4', display_name: 'Meera', friend_code: 'MRA004' }, todayMinutes: 30, currentStreak: 5 },
  { profile: { id: 'temp-5', display_name: 'Rohan', friend_code: 'RHN005' }, todayMinutes: 30, currentStreak: 9 },
];

export default function FriendsScreen({ onOpenStudyTable }: FriendsScreenProps) {
  const { profile, session } = useAuth();
  const [codeInput, setCodeInput] = useState('');
  const [friends, setFriends] = useState<FriendStat[]>([]);
  const [pendingIncoming, setPendingIncoming] = useState<{ id: string; display_name: string; friend_code: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadFriends = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const { data: friendships, error: fErr } = await supabase
        .from('friendships')
        .select('id, user_id, friend_id, status')
        .or(`user_id.eq.${session.user.id},friend_id.eq.${session.user.id}`);
      if (fErr) throw fErr;

      const accepted = (friendships || []).filter((f) => f.status === 'accepted');
      const pending = (friendships || []).filter(
        (f) => f.status === 'pending' && f.friend_id === session.user.id
      );

      const friendIds = accepted.map((f) => (f.user_id === session.user.id ? f.friend_id : f.user_id));
      const statsPromises = friendIds.map((id) => fetchFriendStat(id).catch(() => null));
      const stats = await Promise.all(statsPromises);
      setFriends([...TEMP_FRIENDS, ...stats.filter((s): s is FriendStat => s !== null)]);

      const pendingPromises = pending.map(async (p) => {
        const { data } = await supabase
          .from('profiles')
          .select('id, display_name, friend_code')
          .eq('id', p.user_id)
          .maybeSingle();
        return data as { id: string; display_name: string; friend_code: string } | null;
      });
      const pendingProfiles = await Promise.all(pendingPromises);
      setPendingIncoming(pendingProfiles.filter((p): p is { id: string; display_name: string; friend_code: string } => p !== null));
    } catch (e) {
      console.error('Friends load error:', e);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, [session]);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  async function handleAddFriend() {
    if (!session || !codeInput.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const code = codeInput.trim().toUpperCase();
      const { data: target, error: tErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('friend_code', code)
        .maybeSingle();
      if (tErr) throw tErr;
      if (!target) {
        setError('No user found with that code.');
        setAdding(false);
        return;
      }
      if (target.id === session.user.id) {
        setError("You can't add yourself.");
        setAdding(false);
        return;
      }

      const { error: insErr } = await supabase.from('friendships').insert({
        user_id: session.user.id,
        friend_id: target.id,
        status: 'pending',
      });
      if (insErr) {
        if (insErr.code === '23505') {
          setError('Already added or requested.');
        } else {
          throw insErr;
        }
        setAdding(false);
        return;
      }

      const { data: reverse } = await supabase
        .from('friendships')
        .select('id')
        .eq('user_id', target.id)
        .eq('friend_id', session.user.id)
        .maybeSingle();

      if (reverse) {
        await supabase.from('friendships')
          .update({ status: 'accepted' })
          .eq('id', reverse.id);
        await supabase.from('friendships')
          .update({ status: 'accepted' })
          .eq('user_id', session.user.id)
          .eq('friend_id', target.id);
      }

      setCodeInput('');
      await loadFriends();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add friend');
    } finally {
      setAdding(false);
    }
  }

  async function handleAccept(requesterId: string) {
    if (!session) return;
    await supabase.from('friendships')
      .update({ status: 'accepted' })
      .eq('user_id', requesterId)
      .eq('friend_id', session.user.id);
    await supabase.from('friendships')
      .insert({
        user_id: session.user.id,
        friend_id: requesterId,
        status: 'accepted',
      });
    await loadFriends();
  }

  function copyCode() {
    if (!profile) return;
    navigator.clipboard?.writeText(profile.friend_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadFriends();
    setRefreshing(false);
  }

  const topStreakFriend =
    friends.length > 0 ? friends.reduce((a, b) => (b.currentStreak > a.currentStreak ? b : a)) : null;
  const topTodayFriend =
    friends.length > 0 ? friends.reduce((a, b) => (b.todayMinutes > a.todayMinutes ? b : a)) : null;

  return (
    <div className="page-wrap pb-24">
      <div className="page-kicker">Accountability circle</div>
      <h2 className="page-title">Focus together</h2>
      <p className="page-copy mb-7">Quiet accountability with the people you trust. No feeds and no performance theatre.</p>

      {onOpenStudyTable && (
        <button
          onClick={onOpenStudyTable}
          className="group relative mb-8 block w-full overflow-hidden rounded-[1.8rem] border border-[#f6e3ba]/25 text-left shadow-[0_20px_80px_rgba(0,0,0,.5)] transition hover:border-[#f6e3ba]/50"
        >
          <div className="relative h-44 overflow-hidden sm:h-56">
            <img
              src="/visuals/table/table-scene.png"
              alt=""
              aria-hidden="true"
              draggable={false}
              className="table-kenburns absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#090b0a] via-[#090b0a]/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#090b0a]/85 via-transparent to-transparent" />
            <div className="table-shimmer pointer-events-none absolute inset-0" aria-hidden="true" />
            <div className="absolute left-5 top-1/2 flex -translate-y-1/2 items-center gap-4 sm:left-7">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#f6e3ba]/30 bg-black/55 text-[#f6e3ba] backdrop-blur">
                <BookOpen className="h-5 w-5" />
              </span>
              <span>
                <span className="flex items-center gap-2 font-display text-base font-bold text-stone-50 sm:text-lg">
                  The study table
                  <span className="rounded-full border border-[#f6e3ba]/40 bg-[#f6e3ba]/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[.14em] text-[#f6e3ba]">
                    3D
                  </span>
                </span>
                <span className="mt-1 block max-w-[220px] text-xs leading-5 text-stone-400 sm:max-w-xs">
                  See who&apos;s at the table right now — books open when a session runs.
                </span>
                <span className="mt-2.5 inline-flex items-center gap-1 rounded-xl bg-[#f6e3ba] px-3 py-1.5 text-[11px] font-extrabold text-[#11130f] transition-all group-hover:gap-2">
                  Open table <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </span>
            </div>
          </div>
        </button>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
      <div className="surface mb-2 p-5 sm:p-6 lg:mb-8">
        <div className="text-xs text-slate-400 mb-2">Your friend code</div>
        <div className="flex items-center gap-3">
          <div className="font-display flex-1 text-3xl font-extrabold tracking-[0.28em] text-emerald-400">
            {profile?.friend_code || '------'}
          </div>
          <button
            onClick={copyCode}
            className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            aria-label="Copy code"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">Share this code so friends can add you.</p>
      </div>

      <div className="surface-soft mb-8 p-4 sm:p-6">
        <label className="block text-sm font-medium text-slate-300 mb-2">Add a friend by code</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            placeholder="6-letter code"
            maxLength={6}
            className="premium-input flex-1 uppercase tracking-[0.2em]"
          />
          <button
            onClick={handleAddFriend}
            disabled={adding || codeInput.length < 6}
            className="px-4 rounded-xl bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 disabled:opacity-50 transition-colors flex items-center gap-1"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>
      </div>

      {pendingIncoming.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-slate-300 mb-2">Pending requests</h3>
          <div className="space-y-2">
            {pendingIncoming.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <span className="text-white text-sm font-medium">{p.display_name}</span>
                <button
                  onClick={() => handleAccept(p.id)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-sm font-medium hover:bg-amber-400 transition-colors"
                >
                  Accept
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {topStreakFriend && topTodayFriend && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="flex aspect-square flex-col justify-between rounded-2xl border border-orange-400/25 bg-gradient-to-br from-orange-400/10 via-transparent to-transparent p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-400/15 text-orange-300">
              <Flame className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[.14em] text-orange-300/80">Top streak</div>
              <div className="mt-1 truncate font-display text-lg font-extrabold text-white">{topStreakFriend.profile.display_name}</div>
              <div className="text-xs text-slate-400">{topStreakFriend.currentStreak}-day streak</div>
            </div>
          </div>
          <div className="flex aspect-square flex-col justify-between rounded-2xl border border-[#f6e3ba]/25 bg-gradient-to-br from-[#f6e3ba]/10 via-transparent to-transparent p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f6e3ba]/15 text-[#f6e3ba]">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#f6e3ba]/80">Today&apos;s best</div>
              <div className="mt-1 truncate font-display text-lg font-extrabold text-white">{topTodayFriend.profile.display_name}</div>
              <div className="text-xs text-slate-400">{topTodayFriend.todayMinutes}m focused</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
          <Users className="w-4 h-4" /> Your friends ({friends.length})
        </h3>
        <button
          onClick={handleRefresh}
          className="text-xs text-slate-500 hover:text-white flex items-center gap-1 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          {lastRefresh ? `Updated ${timeAgo(lastRefresh)}` : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm animate-pulse-soft">Loading friends…</div>
      ) : friends.length === 0 ? (
        <div className="surface-soft flex min-h-48 flex-col items-center justify-center px-6 text-center text-slate-500">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[.04]"><Users className="h-5 w-5 text-stone-600" /></div>
          <div className="text-sm font-semibold text-stone-400">Your circle is quiet</div>
          <div className="mt-1 text-xs">Add someone with their code above.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {friends.map((f) => (
            <div key={f.profile.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900 border border-slate-800">
              <div>
                <div className="text-white text-sm font-medium">{f.profile.display_name}</div>
                <div className="text-xs text-slate-500">{f.profile.friend_code}</div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  {f.todayMinutes}m
                </div>
                <div className="flex items-center gap-1 text-slate-300">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  {f.currentStreak}d
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const mins = Math.floor(seconds / 60);
  return `${mins} min ago`;
}
