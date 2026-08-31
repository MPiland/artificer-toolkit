import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { normalizeSql } from './helpers/normalize-sql.js'

const migrationPath = new URL(
  '../../../../supabase/migrations/20260827020000_uuid_backed_saving_throw_abilities.sql',
  import.meta.url
)
const canonicalTablePath = new URL('../domains/shared/tables/saving_throws.sql', import.meta.url)

describe('UUID-backed saving throw ability migration', () => {
  it('does not require or create a canonical System when no legacy rows need conversion', async () => {
    const migration = normalizeSql(await readFile(migrationPath, 'utf8'))

    const conversionStart = migration.indexOf('IF EXISTS (SELECT 1 FROM public.saving_throws) THEN')
    const systemRequirement = migration.indexOf(
      "RAISE EXCEPTION 'Cannot migrate saving throw abilities: canonical D&D System is missing.'"
    )

    expect(conversionStart).toBeGreaterThan(-1)
    expect(systemRequirement).toBeGreaterThan(conversionStart)
    expect(migration).toContain(
      '-- legacy rows require the canonical D&D vocabulary; never fabricate that System.'
    )
    expect(migration).toContain('ALTER COLUMN system_id SET NOT NULL')
    expect(migration).toContain('ALTER COLUMN ability_definition_id SET NOT NULL')
  })

  it('derives Feature ownership through ancestry options and rejects noncanonical candidates', async () => {
    const migration = normalizeSql(await readFile(migrationPath, 'utf8'))

    expect(migration).toContain('FROM public.race_ancestry_option_features AS link')
    expect(migration).toContain(
      'JOIN public.race_ancestry_options AS ancestry_option ON ancestry_option.id = link.ancestry_option_id'
    )
    expect(migration).toContain(
      'JOIN public.race_ancestries AS ancestry ON ancestry.id = ancestry_option.ancestry_id'
    )
    expect(migration).toContain('JOIN public.races AS subject ON subject.id = ancestry.race_id')
    expect(migration).toContain('FILTER (WHERE effect_systems.system_id IS NOT NULL)')
    expect(migration).toContain('cardinality(candidates.system_ids) <> 1')
    expect(migration).toContain(
      "candidates.system_ids[1] <> '00000000-0000-0000-0000-000000000001'::uuid"
    )
    expect(migration).toContain(
      "RAISE EXCEPTION 'Cannot migrate saving throws without one exact canonical D&D System owner.'"
    )
  })

  it('restores the canonical UUID-backed bonus payload invariant after removing legacy ability codes', async () => {
    const [migrationSource, canonicalSource] = await Promise.all([
      readFile(migrationPath, 'utf8'),
      readFile(canonicalTablePath, 'utf8')
    ])
    const migration = normalizeSql(migrationSource)
    const canonical = normalizeSql(canonicalSource)

    const bonusConversion = migration.slice(
      migration.indexOf(
        'ALTER TABLE public.saving_throw_dc_bonuses ALTER COLUMN system_id SET NOT NULL'
      )
    )
    const payloadArms = [
      "(bonus_kind = 'ABILITY_MODIFIER' AND ability_definition_id IS NOT NULL AND amount IS NULL)",
      "(bonus_kind = 'PROFICIENCY_BONUS' AND ability_definition_id IS NULL AND amount IS NULL)",
      "(bonus_kind = 'STATIC_BONUS' AND ability_definition_id IS NULL AND amount IS NOT NULL)"
    ]

    expect(bonusConversion).toContain(
      'DROP CONSTRAINT IF EXISTS saving_throw_dc_bonuses_payload_chk'
    )
    expect(bonusConversion).toContain('DROP COLUMN ability_code')
    expect(bonusConversion).toContain('ADD CONSTRAINT saving_throw_dc_bonuses_payload_chk CHECK')
    for (const arm of payloadArms) {
      expect(canonical).toContain(arm)
      expect(bonusConversion).toContain(arm)
    }
  })
})
