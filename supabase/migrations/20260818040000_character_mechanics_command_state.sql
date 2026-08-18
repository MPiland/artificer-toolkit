alter table public.character_mechanics_projections
  add column command_state jsonb not null,
  add column command_state_checksum text not null
    check (command_state_checksum ~ '^[a-f0-9]{64}$');

alter table public.character_mechanics_projections
  add column command_lane_checksum text not null
    check (command_lane_checksum ~ '^[a-f0-9]{64}$');
