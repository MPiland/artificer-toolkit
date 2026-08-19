alter table public.campaign_character_mechanics_projections
  add column projection_kind text not null default 'MATERIALIZED'
    check (projection_kind in ('BASE_REFERENCE', 'MATERIALIZED'));

alter table public.campaign_character_mechanics_projections
  alter column rule_policy_input drop not null,
  alter column rule_policy_output drop not null,
  drop constraint if exists campaign_character_mechanics_projections_rule_policy_input_check,
  drop constraint if exists campaign_character_mechanics_projections_rule_policy_output_check,
  add constraint campaign_character_mechanics_projections_policy_shape_check check (
    (projection_kind = 'BASE_REFERENCE' and rule_policy_input is null and rule_policy_output is null)
    or (
      projection_kind = 'MATERIALIZED'
      and rule_policy_input is not null
      and rule_policy_output is not null
      and jsonb_typeof(rule_policy_input) = 'object'
      and jsonb_typeof(rule_policy_output) = 'object'
    )
  );

alter table public.campaign_character_mechanics_projections
  alter column projection_kind drop default;
