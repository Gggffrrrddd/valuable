import { useEffect, useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  MAX_SUBJECTS,
  MAX_SUBJECT_NAME,
  addUserSubject,
  archiveUserSubject,
  fetchUserSubjects,
  type UserSubject,
} from "@/lib/subjects";

export default function SubjectChips({
  selected,
  onSelectedChange,
}: {
  selected: string;
  onSelectedChange: (name: string) => void;
}) {
  const { session } = useAuth();
  const [subjects, setSubjects] = useState<UserSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<UserSubject | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchUserSubjects(session.user.id)
      .then((rows) => {
        if (!cancelled) setSubjects(rows);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Could not load your subjects.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const active = subjects.filter((s) => !s.archived_at);
  const maxed = active.length >= MAX_SUBJECTS;

  async function add() {
    if (!session || !newName.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await addUserSubject(session.user.id, newName);
      setSubjects((prev) => {
        const exists = prev.some((s) => s.id === created.id);
        return exists
          ? prev.map((s) => (s.id === created.id ? created : s))
          : [...prev, created];
      });
      onSelectedChange(created.name);
      setNewName("");
      setAddOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add subject.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(subject: UserSubject) {
    if (!session || busy) return;
    setBusy(true);
    setError(null);
    try {
      await archiveUserSubject(session.user.id, subject.id);
      setSubjects((prev) =>
        prev.map((s) =>
          s.id === subject.id
            ? { ...s, archived_at: new Date().toISOString() }
            : s,
        ),
      );
      if (selected === subject.name) onSelectedChange("");
      setRemoving(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove subject.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="text-xs font-bold uppercase tracking-[.14em] text-stone-500">
          What are you focusing on?
        </label>
        <span className="text-[10px] font-semibold text-stone-600">
          Optional
        </span>
      </div>

      {loading ? (
        <div className="flex h-10 items-center gap-2 text-xs text-stone-600">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading subjects…
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {active.map((s) => {
            const isSelected = selected === s.name;
            return (
              <div key={s.id} className="relative">
                <button
                  type="button"
                  onClick={() => onSelectedChange(isSelected ? "" : s.name)}
                  aria-pressed={isSelected}
                  className={`flex h-10 items-center gap-1.5 rounded-full border py-0 pl-3.5 pr-8 text-xs font-bold transition ${
                    isSelected
                      ? "border-lime-300/50 bg-lime-300/15 text-lime-200"
                      : "border-white/10 bg-white/[.03] text-stone-300 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {isSelected && <Check className="h-3.5 w-3.5" />}
                  <span className="max-w-36 truncate">{s.name}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRemoving(s);
                  }}
                  aria-label={`Remove ${s.name}`}
                  className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-stone-500 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => {
              setAddOpen((v) => !v);
              setError(null);
            }}
            disabled={maxed && !addOpen}
            title={maxed ? "Remove one to add a new subject" : "Add subject"}
            aria-label="Add subject"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-[#f6e3ba]/40 text-[#f6e3ba]/80 transition hover:border-[#f6e3ba]/75 hover:bg-[#f6e3ba]/10 hover:text-[#f6e3ba] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}

      {maxed && (
        <p className="mt-2 text-[11px] text-stone-500">
          Remove one to add a new subject
        </p>
      )}

      {addOpen && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value.slice(0, MAX_SUBJECT_NAME));
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void add();
              }
              if (e.key === "Escape") setAddOpen(false);
            }}
            maxLength={MAX_SUBJECT_NAME}
            autoFocus
            placeholder="Subject name"
            className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-stone-100 outline-none focus:border-lime-300/40"
          />
          <button
            type="button"
            onClick={() => void add()}
            disabled={!newName.trim() || busy}
            className="h-10 rounded-xl bg-lime-300 px-4 text-xs font-extrabold text-[#11130f] transition hover:bg-lime-200 disabled:opacity-40"
          >
            {busy ? "Adding…" : "Add"}
          </button>
          <button
            type="button"
            onClick={() => {
              setAddOpen(false);
              setNewName("");
              setError(null);
            }}
            className="h-10 rounded-xl px-3 text-xs font-bold text-stone-500 hover:text-white"
          >
            Cancel
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}

      {removing && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Remove ${removing.name}`}
          onClick={() => !busy && setRemoving(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#101310] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-stone-100">
              Remove “{removing.name}”?
            </h3>
            <p className="mt-2 text-xs leading-5 text-stone-400">
              It will disappear from your chips and subject breakdown.{" "}
              <span className="font-semibold text-stone-200">
                Past sessions stay counted in your totals.
              </span>
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRemoving(null)}
                disabled={busy}
                className="h-10 rounded-xl px-3 text-xs font-bold text-stone-400 hover:text-white"
              >
                Keep subject
              </button>
              <button
                type="button"
                onClick={() => void remove(removing)}
                disabled={busy}
                className="h-10 rounded-xl border border-rose-300/25 bg-rose-300/[.08] px-3 text-xs font-extrabold text-rose-200 hover:bg-rose-300/15 disabled:opacity-40"
              >
                {busy ? "Removing…" : "Remove subject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
