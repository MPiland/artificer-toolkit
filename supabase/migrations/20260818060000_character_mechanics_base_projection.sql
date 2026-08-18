-- Campaign-specific mechanics are stored only in the assignment-bound overlay.
alter table public.character_mechanics_projections
  drop column if exists campaign_context_checksum;
