import { useEffect, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  MAX_SUBJECTS,
  MAX_SUBJECT_NAME,
  SUBJECTS_CHANGED_EVENT,
  addUserSubject,
  archiveUserSubject,
  fetchUserSubjects,
  type UserSubject,
} from "@/lib/subjects";

export default function SettingsSubjects() {
  const { session } = useAuth();
  const [subjects, setSubjects] = useState<UserSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
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

  function notifyChange() {
    try {
      window.dispatchEvent(new Event(SUBJECTS_CHANGED_EVENT));
    } catch {
      /* non-fatal */
    }
  }

  async function add() {
    if (!session || !name.trim() || busy || maxed) return;
    setBusy(true);
    setError(null);
    try {
      const created = await addUserSubject(session.user.id, name);
      setSubjects((prev) => {
        const exists = prev.some((s) => s.id === created.id);
        return exists
          ? prev.map((s) => (s.id === created.id ? created : s))
          : [...prev, created];
      });
      setName("");
      notifyChange();
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
      setRemoving(null);
      notifyChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove subject.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="your-subjects"
      className="mt-4 rounded-[1.5rem] border border-white/[.07] bg-white/[.025] p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-stone-200">Your subjects</h2>
          <p className="mt-1 text-[11px] leading-5 text-stone-500">
            These appear in the focus-session dropdown. Maximum {MAX_SUBJECTS}.
          </p>
        </div>
        <span className="text-[10px] font-bold tabular-nums text-stone-600">
          {active.length}/{MAX_SUBJECTS}
        </span>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-stone-600">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading subjects…
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {active.map((s) => (
            <div
              key={s.id}
              className="flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[.03] pl-3.5 pr-1.5 text-xs font-bold text-stone-300"
            >
              <span className="max-w-40 truncate">{s.name}</span>
              <button
                type="button"
                onClick={() => setRemoving(s)}
                aria-label={`Remove ${s.name}`}
                className="flex h-7 w-7 items-center justify-center rounded-full text-stone-500 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {active.length === 0 && (
            <span className="text-xs text-stone-600">No active subjects.</span>
          )}
        </div>
      )}

      {maxed ? (
        <p className="mt-3 text-[11px] text-stone-500">
          Remove one to add a new subject
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value.slice(0, MAX_SUBJECT_NAME));
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void add();
              }
            }}
            maxLength={MAX_SUBJECT_NAME}
            placeholder="New subject"
            aria-label="New subject name"
            className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-stone-100 outline-none focus:border-lime-300/40"
          />
          <button
            type="button"
            onClick={() => void add()}
            disabled={!name.trim() || busy}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-lime-300 px-4 text-xs font-extrabold text-[#11130f] transition hover:bg-lime-200 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> Add
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
              It will hide from your subject dropdown and subject breakdown.{" "}
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
    </section>
  );
}
