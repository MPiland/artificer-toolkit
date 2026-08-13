CREATE TABLE IF NOT EXISTS public.notification_delivery_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation text NOT NULL CHECK (operation IN ('TRIGGER', 'CANCEL')),
  workflow_key text NOT NULL CHECK (workflow_key IN (
    'social-application-submitted',
    'social-application-decided',
    'social-invitation-received',
    'social-invitation-decided',
    'campaign-announcement'
  )),
  source_kind text NOT NULL CHECK (source_kind IN ('SOCIAL_APPLICATION', 'CAMPAIGN_INVITE', 'CAMPAIGN_ANNOUNCEMENT')),
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

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('SOCIAL', 'CAMPAIGN')),
  in_app_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.notification_preferences FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.notification_feed_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_intent_id uuid NOT NULL UNIQUE
    REFERENCES public.notification_delivery_intents (id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('SOCIAL', 'CAMPAIGN')),
  workflow_key text NOT NULL CHECK (workflow_key IN (
    'social-application-submitted',
    'social-application-decided',
    'social-invitation-received',
    'social-invitation-decided',
    'campaign-announcement'
  )),
  source_kind text NOT NULL CHECK (source_kind IN ('SOCIAL_APPLICATION', 'CAMPAIGN_INVITE', 'CAMPAIGN_ANNOUNCEMENT')),
  source_public_id uuid NOT NULL,
  grouping_key text CHECK (grouping_key IS NULL OR char_length(grouping_key) BETWEEN 1 AND 200),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz NOT NULL,
  seen_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_feed_items_recipient_occurred_idx
  ON public.notification_feed_items (recipient_user_id, occurred_at DESC, id DESC);

