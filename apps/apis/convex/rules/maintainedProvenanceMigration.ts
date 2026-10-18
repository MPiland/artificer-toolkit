import { Migrations } from '@convex-dev/migrations'
import { encounterMaintainedEffectDescriptorDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { components, internal } from '../_generated/api'
import schema from '../schema'
import { internalMutation } from '../lib/mutations'

/**
 * D151 backfill: a maintained state's descriptor named its action occurrence in top-level
 * `sourceActionId` and `sourceOccurrenceId`. Those move into `provenance` as its `ACTION` kind, beside
 * the `CARRIED` kind a later Run's reinstated Concentration uses. Each rewritten descriptor is
 * validated and re-checksummed. Idempotent: a descriptor with a provenance is left alone.
 */
const migrations = new Migrations(components.migrations, { schema, internalMutation })

export function migratedDescriptor(descriptorJson: string) {
  const stored: unknown = JSON.parse(descriptorJson)
  if (
    typeof stored !== 'object' ||
    stored === null ||
    !('sourceActionId' in stored) ||
    !('sourceOccurrenceId' in stored)
  )
    return undefined
  const { sourceActionId, sourceOccurrenceId, ...rest } = stored
  const descriptor = encounterMaintainedEffectDescriptorDtoSchema.parse({
    ...rest,
    provenance: { kind: 'ACTION', sourceActionId, sourceOccurrenceId }
  })
  return {
    descriptorJson: JSON.stringify(descriptor),
    descriptorChecksum: checksumCanonicalJson(descriptor)
  }
}

export const maintainedStateProvenance = migrations.define({
  table: 'encounterMaintainedEffectStates',
  migrateOne: (_ctx, row) => migratedDescriptor(row.descriptorJson)
})

export const run = migrations.runner([
  internal.rules.maintainedProvenanceMigration.maintainedStateProvenance
])
