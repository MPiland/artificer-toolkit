-- Spell class membership is an indexed catalog reference, not a normalized
-- spell aggregate. Each row must identify the immutable authored spell version
-- that published it.

CREATE TABLE IF NOT EXISTS public.spell_catalog_classes (
  spell_id uuid NOT NULL REFERENCES public.spells (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  authored_version_id uuid NOT NULL,
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  PRIMARY KEY (spell_id, class_id),
  FOREIGN KEY (spell_id, authored_version_id)
    REFERENCES public.spell_versions (spell_id, id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_spell_catalog_classes_class
  ON public.spell_catalog_classes (class_id, spell_id);

CREATE INDEX IF NOT EXISTS idx_spell_catalog_classes_version
  ON public.spell_catalog_classes (authored_version_id);

-- A marker exists even when the Spell has no Classes. Readers use it to reject
-- a missing or stale membership index instead of treating that state as empty.
CREATE TABLE IF NOT EXISTS public.spell_catalog_index_versions (
  spell_id uuid PRIMARY KEY REFERENCES public.spells (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  authored_version_id uuid NOT NULL,
  FOREIGN KEY (spell_id, authored_version_id)
    REFERENCES public.spell_versions (spell_id, id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_spell_catalog_index_versions_version
  ON public.spell_catalog_index_versions (authored_version_id);

ALTER TABLE public.spell_catalog_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spell_catalog_index_versions ENABLE ROW LEVEL SECURITY;
