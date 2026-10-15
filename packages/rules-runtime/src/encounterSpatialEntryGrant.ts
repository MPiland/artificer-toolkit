import { v5 as uuidv5 } from 'uuid'

import {
  activeRuleEffectDefinitionDtoSchema,
  type ActiveRuleEffectDefinitionDto
} from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { ServerCompletedRuleExecutionDto } from '@artificer-toolkit/schema/shared/rulesExecution'

const SPATIAL_ENTRY_GRANT_NAMESPACE = '5b0d6f3a-2c4e-4f7a-9d1b-3e8a7c6b5a40'

/**
 * The grant a creature keeps after failing a zone's entry save: the zone's authored modifier-grant
 * template, copied under this movement's origin so it reads, lasts and ends like any other grant.
 * Null when the zone authors no grant, the creature resisted the zone, or the creature already
 * holds the grant from this same authored zone (it does not stack).
 */
export function planSpatialEntryGrant(input: {
  zoneDefinition: ActiveRuleEffectDefinitionDto
  holderEffects: readonly ActiveRuleEffectRecord[]
  execution: Pick<ServerCompletedRuleExecutionDto, 'outputs'>
  encounterId: string
  occurrenceId: string
  sourceCommandId: string
  ordinal: number
  targetActorId: string
}) {
  const { zoneDefinition } = input
  if (
    zoneDefinition.schemaVersion !== 2 ||
    zoneDefinition.origin.kind !== 'ENCOUNTER' ||
    !zoneDefinition.stateContributions.some(({ kind }) => kind === 'MODIFIER_GRANT') ||
    input.execution.outputs.resultPath !== 'ON_SAVE_FAIL' ||
    input.holderEffects.some(
      ({ definition }) =>
        definition.authoredEffectId === zoneDefinition.authoredEffectId &&
        definition.compiledEntryId === zoneDefinition.compiledEntryId
    )
  )
    return null
  return {
    id: uuidv5(
      `${input.occurrenceId}:${input.sourceCommandId}:${input.ordinal}:${input.targetActorId}`,
      SPATIAL_ENTRY_GRANT_NAMESPACE
    ),
    definition: activeRuleEffectDefinitionDtoSchema.parse({
      ...zoneDefinition,
      origin: {
        kind: 'ENCOUNTER',
        sourceAggregateId: input.encounterId,
        sourceOccurrenceId: input.occurrenceId,
        rootCommandId: input.sourceCommandId,
        sourceActorId: zoneDefinition.origin.sourceActorId
      }
    }),
    lifecycle: { schemaVersion: 1 as const, remainingTicks: null }
  }
}
