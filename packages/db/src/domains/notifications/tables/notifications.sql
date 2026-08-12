CREATE TABLE IF NOT EXISTS public.notification_delivery_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation text NOT NULL CHECK (operation IN ('TRIGGER', 'CANCEL')),
  workflow_key text NOT NULL CHECK (workflow_key IN (
    'social-application-submitted',
    'social-application-decided',
    'social-invitation-received',
    'social-invitation-decided'
  )),
  source_kind text NOT NULL CHECK (source_kind IN ('SOCIAL_APPLICATION', 'CAMPAIGN_INVITE')),
  source_public_id uuid NOT NULL,
  recipient_notification_id uuid NOT NULL
    REFERENCES public.profiles (notification_recipient_id) ON DELETE CASCADE,
  grouping_key text CHECK (grouping_key IS NULL OR char_length(grouping_key) BETWEEN 1 AND 200),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 10),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  last_error_code text CHECK (
    last_error_code IS NULL OR char_length(last_error_code) BETWEEN 1 AND 64
  ),
  CHECK (num_nonnulls(delivered_at, failed_at) <= 1),
  UNIQUE (recipient_notification_id, source_kind, source_public_id, workflow_key, operation)
);

CREATE INDEX IF NOT EXISTS notification_delivery_intents_due_idx
  ON public.notification_delivery_intents (next_attempt_at, occurred_at, id)
  WHERE delivered_at IS NULL AND failed_at IS NULL;

ALTER TABLE public.notification_delivery_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_delivery_intents FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.notification_delivery_intents FROM anon, authenticated;
