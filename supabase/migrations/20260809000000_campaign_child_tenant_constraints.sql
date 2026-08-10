ALTER TABLE public.campaign_conversations
  ADD CONSTRAINT campaign_conversations_id_campaign_id_key UNIQUE (id, campaign_id);

ALTER TABLE public.campaign_sessions
  ADD CONSTRAINT campaign_sessions_id_campaign_id_key UNIQUE (id, campaign_id);

ALTER TABLE public.campaign_conversation_members
  DROP CONSTRAINT campaign_conversation_members_conversation_id_fkey,
  ADD CONSTRAINT campaign_conversation_members_conversation_campaign_fkey
    FOREIGN KEY (conversation_id, campaign_id)
    REFERENCES public.campaign_conversations (id, campaign_id)
    ON DELETE CASCADE;

ALTER TABLE public.campaign_conversation_entries
  DROP CONSTRAINT campaign_conversation_entries_conversation_id_fkey,
  ADD CONSTRAINT campaign_conversation_entries_conversation_campaign_fkey
    FOREIGN KEY (conversation_id, campaign_id)
    REFERENCES public.campaign_conversations (id, campaign_id)
    ON DELETE CASCADE;

ALTER TABLE public.campaign_session_attendance
  DROP CONSTRAINT campaign_session_attendance_session_id_fkey,
  ADD CONSTRAINT campaign_session_attendance_session_campaign_fkey
    FOREIGN KEY (session_id, campaign_id)
    REFERENCES public.campaign_sessions (id, campaign_id)
    ON DELETE CASCADE;

ALTER TABLE public.campaign_session_rsvps
  DROP CONSTRAINT campaign_session_rsvps_session_id_fkey,
  ADD CONSTRAINT campaign_session_rsvps_session_campaign_fkey
    FOREIGN KEY (session_id, campaign_id)
    REFERENCES public.campaign_sessions (id, campaign_id)
    ON DELETE CASCADE;

ALTER TABLE public.campaign_session_reference_pins
  DROP CONSTRAINT campaign_session_reference_pins_session_id_fkey,
  ADD CONSTRAINT campaign_session_reference_pins_session_campaign_fkey
    FOREIGN KEY (session_id, campaign_id)
    REFERENCES public.campaign_sessions (id, campaign_id)
    ON DELETE CASCADE;
