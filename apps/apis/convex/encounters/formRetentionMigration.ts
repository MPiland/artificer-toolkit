import { Migrations } from '@convex-dev/migrations'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { components, internal } from '../_generated/api'
import schema from '../schema'
import { internalMutation } from '../lib/mutations'

/**
 * SPELLS-4.T2s backfill: a stored `CREATURE_FORM` contribution gains `retainedAbilityIds`, the
 * scores its form keeps, now authored on the form effect instead of System-wide. Every form stored
 * before it is Polymorph, True Polymorph or Giant Insect, which keep none, so each gains `[]`. Each
 * rewritten definition is validated and re-checksummed. Idempotent: a contribution that has the
 * field is left alone.
 */
const migrations = new Migrations(components.migrations, { schema, internalMutation })

function migratedDefinition(definitionJson: string) {
  const stored = JSON.parse(definitionJson) as { stateContributions?: unknown[] }
  let changed = false
  const stateContributions = (stored.stateContributions ?? []).map((contribution) => {
    if (
      typeof contribution !== 'object' ||
      contribution === null ||
      !('kind' in contribution) ||
      contribution.kind !== 'CREATURE_FORM' ||
      'retainedAbilityIds' in contribution
    )
      return contribution
    changed = true
    return { ...contribution, retainedAbilityIds: [] }
  })
  if (!changed) return undefined
  const definition = activeRuleEffectDefinitionDtoSchema.parse({ ...stored, stateContributions })
  return {
    definitionJson: JSON.stringify(definition),
    definitionChecksum: checksumCanonicalJson(definition)
  }
}

// Definitions can approach the document size limit.
export const characterEffectFormRetention = migrations.define({
  table: 'characterActiveRuleEffects',
  batchSize: 1,
  migrateOne: (_ctx, row) => migratedDefinition(row.definitionJson)
})

export const encounterEffectFormRetention = migrations.define({
  table: 'encounterActiveRuleEffects',
  batchSize: 1,
  migrateOne: (_ctx, row) => migratedDefinition(row.definitionJson)
})

export const run = migrations.runner([
  internal.encounters.formRetentionMigration.characterEffectFormRetention,
  internal.encounters.formRetentionMigration.encounterEffectFormRetention
])
