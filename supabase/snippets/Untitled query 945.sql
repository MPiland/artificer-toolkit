select
  id,
  email,
  email_confirmed_at,
  created_at,
  last_sign_in_at
from auth.users
order by created_at desc;