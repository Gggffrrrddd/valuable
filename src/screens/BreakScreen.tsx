import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { CATEGORIES, type ContentItem, type ContentCategory } from '@/types';
import { Play, SkipForward, Check, Shuffle, X } from 'lucide-react';

interface BreakScreenProps {
  breakMinutes: number;
  onDone: () => void;
  /** Cut the rest short — jump straight back to the focus timer. */
  onCutToFocus: () => void;
}

export default function BreakScreen({ breakMinutes, onDone, onCutToFocus }: BreakScreenProps) {
  const { session } = useAuth();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [selected, setSelected] = useState<ContentItem | null>(null);
  const [category, setCategory] = useState<ContentCategory | 'All'>('All');
  const [loading, setLoading] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(breakMinutes * 60);
  const [breakOver, setBreakOver] = useState(false);
  const loggedRef = useRef(false);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('content_items')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Content load error:', error.message);
        setLoading(false);
        return;
      }
      const all = (data || []) as ContentItem[];
      setItems(all);
      if (all.length > 0) {
        setSelected(all[Math.floor(Math.random() * all.length)]);
      }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          setBreakOver(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  async function logView(item: ContentItem) {
    if (loggedRef.current || !session) return;
    loggedRef.current = true;
    await supabase.from('content_views').insert({
      user_id: session.user.id,
      content_item_id: item.id,
    });
  }

  function pickRandom(pool: ContentItem[]) {
    const filtered = category === 'All' ? pool : pool.filter((i) => i.category === category);
    if (filtered.length === 0) return;
    const next = filtered[Math.floor(Math.random() * filtered.length)];
    setSelected(next);
    loggedRef.current = false;
  }

  function handleSelect(item: ContentItem) {
    setSelected(item);
    loggedRef.current = false;
  }

  const filteredItems = category === 'All' ? items : items.filter((i) => i.category === category);
  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;
  const totalBreak = Math.max(1, breakMinutes * 60);
  const breakPct = Math.min(100, Math.round(((totalBreak - secondsLeft) / totalBreak) * 100));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,.1),transparent_30rem),#090b0a] px-5 py-6 pb-24 animate-fade-in sm:px-8 lg:px-12">
      <div className="mx-auto max-w-5xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-[.22em] text-[#f6e3ba]/70">Recovery</div>
          <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-stone-50 sm:text-4xl">
            Break <span className="text-[#f6e3ba]">time</span>
          </h2>
          <p className="mt-1 text-sm text-stone-500">Something useful, not mindless.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className={`rounded-full px-4 py-2 font-display text-sm font-extrabold tabular-nums ${
            breakOver
              ? 'bg-[#f6e3ba] text-[#11130f] shadow-[0_0_28px_rgba(246,227,186,.35)]'
              : 'border border-[#f6e3ba]/30 bg-[#f6e3ba]/[.07] text-[#f6e3ba] shadow-[0_0_24px_rgba(246,227,186,.12)]'
          }`}>
            {breakOver ? "Break's up!" : `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`}
          </div>
          <button
            onClick={onCutToFocus}
            title="Skip rest — back to focus timer"
            aria-label="Skip rest and go back to focus timer"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[.03] text-stone-500 transition hover:border-white/25 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mb-6 h-[3px] overflow-hidden rounded-full bg-white/[.06]">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${breakPct}%`, background: 'linear-gradient(90deg, #8a6a2f, #f6e3ba)' }}
        />
      </div>

      {loading && <div className="text-slate-400 text-sm animate-pulse-soft">Loading content…</div>}

      {!loading && selected && (
        <div className="mb-6 animate-grow-in">
          <div className="relative w-full aspect-video rounded-[2rem] overflow-hidden bg-slate-900 border border-white/10 shadow-[0_30px_90px_rgba(0,0,0,.45)]">
            <iframe
              key={selected.id}
              src={`https://www.youtube.com/embed/${selected.youtube_video_id}?rel=0&modestbranding=1&autoplay=0`}
              title={selected.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>
          <div className="mt-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white">{selected.title}</h3>
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 text-xs">
                {selected.category}
              </span>
            </div>
            <button
              onClick={() => pickRandom(items)}
              className="shrink-0 w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              aria-label="Shuffle"
            >
              <Shuffle className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => logView(selected)}
            className="mt-3 text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
          >
            <Check className="w-3 h-3" /> Mark as watched
          </button>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
            {(['All', ...CATEGORIES] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  category === cat
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border transition-colors text-left ${
                  selected?.id === item.id
                    ? 'bg-amber-500/10 border-amber-500/40'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="shrink-0 w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center">
                  <Play className="w-4 h-4 text-amber-400 ml-0.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{item.title}</div>
                  <div className="text-xs text-slate-500">{item.category} · {Math.round(item.duration_seconds / 60)}m</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center text-slate-400 py-12">
          Content is being curated. Check back soon.
        </div>
      )}

      {breakOver && (
        <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-slate-950 to-transparent safe-bottom">
          <div className="max-w-md mx-auto">
            <div className="text-center text-amber-300 text-sm mb-3 animate-pulse-soft">
              Your break is up — ready to focus again?
            </div>
            <button
              onClick={onDone}
              className="w-full py-3.5 rounded-xl bg-[#f6e3ba] text-[#11130f] font-semibold hover:bg-[#fff0d6] transition-colors flex items-center justify-center gap-2 shadow-[0_10px_40px_rgba(246,227,186,.25)]"
            >
              <SkipForward className="w-5 h-5" />
              Back to Focus
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
