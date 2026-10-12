import type {
  ActiveRuleEffectDefinitionDto,
  ActiveRuleEffectLifecycleDto,
  EncounterMaintainedEffectDescriptorDto
} from '@artificer-toolkit/schema/shared/activeRuleEffects'

export const lifecycle: ActiveRuleEffectLifecycleDto = {
  schemaVersion: 1,
  remainingTicks: 3
}
export type EmptyPolicy = 'V1' | 'TERMINATE_WHEN_EMPTY' | 'RETAIN_UNTIL_TERMINAL'

export function definition(
  encounterId: string,
  sourceActorId: string
): ActiveRuleEffectDefinitionDto {
  const sourceOccurrenceId = crypto.randomUUID()
  const rootCommandId = crypto.randomUUID()
  const authoredEffectId = crypto.randomUUID()
  const compiledEntryId = crypto.randomUUID()
  return {
    schemaVersion: 1,
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: encounterId,
      sourceOccurrenceId,
      rootCommandId,
      sourceActorId
    },
    authoredEffectId,
    compiledEntryId,
    frozenGraphNodeId: 'entry',
    frozenGraph: {
      schemaVersion: 1,
      source: {
        definitionId: authoredEffectId,
        gameSystemId: crypto.randomUUID(),
        definitionFamilyKey: 'effect',
        checksum: 'a'.repeat(64)
      },
      capabilityContractVersion: 1,
      factContracts: [],
      nodes: [
        {
          id: 'entry',
          operation: { key: 'comparison', contractVersion: 1 },
          inputs: {}
        }
      ],
      sourceEntryBindings: [{ sourceEntryId: compiledEntryId, nodeId: 'entry' }],
      outputs: { result: { kind: 'LITERAL', value: true } }
    },
    adapterFacts: {},
    perceptionContributions: [],
    recurrence: {
      recurrenceStage: 'NONE',
      consumeOnFirstEvents: [],
      endOnEvents: [],
      lifetimeScope: 'ENCOUNTER',
      expiration: {
        kind: 'TICKS',
        initialRemaining: 3,
        decrementStage: 'END_OF_TURN',
        anchor: 'HOLDER'
      }
    }
  }
}

export function descriptor(
  sourceActorId: string,
  policy: EmptyPolicy
): EncounterMaintainedEffectDescriptorDto {
  const base = {
    maintenanceDefinitionId: crypto.randomUUID(),
    definitionChecksum: 'b'.repeat(64),
    sourceActionId: crypto.randomUUID(),
    sourceOccurrenceId: crypto.randomUUID(),
    sourceActorId,
    replacementPolicy: 'REPLACE_SAME_DEFINITION' as const
  }
  if (policy === 'V1') return { ...base, schemaVersion: 1 }
  return { ...base, schemaVersion: 2, emptyDependentPolicy: policy }
}
