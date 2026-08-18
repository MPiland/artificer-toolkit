-- Immutable authored document versions are the aggregate source of truth.
-- Class root rows retain only ownership, routing, and catalog-envelope fields;
-- starting equipment remains inside the immutable document rather than a live
-- child-row dependency.

ALTER TABLE public.classes
  DROP CONSTRAINT IF EXISTS classes_category_parent_chk;
