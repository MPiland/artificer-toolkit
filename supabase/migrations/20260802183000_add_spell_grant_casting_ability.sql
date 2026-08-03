ALTER TABLE public.spell_grants
ADD COLUMN IF NOT EXISTS casting_ability_code text;

ALTER TABLE public.spell_grants
DROP CONSTRAINT IF EXISTS spell_grants_root_casting_ability_chk,
ADD CONSTRAINT spell_grants_root_casting_ability_chk CHECK (
  casting_ability_code IS NULL
  OR casting_ability_code IN (
    'STRENGTH',
    'DEXTERITY',
    'CONSTITUTION',
    'INTELLIGENCE',
    'WISDOM',
    'CHARISMA'
  )
);
