alter table public.creature_speeds
  add column sort_order integer;

with authored_speed_order as (
  select
    definition.subject_id as creature_id,
    (speed.value ->> 'speedId')::uuid as speed_id,
    speed.ordinality::integer as sort_order
  from public.authored_definitions definition
  join public.authored_definition_revisions revision
    on revision.definition_id = definition.subject_id
    and revision.id = definition.active_revision_id
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(revision.payload -> 'speeds') = 'array'
        then revision.payload -> 'speeds'
      else '[]'::jsonb
    end
  ) with ordinality as speed(value, ordinality)
  where definition.subject_kind = 'CREATURE'
)
update public.creature_speeds persisted_speed
set sort_order = authored_speed.sort_order
from authored_speed_order authored_speed
where authored_speed.creature_id = persisted_speed.creature_id
  and authored_speed.speed_id = persisted_speed.speed_id;

with fallback_speed_order as (
  select
    creature_id,
    speed_id,
    row_number() over (partition by creature_id order by speed_id)::integer as sort_order
  from public.creature_speeds
  where sort_order is null
)
update public.creature_speeds persisted_speed
set sort_order = fallback_speed.sort_order
from fallback_speed_order fallback_speed
where fallback_speed.creature_id = persisted_speed.creature_id
  and fallback_speed.speed_id = persisted_speed.speed_id;

alter table public.creature_speeds
  alter column sort_order set not null,
  add constraint creature_speeds_creature_sort_order_unique
    unique (creature_id, sort_order);
