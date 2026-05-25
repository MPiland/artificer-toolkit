DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'facet_body_selection_items_pkey'
      AND conrelid = 'public.facet_body_selection_items'::regclass
  ) THEN
    ALTER TABLE public.facet_body_selection_items
      ADD CONSTRAINT facet_body_selection_items_pkey
      PRIMARY KEY (facet_body_id, sort_order);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'facet_exists_selection_items_pkey'
      AND conrelid = 'public.facet_exists_selection_items'::regclass
  ) THEN
    ALTER TABLE public.facet_exists_selection_items
      ADD CONSTRAINT facet_exists_selection_items_pkey
      PRIMARY KEY (facet_condition_id, sort_order);
  END IF;
END;
$$;

DROP INDEX IF EXISTS public.idx_facet_body_selection_items_body_id;
DROP INDEX IF EXISTS public.idx_facet_exists_selection_items_condition_id;
