ALTER TABLE public.effect_invocations
  ADD COLUMN resource_charge_id uuid REFERENCES public.charges (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  ADD COLUMN resource_cost integer,
  ADD CONSTRAINT effect_invocations_resource_use_pair_check CHECK (
    (resource_charge_id IS NULL AND resource_cost IS NULL)
    OR (resource_charge_id IS NOT NULL AND resource_cost > 0)
  );
