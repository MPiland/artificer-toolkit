update public.social_profiles social
set adult_attested_at = now(),
    content_preference = 'STANDARD',
    version = version + 1,
    updated_at = now()
from auth.users account
where account.id = social.user_id
  and account.email = 'social-host@local.test';
