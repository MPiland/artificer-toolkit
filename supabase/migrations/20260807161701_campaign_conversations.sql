-- Campaign collaboration uses stable conversations instead of room-shaped rows.
CREATE TABLE public.campaign_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('TABLE', 'PARTY', 'DIRECT')),
  direct_user_a uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  direct_user_b uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (kind IN ('TABLE', 'PARTY') AND direct_user_a IS NULL AND direct_user_b IS NULL)
    OR (kind = 'DIRECT' AND direct_user_a IS NOT NULL AND direct_user_b IS NOT NULL AND direct_user_a < direct_user_b)
  ),
  CHECK (direct_user_a IS NULL OR direct_user_a <> direct_user_b)
);
CREATE UNIQUE INDEX campaign_conversations_campaign_kind_idx
  ON public.campaign_conversations (campaign_id, kind) WHERE kind IN ('TABLE', 'PARTY');
CREATE UNIQUE INDEX campaign_conversations_direct_pair_idx
  ON public.campaign_conversations (campaign_id, direct_user_a, direct_user_b) WHERE kind = 'DIRECT';
CREATE INDEX campaign_conversations_campaign_idx
  ON public.campaign_conversations (campaign_id, created_at DESC, id DESC);
ALTER TABLE public.campaign_conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.campaign_conversation_members (
  conversation_id uuid NOT NULL REFERENCES public.campaign_conversations (id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  access_started_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id),
  UNIQUE (conversation_id, campaign_id, user_id)
);
CREATE INDEX campaign_conversation_members_user_idx
  ON public.campaign_conversation_members (campaign_id, user_id, access_started_at);
ALTER TABLE public.campaign_conversation_members ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.validate_campaign_conversation_member()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF (SELECT kind FROM public.campaign_conversations WHERE id = NEW.conversation_id) = 'DIRECT'
    AND NEW.user_id NOT IN (
      SELECT direct_user_a FROM public.campaign_conversations WHERE id = NEW.conversation_id
      UNION ALL
      SELECT direct_user_b FROM public.campaign_conversations WHERE id = NEW.conversation_id
    ) THEN
    RAISE EXCEPTION 'Direct conversations have exactly two members.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER campaign_conversation_members_validate
  BEFORE INSERT OR UPDATE ON public.campaign_conversation_members
  FOR EACH ROW EXECUTE FUNCTION public.validate_campaign_conversation_member();

CREATE TABLE public.campaign_conversation_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.campaign_conversations (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('CHAT', 'ROLL')),
  author_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  author_character_id uuid,
  mode text CHECK (mode IN ('OOC', 'ROLEPLAY')),
  body text CHECK (body IS NULL OR char_length(body) <= 2000),
  roll_payload jsonb CHECK (roll_payload IS NULL OR jsonb_typeof(roll_payload) = 'object'),
  username_snapshot text NOT NULL CHECK (char_length(btrim(username_snapshot)) BETWEEN 1 AND 30),
  character_name_snapshot text CHECK (character_name_snapshot IS NULL OR char_length(character_name_snapshot) <= 100),
  client_nonce uuid NOT NULL,
  edited_at timestamptz,
  unsent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, author_user_id, client_nonce),
  CHECK (
    (kind = 'CHAT' AND roll_payload IS NULL AND mode IS NOT NULL AND ((unsent_at IS NULL AND body IS NOT NULL) OR (unsent_at IS NOT NULL AND body IS NULL)))
    OR (kind = 'ROLL' AND roll_payload IS NOT NULL AND body IS NULL AND mode IS NULL AND unsent_at IS NULL AND edited_at IS NULL)
  )
);
CREATE INDEX campaign_conversation_entries_cursor_idx
  ON public.campaign_conversation_entries (conversation_id, created_at DESC, id DESC);
CREATE OR REPLACE FUNCTION public.lock_campaign_conversation_entry()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.conversation_id::text, 0));
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.trim_campaign_conversation_entries()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  DELETE FROM public.campaign_conversation_entries
  WHERE id IN (
    SELECT id FROM public.campaign_conversation_entries
    WHERE conversation_id = NEW.conversation_id
    ORDER BY created_at DESC, id DESC
    OFFSET 500
  );
  RETURN NULL;
END;
$$;
CREATE TRIGGER campaign_conversation_entries_lock BEFORE INSERT ON public.campaign_conversation_entries
  FOR EACH ROW EXECUTE FUNCTION public.lock_campaign_conversation_entry();
CREATE TRIGGER campaign_conversation_entries_trim AFTER INSERT ON public.campaign_conversation_entries
  FOR EACH ROW EXECUTE FUNCTION public.trim_campaign_conversation_entries();
