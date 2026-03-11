/*************************************************
 * DETAILS — STANDALONE AUTHORED ENTITY
 *************************************************/

CREATE TABLE IF NOT EXISTS public.details (
  id uuid PRIMARY KEY,

  label text NOT NULL,
  description text NOT NULL,

  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

ALTER TABLE public.details ENABLE ROW LEVEL SECURITY;