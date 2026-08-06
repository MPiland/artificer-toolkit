UPDATE auth.users AS auth_user
SET raw_app_meta_data = COALESCE(auth_user.raw_app_meta_data, '{}'::jsonb) ||
  '{"registration_completed": true}'::jsonb
WHERE auth_user.invited_at IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = auth_user.id
      AND profile.username IS NOT NULL
  );
