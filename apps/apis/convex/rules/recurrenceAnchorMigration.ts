import { Migrations } from '@convex-dev/migrations'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { components, internal } from '../_generated/api'
import schema from '../schema'
import { internalMutation } from '../lib/mutations'

/**
 * SPELLS-33.T6n2 backfill: the actor whose turns time an effect moved from a counted expiration's
 * `anchor` to the required `recurrence.anchor`, so an uncounted recurrence can fire on its source's
 * turns too. A stored counted anchor moves up; any other recurrence was timed by its holder. Each
 * rewritten definition is validated and re-checksummed. Idempotent: a recurrence with an anchor and
 * none on its expiration is left alone.
 */
const migrations = new Migrations(components.migrations, { schema, internalMutation })

function migratedDefinition(definitionJson: string) {
  const stored = JSON.parse(definitionJson) as {
    recurrence?: { anchor?: unknown; expiration?: { anchor?: unknown } } | null
  }
  const recurrence = stored.recurrence
  if (
    !recurrence ||
    (recurrence.anchor !== undefined && recurrence.expiration?.anchor === undefined)
  )
    return undefined
  const { anchor: countedAnchor, ...expiration } = recurrence.expiration ?? {}
  const definition = activeRuleEffectDefinitionDtoSchema.parse({
    ...stored,
    recurrence: {
      ...recurrence,
      anchor: recurrence.anchor ?? countedAnchor ?? 'HOLDER',
      ...(recurrence.expiration && { expiration })
    }
  })
  return {
    definitionJson: JSON.stringify(definition),
    definitionChecksum: checksumCanonicalJson(definition)
  }
}

// Definitions can approach the document size limit.
export const characterEffectRecurrenceAnchors = migrations.define({
  table: 'characterActiveRuleEffects',
  batchSize: 1,
  migrateOne: (_ctx, row) => migratedDefinition(row.definitionJson)
})

export const encounterEffectRecurrenceAnchors = migrations.define({
  table: 'encounterActiveRuleEffects',
  batchSize: 1,
  migrateOne: (_ctx, row) => migratedDefinition(row.definitionJson)
})

export const spatialEffectRecurrenceAnchors = migrations.define({
  table: 'encounterSpatialRuleEffects',
  batchSize: 1,
  migrateOne: (_ctx, row) => migratedDefinition(row.definitionJson)
})

export const run = migrations.runner([
  internal.rules.recurrenceAnchorMigration.characterEffectRecurrenceAnchors,
  internal.rules.recurrenceAnchorMigration.encounterEffectRecurrenceAnchors,
  internal.rules.recurrenceAnchorMigration.spatialEffectRecurrenceAnchors
])
