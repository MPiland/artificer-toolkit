CREATE TABLE IF NOT EXISTS public.social_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  adult_attested_at timestamptz,
  us_attested_at timestamptz,
  content_preference text NOT NULL DEFAULT 'STANDARD'
    CHECK (content_preference IN ('STANDARD', 'MATURE')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS social_profiles_status_idx ON public.social_profiles (status, id);
ALTER TABLE public.social_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_profiles FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.social_profiles FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.social_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL UNIQUE REFERENCES public.campaigns (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'OPEN', 'CLOSED')),
  audience text NOT NULL CHECK (audience IN ('PRIVATE', 'PUBLIC')),
  moderation_status text NOT NULL DEFAULT 'VISIBLE' CHECK (moderation_status IN ('VISIBLE', 'HIDDEN')),
  system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 100),
  summary text NOT NULL CHECK (char_length(btrim(summary)) BETWEEN 1 AND 2000),
  campaign_format text NOT NULL CHECK (campaign_format IN ('ONE_SHOT', 'ONGOING')),
  tone_tags text[] NOT NULL CHECK (
    cardinality(tone_tags) BETWEEN 1 AND 3
    AND tone_tags <@ ARRAY[
      'LIGHTHEARTED', 'HEROIC', 'SERIOUS', 'DARK',
      'GRITTY', 'HORROR', 'COMEDIC', 'COZY'
    ]::text[]
  ),
  tone_details text CHECK (tone_details IS NULL OR char_length(btrim(tone_details)) BETWEEN 1 AND 1000),
  content_maturity text NOT NULL CHECK (content_maturity IN ('STANDARD', 'MATURE')),
  play_mode text NOT NULL CHECK (play_mode IN ('ONLINE', 'IN_PERSON', 'HYBRID')),
  capacity integer NOT NULL CHECK (capacity BETWEEN 1 AND 100),
  schedule_kind text NOT NULL CHECK (schedule_kind IN ('FLEXIBLE', 'ONE_TIME', 'RECURRING')),
  time_zone text NOT NULL CHECK (char_length(btrim(time_zone)) BETWEEN 1 AND 100),
  schedule_summary text NOT NULL CHECK (char_length(btrim(schedule_summary)) BETWEEN 1 AND 2000),
  starts_at timestamptz,
  weekday smallint CHECK (weekday BETWEEN 0 AND 6),
  local_start_time time,
  recurrence text CHECK (recurrence IN ('WEEKLY', 'BIWEEKLY')),
  city text CHECK (city IS NULL OR char_length(btrim(city)) BETWEEN 1 AND 100),
  state_code text CHECK (state_code IS NULL OR state_code ~ '^[A-Z]{2}$'),
  content_guidance text NOT NULL CHECK (char_length(btrim(content_guidance)) BETWEEN 1 AND 4000),
  attendance_policy text NOT NULL CHECK (char_length(btrim(attendance_policy)) BETWEEN 1 AND 4000),
  allowed_content_rules text NOT NULL CHECK (char_length(btrim(allowed_content_rules)) BETWEEN 1 AND 4000),
  table_conduct text NOT NULL CHECK (char_length(btrim(table_conduct)) BETWEEN 1 AND 4000),
  content_boundaries text NOT NULL CHECK (char_length(btrim(content_boundaries)) BETWEEN 1 AND 4000),
  safety_practices text[] NOT NULL CHECK (
    cardinality(safety_practices) BETWEEN 1 AND 6
    AND safety_practices <@ ARRAY[
      'SESSION_ZERO',
      'LINES_AND_VEILS',
      'X_CARD',
      'OPEN_DOOR',
      'SCRIPT_CHANGE',
      'OTHER'
    ]::text[]
  ),
  safety_details text NOT NULL CHECK (char_length(btrim(safety_details)) BETWEEN 1 AND 4000),
  is_free boolean NOT NULL DEFAULT true,
  price_amount numeric(12, 2),
  price_currency text,
  published_at timestamptz,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(summary, '')), 'B')
  ) STORED,
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (schedule_kind = 'FLEXIBLE'
      AND starts_at IS NULL AND weekday IS NULL AND local_start_time IS NULL AND recurrence IS NULL)
    OR (schedule_kind = 'ONE_TIME'
      AND starts_at IS NOT NULL AND weekday IS NULL AND local_start_time IS NULL AND recurrence IS NULL)
    OR (schedule_kind = 'RECURRING'
      AND starts_at IS NULL AND weekday IS NOT NULL AND local_start_time IS NOT NULL AND recurrence IS NOT NULL)
  ),
  CHECK (campaign_format <> 'ONE_SHOT' OR schedule_kind <> 'RECURRING'),
  CHECK (
    (play_mode = 'ONLINE' AND city IS NULL AND state_code IS NULL)
    OR (play_mode IN ('IN_PERSON', 'HYBRID') AND city IS NOT NULL AND state_code IS NOT NULL)
  ),
  CHECK (is_free = true AND price_amount IS NULL AND price_currency IS NULL),
  CHECK (status <> 'OPEN' OR published_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS systems_ruleset_idx
  ON public.systems (ruleset_code, ruleset_version, id);
CREATE INDEX IF NOT EXISTS social_listings_discovery_cursor_idx
  ON public.social_listings (published_at DESC, id DESC)
  WHERE status = 'OPEN' AND audience = 'PUBLIC' AND moderation_status = 'VISIBLE';
CREATE INDEX IF NOT EXISTS social_listings_system_idx
  ON public.social_listings (system_id, published_at DESC, id DESC)
  WHERE status = 'OPEN' AND audience = 'PUBLIC' AND moderation_status = 'VISIBLE';
CREATE INDEX IF NOT EXISTS social_listings_format_maturity_idx
  ON public.social_listings (campaign_format, content_maturity, published_at DESC, id DESC)
  WHERE status = 'OPEN' AND audience = 'PUBLIC' AND moderation_status = 'VISIBLE';
CREATE INDEX IF NOT EXISTS social_listings_play_mode_idx
  ON public.social_listings (play_mode, published_at DESC, id DESC)
  WHERE status = 'OPEN' AND audience = 'PUBLIC' AND moderation_status = 'VISIBLE';
CREATE INDEX IF NOT EXISTS social_listings_schedule_idx
  ON public.social_listings (schedule_kind, time_zone, weekday, published_at DESC, id DESC)
  WHERE status = 'OPEN' AND audience = 'PUBLIC' AND moderation_status = 'VISIBLE';
CREATE INDEX IF NOT EXISTS social_listings_location_idx
  ON public.social_listings (state_code, lower(city), published_at DESC, id DESC)
  WHERE status = 'OPEN' AND audience = 'PUBLIC' AND moderation_status = 'VISIBLE';
CREATE INDEX IF NOT EXISTS social_listings_capacity_idx
  ON public.social_listings (capacity, published_at DESC, id DESC)
  WHERE status = 'OPEN' AND audience = 'PUBLIC' AND moderation_status = 'VISIBLE';
CREATE INDEX IF NOT EXISTS social_listings_safety_idx
  ON public.social_listings USING gin (safety_practices)
  WHERE status = 'OPEN' AND audience = 'PUBLIC' AND moderation_status = 'VISIBLE';
CREATE INDEX IF NOT EXISTS social_listings_tone_tags_idx
  ON public.social_listings USING gin (tone_tags)
  WHERE status = 'OPEN' AND audience = 'PUBLIC' AND moderation_status = 'VISIBLE';
CREATE INDEX IF NOT EXISTS social_listings_search_idx
  ON public.social_listings USING gin (search_vector);
ALTER TABLE public.social_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_listings FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.social_listings FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.social_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.social_listings (id) ON DELETE CASCADE,
  applicant_profile_id uuid NOT NULL REFERENCES public.social_profiles (id) ON DELETE RESTRICT,
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('SUBMITTED', 'WITHDRAWN', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'BLOCKED')),
  listing_version integer NOT NULL CHECK (listing_version >= 0),
  expectations_snapshot jsonb NOT NULL CHECK (jsonb_typeof(expectations_snapshot) = 'object'),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  responded_at timestamptz,
  expired_at timestamptz,
  blocked_at timestamptz,
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status = 'SUBMITTED'
      AND withdrawn_at IS NULL AND responded_at IS NULL AND expired_at IS NULL AND blocked_at IS NULL)
    OR (status = 'WITHDRAWN'
      AND withdrawn_at IS NOT NULL AND responded_at IS NULL AND expired_at IS NULL AND blocked_at IS NULL)
    OR (status IN ('ACCEPTED', 'DECLINED')
      AND withdrawn_at IS NULL AND responded_at IS NOT NULL AND expired_at IS NULL AND blocked_at IS NULL)
    OR (status = 'EXPIRED'
      AND withdrawn_at IS NULL AND responded_at IS NULL AND expired_at IS NOT NULL AND blocked_at IS NULL)
    OR (status = 'BLOCKED'
      AND withdrawn_at IS NULL AND responded_at IS NULL AND expired_at IS NULL AND blocked_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS social_applications_one_active_idx
  ON public.social_applications (listing_id, applicant_profile_id)
  WHERE status IN ('SUBMITTED', 'ACCEPTED');
CREATE INDEX IF NOT EXISTS social_applications_listing_status_idx
  ON public.social_applications (listing_id, status, submitted_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS social_applications_applicant_status_idx
  ON public.social_applications (applicant_profile_id, status, submitted_at DESC, id DESC);
ALTER TABLE public.social_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_applications FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.social_applications FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.social_blocks (
  blocker_profile_id uuid NOT NULL REFERENCES public.social_profiles (id) ON DELETE CASCADE,
  blocked_profile_id uuid NOT NULL REFERENCES public.social_profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_profile_id, blocked_profile_id),
  CHECK (blocker_profile_id <> blocked_profile_id)
);

CREATE INDEX IF NOT EXISTS social_blocks_blocked_idx
  ON public.social_blocks (blocked_profile_id, blocker_profile_id);
ALTER TABLE public.social_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_blocks FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.social_blocks FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.social_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_profile_id uuid NOT NULL REFERENCES public.social_profiles (id) ON DELETE RESTRICT,
  target_profile_id uuid REFERENCES public.social_profiles (id) ON DELETE RESTRICT,
  target_listing_id uuid REFERENCES public.social_listings (id) ON DELETE RESTRICT,
  target_application_id uuid REFERENCES public.social_applications (id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (reason IN (
    'HARASSMENT',
    'HATE_OR_ABUSE',
    'SEXUAL_CONTENT',
    'SPAM_OR_SCAM',
    'SAFETY_MISREPRESENTATION',
    'PRIVACY',
    'OTHER'
  )),
  details text NOT NULL CHECK (char_length(btrim(details)) BETWEEN 1 AND 4000),
  evidence_snapshot jsonb NOT NULL CHECK (jsonb_typeof(evidence_snapshot) = 'object'),
  status text NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('SUBMITTED', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED')),
  review_started_at timestamptz,
  resolved_at timestamptz,
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(target_profile_id, target_listing_id, target_application_id) = 1),
  CHECK (
    (status = 'SUBMITTED' AND review_started_at IS NULL AND resolved_at IS NULL)
    OR (status = 'UNDER_REVIEW' AND review_started_at IS NOT NULL AND resolved_at IS NULL)
    OR (status IN ('RESOLVED', 'DISMISSED') AND review_started_at IS NOT NULL AND resolved_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS social_reports_queue_idx
  ON public.social_reports (status, created_at, id);
CREATE INDEX IF NOT EXISTS social_reports_reporter_idx
  ON public.social_reports (reporter_profile_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS social_reports_target_profile_idx
  ON public.social_reports (target_profile_id, created_at DESC) WHERE target_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS social_reports_target_listing_idx
  ON public.social_reports (target_listing_id, created_at DESC) WHERE target_listing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS social_reports_target_application_idx
  ON public.social_reports (target_application_id, created_at DESC) WHERE target_application_id IS NOT NULL;
ALTER TABLE public.social_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_reports FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.social_reports FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.social_moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  report_id uuid NOT NULL REFERENCES public.social_reports (id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN (
    'VIEWED',
    'START_REVIEW',
    'DISMISS',
    'RESOLVE',
    'HIDE_LISTING',
    'RESTORE_LISTING',
    'SUSPEND_PROFILE',
    'RESTORE_PROFILE'
  )),
  affected_profile_id uuid REFERENCES public.social_profiles (id) ON DELETE RESTRICT,
  affected_listing_id uuid REFERENCES public.social_listings (id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 4000),
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(before_state) = 'object'),
  after_state jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(after_state) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (action IN ('VIEWED', 'START_REVIEW', 'DISMISS', 'RESOLVE')
      AND affected_profile_id IS NULL AND affected_listing_id IS NULL)
    OR (action IN ('HIDE_LISTING', 'RESTORE_LISTING')
      AND affected_profile_id IS NULL AND affected_listing_id IS NOT NULL)
    OR (action IN ('SUSPEND_PROFILE', 'RESTORE_PROFILE')
      AND affected_profile_id IS NOT NULL AND affected_listing_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS social_moderation_actions_report_idx
  ON public.social_moderation_actions (report_id, created_at, id);
CREATE INDEX IF NOT EXISTS social_moderation_actions_moderator_idx
  ON public.social_moderation_actions (moderator_user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS social_moderation_actions_profile_idx
  ON public.social_moderation_actions (affected_profile_id, created_at DESC)
  WHERE affected_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS social_moderation_actions_listing_idx
  ON public.social_moderation_actions (affected_listing_id, created_at DESC)
  WHERE affected_listing_id IS NOT NULL;
ALTER TABLE public.social_moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_moderation_actions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.social_moderation_actions FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.social_action_rate_limits (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  action_kind text NOT NULL CHECK (action_kind IN ('INVITE', 'APPLICATION', 'REPORT', 'BLOCK')),
  window_kind text NOT NULL CHECK (window_kind IN ('HOUR', 'DAY')),
  window_started_at timestamptz NOT NULL,
  action_count integer NOT NULL CHECK (action_count > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, action_kind, window_kind, window_started_at),
  CHECK (window_kind = 'HOUR' OR action_kind IN ('APPLICATION', 'REPORT'))
);

ALTER TABLE public.social_action_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_action_rate_limits FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.social_action_rate_limits FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.campaign_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.social_listings (id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  recipient_username text NOT NULL CHECK (char_length(btrim(recipient_username)) BETWEEN 3 AND 30),
  listing_version integer NOT NULL CHECK (listing_version >= 0),
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED')),
  expires_at timestamptz NOT NULL,
  responded_at timestamptz,
  revoked_at timestamptz,
  expired_at timestamptz,
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (created_by <> recipient_user_id),
  CHECK (
    (status = 'PENDING' AND responded_at IS NULL AND revoked_at IS NULL AND expired_at IS NULL)
    OR (status IN ('ACCEPTED', 'DECLINED') AND responded_at IS NOT NULL AND revoked_at IS NULL AND expired_at IS NULL)
    OR (status = 'REVOKED' AND responded_at IS NULL AND revoked_at IS NOT NULL AND expired_at IS NULL)
    OR (status = 'EXPIRED' AND responded_at IS NULL AND revoked_at IS NULL AND expired_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS campaign_invites_one_pending_idx
  ON public.campaign_invites (listing_id, recipient_user_id)
  WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS campaign_invites_listing_status_idx
  ON public.campaign_invites (listing_id, status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS campaign_invites_recipient_status_idx
  ON public.campaign_invites (recipient_user_id, status, created_at DESC, id DESC);
ALTER TABLE public.campaign_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_invites FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.campaign_invites FROM anon, authenticated;
