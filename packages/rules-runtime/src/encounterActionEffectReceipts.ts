import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'

/** Projects the same receipt fields for forecast and persisted effect records. */
export function projectNativeActionEffectTransitions(input: {
  state: ActiveRuleEffectRecord | null
  recurring: ActiveRuleEffectRecord | null
  /** A failure-margin rider's effect, created beside the recurring effect it rides on. */
  rider?: ActiveRuleEffectRecord | null
  targetActorId: string
}) {
  const { state, recurring } = input
  const stateEffectTransitions = state
    ? [
        (() => {
          const [contribution] = state.definition.stateContributions
          if (
            !contribution ||
            (contribution.kind !== 'HIT_POINT_MAXIMUM_REDUCTION' &&
              contribution.kind !== 'SCALAR_REDUCTION')
          )
            throw new Error('Created state effect has an invalid contribution.')
          return {
            kind: 'CREATE' as const,
            owner: state.owner,
            activeEffectId: state.id,
            createdOrdinal: state.createdOrdinal,
            afterVersion: state.version,
            authoredEffectId: state.definition.authoredEffectId,
            compiledEntryId: state.definition.compiledEntryId,
            frozenGraphNodeId: state.definition.frozenGraphNodeId,
            definitionChecksum: state.definitionChecksum,
            lifecycleChecksum: state.lifecycleChecksum,
            frozenSourceChecksum: state.definition.frozenGraph.source.checksum,
            capabilityContractVersion: state.definition.frozenGraph.capabilityContractVersion,
            contribution
          }
        })()
      ]
    : []
  const activeEffectTransitions = [recurring, input.rider ?? null].flatMap((recurring) =>
    recurring
      ? [
          {
            kind: 'CREATE' as const,
            activeEffectId: recurring.id,
            targetActorId: input.targetActorId,
            ...(recurring.maintainedEffectStateId
              ? { maintainedEffectStateId: recurring.maintainedEffectStateId }
              : {}),
            createdOrdinal: recurring.createdOrdinal,
            afterVersion: recurring.version,
            authoredEffectId: recurring.definition.authoredEffectId,
            compiledEntryId: recurring.definition.compiledEntryId,
            frozenGraphNodeId: recurring.definition.frozenGraphNodeId,
            definitionChecksum: recurring.definitionChecksum,
            lifecycleChecksum: recurring.lifecycleChecksum,
            frozenSourceChecksum: recurring.definition.frozenGraph.source.checksum,
            capabilityContractVersion: recurring.definition.frozenGraph.capabilityContractVersion,
            recurrenceStage: recurring.definition.recurrence.recurrenceStage,
            remainingTicks: recurring.lifecycle.remainingTicks
          }
        ]
      : []
  )
  return { stateEffectTransitions, activeEffectTransitions }
}
