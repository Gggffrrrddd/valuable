-- Idempotency + audit trail for RevenueCat webhook events.

BEGIN;

CREATE TABLE IF NOT EXISTS public.billing_events (
  id text PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies: service role only (webhook).
REVOKE ALL ON public.billing_events FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_billing_events_user_received
  ON public.billing_events (user_id, received_at DESC);

COMMIT;
