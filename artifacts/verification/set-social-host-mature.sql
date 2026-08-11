update public.social_profiles social
set content_preference = 'MATURE',
    adult_attested_at = coalesce(adult_attested_at, now()),
    version = version + 1,
    updated_at = now()
from auth.users account
where account.id = social.user_id
  and account.email = 'social-host@local.test';
