ALTER TABLE public.effect_invocations
  DROP CONSTRAINT effect_invocations_resource_charge_id_fkey,
  ADD CONSTRAINT effect_invocations_resource_charge_id_fkey
    FOREIGN KEY (resource_charge_id)
    REFERENCES public.charges (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED;
