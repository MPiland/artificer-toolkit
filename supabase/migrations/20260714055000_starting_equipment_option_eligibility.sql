ALTER TABLE public.starting_equipment_options
  ADD COLUMN IF NOT EXISTS eligibility_facet_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'starting_equipment_options_eligibility_facet_id_fkey'
      AND conrelid = 'public.starting_equipment_options'::regclass
  ) THEN
    ALTER TABLE public.starting_equipment_options
      ADD CONSTRAINT starting_equipment_options_eligibility_facet_id_fkey
      FOREIGN KEY (eligibility_facet_id)
      REFERENCES public.facets(id)
      ON DELETE SET NULL
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_starting_equipment_options_eligibility
  ON public.starting_equipment_options(eligibility_facet_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_starting_equipment_option_eligibility_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_starting_equipment_option_eligibility_on_update
    AFTER UPDATE ON public.starting_equipment_options
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[{
      "table": "public.facets",
      "columns": ["eligibility_facet_id"]
    }]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_starting_equipment_option_eligibility'
  ) THEN
    CREATE TRIGGER trg_cleanup_starting_equipment_option_eligibility
    AFTER DELETE ON public.starting_equipment_options
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.facets",
      "columns": ["eligibility_facet_id"]
    }]');
  END IF;
END;
$$;