ALTER TABLE public.campaign_conversation_entries ENABLE ROW LEVEL SECURITY;

-- Preserve existing TABLE/PARTY history while switching reads and writes to conversations.
INSERT INTO public.campaign_conversations (campaign_id, kind)
SELECT DISTINCT campaign_id, room FROM public.campaign_room_entries
ON CONFLICT DO NOTHING;
INSERT INTO public.campaign_conversation_members (conversation_id, campaign_id, user_id, access_started_at)
SELECT conversations.id, conversations.campaign_id, memberships.user_id, memberships.access_started_at
FROM public.campaign_conversations conversations
JOIN public.campaign_memberships memberships ON memberships.campaign_id = conversations.campaign_id
WHERE memberships.status = 'ACTIVE'
  AND (conversations.kind = 'TABLE' OR (conversations.kind = 'PARTY' AND memberships.role = 'PLAYER'))
ON CONFLICT (conversation_id, user_id) DO NOTHING;
INSERT INTO public.campaign_conversation_entries (
  id, campaign_id, conversation_id, kind, author_user_id, author_character_id, mode, body,
  roll_payload, username_snapshot, character_name_snapshot, client_nonce, edited_at, unsent_at, created_at
)
SELECT entries.id, entries.campaign_id, conversations.id, entries.kind, entries.author_user_id,
  entries.author_character_id, entries.mode, entries.body, entries.roll_payload,
  entries.username_snapshot, entries.character_name_snapshot, entries.client_nonce,
  entries.edited_at, entries.unsent_at, entries.created_at
FROM public.campaign_room_entries entries
JOIN public.campaign_conversations conversations
  ON conversations.campaign_id = entries.campaign_id AND conversations.kind = entries.room
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS campaign_room_entries_lock ON public.campaign_room_entries;
DROP TRIGGER IF EXISTS campaign_room_entries_trim ON public.campaign_room_entries;
DROP FUNCTION IF EXISTS public.lock_campaign_room_entry();
DROP FUNCTION IF EXISTS public.trim_campaign_room_entries();
DROP TABLE public.campaign_room_entries;

-- Realtime authorization is intentionally an exact-topic check in the non-exposed schema.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
CREATE OR REPLACE FUNCTION private.can_subscribe_campaign_realtime_topic(requested_topic text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaign_memberships membership
    WHERE membership.user_id = auth.uid()
      AND membership.status = 'ACTIVE'
      AND (
        requested_topic = 'campaign:' || membership.campaign_id || ':table:' || membership.user_id || ':' || ((extract(epoch FROM date_trunc('milliseconds', membership.access_started_at)) * 1000)::bigint)::text
        OR (requested_topic = 'campaign:' || membership.campaign_id || ':party:' || membership.user_id || ':' || ((extract(epoch FROM date_trunc('milliseconds', membership.access_started_at)) * 1000)::bigint)::text AND membership.role = 'PLAYER')
        OR EXISTS (
          SELECT 1
          FROM public.campaign_conversation_members conversation_member
          JOIN public.campaign_conversations conversation ON conversation.id = conversation_member.conversation_id
          WHERE conversation.kind = 'DIRECT'
            AND conversation_member.user_id = membership.user_id
            AND conversation_member.campaign_id = membership.campaign_id
            AND EXISTS (
              SELECT 1
              FROM public.campaign_memberships other_membership
              WHERE other_membership.campaign_id = membership.campaign_id
                AND other_membership.status = 'ACTIVE'
                AND other_membership.user_id = CASE
                  WHEN conversation.direct_user_a = membership.user_id THEN conversation.direct_user_b
                  ELSE conversation.direct_user_a
                END
            )
            AND requested_topic = 'campaign:' || membership.campaign_id || ':direct:' || conversation.id || ':' || membership.user_id || ':' || ((extract(epoch FROM date_trunc('milliseconds', conversation_member.access_started_at)) * 1000)::bigint)::text
        )
      )
  )
$$;
REVOKE ALL ON FUNCTION private.can_subscribe_campaign_realtime_topic(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_subscribe_campaign_realtime_topic(text) TO authenticated;
DROP POLICY IF EXISTS campaign_realtime_topics ON realtime.messages;
CREATE POLICY campaign_realtime_topics ON realtime.messages FOR SELECT TO authenticated
USING (private.can_subscribe_campaign_realtime_topic(realtime.topic()));
REVOKE ALL ON FUNCTION public.can_subscribe_campaign_realtime_topic(text) FROM PUBLIC, authenticated;
DROP FUNCTION IF EXISTS public.can_subscribe_campaign_realtime_topic(text);
