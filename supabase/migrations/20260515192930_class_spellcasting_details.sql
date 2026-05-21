CREATE TABLE IF NOT EXISTS public.class_spellcasting_details (
  spellcasting_id uuid NOT NULL
    REFERENCES public.class_spellcasting(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  detail_id uuid NOT NULL
    REFERENCES public.details(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  sort_order integer NOT NULL,

  PRIMARY KEY (spellcasting_id, detail_id)
);

ALTER TABLE public.class_spellcasting_details ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_class_spellcasting_details_sc
  ON public.class_spellcasting_details(spellcasting_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_class_spellcasting_details_owned'
      AND tgrelid = 'public.class_spellcasting_details'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_class_spellcasting_details_owned
    AFTER DELETE ON public.class_spellcasting_details
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.details",
      "columns": ["detail_id"]
    }]');
  END IF;
END;
$$;
