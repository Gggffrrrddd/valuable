import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, content-type, apikey, x-client-info",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST")
    return json({ ok: false, error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer "))
    return json({ ok: false, error: "Unauthorized" }, 401);

  let body: { confirm?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* body optional */
  }
  if (body.confirm !== "DELETE")
    return json({ ok: false, error: "Confirmation required" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const token = auth.slice("Bearer ".length);
  const { data: userData, error: userError } =
    await supabase.auth.getUser(token);
  const user = userData.user;
  if (userError || !user)
    return json({ ok: false, error: "Unauthorized" }, 401);

  // Storage is not reachable by the auth-user cascade. Only this user's folder.
  const { data: files } = await supabase.storage
    .from("dream-images")
    .list(user.id, {
      limit: 100,
    });
  const paths = (files ?? []).map((file) => `${user.id}/${file.name}`);
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("dream-images")
      .remove(paths);
    if (storageError)
      return json({ ok: false, error: storageError.message }, 500);
  }

  // Deleting the auth user cascades to profiles and that user's own rows.
  // Other users' auth accounts/profiles are never addressed.
  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
  if (deleteError) return json({ ok: false, error: deleteError.message }, 500);

  return json({ ok: true });
});
