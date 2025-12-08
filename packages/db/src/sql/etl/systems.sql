/***************************
 * TABLES
 ***************************/
CREATE TABLE IF NOT EXISTS public.systems (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
    is_master boolean NOT NULL DEFAULT FALSE,
    label text NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_systems_user ON public.systems (user_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_systems_updated_at'
            AND tgrelid = 'public.systems'::regclass) THEN
    CREATE TRIGGER trg_systems_updated_at
        BEFORE UPDATE ON public.systems
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.systems ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.system_tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    name text NOT NULL,
    UNIQUE(system_id, name),
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_tags_system ON public.system_tags (system_id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.system_tags'::regclass
          AND contype = 'u'
          AND conname = 'system_tags_name_key') THEN
        ALTER TABLE public.system_tags DROP CONSTRAINT system_tags_name_key;
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_system_tags_system_name ON public.system_tags (system_id, name);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_tags_updated_at'
            AND tgrelid = 'public.system_tags'::regclass) THEN
    CREATE TRIGGER trg_system_tags_updated_at
        BEFORE UPDATE ON public.system_tags
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_tags ENABLE ROW LEVEL SECURITY;

-- Ability options
CREATE TABLE IF NOT EXISTS public.system_abilities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    label text NOT NULL,
    description text,
    tooltip text,
    short text,
    code text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_abilities_label ON public.system_abilities (label);

CREATE INDEX IF NOT EXISTS idx_system_abilities_system ON public.system_abilities (system_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_abilities_updated_at'
            AND tgrelid = 'public.system_abilities'::regclass) THEN
    CREATE TRIGGER trg_system_abilities_updated_at
        BEFORE UPDATE ON public.system_abilities
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_abilities ENABLE ROW LEVEL SECURITY;

-- Action options
CREATE TABLE IF NOT EXISTS public.system_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    label text NOT NULL,
    description text,
    tooltip text,
    short text,
    code text NOT NULL,
    is_master boolean NOT NULL DEFAULT FALSE,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_actions_label ON public.system_actions (label);

CREATE INDEX IF NOT EXISTS idx_system_actions_system ON public.system_actions (system_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_actions_updated_at'
            AND tgrelid = 'public.system_actions'::regclass) THEN
    CREATE TRIGGER trg_system_actions_updated_at
        BEFORE UPDATE ON public.system_actions
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_actions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.system_action_tags (
    tag_id uuid NOT NULL REFERENCES public.system_tags (id) ON DELETE CASCADE DEFERRABLE,
    action_id uuid NOT NULL REFERENCES public.system_actions (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW(),
    PRIMARY KEY (tag_id, action_id)
);

CREATE INDEX IF NOT EXISTS idx_system_action_tags_action ON public.system_action_tags (action_id);

CREATE INDEX IF NOT EXISTS idx_system_action_tags_tag ON public.system_action_tags (tag_id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'system_action_tags' AND column_name = 'option_id'
    ) THEN
        ALTER TABLE public.system_action_tags RENAME COLUMN option_id TO action_id;
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_class WHERE relname = 'idx_system_action_tags_opt'
    ) THEN
        ALTER INDEX idx_system_action_tags_opt RENAME TO idx_system_action_tags_action;
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_action_tags_updated_at'
            AND tgrelid = 'public.system_action_tags'::regclass) THEN
    CREATE TRIGGER trg_system_action_tags_updated_at
        BEFORE UPDATE ON public.system_action_tags
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_action_tags ENABLE ROW LEVEL SECURITY;

-- Alignment
CREATE TABLE IF NOT EXISTS public.system_alignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    label text NOT NULL,
    description text,
    tooltip text,
    short text,
    code text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_alignments_label ON public.system_alignments (label);

CREATE INDEX IF NOT EXISTS idx_system_alignments_system ON public.system_alignments (system_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_alignments_updated_at'
            AND tgrelid = 'public.system_alignments'::regclass) THEN
    CREATE TRIGGER trg_system_alignments_updated_at
        BEFORE UPDATE ON public.system_alignments
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_alignments ENABLE ROW LEVEL SECURITY;

-- Attributes
CREATE TABLE IF NOT EXISTS public.system_attributes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    label text NOT NULL,
    description text,
    tooltip text,
    short text,
    code text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_attributes_label ON public.system_attributes (label);

CREATE INDEX IF NOT EXISTS idx_system_attributes_system ON public.system_attributes (system_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_attributes_updated_at'
            AND tgrelid = 'public.system_attributes'::regclass) THEN
    CREATE TRIGGER trg_system_attributes_updated_at
        BEFORE UPDATE ON public.system_attributes
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_attributes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.system_attribute_tags (
    tag_id uuid NOT NULL REFERENCES public.system_tags (id) ON DELETE CASCADE DEFERRABLE,
    attribute_id uuid NOT NULL REFERENCES public.system_attributes (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW(),
    PRIMARY KEY (tag_id, attribute_id)
);

CREATE INDEX IF NOT EXISTS idx_system_attribute_tags_attribute ON public.system_attribute_tags (attribute_id);

CREATE INDEX IF NOT EXISTS idx_system_attribute_tags_tag ON public.system_attribute_tags (tag_id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'system_attribute_tags' AND column_name = 'option_id'
    ) THEN
        ALTER TABLE public.system_attribute_tags RENAME COLUMN option_id TO attribute_id;
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_class WHERE relname = 'idx_system_attribute_tags_opt'
    ) THEN
        ALTER INDEX idx_system_attribute_tags_opt RENAME TO idx_system_attribute_tags_attribute;
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_attribute_tags_updated_at'
            AND tgrelid = 'public.system_attribute_tags'::regclass) THEN
    CREATE TRIGGER trg_system_attribute_tags_updated_at
        BEFORE UPDATE ON public.system_attribute_tags
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_attribute_tags ENABLE ROW LEVEL SECURITY;

-- Categories
CREATE TABLE IF NOT EXISTS public.system_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    label text NOT NULL,
    description text,
    tooltip text,
    short text,
    code text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_categories_label ON public.system_categories (label);

