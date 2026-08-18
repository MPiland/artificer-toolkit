create table public.campaign_character_mechanics_projections (
  campaign_id uuid not null,
  character_id uuid not null,
  stream_version integer not null check (stream_version >= 0),
  base_mechanics_projection_checksum text not null
    check (base_mechanics_projection_checksum ~ '^[a-f0-9]{64}$'),
  mechanical_context_checksum text not null
    check (mechanical_context_checksum ~ '^[a-f0-9]{64}$'),
  projection_schema_version integer not null check (projection_schema_version > 0),
  projection_checksum text not null check (projection_checksum ~ '^[a-f0-9]{64}$'),
  rule_policy_input jsonb not null check (jsonb_typeof(rule_policy_input) = 'object'),
  rule_policy_output jsonb not null check (jsonb_typeof(rule_policy_output) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, character_id),
  foreign key (campaign_id, character_id)
    references public.campaign_character_assignments (campaign_id, character_id)
    on delete cascade
);

alter table public.campaign_character_mechanics_projections enable row level security;
revoke all on table public.campaign_character_mechanics_projections from anon, authenticated;
