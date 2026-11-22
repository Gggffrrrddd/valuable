import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { fetchFriendStat, type FriendStat } from '@/lib/stats';
import { characterLabel, resolveAvatarCharacter } from '@/lib/character';
import CharacterPicker, { CharacterPortrait, type CharacterPickerMode } from '@/components/CharacterPicker';
import type { AvatarCharacter } from '@/types';
import { UserPlus, Copy, Check, X, Flame, Clock, Users, RefreshCw, BookOpen, ArrowUpRight, Trash2 } from 'lucide-react';

interface FriendsScreenProps {
  onOpenStudyTable?: () => void;
}

interface FriendRequest {
  request_id: string;
  direction: 'incoming' | 'outgoing';
  other_id: string;
  display_name: string;
  avatar_character: string | null;
  created_at: string;
}

export default function FriendsScreen({ onOpenStudyTable }: FriendsScreenProps) {
  const { profile, session, updateAvatarCharacter } = useAuth();
  const [codeInput, setCodeInput] = useState('');
  const [friends, setFriends] = useState<FriendStat[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [removeTarget, setRemoveTarget] = useState<FriendStat | null>(null);
  const [removing, setRemoving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<CharacterPickerMode>('first');
  const [selectedCharacter, setSelectedCharacter] = useState<AvatarCharacter>('boy');
  const [savingCharacter, setSavingCharacter] = useState(false);
  const [characterError, setCharacterError] = useState<string | null>(null);

  const currentCharacter = resolveAvatarCharacter(profile?.avatar_character);


  const loadFriends = useCallback(async (silent = false) => {
    if (!session) return;
    if (!silent) setLoading(true);
    try {
      const { data: friendships, error: fErr } = await supabase
        .from('friendships')
        .select('id, user_id, friend_id, status')
        .or(`user_id.eq.${session.user.id},friend_id.eq.${session.user.id}`);
      if (fErr) throw fErr;

      const accepted = (friendships || []).filter((f) => f.status === 'accepted');
      const friendIds = accepted.map((f) => (f.user_id === session.user.id ? f.friend_id : f.user_id));
      const statsPromises = friendIds.map((id) => fetchFriendStat(id).catch(() => null));
      const stats = await Promise.all(statsPromises);
      setFriends(stats.filter((s): s is FriendStat => s !== null));

      // RPC (not profiles): the sender is not an accepted friend yet, so the
      // profiles RLS policy would hide the row needed by the request card.
      const { data: requestRows, error: reqErr } = await supabase.rpc('list_my_friend_requests');
      if (reqErr) throw reqErr;
      const requests = (requestRows || []) as FriendRequest[];
      setIncomingRequests(requests.filter((r) => r.direction === 'incoming'));
      setOutgoingRequests(requests.filter((r) => r.direction === 'outgoing'));
    } catch (e) {
      console.error('Friends load error:', e);
    } finally {
      if (!silent) setLoading(false);
      setLastRefresh(new Date());
    }
  }, [session]);

  // Short polling mirrors the study-table pattern, so a new request appears
  // without a manual refresh. Hidden tabs skip the query.
  useEffect(() => {
    void loadFriends();
    const id = window.setInterval(() => {
      if (!document.hidden) void loadFriends(true);
    }, 15_000);
    const onVisible = () => {
      if (!document.hidden) void loadFriends(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadFriends]);

  async function handleAddFriend() {
    if (!session || !codeInput.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const code = codeInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code.length !== 6) {
        setError('Enter the 6-character friend code.');
        setAdding(false);
        return;
      }

      // SECURITY DEFINER lookup: profiles RLS intentionally hides non-friends,
      // so a direct profiles query can never find a code before the add.
      const { data: lookupRows, error: tErr } = await supabase.rpc(
        'lookup_profile_by_friend_code',
        { p_code: code }
      );
      if (tErr) throw tErr;
      const target = (Array.isArray(lookupRows) ? lookupRows[0] : lookupRows) as
        | { profile_id: string; display_name: string; avatar_character: string }
        | undefined;
      if (!target) {
        setError('No user found with that code.');
        setAdding(false);
        return;
      }
      if (target.profile_id === session.user.id) {
        setError("That's your own code.");
        setAdding(false);
        return;
      }

      // Check both directions first. A reverse pending request is allowed:
      // the insert below completes the mutual add, exactly as before.
      const { data: existing, error: exErr } = await supabase
        .from('friendships')
        .select('id, user_id, friend_id, status')
        .or(
          `and(user_id.eq.${session.user.id},friend_id.eq.${target.profile_id}),` +
            `and(user_id.eq.${target.profile_id},friend_id.eq.${session.user.id})`
        );
      if (exErr) throw exErr;
      const rows = existing ?? [];
      const ownRow = rows.find((f) => f.user_id === session.user.id);
      const reverseRow = rows.find((f) => f.user_id === target.profile_id);

      if (rows.some((f) => f.status === 'accepted')) {
        setError('Already in your circle.');
        setAdding(false);
        return;
      }
      if (rows.some((f) => f.status === 'rejected')) {
        setError('Request was rejected.');
        setAdding(false);
        return;
      }
      if (ownRow?.status === 'pending') {
        // Both users asked each other: accept the incoming half atomically,
        // which also converts our outgoing half to accepted.
        if (reverseRow?.status === 'pending') {
          const { error: acceptErr } = await supabase.rpc('accept_friend_request', {
            p_request_id: reverseRow.id,
          });
          if (acceptErr) throw acceptErr;
          setCodeInput('');
          await loadFriends(true);
          return;
        }
        setError('Request already sent.');
        setAdding(false);
        return;
      }

      const { error: insErr } = await supabase.from('friendships').insert({
        user_id: session.user.id,
        friend_id: target.profile_id,
        status: 'pending',
      });
      if (insErr) {
        if (insErr.code === '23505') {
          setError('Already in your circle.');
        } else {
          throw insErr;
        }
        setAdding(false);
        return;
      }

      // They had already requested us: accept their incoming request, which
      // creates the reciprocal accepted row as well.
      if (reverseRow?.status === 'pending') {
        const { error: acceptErr } = await supabase.rpc('accept_friend_request', {
          p_request_id: reverseRow.id,
        });
        if (acceptErr) throw acceptErr;
      }

      setCodeInput('');
      await loadFriends(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add friend');
    } finally {
      setAdding(false);
    }
  }

  async function handleAccept(requestId: string) {
    if (!session) return;
    setError(null);
    const { error: acceptErr } = await supabase.rpc('accept_friend_request', {
      p_request_id: requestId,
    });
    if (acceptErr) {
      setError(acceptErr.message);
      return;
    }
    await loadFriends(true);
  }

  async function handleReject(requestId: string) {
    if (!session) return;
    setError(null);
    const { error: rejectErr } = await supabase.rpc('reject_friend_request', {
      p_request_id: requestId,
    });
    if (rejectErr) {
      setError(rejectErr.message);
      return;
    }
    await loadFriends(true);
  }

  async function handleCancelRequest(requestId: string) {
    if (!session) return;
    setError(null);
    const { error: cancelErr } = await supabase.rpc('cancel_friend_request', {
      p_request_id: requestId,
    });
    if (cancelErr) {
      setError(cancelErr.message);
      return;
    }
    await loadFriends(true);
  }

  function copyCode() {
    if (!profile) return;
    navigator.clipboard?.writeText(profile.friend_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadFriends(true);
    setRefreshing(false);
  }

  // Highlight only a UNIQUE leader — on a tie nobody gets the badge.
  const topStreakId = (() => {
    let best = -1;
    let bestId: string | null = null;
    let tied = false;
    for (const f of friends) {
      if (f.currentStreak > best) { best = f.currentStreak; bestId = f.profile.id; tied = false; }
      else if (f.currentStreak === best) { tied = true; }
    }
    return tied ? null : bestId;
  })();
  const topTodayId = (() => {
    let best = -1;
    let bestId: string | null = null;
    let tied = false;
    for (const f of friends) {
      if (f.todayMinutes > best) { best = f.todayMinutes; bestId = f.profile.id; tied = false; }
      else if (f.todayMinutes === best) { tied = true; }
    }
    return tied ? null : bestId;
  })();

  async function handleRemoveFriend(f: FriendStat) {
    setRemoving(true);
    try {
      if (session) {
        const myId = session.user.id;
        const fid = f.profile.id;
        const { error: delErr } = await supabase
          .from('friendships')
          .delete()
          .or(`and(user_id.eq.${myId},friend_id.eq.${fid}),and(user_id.eq.${fid},friend_id.eq.${myId})`);
        if (delErr) throw delErr;
      }
      setFriends((prev) => prev.filter((x) => x.profile.id !== f.profile.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove friend');
    } finally {
      setRemoving(false);
      setRemoveTarget(null);
    }
  }

  /**
   * The study table is gated by the one-time character choice. The picker only
   * appears when the profile has never been resolved; after that the table
   * opens directly and the choice lives on the Circle page.
   */
  function openTableWithCharacterGate() {
    if (!onOpenStudyTable) return;
    if (!profile?.character_chosen) {
      setSelectedCharacter(resolveAvatarCharacter(profile?.avatar_character));
      setPickerMode('first');
      setCharacterError(null);
      setPickerOpen(true);
      return;
    }
    onOpenStudyTable();
  }

  function openCharacterPicker() {
    setSelectedCharacter(currentCharacter);
    setPickerMode('change');
    setCharacterError(null);
    setPickerOpen(true);
  }

  async function saveCharacter(character: AvatarCharacter): Promise<boolean> {
    setSavingCharacter(true);
    setCharacterError(null);
    const { error: saveErr } = await updateAvatarCharacter(character);
    setSavingCharacter(false);
    if (saveErr) {
      setCharacterError(saveErr);
      return false;
    }
    return true;
  }

  async function confirmCharacter() {
    if (savingCharacter) return;
    const saved = await saveCharacter(selectedCharacter);
    if (!saved) return;
    setPickerOpen(false);
    if (pickerMode === 'first') onOpenStudyTable?.();
  }

  async function dismissCharacterPicker() {
    if (savingCharacter) return;
    if (pickerMode === 'change') {
      setPickerOpen(false);
      setCharacterError(null);
      return;
    }
    // First-time skip/dismiss always keeps the default Boy and marks the
    // choice resolved so the picker never appears automatically again.
    const saved = await saveCharacter('boy');
    if (!saved) return;
    setPickerOpen(false);
    onOpenStudyTable?.();
  }

  return (
    <div className="page-wrap pb-24">
      <div className="page-kicker">Accountability circle</div>
      <h2 className="page-title">Focus together</h2>
      <p className="page-copy mb-7">Quiet accountability with the people you trust. No feeds and no performance theatre.</p>

      {onOpenStudyTable && (
        <button
          onClick={openTableWithCharacterGate}
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

      <div className="surface mb-4 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#f6e3ba]/20 bg-gradient-to-b from-[#f6e3ba]/10 to-transparent">
            <CharacterPortrait character={currentCharacter} className="h-full w-full" />
          </div>
          <div>
            <div className="page-kicker">Your character</div>
            <div className="mt-0.5 text-sm font-bold text-stone-100">{characterLabel(currentCharacter)} at the table</div>
            <div className="mt-0.5 text-xs text-stone-500">Your friends see the character you choose here.</div>
          </div>
        </div>
        <button
          type="button"
          onClick={openCharacterPicker}
          className="shrink-0 rounded-xl border border-white/[.09] bg-white/[.03] px-4 py-2.5 text-xs font-bold text-stone-200 transition hover:border-white/20 hover:bg-white/[.06]"
        >
          Change your character
        </button>
      </div>

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
            onChange={(e) => setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="6-character code"
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

      {incomingRequests.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-300">
            <UserPlus className="h-4 w-4 text-[#f6e3ba]" /> Friend requests
          </h3>
          <div className="space-y-2">
            {incomingRequests.map((r) => (
              <div
                key={r.request_id}
                className="surface-soft flex flex-col gap-3 border-[#f6e3ba]/25 bg-[#f6e3ba]/[.04] p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#f6e3ba]/20 bg-gradient-to-b from-[#f6e3ba]/10 to-transparent">
                    <CharacterPortrait
                      character={resolveAvatarCharacter(r.avatar_character)}
                      className="h-full w-full"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-stone-100">{r.display_name}</div>
                    <div className="text-xs text-stone-500">wants to join your circle</div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => handleAccept(r.request_id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-extrabold text-slate-950 transition-colors hover:bg-emerald-400"
                  >
                    <Check className="h-3.5 w-3.5" /> Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReject(r.request_id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[.03] px-3 py-1.5 text-xs font-bold text-stone-300 transition-colors hover:border-red-400/40 hover:text-red-300"
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {outgoingRequests.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-300">
            <Clock className="h-4 w-4 text-[#f6e3ba]" /> Pending requests
          </h3>
          <div className="space-y-2">
            {outgoingRequests.map((r) => (
              <div
                key={r.request_id}
                className="surface-soft flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[.03]">
                    <CharacterPortrait
                      character={resolveAvatarCharacter(r.avatar_character)}
                      className="h-full w-full"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-stone-100">{r.display_name}</div>
                    <div className="text-xs text-stone-500">Waiting for them to accept</div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                  <span className="rounded-full border border-[#f6e3ba]/25 bg-[#f6e3ba]/10 px-2 py-1 text-[10px] font-extrabold uppercase tracking-[.12em] text-[#f6e3ba]">
                    Pending
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCancelRequest(r.request_id)}
                    className="rounded-lg border border-white/10 bg-white/[.03] px-3 py-1.5 text-xs font-bold text-stone-400 transition-colors hover:border-white/20 hover:text-stone-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
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
        <div className="surface-soft relative flex min-h-52 flex-col items-center justify-center overflow-hidden px-6 py-10 text-center">
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#f6e3ba]/35 to-transparent" />
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#f6e3ba]/20 bg-[#f6e3ba]/[.06] shadow-[0_0_40px_rgba(246,227,186,.08)]">
            <Users className="h-5 w-5 text-[#f6e3ba]" />
          </div>
          <div className="font-display text-base font-bold text-stone-200">Your table is waiting</div>
          <div className="mt-1.5 max-w-xs text-xs leading-5 text-stone-500">
            Add a friend with their code above. Their seat fills the moment they join your circle.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {friends.map((f) => {
            const isTopStreak = f.profile.id === topStreakId;
            const isTopToday = f.profile.id === topTodayId;
            return (
              <div
                key={f.profile.id}
                className={`flex items-center justify-between gap-2 px-4 py-3 rounded-xl border transition ${
                  isTopStreak
                    ? 'bg-orange-400/[.06] border-orange-400/35 shadow-[0_0_24px_rgba(251,146,60,.08)]'
                    : isTopToday
                      ? 'bg-[#f6e3ba]/[.05] border-[#f6e3ba]/30'
                      : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white text-sm font-medium truncate">{f.profile.display_name}</span>
                    {isTopStreak && (
                      <span className="shrink-0 rounded-full bg-orange-400/15 px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wider text-orange-300">
                        Top streak
                      </span>
                    )}
                    {isTopToday && (
                      <span className="shrink-0 rounded-full bg-[#f6e3ba]/15 px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wider text-[#f6e3ba]">
                        Today&apos;s best
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">{f.profile.friend_code}</div>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-sm">
                  <div className="flex items-center gap-1 text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    {f.todayMinutes}m
                  </div>
                  <div className="flex items-center gap-1 text-slate-300">
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    {f.currentStreak}d
                  </div>
                  <button
                    onClick={() => setRemoveTarget(f)}
                    className="rounded-lg p-1.5 text-slate-600 hover:text-red-300 hover:bg-white/5 transition"
                    title="Remove friend"
                    aria-label={`Remove ${f.profile.display_name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pickerOpen && (
        <CharacterPicker
          mode={pickerMode}
          value={selectedCharacter}
          onChange={setSelectedCharacter}
          onConfirm={confirmCharacter}
          onDismiss={dismissCharacterPicker}
          saving={savingCharacter}
          error={characterError}
        />
      )}

      {removeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => !removing && setRemoveTarget(null)}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-base font-bold text-white">Remove friend?</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Do you really want to remove{' '}
              <span className="font-bold text-slate-200">{removeTarget.profile.display_name}</span> from your
              circle?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setRemoveTarget(null)}
                disabled={removing}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-bold text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemoveFriend(removeTarget)}
                disabled={removing}
                className="flex-1 rounded-xl bg-red-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-red-400 disabled:opacity-50"
              >
                {removing ? 'Removing…' : 'Yes, remove'}
              </button>
            </div>
          </div>
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
