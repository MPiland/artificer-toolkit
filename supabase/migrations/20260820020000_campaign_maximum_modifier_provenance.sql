alter table public.campaign_character_mechanics_projections
  add column manual_maximum_modifier_owner text
    check (manual_maximum_modifier_owner in ('CHARACTER', 'CAMPAIGN'));
