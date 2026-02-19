/* ──────────────────────────────────────────────
 * EFFECTS
 * Root authored effect container
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.effects (
  id uuid PRIMARY KEY,

  -- Authoring order within parent container
  sort_order integer NOT NULL,

  -- Traits are flat vocabulary references (no payload)
  -- Stored as join table, not array (added later if needed)
  -- traits are optional, so nothing inline here

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.effects ENABLE ROW LEVEL SECURITY;