CREATE INDEX IF NOT EXISTS idx_system_categories_system ON public.system_categories (system_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_categories_updated_at'
            AND tgrelid = 'public.system_categories'::regclass) THEN
    CREATE TRIGGER trg_system_categories_updated_at
        BEFORE UPDATE ON public.system_categories
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.system_category_tags (
    tag_id uuid NOT NULL REFERENCES public.system_tags (id) ON DELETE CASCADE DEFERRABLE,
    category_id uuid NOT NULL REFERENCES public.system_categories (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW(),
    PRIMARY KEY (tag_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_system_category_tags_category ON public.system_category_tags (category_id);

CREATE INDEX IF NOT EXISTS idx_system_category_tags_tag ON public.system_category_tags (tag_id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'system_category_tags' AND column_name = 'option_id'
    ) THEN
        ALTER TABLE public.system_category_tags RENAME COLUMN option_id TO category_id;
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_class WHERE relname = 'idx_system_cat_tags_opt'
    ) THEN
        ALTER INDEX idx_system_cat_tags_opt RENAME TO idx_system_category_tags_category;
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_category_tags_updated_at'
            AND tgrelid = 'public.system_category_tags'::regclass) THEN
    CREATE TRIGGER trg_system_category_tags_updated_at
        BEFORE UPDATE ON public.system_category_tags
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_category_tags ENABLE ROW LEVEL SECURITY;

-- Conditions
CREATE TABLE IF NOT EXISTS public.system_conditions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    label text NOT NULL,
    description text,
    tooltip text,
    short text,
    code text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_conditions_label ON public.system_conditions (label);

CREATE INDEX IF NOT EXISTS idx_system_conditions_system ON public.system_conditions (system_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_conditions_updated_at'
            AND tgrelid = 'public.system_conditions'::regclass) THEN
    CREATE TRIGGER trg_system_conditions_updated_at
        BEFORE UPDATE ON public.system_conditions
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_conditions ENABLE ROW LEVEL SECURITY;

-- Damage type options
CREATE TABLE IF NOT EXISTS public.system_damage_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    label text NOT NULL,
    description text,
    tooltip text,
    short text,
    code text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_damage_types_label ON public.system_damage_types (label);

CREATE INDEX IF NOT EXISTS idx_system_damage_types_system ON public.system_damage_types (system_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_damage_types_updated_at'
            AND tgrelid = 'public.system_damage_types'::regclass) THEN
    CREATE TRIGGER trg_system_damage_types_updated_at
        BEFORE UPDATE ON public.system_damage_types
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_damage_types ENABLE ROW LEVEL SECURITY;

-- Languages
CREATE TABLE IF NOT EXISTS public.system_langs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    label text NOT NULL,
    description text,
    tooltip text,
    short text,
    code text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_langs_label ON public.system_langs (label);

CREATE INDEX IF NOT EXISTS idx_system_langs_system ON public.system_langs (system_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_langs_updated_at'
            AND tgrelid = 'public.system_langs'::regclass) THEN
    CREATE TRIGGER trg_system_langs_updated_at
        BEFORE UPDATE ON public.system_langs
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_langs ENABLE ROW LEVEL SECURITY;

-- Passives
CREATE TABLE IF NOT EXISTS public.system_passives (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    label text NOT NULL,
    description text,
    tooltip text,
    short text,
    code text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_passives_label ON public.system_passives (label);

CREATE INDEX IF NOT EXISTS idx_system_passives_system ON public.system_passives (system_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_passives_updated_at'
            AND tgrelid = 'public.system_passives'::regclass) THEN
    CREATE TRIGGER trg_system_passives_updated_at
        BEFORE UPDATE ON public.system_passives
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_passives ENABLE ROW LEVEL SECURITY;

-- Prerequisite options
CREATE TABLE IF NOT EXISTS public.system_prereqs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    label text NOT NULL,
    description text,
    tooltip text,
    short text,
    code text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_prereqs_label ON public.system_prereqs (label);

CREATE INDEX IF NOT EXISTS idx_system_prereqs_system ON public.system_prereqs (system_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_prereqs_updated_at'
            AND tgrelid = 'public.system_prereqs'::regclass) THEN
    CREATE TRIGGER trg_system_prereqs_updated_at
        BEFORE UPDATE ON public.system_prereqs
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_prereqs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.system_prereq_tags (
    tag_id uuid NOT NULL REFERENCES public.system_tags (id) ON DELETE CASCADE DEFERRABLE,
    prereq_id uuid NOT NULL REFERENCES public.system_prereqs (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW(),
    PRIMARY KEY (tag_id, prereq_id)
);

CREATE INDEX IF NOT EXISTS idx_system_prereq_tags_prereq ON public.system_prereq_tags (prereq_id);

CREATE INDEX IF NOT EXISTS idx_system_prereq_tags_tag ON public.system_prereq_tags (tag_id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'system_prereq_tags' AND column_name = 'option_id'
    ) THEN
        ALTER TABLE public.system_prereq_tags RENAME COLUMN option_id TO prereq_id;
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_class WHERE relname = 'idx_system_prereq_tags_opt'
    ) THEN
        ALTER INDEX idx_system_prereq_tags_opt RENAME TO idx_system_prereq_tags_prereq;
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_prereq_tags_updated_at'
            AND tgrelid = 'public.system_prereq_tags'::regclass) THEN
    CREATE TRIGGER trg_system_prereq_tags_updated_at
        BEFORE UPDATE ON public.system_prereq_tags
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_prereq_tags ENABLE ROW LEVEL SECURITY;

-- Ranges
CREATE TABLE IF NOT EXISTS public.system_ranges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    label text NOT NULL,
    description text,
    tooltip text,
    short text,
    code text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_ranges_label ON public.system_ranges (label);

CREATE INDEX IF NOT EXISTS idx_system_ranges_system ON public.system_ranges (system_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_ranges_updated_at'
            AND tgrelid = 'public.system_ranges'::regclass) THEN
    CREATE TRIGGER trg_system_ranges_updated_at
        BEFORE UPDATE ON public.system_ranges
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_ranges ENABLE ROW LEVEL SECURITY;

-- Sizes
CREATE TABLE IF NOT EXISTS public.system_sizes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    label text NOT NULL,
    description text,
    tooltip text,
    short text,
    code text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_sizes_label ON public.system_sizes (label);

CREATE INDEX IF NOT EXISTS idx_system_sizes_system ON public.system_sizes (system_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_sizes_updated_at'
            AND tgrelid = 'public.system_sizes'::regclass) THEN
    CREATE TRIGGER trg_system_sizes_updated_at
        BEFORE UPDATE ON public.system_sizes
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_sizes ENABLE ROW LEVEL SECURITY;

-- Speed options
CREATE TABLE IF NOT EXISTS public.system_speeds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    label text NOT NULL,
    description text,
    tooltip text,
    short text,
    code text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_speeds_label ON public.system_speeds (label);

CREATE INDEX IF NOT EXISTS idx_system_speeds_system ON public.system_speeds (system_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_speeds_updated_at'
            AND tgrelid = 'public.system_speeds'::regclass) THEN
    CREATE TRIGGER trg_system_speeds_updated_at
        BEFORE UPDATE ON public.system_speeds
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_speeds ENABLE ROW LEVEL SECURITY;

-- Terrains
CREATE TABLE IF NOT EXISTS public.system_terrains (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    label text NOT NULL,
    description text,
    tooltip text,
    short text,
    code text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_terrains_label ON public.system_terrains (label);

CREATE INDEX IF NOT EXISTS idx_system_terrains_system ON public.system_terrains (system_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_terrains_updated_at'
            AND tgrelid = 'public.system_terrains'::regclass) THEN
    CREATE TRIGGER trg_system_terrains_updated_at
        BEFORE UPDATE ON public.system_terrains
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_terrains ENABLE ROW LEVEL SECURITY;

-- Currencies
CREATE TABLE IF NOT EXISTS public.system_currencies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    label text NOT NULL,
    description text,
    abbreviation text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_system_currencies_system_label ON public.system_currencies (system_id, label);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_currencies_updated_at'
            AND tgrelid = 'public.system_currencies'::regclass) THEN
    CREATE TRIGGER trg_system_currencies_updated_at
        BEFORE UPDATE ON public.system_currencies
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_currencies ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.system_currency_conversions (
    currency_id uuid PRIMARY KEY REFERENCES public.system_currencies (id) ON DELETE CASCADE DEFERRABLE,
    copper double precision NOT NULL,
    silver double precision NOT NULL,
    gold double precision NOT NULL,
    electrum double precision NOT NULL,
    platinum double precision NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_system_currency_conversions_currency ON public.system_currency_conversions (currency_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_currency_conversions_updated_at'
            AND tgrelid = 'public.system_currency_conversions'::regclass) THEN
    CREATE TRIGGER trg_system_currency_conversions_updated_at
        BEFORE UPDATE ON public.system_currency_conversions
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_currency_conversions ENABLE ROW LEVEL SECURITY;

-- Normalized measurement registries (replacing enums with lookup tables)
CREATE TABLE IF NOT EXISTS public.system_measurement_systems (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    label text UNIQUE NOT NULL, -- e.g., 'imperial', 'metric'
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_system_measurement_systems_updated_at'
          AND tgrelid = 'public.system_measurement_systems'::regclass) THEN
    CREATE TRIGGER trg_system_measurement_systems_updated_at
        BEFORE UPDATE ON public.system_measurement_systems
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_measurement_systems ENABLE ROW LEVEL SECURITY;

-- Seed canonical measurement systems from TS enum: MeasurementSystemEnum
INSERT INTO public.system_measurement_systems (label)
VALUES
    ('IMPERIAL'),
    ('METRIC')
ON CONFLICT (label) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.system_measurement_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    label text UNIQUE NOT NULL, -- e.g., 'weight', 'length', 'volume'
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_system_measurement_types_updated_at'
          AND tgrelid = 'public.system_measurement_types'::regclass) THEN
    CREATE TRIGGER trg_system_measurement_types_updated_at
        BEFORE UPDATE ON public.system_measurement_types
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_measurement_types ENABLE ROW LEVEL SECURITY;

-- Seed canonical measurement types from TS enum: MeasurementTypeEnum
INSERT INTO public.system_measurement_types (label)
VALUES
    ('VOLUME'),
    ('WEIGHT'),
    ('LENGTH')
ON CONFLICT (label) DO NOTHING;

-- Measurement units with bridge to types (supports multiple types per unit)
CREATE TABLE IF NOT EXISTS public.system_measure_units (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    measurement_system_id uuid NOT NULL REFERENCES public.system_measurement_systems (id) ON DELETE RESTRICT DEFERRABLE,
    label text NOT NULL,
    description text,
    tooltip text,
    short text,
    code text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_measure_units_system ON public.system_measure_units (system_id);
CREATE INDEX IF NOT EXISTS idx_system_measure_units_measurement_system_id ON public.system_measure_units (measurement_system_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_system_measure_units_updated_at'
          AND tgrelid = 'public.system_measure_units'::regclass) THEN
    CREATE TRIGGER trg_system_measure_units_updated_at
        BEFORE UPDATE ON public.system_measure_units
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_measure_units ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.system_measure_unit_types (
    unit_id uuid NOT NULL REFERENCES public.system_measure_units (id) ON DELETE CASCADE DEFERRABLE,
    type_id uuid NOT NULL REFERENCES public.system_measurement_types (id) ON DELETE RESTRICT DEFERRABLE,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW(),
    PRIMARY KEY (unit_id, type_id)
);

CREATE INDEX IF NOT EXISTS idx_system_measure_unit_types_unit ON public.system_measure_unit_types (unit_id);
CREATE INDEX IF NOT EXISTS idx_system_measure_unit_types_type ON public.system_measure_unit_types (type_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_system_measure_unit_types_updated_at'
          AND tgrelid = 'public.system_measure_unit_types'::regclass) THEN
    CREATE TRIGGER trg_system_measure_unit_types_updated_at
        BEFORE UPDATE ON public.system_measure_unit_types
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_measure_unit_types ENABLE ROW LEVEL SECURITY;

-- Modifier options
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'system_mod_opt_type'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.system_mod_opt_type AS ENUM (
            'CATEGORY',
            'TYPE',
            'METHOD',
            'SPELL_CATEGORY'
        );
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.system_mod_opts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    type system_mod_opt_type NOT NULL,
    label text NOT NULL,
    description text,
    tooltip text,
    short text,
    code text NOT NULL,
    UNIQUE (system_id, label, type),
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_mod_opts_label ON public.system_mod_opts (label);

CREATE INDEX IF NOT EXISTS idx_system_mod_opts_system ON public.system_mod_opts (system_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_mod_opts_updated_at'
            AND tgrelid = 'public.system_mod_opts'::regclass) THEN
    CREATE TRIGGER trg_system_mod_opts_updated_at
        BEFORE UPDATE ON public.system_mod_opts
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_mod_opts ENABLE ROW LEVEL SECURITY;

-- Category/type bridge
CREATE TABLE IF NOT EXISTS public.system_mod_cat_types (
    category_id uuid NOT NULL REFERENCES public.system_mod_opts (id) ON DELETE CASCADE DEFERRABLE,
    type_id uuid NOT NULL REFERENCES public.system_mod_opts (id) ON DELETE CASCADE DEFERRABLE,
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW(),
    PRIMARY KEY (category_id, type_id)
);

CREATE INDEX IF NOT EXISTS idx_system_mod_cat_types_cat ON public.system_mod_cat_types (category_id);

CREATE INDEX IF NOT EXISTS idx_system_mod_cat_types_type ON public.system_mod_cat_types (type_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_mod_cat_types_updated_at'
            AND tgrelid = 'public.system_mod_cat_types'::regclass) THEN
    CREATE TRIGGER trg_system_mod_cat_types_updated_at
        BEFORE UPDATE ON public.system_mod_cat_types
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_mod_cat_types ENABLE ROW LEVEL SECURITY;

-- Type/method bridge
CREATE TABLE IF NOT EXISTS public.system_mod_type_mthds (
    type_id uuid NOT NULL REFERENCES public.system_mod_opts (id) ON DELETE CASCADE DEFERRABLE,
    method_id uuid NOT NULL REFERENCES public.system_mod_opts (id) ON DELETE CASCADE DEFERRABLE,
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW(),
    PRIMARY KEY (type_id, method_id)
);

CREATE INDEX IF NOT EXISTS idx_system_mod_type_mthds_type ON public.system_mod_type_mthds (type_id);

CREATE INDEX IF NOT EXISTS idx_system_mod_type_mthds_mthd ON public.system_mod_type_mthds (method_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_mod_type_mthds_updated_at'
            AND tgrelid = 'public.system_mod_type_mthds'::regclass) THEN
    CREATE TRIGGER trg_system_mod_type_mthds_updated_at
        BEFORE UPDATE ON public.system_mod_type_mthds
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_mod_type_mthds ENABLE ROW LEVEL SECURITY;

-- Category/type/method bridge
CREATE TABLE IF NOT EXISTS public.system_mod_cat_type_mthds (
    category_id uuid NOT NULL REFERENCES public.system_mod_opts (id) ON DELETE CASCADE DEFERRABLE,
    type_id uuid NOT NULL REFERENCES public.system_mod_opts (id) ON DELETE CASCADE DEFERRABLE,
    method_id uuid NOT NULL REFERENCES public.system_mod_opts (id) ON DELETE CASCADE DEFERRABLE,
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW(),
    PRIMARY KEY (category_id, type_id, method_id)
);

CREATE INDEX IF NOT EXISTS idx_system_mod_cat_type_mthds_cat ON public.system_mod_cat_type_mthds (category_id);

CREATE INDEX IF NOT EXISTS idx_system_mod_cat_type_mthds_type ON public.system_mod_cat_type_mthds (type_id);

CREATE INDEX IF NOT EXISTS idx_system_mod_cat_type_mthds_mthd ON public.system_mod_cat_type_mthds (method_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_mod_cat_type_mthds_updated_at'
            AND tgrelid = 'public.system_mod_cat_type_mthds'::regclass) THEN
    CREATE TRIGGER trg_system_mod_cat_type_mthds_updated_at
        BEFORE UPDATE ON public.system_mod_cat_type_mthds
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_mod_cat_type_mthds ENABLE ROW LEVEL SECURITY;

-- Character options
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'system_char_opt_type'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.system_char_opt_type AS ENUM (
            'HP_CALC_MTHD',
            'ADV_MTHD',
            'SP_CALC_MTHD',
            'START_EQUIP'
        );
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.system_char_opts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    type system_char_opt_type NOT NULL,
    label text NOT NULL,
    description text,
    tooltip text,
    short text,
    code text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_char_opts_label ON public.system_char_opts (label);

CREATE INDEX IF NOT EXISTS idx_system_char_opts_system ON public.system_char_opts (system_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_char_opts_updated_at'
            AND tgrelid = 'public.system_char_opts'::regclass) THEN
    CREATE TRIGGER trg_system_char_opts_updated_at
        BEFORE UPDATE ON public.system_char_opts
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_char_opts ENABLE ROW LEVEL SECURITY;


-- Character ability score generate
CREATE TABLE IF NOT EXISTS public.system_abil_gen_mthds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    label text NOT NULL,
    total int,
    code text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_abil_gen_mthds_label ON public.system_abil_gen_mthds (label);

CREATE INDEX IF NOT EXISTS idx_system_abil_gen_mthds_system ON public.system_abil_gen_mthds (system_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_abil_gen_mthds_updated_at'
            AND tgrelid = 'public.system_abil_gen_mthds'::regclass) THEN
    CREATE TRIGGER trg_system_abil_gen_mthds_updated_at
        BEFORE UPDATE ON public.system_abil_gen_mthds
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_abil_gen_mthds ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.system_abil_gen_mthd_opts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    gen_method_id uuid NOT NULL REFERENCES public.system_abil_gen_mthds (id) ON DELETE CASCADE DEFERRABLE,
    label text NOT NULL,
    reduce int,
    code text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_abil_gen_mthd_opts_label ON public.system_abil_gen_mthd_opts (label);

CREATE INDEX IF NOT EXISTS idx_system_abil_gen_mthd_opts_gen_method ON public.system_abil_gen_mthd_opts (gen_method_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_abil_gen_mthd_opts_updated_at'
            AND tgrelid = 'public.system_abil_gen_mthd_opts'::regclass) THEN
    CREATE TRIGGER trg_system_abil_gen_mthd_opts_updated_at
        BEFORE UPDATE ON public.system_abil_gen_mthd_opts
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_abil_gen_mthd_opts ENABLE ROW LEVEL SECURITY;

-- Charges options
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'system_charge_opt_type'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.system_charge_opt_type AS ENUM (
            'RESET',
            'LIMIT'
        );
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.system_charges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    type system_charge_opt_type NOT NULL,
    label text NOT NULL,
    description text,
    tooltip text,
    short text,
    code text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_charges_label ON public.system_charges (label);

CREATE INDEX IF NOT EXISTS idx_system_charges_system ON public.system_charges (system_id);

CREATE INDEX IF NOT EXISTS idx_system_charges_type ON public.system_charges (type);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_charges_updated_at'
            AND tgrelid = 'public.system_charges'::regclass) THEN
    CREATE TRIGGER trg_system_charges_updated_at
        BEFORE UPDATE ON public.system_charges
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_charges ENABLE ROW LEVEL SECURITY;

-- Charge tags bridge
CREATE TABLE IF NOT EXISTS public.system_charge_tags (
    tag_id uuid NOT NULL REFERENCES public.system_tags (id) ON DELETE CASCADE DEFERRABLE,
    charge_id uuid NOT NULL REFERENCES public.system_charges (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW(),
    PRIMARY KEY (tag_id, charge_id)
);

CREATE INDEX IF NOT EXISTS idx_system_charge_tags_charge ON public.system_charge_tags (charge_id);

CREATE INDEX IF NOT EXISTS idx_system_charge_tags_tag ON public.system_charge_tags (tag_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_system_charge_tags_updated_at'
          AND tgrelid = 'public.system_charge_tags'::regclass
    ) THEN
        CREATE TRIGGER trg_system_charge_tags_updated_at
            BEFORE UPDATE ON public.system_charge_tags
            FOR EACH ROW
            EXECUTE FUNCTION public.set_updated_at();
    END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_charge_tags ENABLE ROW LEVEL SECURITY;

-- Equipment options
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'system_equip_opt_type'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.system_equip_opt_type AS ENUM (
            'CATEGORY',
            'PROPERTY',
            'RARITY'
        );
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.system_equip_opts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    type system_equip_opt_type NOT NULL,
    label text NOT NULL,
    description text,
    tooltip text,
    short text,
    code text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_equip_opts_label ON public.system_equip_opts (label);

CREATE INDEX IF NOT EXISTS idx_system_equip_opts_system ON public.system_equip_opts (system_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_equip_opts_updated_at'
            AND tgrelid = 'public.system_equip_opts'::regclass) THEN
    CREATE TRIGGER trg_system_equip_opts_updated_at
        BEFORE UPDATE ON public.system_equip_opts
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_equip_opts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.system_equip_cat_props (
    category_id uuid NOT NULL REFERENCES public.system_equip_opts (id) ON DELETE CASCADE DEFERRABLE,
    property_id uuid NOT NULL REFERENCES public.system_equip_opts (id) ON DELETE CASCADE DEFERRABLE,
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW(),
    PRIMARY KEY (category_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_system_equip_cat_props_category_id ON public.system_equip_cat_props (category_id);

CREATE INDEX IF NOT EXISTS idx_system_equip_cat_props_property_id ON public.system_equip_cat_props (property_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_equip_cat_props_updated_at'
            AND tgrelid = 'public.system_equip_cat_props'::regclass) THEN
    CREATE TRIGGER trg_system_equip_cat_props_updated_at
        BEFORE UPDATE ON public.system_equip_cat_props
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_equip_cat_props ENABLE ROW LEVEL SECURITY;

-- Proficiency level options
CREATE TABLE IF NOT EXISTS public.system_prof_levels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    label text NOT NULL,
    multiplier float NOT NULL DEFAULT 1,
    code text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_prof_levels_label ON public.system_prof_levels (label);

CREATE INDEX IF NOT EXISTS idx_system_prof_levels_system ON public.system_prof_levels (system_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_prof_levels_updated_at'
            AND tgrelid = 'public.system_prof_levels'::regclass) THEN
    CREATE TRIGGER trg_system_prof_levels_updated_at
        BEFORE UPDATE ON public.system_prof_levels
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_prof_levels ENABLE ROW LEVEL SECURITY;

-- Proficiency category options
CREATE TABLE IF NOT EXISTS public.system_prof_cats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    label text NOT NULL,
    description text DEFAULT NULL,
    tooltip text DEFAULT NULL,
    short text DEFAULT NULL,
    code text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_prof_cats_label ON public.system_prof_cats (label);

CREATE INDEX IF NOT EXISTS idx_system_prof_cats_system ON public.system_prof_cats (system_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_prof_cats_updated_at'
            AND tgrelid = 'public.system_prof_cats'::regclass) THEN
    CREATE TRIGGER trg_system_prof_cats_updated_at
        BEFORE UPDATE ON public.system_prof_cats
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_prof_cats ENABLE ROW LEVEL SECURITY;

-- Senses
CREATE TABLE IF NOT EXISTS public.system_senses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    label text NOT NULL,
    creature_description text DEFAULT NULL,
    monster_description text DEFAULT NULL,
    code text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_senses_label ON public.system_senses (label);

CREATE INDEX IF NOT EXISTS idx_system_senses_system ON public.system_senses (system_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_senses_updated_at'
            AND tgrelid = 'public.system_senses'::regclass) THEN
    CREATE TRIGGER trg_system_senses_updated_at
        BEFORE UPDATE ON public.system_senses
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_senses ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.system_sense_tags (
    tag_id uuid NOT NULL REFERENCES public.system_tags (id) ON DELETE CASCADE DEFERRABLE,
    sense_id uuid NOT NULL REFERENCES public.system_senses (id) ON DELETE CASCADE DEFERRABLE,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW(),
    PRIMARY KEY (tag_id, sense_id)
);

CREATE INDEX IF NOT EXISTS idx_system_sense_tags_sense ON public.system_sense_tags (sense_id);

CREATE INDEX IF NOT EXISTS idx_system_sense_tags_tag ON public.system_sense_tags (tag_id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'system_sense_tags' AND column_name = 'option_id'
    ) THEN
        ALTER TABLE public.system_sense_tags RENAME COLUMN option_id TO sense_id;
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_class WHERE relname = 'idx_system_sense_tags_opt'
    ) THEN
        ALTER INDEX idx_system_sense_tags_opt RENAME TO idx_system_sense_tags_sense;
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_sense_tags_updated_at'
            AND tgrelid = 'public.system_sense_tags'::regclass) THEN
    CREATE TRIGGER trg_system_sense_tags_updated_at
        BEFORE UPDATE ON public.system_sense_tags
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_sense_tags ENABLE ROW LEVEL SECURITY;

-- Skill options
CREATE TABLE IF NOT EXISTS public.system_skills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    label text NOT NULL,
    description text DEFAULT NULL,
    ability_id uuid NOT NULL REFERENCES public.system_abilities (id) ON DELETE SET NULL DEFERRABLE,
    code text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_skills_label ON public.system_skills (label);

CREATE INDEX IF NOT EXISTS idx_system_skills_system ON public.system_skills (system_id);

CREATE INDEX IF NOT EXISTS idx_system_skills_abil ON public.system_skills (ability_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_skills_updated_at'
            AND tgrelid = 'public.system_skills'::regclass) THEN
    CREATE TRIGGER trg_system_skills_updated_at
        BEFORE UPDATE ON public.system_skills
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_skills ENABLE ROW LEVEL SECURITY;

-- Spell options
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'system_spell_opt_type'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.system_spell_opt_type AS ENUM (
            'CATEGORY',
            'DURATION',
            'RANGE',
            'SCHOOL',
            'SHAPE',
            'REQUIREMENT'
        );
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.system_spell_opts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
    type system_spell_opt_type NOT NULL,
    label text NOT NULL,
    description text,
    tooltip text,
    short text,
    code text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_spell_opts_label ON public.system_spell_opts (label);

CREATE INDEX IF NOT EXISTS idx_system_spell_opts_system ON public.system_spell_opts (system_id);

CREATE INDEX IF NOT EXISTS idx_system_spell_opts_type ON public.system_spell_opts (type);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_spell_opts_updated_at'
            AND tgrelid = 'public.system_spell_opts'::regclass) THEN
    CREATE TRIGGER trg_system_spell_opts_updated_at
        BEFORE UPDATE ON public.system_spell_opts
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_spell_opts ENABLE ROW LEVEL SECURITY;

-- Measurement
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'system_meas_system'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.system_meas_system AS ENUM (
            'IMPERIAL',
            'METRIC'
        );
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'system_measure_opt_type'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.system_measure_opt_type AS ENUM (
            'AMOUNT',
            'ROUNDING'
        );
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.system_measure_opts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE,
    type system_measure_opt_type NOT NULL,
    label text NOT NULL,
    description text,
    tooltip text,
    short text,
    code text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_meas_opt_label ON public.system_measure_opts (label);

CREATE INDEX IF NOT EXISTS idx_system_meas_opt_system ON public.system_measure_opts (system_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_trigger
        WHERE
            tgname = 'trg_system_meas_opt_updated_at'
            AND tgrelid = 'public.system_measure_opts'::regclass) THEN
    CREATE TRIGGER trg_system_meas_opt_updated_at
        BEFORE UPDATE ON public.system_measure_opts
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.system_measure_opts ENABLE ROW LEVEL SECURITY;

SELECT
    public.apply_standard_policies ('systems');


/***************************
 * FUNCTIONS
 ***************************/
CREATE OR REPLACE FUNCTION public.upsert_systems (json_data jsonb)
    RETURNS uuid
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
DECLARE
    v_id uuid := (json_data ->> 'id')::uuid;
    v_label text := NULLIF (json_data ->> 'label', '');
    v_description text := json_data ->> 'description';
    v_user_id uuid := CASE
        WHEN (json_data ->> 'userId')::text = 'master' THEN NULL
        WHEN (json_data ->> 'userId') IS NULL OR (json_data ->> 'userId')::text = '' THEN NULL
        ELSE (json_data ->> 'userId')::uuid
    END;
    v_is_master boolean := (json_data ->> 'userId')::text = 'master';
BEGIN
    -- 🧩 Core
    INSERT INTO public.systems (id, label, description, user_id, is_master)
        VALUES (v_id, v_label, v_description, v_user_id, v_is_master)
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = EXCLUDED.description,
            is_master = EXCLUDED.is_master,
            updated_at = NOW();

    -- 🧩 Charges (resets, limits) with optional tags
    -- DELETE stale
    WITH ch_ids AS (
        SELECT NULLIF(obj->>'id','')::uuid AS id
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data->'charges'->'resets','[]'::jsonb)) obj
        UNION
        SELECT NULLIF(obj->>'id','')::uuid AS id
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data->'charges'->'limits','[]'::jsonb)) obj
    )
    DELETE FROM public.system_charges ch
    WHERE ch.system_id = v_id
      AND NOT EXISTS (SELECT 1 FROM ch_ids WHERE ch_ids.id = ch.id);

    -- UPSERT resets
    INSERT INTO public.system_charges (id, system_id, type, label, description, tooltip, short, code)
    SELECT
        NULLIF(obj->>'id','')::uuid,
        v_id,
        'RESET'::public.system_charge_opt_type,
        obj->>'label',
        NULLIF(obj->>'description',''),
        NULLIF(obj->>'tooltip',''),
        NULLIF(obj->>'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data->'charges'->'resets','[]'::jsonb)) obj
    ON CONFLICT (id) DO UPDATE SET
        label = EXCLUDED.label,
        description = COALESCE(EXCLUDED.description, public.system_charges.description),
        tooltip = COALESCE(EXCLUDED.tooltip, public.system_charges.tooltip),
        short = COALESCE(EXCLUDED.short, public.system_charges.short),
        code = COALESCE(EXCLUDED.code, public.system_charges.code),
        updated_at = NOW();

    -- UPSERT limits
    INSERT INTO public.system_charges (id, system_id, type, label, description, tooltip, short, code)
    SELECT
        NULLIF(obj->>'id','')::uuid,
        v_id,
        'LIMIT'::public.system_charge_opt_type,
        obj->>'label',
        NULLIF(obj->>'description',''),
        NULLIF(obj->>'tooltip',''),
        NULLIF(obj->>'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data->'charges'->'limits','[]'::jsonb)) obj
    ON CONFLICT (id) DO UPDATE SET
        label = EXCLUDED.label,
        description = COALESCE(EXCLUDED.description, public.system_charges.description),
        tooltip = COALESCE(EXCLUDED.tooltip, public.system_charges.tooltip),
        short = COALESCE(EXCLUDED.short, public.system_charges.short),
        updated_at = NOW();

    -- 🧩 Seed system tags from JSON payload (json_data->'tags')
    INSERT INTO public.system_tags (system_id, name)
    SELECT
        v_id,
        tag
    FROM JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(json_data->'tags','[]'::jsonb)) AS tag
    ON CONFLICT (system_id, name) DO NOTHING;

    -- 🔗 Rebuild tag bridges per-entity (delete/insert for this system)
    -- Actions
    DELETE FROM public.system_action_tags sat USING public.system_actions a
    WHERE sat.action_id = a.id AND a.system_id = v_id;

    INSERT INTO public.system_action_tags (tag_id, action_id)
    SELECT t.id, (obj->>'id')::uuid
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data->'actions','[]'::jsonb)) obj
    CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(obj->'tags','[]'::jsonb)) tag
    JOIN public.system_tags t ON t.system_id = v_id AND t.name = tag
    WHERE obj ? 'id'
    ON CONFLICT (tag_id, action_id) DO UPDATE SET updated_at = NOW();

    -- Attributes
    DELETE FROM public.system_attribute_tags sat USING public.system_attributes a
    WHERE sat.attribute_id = a.id AND a.system_id = v_id;

    INSERT INTO public.system_attribute_tags (tag_id, attribute_id)
    SELECT t.id, (obj->>'id')::uuid
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data->'attributes','[]'::jsonb)) obj
    CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(obj->'tags','[]'::jsonb)) tag
    JOIN public.system_tags t ON t.system_id = v_id AND t.name = tag
    WHERE obj ? 'id'
    ON CONFLICT (tag_id, attribute_id) DO UPDATE SET updated_at = NOW();

    -- Categories
    DELETE FROM public.system_category_tags sct USING public.system_categories c
    WHERE sct.category_id = c.id AND c.system_id = v_id;

    INSERT INTO public.system_category_tags (tag_id, category_id)
    SELECT t.id, (obj->>'id')::uuid
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data->'categories','[]'::jsonb)) obj
    CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(obj->'tags','[]'::jsonb)) tag
    JOIN public.system_tags t ON t.system_id = v_id AND t.name = tag
    WHERE obj ? 'id'
    ON CONFLICT (tag_id, category_id) DO UPDATE SET updated_at = NOW();

    -- Prerequisites
    DELETE FROM public.system_prereq_tags spt USING public.system_prereqs p
    WHERE spt.prereq_id = p.id AND p.system_id = v_id;

    INSERT INTO public.system_prereq_tags (tag_id, prereq_id)
    SELECT t.id, (obj->>'id')::uuid
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data->'prerequisites','[]'::jsonb)) obj
    CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(obj->'tags','[]'::jsonb)) tag
    JOIN public.system_tags t ON t.system_id = v_id AND t.name = tag
    WHERE obj ? 'id'
    ON CONFLICT (tag_id, prereq_id) DO UPDATE SET updated_at = NOW();

    -- Senses
    DELETE FROM public.system_sense_tags sst USING public.system_senses s2
    WHERE sst.sense_id = s2.id AND s2.system_id = v_id;

    INSERT INTO public.system_sense_tags (tag_id, sense_id)
    SELECT t.id, (obj->>'id')::uuid
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data->'senses','[]'::jsonb)) obj
    CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(obj->'tags','[]'::jsonb)) tag
    JOIN public.system_tags t ON t.system_id = v_id AND t.name = tag
    WHERE obj ? 'id'
    ON CONFLICT (tag_id, sense_id) DO UPDATE SET updated_at = NOW();

    -- Charges
    DELETE FROM public.system_charge_tags sct USING public.system_charges ch
    WHERE sct.charge_id = ch.id AND ch.system_id = v_id;

    INSERT INTO public.system_charge_tags (tag_id, charge_id)
    SELECT t.id, (obj->>'id')::uuid
    FROM (
        SELECT obj FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data->'charges'->'resets','[]'::jsonb)) obj
        UNION ALL
        SELECT obj FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data->'charges'->'limits','[]'::jsonb)) obj
    ) x
    CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(x.obj->'tags','[]'::jsonb)) tag
    JOIN public.system_tags t ON t.system_id = v_id AND t.name = tag
    WHERE x.obj ? 'id'
    ON CONFLICT (tag_id, charge_id) DO UPDATE SET updated_at = NOW();

    -- DELETE stale
    DELETE FROM public.system_currencies c
    WHERE c.system_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'currencies', '[]'::jsonb)) AS obj
        WHERE
            (obj ->> 'id')::uuid = c.id);

    -- 🧩 Currencies
    INSERT INTO public.system_currencies (id, system_id, label, description, abbreviation)
    SELECT
        (obj ->> 'id')::uuid AS id,
        v_id AS system_id,
        obj ->> 'label' AS label,
        obj ->> 'description' AS description,
        obj ->> 'abbreviation' AS abbreviation
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'currencies', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_currencies.description),
            abbreviation = COALESCE(EXCLUDED.abbreviation, public.system_currencies.abbreviation),
            updated_at = NOW();

    -- 🧩 Currency Conversions
    -- DELETE stale conversions scoped to this system's currencies
    DELETE FROM public.system_currency_conversions conv USING public.system_currencies cur
    WHERE conv.currency_id = cur.id
        AND cur.system_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'currencies', '[]'::jsonb)) AS obj
        WHERE (obj ->> 'id')::uuid = cur.id
        AND obj ? 'conversions');

    -- UPSERT conversions
    INSERT INTO public.system_currency_conversions (currency_id, copper, silver, gold, electrum, platinum)
    SELECT
        (obj ->> 'id')::uuid AS currency_id,
        COALESCE((obj -> 'conversions' ->> 'copper')::float8, 0),
        COALESCE((obj -> 'conversions' ->> 'silver')::float8, 0),
        COALESCE((obj -> 'conversions' ->> 'gold')::float8, 0),
        COALESCE((obj -> 'conversions' ->> 'electrum')::float8, 0),
        COALESCE((obj -> 'conversions' ->> 'platinum')::float8, 0)
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'currencies', '[]'::jsonb)) AS obj
    WHERE
        obj ? 'conversions'
    ON CONFLICT (currency_id)
        DO UPDATE SET
            copper = EXCLUDED.copper,
            silver = EXCLUDED.silver,
            gold = EXCLUDED.gold,
            electrum = EXCLUDED.electrum,
            platinum = EXCLUDED.platinum,
            updated_at = NOW();

    -- 🧩 Base Lists (GenericType-style)
    -- Abilities
    DELETE FROM public.system_abilities a
    WHERE a.system_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'abilities', '[]'::jsonb)) AS obj
        WHERE (obj ->> 'id')::uuid = a.id);

    INSERT INTO public.system_abilities (id, system_id, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'abilities', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_abilities.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_abilities.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_abilities.short),
            code = COALESCE(EXCLUDED.code, public.system_abilities.code),
            updated_at = NOW();

    -- Actions
    DELETE FROM public.system_actions a
    WHERE a.system_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'actions', '[]'::jsonb)) AS obj
        WHERE (obj ->> 'id')::uuid = a.id);

    INSERT INTO public.system_actions (id, system_id, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'actions', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_actions.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_actions.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_actions.short),
            code = COALESCE(EXCLUDED.code, public.system_actions.code),
            updated_at = NOW();

    -- Alignments
    DELETE FROM public.system_alignments al
    WHERE al.system_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'alignments', '[]'::jsonb)) AS obj
        WHERE (obj ->> 'id')::uuid = al.id);

    INSERT INTO public.system_alignments (id, system_id, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'alignments', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_alignments.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_alignments.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_alignments.short),
            code = COALESCE(EXCLUDED.code, public.system_alignments.code),
            updated_at = NOW();

    -- Attributes
    DELETE FROM public.system_attributes at
    WHERE at.system_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'attributes', '[]'::jsonb)) AS obj
        WHERE (obj ->> 'id')::uuid = at.id);

    INSERT INTO public.system_attributes (id, system_id, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'attributes', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_attributes.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_attributes.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_attributes.short),
            code = COALESCE(EXCLUDED.code, public.system_attributes.code),
            updated_at = NOW();

    -- Categories
    DELETE FROM public.system_categories c
    WHERE c.system_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'categories', '[]'::jsonb)) AS obj
        WHERE (obj ->> 'id')::uuid = c.id);

    INSERT INTO public.system_categories (id, system_id, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'categories', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_categories.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_categories.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_categories.short),
            code = COALESCE(EXCLUDED.code, public.system_categories.code),
            updated_at = NOW();

    -- Conditions
    DELETE FROM public.system_conditions co
    WHERE co.system_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'conditions', '[]'::jsonb)) AS obj
        WHERE (obj ->> 'id')::uuid = co.id);

    INSERT INTO public.system_conditions (id, system_id, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'conditions', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_conditions.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_conditions.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_conditions.short),
            code = COALESCE(EXCLUDED.code, public.system_conditions.code),
            updated_at = NOW();

    -- Damage Types
    DELETE FROM public.system_damage_types dt
    WHERE dt.system_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'damageTypes', '[]'::jsonb)) AS obj
        WHERE (obj ->> 'id')::uuid = dt.id);

    INSERT INTO public.system_damage_types (id, system_id, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'damageTypes', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_damage_types.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_damage_types.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_damage_types.short),
            code = COALESCE(EXCLUDED.code, public.system_damage_types.code),
            updated_at = NOW();

    -- Languages
    DELETE FROM public.system_langs la
    WHERE la.system_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'languages', '[]'::jsonb)) AS obj
        WHERE (obj ->> 'id')::uuid = la.id);

    INSERT INTO public.system_langs (id, system_id, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'languages', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_langs.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_langs.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_langs.short),
            code = COALESCE(EXCLUDED.code, public.system_langs.code),
            updated_at = NOW();

    -- Passives
    DELETE FROM public.system_passives ps
    WHERE ps.system_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'passives', '[]'::jsonb)) AS obj
        WHERE (obj ->> 'id')::uuid = ps.id);

    INSERT INTO public.system_passives (id, system_id, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'passives', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_passives.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_passives.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_passives.short),
            code = COALESCE(EXCLUDED.code, public.system_passives.code),
            updated_at = NOW();

    -- Prerequisites (base list)
    DELETE FROM public.system_prereqs pr
    WHERE pr.system_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'prerequisites', '[]'::jsonb)) AS obj
        WHERE (obj ->> 'id')::uuid = pr.id);

    INSERT INTO public.system_prereqs (id, system_id, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'prerequisites', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_prereqs.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_prereqs.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_prereqs.short),
            code = COALESCE(EXCLUDED.code, public.system_prereqs.code),
            updated_at = NOW();

    -- Senses (base list)
    DELETE FROM public.system_senses sn
    WHERE sn.system_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'senses', '[]'::jsonb)) AS obj
        WHERE (obj ->> 'id')::uuid = sn.id);

    INSERT INTO public.system_senses (id, system_id, label, creature_description, monster_description, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        obj ->> 'label',
        NULLIF(obj ->> 'creatureDescription',''),
        NULLIF (obj ->> 'monsterDescription', ''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'senses', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            creature_description = EXCLUDED.creature_description,
            monster_description = EXCLUDED.monster_description,
            code = EXCLUDED.code,
            updated_at = NOW();

    -- Ranges
    DELETE FROM public.system_ranges ra
    WHERE ra.system_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'ranges', '[]'::jsonb)) AS obj
        WHERE (obj ->> 'id')::uuid = ra.id);

    INSERT INTO public.system_ranges (id, system_id, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'ranges', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_ranges.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_ranges.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_ranges.short),
            code = COALESCE(EXCLUDED.code, public.system_ranges.code),
            updated_at = NOW();

    -- Sizes
    DELETE FROM public.system_sizes sz
    WHERE sz.system_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'sizes', '[]'::jsonb)) AS obj
        WHERE (obj ->> 'id')::uuid = sz.id);

    INSERT INTO public.system_sizes (id, system_id, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'sizes', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_sizes.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_sizes.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_sizes.short),
            code = COALESCE(EXCLUDED.code, public.system_sizes.code),
            updated_at = NOW();

    -- Skills
    DELETE FROM public.system_skills sk
    WHERE sk.system_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'skills', '[]'::jsonb)) AS obj
        WHERE (obj ->> 'id')::uuid = sk.id);

    INSERT INTO public.system_skills (id, system_id, label, description, ability_id, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'abilityId', '')::uuid,
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'skills', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_skills.description),
            ability_id = COALESCE(EXCLUDED.ability_id, public.system_skills.ability_id),
            code = COALESCE(EXCLUDED.code, public.system_skills.code),
            updated_at = NOW();

    -- Speeds
    DELETE FROM public.system_speeds spd
    WHERE spd.system_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'speeds', '[]'::jsonb)) AS obj
        WHERE (obj ->> 'id')::uuid = spd.id);

    INSERT INTO public.system_speeds (id, system_id, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'speeds', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_speeds.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_speeds.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_speeds.short),
            code = COALESCE(EXCLUDED.code, public.system_speeds.code),
            updated_at = NOW();

    -- Terrains
    DELETE FROM public.system_terrains te
    WHERE te.system_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'terrains', '[]'::jsonb)) AS obj
        WHERE (obj ->> 'id')::uuid = te.id);

    INSERT INTO public.system_terrains (id, system_id, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'terrains', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_terrains.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_terrains.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_terrains.short),
            code = COALESCE(EXCLUDED.code, public.system_terrains.code),
            updated_at = NOW();

    -- 🧩  Measurements (new normalized structure: rules.measureUnits)
    -- When present, use measureUnits: [{ id, label, description, tooltip, short, measurementSystem, type: [..] }]
    -- Upsert measurement systems and types by label and bridge to units
    IF (json_data -> 'rules' -> 'measureUnits') IS NOT NULL THEN
        -- Seed/Upsert measurement system labels from payload
        INSERT INTO public.system_measurement_systems (label)
        SELECT DISTINCT UPPER(obj ->> 'measurementSystem') AS label
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'rules' -> 'measureUnits', '[]'::jsonb)) AS obj
        WHERE obj ? 'measurementSystem' AND NULLIF(obj ->> 'measurementSystem','') IS NOT NULL
        ON CONFLICT (label) DO UPDATE SET label = COALESCE(EXCLUDED.label, public.system_measurement_systems.label), updated_at = NOW();

        -- Seed/Upsert measurement type labels from payload arrays
        INSERT INTO public.system_measurement_types (label)
        SELECT DISTINCT UPPER(t.val #>> '{}') AS label
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'rules' -> 'measureUnits', '[]'::jsonb)) AS obj,
             LATERAL JSONB_ARRAY_ELEMENTS(COALESCE(obj -> 'type', '[]'::jsonb)) AS t(val)
        WHERE t.val IS NOT NULL
        ON CONFLICT (label) DO UPDATE SET label = COALESCE(EXCLUDED.label, public.system_measurement_types.label), updated_at = NOW();

        -- DELETE stale units for this system
        DELETE FROM public.system_measure_units mu
        WHERE mu.system_id = v_id
          AND NOT EXISTS (
              SELECT 1
              FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'rules' -> 'measureUnits', '[]'::jsonb)) AS obj
              WHERE NULLIF (obj ->> 'id', '')::uuid = mu.id
          );

        -- UPSERT units
        INSERT INTO public.system_measure_units (id, system_id, measurement_system_id, label, description, tooltip, short, code)
        SELECT
            NULLIF (obj ->> 'id', '')::uuid,
            v_id,
            (SELECT id FROM public.system_measurement_systems WHERE label = UPPER(obj ->> 'measurementSystem') LIMIT 1),
            obj ->> 'label',
            NULLIF (obj ->> 'description', ''),
            NULLIF (obj ->> 'tooltip', ''),
            NULLIF (obj ->> 'short', ''),
            COALESCE(NULLIF(obj->>'code',''), obj->>'label')
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'rules' -> 'measureUnits', '[]'::jsonb)) AS obj
        ON CONFLICT (id) DO UPDATE SET
            measurement_system_id = COALESCE(EXCLUDED.measurement_system_id, public.system_measure_units.measurement_system_id),
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_measure_units.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_measure_units.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_measure_units.short),
            code = COALESCE(EXCLUDED.code, public.system_measure_units.code),
            updated_at = NOW();

        -- Rebuild unit-type bridges
        DELETE FROM public.system_measure_unit_types mut
        USING public.system_measure_units mu
        WHERE mut.unit_id = mu.id AND mu.system_id = v_id
          AND NOT EXISTS (
              SELECT 1
              FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'rules' -> 'measureUnits', '[]'::jsonb)) AS obj,
                   LATERAL JSONB_ARRAY_ELEMENTS(COALESCE(obj -> 'type', '[]'::jsonb)) AS t(val)
              WHERE NULLIF (obj ->> 'id', '')::uuid = mu.id
                AND (SELECT id FROM public.system_measurement_types WHERE label = UPPER(t.val #>> '{}')) = mut.type_id
          );

        INSERT INTO public.system_measure_unit_types (unit_id, type_id)
        SELECT
            NULLIF (obj ->> 'id', '')::uuid AS unit_id,
            (SELECT id FROM public.system_measurement_types WHERE label = UPPER(t.val #>> '{}') LIMIT 1) AS type_id
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'rules' -> 'measureUnits', '[]'::jsonb)) AS obj,
             LATERAL JSONB_ARRAY_ELEMENTS(COALESCE(obj -> 'type', '[]'::jsonb)) AS t(val)
        WHERE obj ? 'id' AND t.val IS NOT NULL
        ON CONFLICT (unit_id, type_id) DO UPDATE SET updated_at = NOW();
    END IF;

    -- 🧩 Ability Generate Methods (rules.abilityGenerateMethods)
    -- Delete stale methods for this system
    DELETE FROM public.system_abil_gen_mthds gm
    WHERE gm.system_id = v_id
      AND NOT EXISTS (
        SELECT 1
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'rules' -> 'abilityGenerateMethods', '[]'::jsonb)) AS obj
        WHERE NULLIF(obj->>'id','')::uuid = gm.id
      );

    -- Upsert methods
    INSERT INTO public.system_abil_gen_mthds (id, system_id, label, total, code)
    SELECT
      NULLIF(obj->>'id','')::uuid,
      v_id,
      obj->>'label',
      NULLIF(obj->>'total','')::int,
      COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'rules' -> 'abilityGenerateMethods', '[]'::jsonb)) AS obj
    ON CONFLICT (id) DO UPDATE SET
      label = EXCLUDED.label,
      total = COALESCE(EXCLUDED.total, public.system_abil_gen_mthds.total),
      code = COALESCE(EXCLUDED.code, public.system_abil_gen_mthds.code),
      updated_at = NOW();

    -- Delete stale options scoped to this system's methods
    WITH opt_ids AS (
      SELECT NULLIF(opt->>'id','')::uuid AS id
      FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'rules' -> 'abilityGenerateMethods', '[]'::jsonb)) m
      LEFT JOIN LATERAL JSONB_ARRAY_ELEMENTS(COALESCE(m->'options','[]'::jsonb)) opt ON TRUE
    )
    DELETE FROM public.system_abil_gen_mthd_opts go
    USING public.system_abil_gen_mthds gm
    WHERE go.gen_method_id = gm.id
      AND gm.system_id = v_id
      AND NOT EXISTS (SELECT 1 FROM opt_ids oi WHERE oi.id = go.id);

    -- Upsert options
    INSERT INTO public.system_abil_gen_mthd_opts (id, gen_method_id, label, reduce, code)
    SELECT
      NULLIF(opt->>'id','')::uuid,
      NULLIF(m->>'id','')::uuid,
      opt->>'label',
      NULLIF(opt->>'reduce','')::int,
      COALESCE(NULLIF(opt->>'code',''), opt->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'rules' -> 'abilityGenerateMethods', '[]'::jsonb)) m
    LEFT JOIN LATERAL JSONB_ARRAY_ELEMENTS(COALESCE(m->'options','[]'::jsonb)) opt ON TRUE
    WHERE opt IS NOT NULL
    ON CONFLICT (id) DO UPDATE SET
      label = EXCLUDED.label,
      reduce = COALESCE(EXCLUDED.reduce, public.system_abil_gen_mthd_opts.reduce),
      code = COALESCE(EXCLUDED.code, public.system_abil_gen_mthd_opts.code),
      updated_at = NOW();

    -- 🧩 Measurement option lists (rules.measureAmounts, rules.measureRounding)
    -- Upsert new normalized arrays into system_measure_opts
    INSERT INTO public.system_measure_opts (id, system_id, type, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid AS id,
        v_id,
        'AMOUNT'::public.system_measure_opt_type,
        obj ->> 'label',
        NULLIF (obj ->> 'description', ''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF (obj ->> 'short', ''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'rules' -> 'measureAmounts', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            type = EXCLUDED.type,
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_measure_opts.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_measure_opts.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_measure_opts.short),
            code = COALESCE(EXCLUDED.code, public.system_measure_opts.code),
            updated_at = NOW();

    INSERT INTO public.system_measure_opts (id, system_id, type, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid AS id,
        v_id,
        'ROUNDING'::public.system_measure_opt_type,
        obj ->> 'label',
        NULLIF (obj ->> 'description', ''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF (obj ->> 'short', ''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'rules' -> 'measureRounding', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            type = EXCLUDED.type,
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_measure_opts.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_measure_opts.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_measure_opts.short),
            code = COALESCE(EXCLUDED.code, public.system_measure_opts.code),
            updated_at = NOW();

    -- 🧩 Measurement option values (amount, rounding)
    -- DELETE stale
    WITH meas_ids AS (
        SELECT
            NULLIF (obj ->> 'id', '')::uuid AS id
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'rules' -> 'measureAmounts', '[]'::jsonb)) AS obj
        UNION
        SELECT
            NULLIF (obj ->> 'id', '')::uuid AS id
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'rules' -> 'measureRounding', '[]'::jsonb)) AS obj
    )
    DELETE FROM public.system_measure_opts smo
    WHERE smo.system_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                meas_ids m
            WHERE
                m.id = smo.id);
    -- 🧩 Modifiers
    -- Delete stale options
        WITH mod_ids AS (
        SELECT NULLIF(obj->>'id','')::uuid AS id
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data->'modifiers'->'categories','[]'::jsonb)) obj
        UNION
        SELECT NULLIF(obj->>'id','')::uuid
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data->'modifiers'->'types','[]'::jsonb)) obj
        UNION
        SELECT NULLIF(obj->>'id','')::uuid
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data->'modifiers'->'methods','[]'::jsonb)) obj
        UNION
        SELECT NULLIF(obj->>'id','')::uuid
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data->'modifiers'->'spellCategories','[]'::jsonb)) obj
    )
    DELETE FROM public.system_mod_opts sm
    WHERE sm.system_id = v_id
  AND NOT EXISTS (SELECT 1 FROM mod_ids m WHERE m.id = sm.id);  

    -- Bridges
    INSERT INTO public.system_mod_cat_types (category_id, type_id, system_id)
    SELECT
        NULLIF (j ->> 'categoryId', '')::uuid AS category_id,
        NULLIF (j ->> 'typeId', '')::uuid AS type_id,
        v_id
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'modifiers' -> 'categoryTypes', '[]'::jsonb)) AS j
    ON CONFLICT (category_id,
        type_id)
        DO NOTHING;

    DELETE FROM public.system_mod_cat_types smct USING public.system_mod_opts cat
    WHERE smct.category_id = cat.id
        AND smct.system_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'modifiers' -> 'categoryTypes', '[]'::jsonb)) AS j
        WHERE
            NULLIF (j ->> 'categoryId', '')::uuid = smct.category_id
            AND NULLIF (j ->> 'typeId', '')::uuid = smct.type_id);

    INSERT INTO public.system_mod_type_mthds (type_id, method_id, system_id)
    SELECT
        NULLIF (j ->> 'typeId', '')::uuid AS type_id,
        NULLIF (j ->> 'methodId', '')::uuid AS method_id,
        v_id
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'modifiers' -> 'typeMethods', '[]'::jsonb)) AS j
    ON CONFLICT (type_id,
        method_id)
        DO NOTHING;

    DELETE FROM public.system_mod_type_mthds smtm USING public.system_mod_opts typ, public.system_mod_opts mthd
    WHERE smtm.type_id = typ.id
        AND smtm.system_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'modifiers' -> 'typeMethods', '[]'::jsonb)) AS j
        WHERE
            NULLIF (j ->> 'typeId', '')::uuid = smtm.type_id
            AND NULLIF (j ->> 'methodId', '')::uuid = smtm.method_id);

    INSERT INTO public.system_mod_cat_type_mthds (category_id, type_id, method_id, system_id)
    SELECT
        NULLIF (j ->> 'categoryId', '')::uuid AS category_id,
        NULLIF (j ->> 'typeId', '')::uuid AS type_id,
        NULLIF (j ->> 'methodId', '')::uuid AS method_id,
        v_id
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'modifiers' -> 'categoryMethods', '[]'::jsonb)) AS j
    ON CONFLICT (category_id,
        type_id,
        method_id)
        DO NOTHING;

    DELETE FROM public.system_mod_cat_type_mthds smctm USING public.system_mod_opts cat
    WHERE smctm.category_id = cat.id
        AND smctm.system_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'modifiers' -> 'categoryMethods', '[]'::jsonb)) AS j
        WHERE
            NULLIF (j ->> 'categoryId', '')::uuid = smctm.category_id
            AND NULLIF (j ->> 'typeId', '')::uuid = smctm.type_id
            AND NULLIF (j ->> 'methodId', '')::uuid = smctm.method_id);

    -- UPSERT categories
    INSERT INTO public.system_mod_opts (id, system_id, type, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        'CATEGORY',
        obj ->> 'label',
        NULLIF(obj ->> 'desc',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'modifiers' -> 'categories', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            type = EXCLUDED.type,
            label = EXCLUDED.label,
            description = EXCLUDED.description,
            tooltip = EXCLUDED.tooltip,
            short = EXCLUDED.short,
            code = COALESCE(EXCLUDED.code, public.system_mod_opts.code);

    -- UPSERT types
    INSERT INTO public.system_mod_opts (id, system_id, type, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        'TYPE',
        obj ->> 'label',
        NULLIF(obj ->> 'desc',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'modifiers' -> 'types', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = EXCLUDED.description,
            tooltip = EXCLUDED.tooltip,
            short = EXCLUDED.short,
            code = COALESCE(EXCLUDED.code, public.system_mod_opts.code);

    -- UPSERT methods
    INSERT INTO public.system_mod_opts (id, system_id, type, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        'METHOD',
        obj ->> 'label',
        NULLIF(obj ->> 'desc',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'modifiers' -> 'methods', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = EXCLUDED.description,
            tooltip = EXCLUDED.tooltip,
            short = EXCLUDED.short,
            code = COALESCE(EXCLUDED.code, public.system_mod_opts.code);

    -- UPSERT spellCategories
    INSERT INTO public.system_mod_opts (id, system_id, type, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        'SPELL_CATEGORY',
        obj ->> 'label',
        NULLIF(obj ->> 'desc',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'modifiers' -> 'spellCategories', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = EXCLUDED.description,
            tooltip = EXCLUDED.tooltip,
            short = EXCLUDED.short,
            code = COALESCE(EXCLUDED.code, public.system_mod_opts.code);

    -- 🧩 Equipment options (categories, properties, rarities)
    -- DELETE stale per type
    WITH equip_ids AS (
        SELECT NULLIF(obj->>'id','')::uuid AS id
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data->'equipment'->'categories','[]'::jsonb)) obj
        UNION
        SELECT NULLIF(obj->>'id','')::uuid
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data->'equipment'->'properties','[]'::jsonb)) obj
        UNION
        SELECT NULLIF(obj->>'id','')::uuid
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data->'equipment'->'rarities','[]'::jsonb)) obj
    )
    DELETE FROM public.system_equip_opts seo
    WHERE seo.system_id = v_id
  AND NOT EXISTS (SELECT 1 FROM equip_ids e WHERE e.id = seo.id);

    -- Bridges
    INSERT INTO public.system_equip_cat_props (category_id, property_id, system_id)
    SELECT
        NULLIF (obj ->> 'categoryId', '')::uuid AS category_id,
        NULLIF (obj ->> 'propertyId', '')::uuid AS property_id,
        v_id
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'equipment' -> 'categoryProperties', '[]'::jsonb)) AS obj
    ON CONFLICT (category_id,
        property_id)
        DO NOTHING;

    -- Delete stale scoped to this system
    DELETE FROM public.system_equip_cat_props secp USING public.system_equip_opts cat
    WHERE secp.category_id = cat.id
        AND secp.system_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'equipment' -> 'categoryProperties', '[]'::jsonb)) AS obj
        WHERE
            NULLIF (obj ->> 'categoryId', '')::uuid = secp.category_id
            AND NULLIF (obj ->> 'propertyId', '')::uuid = secp.property_id);

    -- UPSERT equipment categories
    INSERT INTO public.system_equip_opts (id, system_id, type, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        'CATEGORY',
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'equipment' -> 'categories', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_equip_opts.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_equip_opts.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_equip_opts.short),
            code = COALESCE(EXCLUDED.code, public.system_equip_opts.code),
            updated_at = NOW();

    -- UPSERT equipment properties
    INSERT INTO public.system_equip_opts (id, system_id, type, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        'PROPERTY',
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'equipment' -> 'properties', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_equip_opts.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_equip_opts.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_equip_opts.short),
            code = COALESCE(EXCLUDED.code, public.system_equip_opts.code),
            updated_at = NOW();

    -- UPSERT equipment rarities
    INSERT INTO public.system_equip_opts (id, system_id, type, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        'RARITY',
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'equipment' -> 'rarities', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_equip_opts.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_equip_opts.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_equip_opts.short),
            code = COALESCE(EXCLUDED.code, public.system_equip_opts.code),
            updated_at = NOW();

    -- 🧩 Spell options (categories, durations, schools, shapes, requirements)
    -- DELETE stale per type
    WITH spell_ids AS (
        SELECT NULLIF(obj->>'id','')::uuid AS id
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data->'spells'->'categories','[]'::jsonb)) obj
        UNION
        SELECT NULLIF(obj->>'id','')::uuid
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data->'spells'->'durations','[]'::jsonb)) obj
        UNION
        SELECT NULLIF(obj->>'id','')::uuid
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data->'spells'->'ranges','[]'::jsonb)) obj
        UNION
        SELECT NULLIF(obj->>'id','')::uuid
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data->'spells'->'schools','[]'::jsonb)) obj
        UNION
        SELECT NULLIF(obj->>'id','')::uuid
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data->'spells'->'shapes','[]'::jsonb)) obj
        UNION
        SELECT NULLIF(obj->>'id','')::uuid
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data->'spells'->'requirements','[]'::jsonb)) obj
    )
    DELETE FROM public.system_spell_opts sso
    WHERE sso.system_id = v_id
    AND NOT EXISTS (SELECT 1 FROM spell_ids s WHERE s.id = sso.id);


    -- UPSERT spell categories
    INSERT INTO public.system_spell_opts (id, system_id, type, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        'CATEGORY',
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'spells' -> 'categories', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_spell_opts.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_spell_opts.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_spell_opts.short),
            code = COALESCE(EXCLUDED.code, public.system_spell_opts.code),
            updated_at = NOW();

    -- 🧩 Proficiencies (levels, categories)
    -- DELETE stale
    WITH prof_level_ids AS (
        SELECT
            NULLIF (obj ->> 'id', '')::uuid AS id
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'proficiencies' -> 'levels', '[]'::jsonb)) AS obj)
    DELETE FROM public.system_prof_levels pl
    WHERE pl.system_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                prof_level_ids p
            WHERE
                p.id = pl.id);

    INSERT INTO public.system_prof_levels (id, system_id, label, multiplier, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        obj ->> 'label',
        NULLIF(obj ->> 'multiplier','')::float8,
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'proficiencies' -> 'levels', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            multiplier = COALESCE(EXCLUDED.multiplier, public.system_prof_levels.multiplier),
            code = COALESCE(EXCLUDED.code, public.system_prof_levels.code),
            updated_at = NOW();

    WITH prof_cat_ids AS (
        SELECT
            NULLIF (obj ->> 'id', '')::uuid AS id
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'proficiencies' -> 'categories', '[]'::jsonb)) AS obj)
    DELETE FROM public.system_prof_cats pc
    WHERE pc.system_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                prof_cat_ids p
            WHERE
                p.id = pc.id);

    INSERT INTO public.system_prof_cats (id, system_id, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        obj ->> 'label',
        NULLIF(obj ->> 'desc',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'proficiencies' -> 'categories', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_prof_cats.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_prof_cats.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_prof_cats.short),
            code = COALESCE(EXCLUDED.code, public.system_prof_cats.code),
            updated_at = NOW();

    -- Removed legacy duplicate charges block (handled earlier with full fields and tags)

    -- 🧩 Character Options (system_char_opts)
    WITH char_ids AS (
        SELECT
            NULLIF (obj ->> 'id', '')::uuid AS id
        FROM (
            SELECT
                u.obj
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'charactersettings' -> 'hitpointCalcMethods', '[]'::jsonb)) u (obj)
            UNION ALL
            SELECT
                u.obj
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'charactersettings' -> 'advancementMethods', '[]'::jsonb)) u (obj)
            UNION ALL
            SELECT
                u.obj
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'charactersettings' -> 'spellPointCalcMethods', '[]'::jsonb)) u (obj)
            UNION ALL
            SELECT
                u.obj
            FROM
                JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'charactersettings' -> 'startingEquipmentOptions', '[]'::jsonb)) u (obj)) s (obj))
    DELETE FROM public.system_char_opts sc
    WHERE sc.system_id = v_id
        AND NOT EXISTS (
            SELECT
                1
            FROM
                char_ids c
            WHERE
                c.id = sc.id);

    INSERT INTO public.system_char_opts (id, system_id, type, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        'HP_CALC_MTHD',
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'charactersettings' -> 'hitpointCalcMethods', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_char_opts.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_char_opts.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_char_opts.short),
            code = COALESCE(EXCLUDED.code, public.system_char_opts.code),
            updated_at = NOW();

    INSERT INTO public.system_char_opts (id, system_id, type, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        'ADV_MTHD',
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'charactersettings' -> 'advancementMethods', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_char_opts.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_char_opts.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_char_opts.short),
            code = COALESCE(EXCLUDED.code, public.system_char_opts.code),
            updated_at = NOW();

    INSERT INTO public.system_char_opts (id, system_id, type, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        'SP_CALC_MTHD',
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'charactersettings' -> 'spellPointCalcMethods', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_char_opts.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_char_opts.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_char_opts.short),
            code = COALESCE(EXCLUDED.code, public.system_char_opts.code),
            updated_at = NOW();

    INSERT INTO public.system_char_opts (id, system_id, type, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        'START_EQUIP',
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'charactersettings' -> 'startingEquipmentOptions', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_char_opts.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_char_opts.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_char_opts.short),
            code = COALESCE(EXCLUDED.code, public.system_char_opts.code),
            updated_at = NOW();

    -- UPSERT spell durations
    INSERT INTO public.system_spell_opts (id, system_id, type, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        'DURATION',
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'spells' -> 'durations', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_spell_opts.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_spell_opts.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_spell_opts.short),
            code = COALESCE(EXCLUDED.code, public.system_spell_opts.code),
            updated_at = NOW();

    -- UPSERT spell ranges
    INSERT INTO public.system_spell_opts (id, system_id, type, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        'RANGE',
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'spells' -> 'ranges', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_spell_opts.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_spell_opts.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_spell_opts.short),
            code = COALESCE(EXCLUDED.code, public.system_spell_opts.code),
            updated_at = NOW();

    -- UPSERT spell schools
    INSERT INTO public.system_spell_opts (id, system_id, type, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        'SCHOOL',
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'spells' -> 'schools', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_spell_opts.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_spell_opts.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_spell_opts.short),
            code = COALESCE(EXCLUDED.code, public.system_spell_opts.code),
            updated_at = NOW();

    -- UPSERT spell shapes
    INSERT INTO public.system_spell_opts (id, system_id, type, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        'SHAPE',
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'spells' -> 'shapes', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_spell_opts.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_spell_opts.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_spell_opts.short),
            code = COALESCE(EXCLUDED.code, public.system_spell_opts.code),
            updated_at = NOW();

    -- UPSERT spell requirements
    INSERT INTO public.system_spell_opts (id, system_id, type, label, description, tooltip, short, code)
    SELECT
        NULLIF (obj ->> 'id', '')::uuid,
        v_id,
        'REQUIREMENT',
        obj ->> 'label',
        NULLIF(obj ->> 'description',''),
        NULLIF (obj ->> 'tooltip', ''),
        NULLIF(obj ->> 'short',''),
        COALESCE(NULLIF(obj->>'code',''), obj->>'label')
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(json_data -> 'spells' -> 'requirements', '[]'::jsonb)) AS obj
    ON CONFLICT (id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = COALESCE(EXCLUDED.description, public.system_spell_opts.description),
            tooltip = COALESCE(EXCLUDED.tooltip, public.system_spell_opts.tooltip),
            short = COALESCE(EXCLUDED.short, public.system_spell_opts.short),
            code = COALESCE(EXCLUDED.code, public.system_spell_opts.code),
            updated_at = NOW();

    RETURN v_id;

END
$$;