ALTER TABLE public.notification_feed_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_feed_items FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.notification_feed_items FROM anon, authenticated;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.notification_category(source_kind text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT CASE
    WHEN source_kind IN ('SOCIAL_APPLICATION', 'CAMPAIGN_INVITE') THEN 'SOCIAL'
    WHEN source_kind = 'CAMPAIGN_ANNOUNCEMENT' THEN 'CAMPAIGN'
    ELSE NULL
  END
$$;

REVOKE ALL ON FUNCTION private.notification_category(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.claim_notification_delivery_intents(
  p_limit integer,
  p_now timestamptz,
  p_stale_before timestamptz
)
RETURNS TABLE (
  id uuid,
  operation text,
  workflow_key text,
  source_kind text,
  source_public_id uuid,
  recipient_notification_id uuid,
  recipient_user_id uuid,
  grouping_key text,
  payload jsonb,
  attempt_count integer,
  recipient_email text,
  recipient_username text,
  in_app_enabled boolean,
  email_enabled boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
BEGIN
  IF p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'p_limit must be between 1 and 100';
  END IF;

  UPDATE public.notification_delivery_intents exhausted
  SET claimed_at = NULL, failed_at = p_now, last_error_code = 'ATTEMPTS_EXHAUSTED'
  WHERE exhausted.delivered_at IS NULL AND exhausted.failed_at IS NULL
    AND exhausted.attempt_count >= 10
    AND (exhausted.claimed_at IS NULL OR exhausted.claimed_at <= p_stale_before);

  UPDATE public.notification_delivery_intents trigger_intent
  SET claimed_at = NULL, failed_at = p_now, last_error_code = 'SOURCE_CANCELLED'
  WHERE trigger_intent.operation = 'TRIGGER'
    AND trigger_intent.delivered_at IS NULL AND trigger_intent.failed_at IS NULL
    AND (trigger_intent.claimed_at IS NULL OR trigger_intent.claimed_at <= p_stale_before)
    AND EXISTS (
      SELECT 1
      FROM public.notification_delivery_intents cancel_intent
      WHERE cancel_intent.operation = 'CANCEL'
        AND cancel_intent.recipient_notification_id = trigger_intent.recipient_notification_id
        AND cancel_intent.source_kind = trigger_intent.source_kind
        AND cancel_intent.source_public_id = trigger_intent.source_public_id
        AND cancel_intent.workflow_key = trigger_intent.workflow_key
    );

  RETURN QUERY
  WITH due AS (
    SELECT intent.id
    FROM public.notification_delivery_intents intent
    WHERE intent.delivered_at IS NULL AND intent.failed_at IS NULL
      AND intent.next_attempt_at <= p_now
      AND (intent.claimed_at IS NULL OR intent.claimed_at <= p_stale_before)
      AND intent.attempt_count < 10
      AND (
        intent.operation <> 'TRIGGER'
        OR NOT EXISTS (
          SELECT 1
          FROM public.notification_delivery_intents cancel_intent
          WHERE cancel_intent.operation = 'CANCEL'
            AND cancel_intent.recipient_notification_id = intent.recipient_notification_id
            AND cancel_intent.source_kind = intent.source_kind
            AND cancel_intent.source_public_id = intent.source_public_id
            AND cancel_intent.workflow_key = intent.workflow_key
        )
      )
      AND (
        intent.operation <> 'CANCEL'
        OR NOT EXISTS (
          SELECT 1
          FROM public.notification_delivery_intents active_trigger
          WHERE active_trigger.operation = 'TRIGGER'
            AND active_trigger.recipient_notification_id = intent.recipient_notification_id
            AND active_trigger.source_kind = intent.source_kind
            AND active_trigger.source_public_id = intent.source_public_id
            AND active_trigger.workflow_key = intent.workflow_key
            AND active_trigger.delivered_at IS NULL
            AND active_trigger.failed_at IS NULL
            AND active_trigger.claimed_at > p_stale_before
        )
      )
    ORDER BY intent.next_attempt_at, intent.occurred_at, intent.id
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ), claimed AS (
    UPDATE public.notification_delivery_intents intent
    SET claimed_at = p_now, attempt_count = intent.attempt_count + 1
    FROM due
    WHERE intent.id = due.id
    RETURNING intent.*
  )
  SELECT
    claimed.id,
    claimed.operation,
    claimed.workflow_key,
    claimed.source_kind,
    claimed.source_public_id,
    claimed.recipient_notification_id,
    profile.id,
    claimed.grouping_key,
    claimed.payload,
    claimed.attempt_count,
    auth_user.email::text,
    profile.username::text,
    COALESCE(preference.in_app_enabled, true),
    COALESCE(preference.email_enabled, true)
  FROM claimed
  JOIN public.profiles profile ON profile.notification_recipient_id = claimed.recipient_notification_id
  JOIN auth.users auth_user ON auth_user.id = profile.id
  LEFT JOIN public.notification_preferences preference
    ON preference.user_id = profile.id
    AND preference.category = private.notification_category(claimed.source_kind)
  ORDER BY claimed.next_attempt_at, claimed.occurred_at, claimed.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_notification_feed_item(
  p_intent_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  feed_item_id uuid;
BEGIN
  INSERT INTO public.notification_feed_items (
    delivery_intent_id, recipient_user_id, category, workflow_key, source_kind,
    source_public_id, grouping_key, payload, occurred_at
  )
  SELECT
    intent.id,
    profile.id,
    private.notification_category(intent.source_kind),
    intent.workflow_key,
    intent.source_kind,
    intent.source_public_id,
    intent.grouping_key,
    intent.payload,
    intent.occurred_at
  FROM public.notification_delivery_intents intent
  JOIN public.profiles profile ON profile.notification_recipient_id = intent.recipient_notification_id
  LEFT JOIN public.notification_preferences preference
    ON preference.user_id = profile.id
    AND preference.category = private.notification_category(intent.source_kind)
  WHERE intent.id = p_intent_id
    AND intent.operation = 'TRIGGER'
    AND COALESCE(preference.in_app_enabled, true)
  ON CONFLICT (delivery_intent_id) DO UPDATE
    SET delivery_intent_id = EXCLUDED.delivery_intent_id
  RETURNING id INTO feed_item_id;

  IF feed_item_id IS NOT NULL THEN
    DELETE FROM public.notification_feed_items item
    WHERE item.recipient_user_id = (
      SELECT recipient_user_id
      FROM public.notification_feed_items
      WHERE id = feed_item_id
    )
      AND item.id IN (
        SELECT id
        FROM public.notification_feed_items
        WHERE recipient_user_id = (
          SELECT recipient_user_id
          FROM public.notification_feed_items
          WHERE id = feed_item_id
        )
        ORDER BY occurred_at DESC, id DESC
        OFFSET 25
      );
  END IF;

  RETURN feed_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.notification_mark_delivery_succeeded(
  p_intent_id uuid,
  p_delivered_at timestamptz
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  UPDATE public.notification_delivery_intents
  SET claimed_at = NULL, delivered_at = p_delivered_at, last_error_code = NULL
  WHERE id = p_intent_id AND failed_at IS NULL
$$;

CREATE OR REPLACE FUNCTION public.notification_mark_delivery_retry(
  p_intent_id uuid,
  p_next_attempt_at timestamptz,
  p_error_code text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  UPDATE public.notification_delivery_intents
  SET claimed_at = NULL, next_attempt_at = p_next_attempt_at, last_error_code = p_error_code
  WHERE id = p_intent_id AND delivered_at IS NULL AND failed_at IS NULL
$$;

CREATE OR REPLACE FUNCTION public.notification_mark_delivery_failed(
  p_intent_id uuid,
  p_failed_at timestamptz,
  p_error_code text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  UPDATE public.notification_delivery_intents
  SET claimed_at = NULL, failed_at = p_failed_at, last_error_code = p_error_code
  WHERE id = p_intent_id AND delivered_at IS NULL AND failed_at IS NULL
$$;

CREATE OR REPLACE FUNCTION public.notification_expire_due_campaign_invites(
  p_now timestamptz,
  p_limit integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  expired_count integer;
BEGIN
  IF p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'p_limit must be between 1 and 100';
  END IF;

  WITH due AS (
    SELECT id
    FROM public.campaign_invites
    WHERE status = 'PENDING' AND expires_at <= p_now
    ORDER BY expires_at, id
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ), expired AS (
    UPDATE public.campaign_invites invite
    SET status = 'EXPIRED', expired_at = p_now,
      version = invite.version + 1, updated_at = p_now
    FROM due
    WHERE invite.id = due.id
    RETURNING invite.id, invite.recipient_user_id
  ), cancelled AS (
    INSERT INTO public.notification_delivery_intents (
      operation, workflow_key, source_kind, source_public_id,
      recipient_notification_id, payload, occurred_at
    )
    SELECT
      'CANCEL',
      'social-invitation-received',
      'CAMPAIGN_INVITE',
      expired.id,
      profile.notification_recipient_id,
      '{}'::jsonb,
      p_now
    FROM expired
    JOIN public.profiles profile ON profile.id = expired.recipient_user_id
    ON CONFLICT (
      recipient_notification_id, source_kind, source_public_id, workflow_key, operation
    ) DO NOTHING
    RETURNING id
  )
  SELECT count(*)::integer INTO expired_count FROM expired;

  RETURN expired_count;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_notification_delivery_intents(integer, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_notification_feed_item(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notification_mark_delivery_succeeded(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notification_mark_delivery_retry(uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notification_mark_delivery_failed(uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notification_expire_due_campaign_invites(timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_delivery_intents(integer, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_notification_feed_item(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.notification_mark_delivery_succeeded(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.notification_mark_delivery_retry(uuid, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.notification_mark_delivery_failed(uuid, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.notification_expire_due_campaign_invites(timestamptz, integer) TO service_role;

CREATE OR REPLACE FUNCTION private.can_subscribe_notification_realtime_topic(requested_topic text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT requested_topic = 'notifications:' || auth.uid()::text
$$;

REVOKE ALL ON FUNCTION private.can_subscribe_notification_realtime_topic(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_subscribe_notification_realtime_topic(text) TO authenticated;

DROP POLICY IF EXISTS notification_realtime_topics ON realtime.messages;
CREATE POLICY notification_realtime_topics ON realtime.messages FOR SELECT TO authenticated
USING (private.can_subscribe_notification_realtime_topic(realtime.topic()));

CREATE OR REPLACE FUNCTION public.broadcast_notification_feed_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, realtime
AS $$
DECLARE
  changed public.notification_feed_items;
  unseen_count integer;
BEGIN
  changed := COALESCE(NEW, OLD);
  SELECT count(*)::integer INTO unseen_count
  FROM public.notification_feed_items
  WHERE recipient_user_id = changed.recipient_user_id
    AND seen_at IS NULL;

  PERFORM realtime.send(
    jsonb_build_object('feedItemId', changed.id, 'unseenCountHint', unseen_count),
    'feed-changed',
    'notifications:' || changed.recipient_user_id::text,
    true
  );
  RETURN changed;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_notification_feed_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notification_feed_items_broadcast_trigger ON public.notification_feed_items;
CREATE TRIGGER notification_feed_items_broadcast_trigger
AFTER INSERT OR UPDATE OF seen_at, read_at ON public.notification_feed_items
FOR EACH ROW EXECUTE FUNCTION public.broadcast_notification_feed_change();
