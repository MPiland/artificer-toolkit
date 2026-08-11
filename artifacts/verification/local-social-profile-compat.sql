do $$
begin
  alter table public.social_profiles
    add column if not exists adult_attested_at timestamptz,
    add column if not exists us_attested_at timestamptz,
    add column if not exists content_preference text not null default 'STANDARD';

  alter table public.social_profiles alter column attested_at set default now();

  update public.social_profiles
  set adult_attested_at = coalesce(adult_attested_at, attested_at),
      us_attested_at = coalesce(us_attested_at, attested_at)
  where adult_attested_at is null or us_attested_at is null;
end
$$;
