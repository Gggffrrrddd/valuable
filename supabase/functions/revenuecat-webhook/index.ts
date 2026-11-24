import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GRANT_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
]);
const REVOKE_EVENTS = new Set(["EXPIRATION", "REFUND"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  if (
    !secret ||
    !(safeEqual(auth, secret) || safeEqual(auth, `Bearer ${secret}`))
  ) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: { event?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const event = body.event;
  if (
    !event ||
    typeof event.id !== "string" ||
    typeof event.type !== "string"
  ) {
    return json({ error: "Missing event" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const userId =
    typeof event.app_user_id === "string" && UUID_RE.test(event.app_user_id)
      ? event.app_user_id
      : null;
  const eventId = event.id;

  const { error: insertError } = await supabase.from("billing_events").insert({
    id: eventId,
    user_id: userId,
    event_type: event.type,
    payload: event,
  });
  if (insertError) {
    // Unique violation = duplicate delivery, acknowledge it safely.
    if (insertError.code === "23505")
      return json({ ok: true, duplicate: true });
    return json({ error: insertError.message }, 500);
  }

  if (!userId) return json({ ok: true, ignored: "anonymous user" });
  if (
    !GRANT_EVENTS.has(event.type) &&
    !REVOKE_EVENTS.has(event.type) &&
    event.type !== "CANCELLATION"
  ) {
    return json({ ok: true, ignored: event.type });
  }

  const expirationMs = Number(event.expiration_at_ms);
  const premiumUntil =
    Number.isFinite(expirationMs) && expirationMs > 0
      ? new Date(expirationMs).toISOString()
      : null;
  const active =
    GRANT_EVENTS.has(event.type) ||
    (event.type === "CANCELLATION" &&
      (!premiumUntil || Date.parse(premiumUntil) > Date.now()));
  const source = event.period_type === "TRIAL" ? "trial" : "play";

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      plan: active ? "premium" : "free",
      premium_until: active ? premiumUntil : null,
      source: active ? source : null,
      is_premium: active,
      premium_expires_at: active ? premiumUntil : null,
    })
    .eq("id", userId);

  if (updateError) return json({ error: updateError.message }, 500);
  return json({ ok: true, plan: active ? "premium" : "free" });
});
