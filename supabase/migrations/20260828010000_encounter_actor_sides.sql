-- Encounter-owned side identity and closed factual relationships are shared by
-- reaction eligibility and initiative policy. Game Systems interpret the
-- relationship; labels and actor kinds never select mechanics.

CREATE TABLE public.encounter_sides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters (id)
    ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 160),
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, encounter_id),
  UNIQUE (encounter_id, sort_order)
);
CREATE INDEX encounter_sides_order_idx ON public.encounter_sides (
  encounter_id,
  sort_order,
  id
);
ALTER TABLE public.encounter_sides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounter_sides FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.encounter_sides FROM anon, authenticated;

CREATE TABLE public.encounter_side_relationships (
  encounter_id uuid NOT NULL REFERENCES public.encounters (id)
    ON DELETE CASCADE,
  first_side_id uuid NOT NULL,
  second_side_id uuid NOT NULL,
  relationship_kind text NOT NULL CHECK (
    relationship_kind IN ('ALLIED', 'NEUTRAL', 'HOSTILE')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (encounter_id, first_side_id, second_side_id),
  FOREIGN KEY (first_side_id, encounter_id) REFERENCES public.encounter_sides (
    id,
    encounter_id
  )
    ON DELETE CASCADE,
  FOREIGN KEY (second_side_id, encounter_id) REFERENCES public.encounter_sides (
    id,
    encounter_id
  )
    ON DELETE CASCADE,
  CHECK (first_side_id::text < second_side_id::text)
);
ALTER TABLE public.encounter_side_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounter_side_relationships FORCE ROW LEVEL SECURITY;
REVOKE ALL
ON TABLE public.encounter_side_relationships
FROM anon, authenticated;

ALTER TABLE public.encounter_actors ADD COLUMN side_id uuid;

INSERT INTO public.encounter_sides (encounter_id, label, sort_order)
SELECT encounter.id, 'Party', 0
FROM public.encounters AS encounter;

INSERT INTO public.encounter_sides (encounter_id, label, sort_order)
SELECT encounter.id, 'Opposition', 1
FROM public.encounters AS encounter;

UPDATE public.encounter_actors AS actor
SET side_id = side.id
FROM public.encounter_sides AS side
WHERE
  side.encounter_id = actor.encounter_id
  AND side.sort_order = CASE
    WHEN actor.kind = 'CHARACTER' THEN 0
    ELSE 1
  END;

ALTER TABLE public.encounter_actors ALTER COLUMN side_id SET NOT NULL;
ALTER TABLE public.encounter_actors
ADD CONSTRAINT encounter_actors_side_fk
  FOREIGN KEY (side_id, encounter_id) REFERENCES public.encounter_sides (
    id,
    encounter_id
  )
    ON DELETE RESTRICT;

INSERT INTO public.encounter_side_relationships
  (encounter_id, first_side_id, second_side_id, relationship_kind)
SELECT
  party.encounter_id,
  LEAST(party.id, opposition.id),
  GREATEST(party.id, opposition.id),
  'HOSTILE'
FROM
  public.encounter_sides AS party
  JOIN public.encounter_sides AS opposition
    ON opposition.encounter_id = party.encounter_id
    AND opposition.sort_order = 1
WHERE party.sort_order = 0;
