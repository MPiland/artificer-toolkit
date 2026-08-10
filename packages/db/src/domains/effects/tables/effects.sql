/*
 * EFFECTS
 * Root authored effect container
 */

CREATE TABLE IF NOT EXISTS public.effects (
  id uuid PRIMARY KEY,

  -- Authoring order within parent container
  sort_order integer NOT NULL,

  -- No additional inline payload lives on the effect root.
  -- Nested invocation and PATH_CODE trees are persisted in owned child tables.

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.effects ENABLE ROW LEVEL SECURITY;
