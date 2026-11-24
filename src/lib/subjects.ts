import { supabase } from "./supabase";
import { SUBJECT_PRESETS } from "@/types";

export const MAX_SUBJECTS = 5;
export const MAX_SUBJECT_NAME = 20;

export interface UserSubject {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  archived_at: string | null;
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

/** Account-owned chips. Seeds the first 5 legacy presets on first use. */
export async function fetchUserSubjects(
  userId: string,
): Promise<UserSubject[]> {
  const { data, error } = await supabase
    .from("user_subjects")
    .select("id, user_id, name, created_at, archived_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as UserSubject[];
  if (rows.length > 0) return rows;

  const seed = SUBJECT_PRESETS.slice(0, MAX_SUBJECTS).map((name) => ({
    user_id: userId,
    name,
  }));
  const { data: inserted, error: seedError } = await supabase
    .from("user_subjects")
    .insert(seed)
    .select("id, user_id, name, created_at, archived_at");
  if (seedError) throw seedError;
  return (inserted ?? []) as UserSubject[];
}

export async function addUserSubject(
  userId: string,
  rawName: string,
): Promise<UserSubject> {
  const name = rawName.trim().replace(/\s+/g, " ");
  if (!name) throw new Error("Enter a subject name.");
  if (name.length > MAX_SUBJECT_NAME) {
    throw new Error(`Keep it under ${MAX_SUBJECT_NAME} characters.`);
  }

  const { data, error } = await supabase
    .from("user_subjects")
    .select("id, user_id, name, created_at, archived_at")
    .eq("user_id", userId);
  if (error) throw error;
  const rows = (data ?? []) as UserSubject[];
  const active = rows.filter((r) => !r.archived_at);
  if (active.some((r) => normalize(r.name) === normalize(name))) {
    throw new Error("That subject is already in your list.");
  }
  if (active.length >= MAX_SUBJECTS) {
    throw new Error("Remove one to add a new subject.");
  }

  // Re-adding a removed name restores the same record (and keeps history).
  const archived = rows.find(
    (r) => r.archived_at && normalize(r.name) === normalize(name),
  );
  if (archived) {
    const { data: restored, error: restoreError } = await supabase
      .from("user_subjects")
      .update({ archived_at: null })
      .eq("id", archived.id)
      .eq("user_id", userId)
      .select("id, user_id, name, created_at, archived_at")
      .single();
    if (restoreError) throw restoreError;
    return restored as UserSubject;
  }

  const { data: created, error: insertError } = await supabase
    .from("user_subjects")
    .insert({ user_id: userId, name })
    .select("id, user_id, name, created_at, archived_at")
    .single();
  if (insertError) throw insertError;
  return created as UserSubject;
}

/** Soft delete only: sessions and all historical totals stay untouched. */
export async function archiveUserSubject(
  userId: string,
  subjectId: string,
): Promise<void> {
  const { error } = await supabase
    .from("user_subjects")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", subjectId)
    .eq("user_id", userId);
  if (error) throw error;
}
