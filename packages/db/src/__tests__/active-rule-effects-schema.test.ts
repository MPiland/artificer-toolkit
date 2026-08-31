import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { normalizeSql } from './helpers/normalize-sql.js'

const root = process.cwd()
const characterSql = normalizeSql(
  readFileSync(join(root, 'packages/db/src/domains/subjects/tables/character_events.sql'), 'utf8')
)
const encounterSql = normalizeSql(
  readFileSync(join(root, 'packages/db/src/domains/encounters/tables/encounters.sql'), 'utf8')
)
const migration = normalizeSql(
  readFileSync(join(root, 'supabase/migrations/20260826070000_active_rule_effects.sql'), 'utf8')
)
const repository = readFileSync(
  join(root, 'packages/db/src/repositories/activeRuleEffects.ts'),
  'utf8'
)

describe('aggregate-owned active rule-effect persistence', () => {
  it.each([migration])(
    'keeps Character effect state server-only, ordered, and encounter-cleanup scoped',
    (source) => {
      expect(source).toContain('character_active_rule_effects')
      expect(source).toContain('UNIQUE (character_id, created_ordinal)')
      expect(source).toContain('source_encounter_id uuid')
      expect(source).toContain('character_active_rule_effects_source_encounter_idx')
      expect(source).toContain('(source_encounter_id, character_id, created_ordinal, id)')
      expect(source).toContain('definition_checksum')
      expect(source).toContain('lifecycle_checksum')
      expect(source).toContain('FORCE ROW LEVEL SECURITY')
      expect(source).toContain(
        'REVOKE ALL ON TABLE public.character_active_rule_effects FROM anon, authenticated'
      )
    }
  )

  it('defers the Character maintained-state FK until both domains exist', () => {
    const crossDomain = readFileSync(
      join(root, 'packages/db/src/domains/bootstrap/constraints/cross_domain_foreign_keys.sql'),
      'utf8'
    )
    expect(crossDomain).toContain('FOREIGN KEY (maintained_effect_state_id, source_encounter_id)')
    expect(crossDomain).toContain('ON DELETE RESTRICT')
    expect(characterSql).not.toContain(
      'FOREIGN KEY (maintained_effect_state_id, source_encounter_id)'
    )
  })

  it.each([encounterSql, migration])(
    'uses exact Encounter actor ownership for Encounter effect state',
    (source) => {
      expect(source).toContain('encounter_active_rule_effects')
      expect(source).toContain('UNIQUE (id, encounter_id)')
      expect(source).toContain('FOREIGN KEY (target_actor_id, encounter_id)')
      expect(source).toContain(
        'REFERENCES public.encounter_actors (id, encounter_id) ON DELETE CASCADE'
      )
      expect(source).toContain('UNIQUE (encounter_id, target_actor_id, created_ordinal)')
    }
  )

  it.each([encounterSql, migration])(
    'persists server-only Encounter maintained state and cascades dependent effects',
    (source) => {
      expect(source).toContain('encounter_maintained_effect_states')
      expect(source).toContain('UNIQUE (encounter_id, owner_actor_id, maintenance_definition_id)')
      expect(source).toContain('descriptor_checksum')
      expect(source).toContain(
        'REVOKE ALL ON TABLE public.encounter_maintained_effect_states FROM anon, authenticated'
      )
      expect(source).toContain('maintained_effect_state_id uuid')
      expect(source).toContain(
        'REFERENCES public.encounter_maintained_effect_states (id, encounter_id) ON DELETE CASCADE'
      )
    }
  )

  it.each([migration])(
    'binds Character maintained dependents only through their exact Encounter source',
    (source) => {
      expect(source).toContain('maintained_effect_state_id uuid')
      expect(source).toContain('FOREIGN KEY (maintained_effect_state_id, source_encounter_id)')
      expect(source).toContain(
        'REFERENCES public.encounter_maintained_effect_states (id, encounter_id)'
      )
      expect(source).toContain('ON DELETE RESTRICT')
    }
  )

  it('keeps the composite actor key in bootstrap without a post-create alter', () => {
    const actorStart = encounterSql.indexOf('CREATE TABLE IF NOT EXISTS public.encounter_actors')
    const actorEnd = encounterSql.indexOf('CREATE INDEX IF NOT EXISTS encounter_actors_order_idx')
    const actorTable = encounterSql.slice(actorStart, actorEnd)
    expect(actorTable).toContain('UNIQUE (id, encounter_id)')
    expect(actorTable).not.toContain('ADD CONSTRAINT encounter_actors_id_encounter_unique')
    expect(migration).toContain(
      'ADD CONSTRAINT encounter_actors_id_encounter_unique UNIQUE (id, encounter_id)'
    )
  })

  it('keeps split checksum validation, scoped allocation, and lifecycle-only CAS in the repository', () => {
    expect(repository).toContain('sourceEncounterIdForDefinition')
    expect(repository).toContain('checksumCanonicalJson(definition) !== row.definition_checksum')
    expect(repository).toContain('checksumCanonicalJson(lifecycle) !== row.lifecycle_checksum')
    expect(repository).toContain('lockCharacterEffectsForEncounterCleanup')
    expect(repository).toContain('listCharacterOwnersForEncounterCleanup')
    expect(repository).toContain('SELECT DISTINCT character_id')
    expect(repository).toContain('updateLifecycleCas')
    expect(repository).toContain('SET version = version + 1, lifecycle =')
    expect(repository).toContain('count(*)::integer AS active_count')
    expect(repository).toContain('coalesce(max(created_ordinal), 0)::integer AS next_ordinal')
    expect(repository).toContain('ActiveRuleEffectLimitError')
    expect(repository).toContain('serverUuidIdentityDtoSchema.parse')
    expect(repository).toContain('lockMaintainedState')
    expect(repository).toContain('lockDependentEffects')
    expect(repository).toContain('deleteMaintainedStateCas')
  })
})
