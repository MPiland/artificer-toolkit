-- Realtime authorization remains an exact-topic check in the non-exposed schema.
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
        OR (requested_topic = 'campaign:' || membership.campaign_id || ':owner:' || membership.user_id || ':' || ((extract(epoch FROM date_trunc('milliseconds', membership.access_started_at)) * 1000)::bigint)::text AND membership.role = 'OWNER')
        OR requested_topic = 'campaign:' || membership.campaign_id || ':user:' || membership.user_id || ':' || ((extract(epoch FROM date_trunc('milliseconds', membership.access_started_at)) * 1000)::bigint)::text
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
