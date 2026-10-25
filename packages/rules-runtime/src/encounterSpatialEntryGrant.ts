import { v5 as uuidv5 } from 'uuid'

import {
  activeRuleEffectDefinitionDtoSchema,
  type ActiveRuleEffectDefinitionDto
} from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { ServerCompletedRuleExecutionDto } from '@artificer-toolkit/schema/shared/rulesExecution'

const SPATIAL_ENTRY_GRANT_NAMESPACE = '5b0d6f3a-2c4e-4f7a-9d1b-3e8a7c6b5a40'

type ModifierGrantContribution = Extract<
  ActiveRuleEffectDefinitionDto['stateContributions'][number],
  { kind: 'MODIFIER_GRANT' }
>

function modifierGrantContribution(definition: ActiveRuleEffectDefinitionDto) {
  return definition.stateContributions.find(
    (contribution): contribution is ModifierGrantContribution =>
      contribution.kind === 'MODIFIER_GRANT'
  )
}

/**
 * The grant a creature keeps after failing a zone's entry save: the modifier grant the zone carries,
 * held under this movement's origin so it reads, lasts and ends like any other grant. The zone's
 * frozen graph is only its provenance. Null when the zone authors no grant, the creature resisted
 * the zone, or the creature already holds that grant from this same zone (it does not stack).
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
  const template = modifierGrantContribution(zoneDefinition)
  if (
    !template ||
    zoneDefinition.origin.kind !== 'ENCOUNTER' ||
    input.execution.outputs.resultPath !== 'ON_SAVE_FAIL' ||
    input.holderEffects.some(({ definition }) => {
      return (
        definition.authoredEffectId === zoneDefinition.authoredEffectId &&
        modifierGrantContribution(definition)?.applyGrantOutcomeId === template.applyGrantOutcomeId
      )
    })
  )
    return null
  const { endOnEvents = [], ...grant } = template
  return {
    id: uuidv5(
      `${input.occurrenceId}:${input.sourceCommandId}:${input.ordinal}:${input.targetActorId}`,
      SPATIAL_ENTRY_GRANT_NAMESPACE
    ),
    definition: activeRuleEffectDefinitionDtoSchema.parse({
      schemaVersion: 2,
      linkedEffectId: null,
      originLevel: null,
      origin: {
        kind: 'ENCOUNTER',
        sourceAggregateId: input.encounterId,
        sourceOccurrenceId: input.occurrenceId,
        rootCommandId: input.sourceCommandId,
        sourceActorId: zoneDefinition.origin.sourceActorId
      },
      authoredEffectId: zoneDefinition.authoredEffectId,
      compiledEntryId: zoneDefinition.compiledEntryId,
      frozenGraphNodeId: zoneDefinition.frozenGraphNodeId,
      frozenGraph: zoneDefinition.frozenGraph,
      adapterFacts: {},
      perceptionContributions: [],
      recurrence: {
        recurrenceStage: 'NONE',
        anchor: 'HOLDER',
        consumeOnFirstEvents: [],
        endOnEvents,
        endOnTriggers: [],
        endOnConditionIds: [],
        holderEnd: null,
        lifetimeScope: 'ENCOUNTER',
        expiration: { kind: 'INDEFINITE' }
      },
      stateContributions: [grant]
    }),
    lifecycle: { schemaVersion: 1 as const, remainingTicks: null }
  }
}
