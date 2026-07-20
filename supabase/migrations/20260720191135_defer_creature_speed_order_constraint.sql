alter table public.creature_speeds
  drop constraint creature_speeds_creature_sort_order_unique,
  add constraint creature_speeds_creature_sort_order_unique
    unique (creature_id, sort_order)
    deferrable initially deferred;
