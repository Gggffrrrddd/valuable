-- Public, logged-out account deletion requests.
-- Authenticated users use the delete-account edge function instead.

BEGIN;

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_account_deletion_request" ON public.account_deletion_requests;
CREATE POLICY "insert_account_deletion_request" ON public.account_deletion_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

REVOKE ALL ON public.account_deletion_requests FROM anon, authenticated;
GRANT INSERT ON public.account_deletion_requests TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_email
  ON public.account_deletion_requests (lower(email), requested_at DESC);

COMMIT;
