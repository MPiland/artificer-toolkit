import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { normalizeSql } from './helpers/normalize-sql.js'

const root = process.cwd()
const encounterSql = normalizeSql(
  readFileSync(join(root, 'packages/db/src/domains/encounters/tables/encounters.sql'), 'utf8')
)
const sceneOwnershipMigration = normalizeSql(
  readFileSync(join(root, 'supabase/migrations/20260830090000_campaign_live_scenes.sql'), 'utf8')
)
const repository = readFileSync(
  join(root, 'packages/db/src/repositories/spatialRuleEffects.ts'),
  'utf8'
)

describe('Encounter/Scene spatial rule-effect persistence', () => {
  it.each([encounterSql])(
    'keeps spatial roots server-only, Scene-owned, and separate from target actors',
    (source) => {
      expect(source).toContain('encounter_spatial_rule_effects')
      expect(source).toContain('UNIQUE (id, encounter_id)')
      expect(source).toContain('UNIQUE (encounter_id, scene_id, created_ordinal)')
      expect(source).toContain('FOREIGN KEY (encounter_id, scene_id)')
      expect(source).toContain(
        'REFERENCES public.encounter_scene_bindings (encounter_id, scene_id)'
      )
      expect(source).toContain('placement_checksum')
      expect(source).toContain('spatial_state_checksum')
      expect(source).toContain("definition #>> '{recurrence,recurrenceStage}' = 'NONE'")
      expect(source).toContain("jsonb_typeof(definition -> 'origin') = 'object'")
      expect(source).toContain(') IS TRUE)')
      expect(source).toContain('FORCE ROW LEVEL SECURITY')
      expect(source).toContain(
        'REVOKE ALL ON TABLE public.encounter_spatial_rule_effects FROM anon, authenticated'
      )
    }
  )

  it('rebinds existing spatial effects through the exact Encounter/Scene binding', () => {
    expect(sceneOwnershipMigration).toContain('encounter_spatial_rule_effects_binding_fk')
    expect(sceneOwnershipMigration).toContain(
      'FOREIGN KEY (encounter_id, scene_id) REFERENCES public.encounter_scene_bindings'
    )
  })

  it('requires an exact locked Scene scope before allocation or mutation', () => {
    expect(repository).toContain('ORDER BY created_ordinal ASC, id ASC')
    expect(repository).toContain('AND scene_id = ${scope.sceneId}')
    expect(repository).toContain('async lockScope')
    expect(repository).toContain('FROM public.encounter_scene_bindings AS binding')
    expect(repository).toContain('FOR UPDATE')
    expect(repository).toContain('MAX_SPATIAL_RULE_EFFECTS_PER_SCENE')
    expect(repository).toContain('checksumCanonicalJson(current.placement)')
    expect(repository).toContain('checksumCanonicalJson(current.spatialState)')
    expect(repository).toContain('updateCurrentStateCas')
    expect(repository).toContain('SpatialRuleEffectCurrentnessError')
  })
})
