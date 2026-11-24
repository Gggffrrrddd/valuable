-- Premium system scaffold: remote flags/content + server-owned entitlement.
-- Run this migration first. It is safe to re-run.

BEGIN;

-- 1) Remote config ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_app_config" ON public.app_config;
CREATE POLICY "read_app_config" ON public.app_config
  FOR SELECT TO anon, authenticated
  USING (true);

REVOKE ALL ON public.app_config FROM anon, authenticated;
GRANT SELECT ON public.app_config TO anon, authenticated;

INSERT INTO public.app_config (key, value)
VALUES
  (
    'premium_flags',
    $json${
      "premium_locks": false,
      "purchase_enabled": false,
      "locked_features": {
        "jar": false,
        "solar_system": false,
        "particle_painting": false,
        "study_table": false,
        "garden": false,
        "stats_history_90": false,
        "share_report": false,
        "unlimited_friends": false,
        "focus_music": false,
        "break_content": false
      }
    }$json$::jsonb
  ),
  (
    'premium_content',
    $json${
      "headline": "Invest in your attention.",
      "subline": "Every visual, insight and ritual — built to protect the hours that matter.",
      "benefits": [
        "Every focus visual, including future releases",
        "90-day performance history and deeper trends",
        "Shareable reports for your streak and milestones",
        "Unlimited focus music and break content",
        "Support independent, ad-free development"
      ],
      "comparison": [
        { "feature": "Focus visuals", "free": "Core visuals", "premium": "Every visual" },
        { "feature": "Stats history", "free": "30 days", "premium": "90 days" },
        { "feature": "Share reports", "free": "—", "premium": "Included" },
        { "feature": "Focus music", "free": "Limited", "premium": "Unlimited" },
        { "feature": "Break content", "free": "Rotating", "premium": "Full library" }
      ],
      "preview": [
        { "label": "Hourglass", "image": "/visuals/hourglass/hourglass-preview.png", "tier": "free" },
        { "label": "Growing Tree", "image": "/visuals/tree/tree-preview.png", "tier": "free" },
        { "label": "Water Jar", "image": "/visuals/jar/jar-preview.png", "tier": "premium" },
        { "label": "Particle Painting", "image": "/visuals/blade/particle-painting-preview.png", "tier": "premium" },
        { "label": "Starlight Butterfly", "image": "/visuals/butterfly/butterfly-preview.png", "tier": "premium" },
        { "label": "Solar System", "image": "/visuals/solar-system/solar-preview.png", "tier": "premium" }
      ],
      "products": {
        "monthly": {
          "id": "valuable_premium_monthly",
          "price_label": null,
          "amount_minor": null,
          "currency": null
        },
        "yearly": {
          "id": "valuable_premium_yearly",
          "price_label": null,
          "amount_minor": null,
          "currency": null
        }
      },
      "faq": [
        {
          "q": "What happens when I subscribe?",
          "a": "Premium unlocks the selected extras immediately and stays active while the subscription is valid."
        },
        {
          "q": "Can I cancel anytime?",
          "a": "Yes. Cancel from Google Play Store → Subscriptions. Access continues until the paid period ends."
        },
        {
          "q": "How do I restore a purchase?",
          "a": "Open Premium and tap Restore purchases. Make sure you are signed in with the same account used for the purchase."
        },
        {
          "q": "Is my study data private?",
          "a": "Your focus data belongs to you. See the Privacy Policy for what is stored and how to delete your account."
        }
      ],
      "disclosure": "Subscriptions renew automatically unless cancelled at least 24 hours before the renewal date. Manage or cancel anytime in Google Play Store → Subscriptions. Prices are shown by the store for your country and currency.",
      "legal": {
        "privacy": "/privacy",
        "terms": "/terms",
        "refund": "/refund",
        "delete_account": "/delete-account"
      }
    }$json$::jsonb
  )
ON CONFLICT (key) DO NOTHING;

-- 2) Server-owned entitlement ---------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS premium_until timestamptz,
  ADD COLUMN IF NOT EXISTS source text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_plan_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('free', 'premium'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_source_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_source_check
      CHECK (source IS NULL OR source IN ('play', 'trial', 'founder'));
  END IF;
END $$;

-- Backfill only obvious active legacy entitlements. Historical sources are
-- unknown and intentionally left NULL.
UPDATE public.profiles
SET
  plan = 'premium',
  premium_until = premium_expires_at
WHERE plan = 'free'
  AND is_premium = true
  AND (premium_expires_at IS NULL OR premium_expires_at > now());

-- The client may still update normal profile fields, but never entitlement.
CREATE OR REPLACE FUNCTION public.guard_profile_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND coalesce(auth.role(), '') <> 'service_role'
     AND (
       NEW.is_premium IS DISTINCT FROM OLD.is_premium OR
       NEW.premium_expires_at IS DISTINCT FROM OLD.premium_expires_at OR
       NEW.plan IS DISTINCT FROM OLD.plan OR
       NEW.premium_until IS DISTINCT FROM OLD.premium_until OR
       NEW.source IS DISTINCT FROM OLD.source
     )
  THEN
    RAISE EXCEPTION 'Entitlement fields can only be changed by the server';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_entitlement ON public.profiles;
CREATE TRIGGER guard_profile_entitlement
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_entitlement();

COMMENT ON COLUMN public.profiles.plan IS
  'Server-owned entitlement plan: free or premium.';
COMMENT ON COLUMN public.profiles.premium_until IS
  'NULL means no expiry while plan=premium (lifetime/trial handled by source).';
COMMENT ON COLUMN public.profiles.source IS
  'Entitlement source: play, trial, founder, or NULL for legacy.';
COMMENT ON COLUMN public.profiles.is_premium IS
  'Legacy mirror kept for compatibility. New code reads plan/premium_until.';
COMMENT ON COLUMN public.profiles.premium_expires_at IS
  'Legacy mirror kept for compatibility. New code reads plan/premium_until.';

COMMIT;
