ALTER TABLE public.campaigns
  ADD COLUMN attunement_slot_override integer CHECK (attunement_slot_override >= 0);
