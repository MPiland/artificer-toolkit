alter table public.equipment_properties
  add column if not exists sort_order smallint;

with ordered_properties as (
  select
    equipment_id,
    property_code,
    row_number() over (
      partition by equipment_id
      order by property_code
    ) as sort_order
  from public.equipment_properties
)
update public.equipment_properties property
set sort_order = ordered.sort_order
from ordered_properties ordered
where property.equipment_id = ordered.equipment_id
  and property.property_code = ordered.property_code
  and property.sort_order is null;

alter table public.equipment_properties
  alter column sort_order set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'equipment_properties_sort_order_positive'
      and conrelid = 'public.equipment_properties'::regclass
  ) then
    alter table public.equipment_properties
      add constraint equipment_properties_sort_order_positive
      check (sort_order > 0);
  end if;
end;
$$;
