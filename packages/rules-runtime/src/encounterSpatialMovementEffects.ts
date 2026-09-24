import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import type { StoredRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

type SpatialBatch = Extract<
  StoredRuleExecutionResultDto,
  { status: 'BATCH_COMPLETE'; batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT' }
>
type Transition = SpatialBatch['spatialEffectTransitions'][number]['transition']

export function spatialEffectTransition(effect: EncounterSpatialRuleEffectRecord) {
  const base = {
    expectedVersion: effect.version,
    definitionChecksum: effect.definitionChecksum,
    lifecycleChecksum: effect.lifecycleChecksum,
    placementChecksum: effect.placementChecksum
  }
  if (effect.placement.activation === 'ONE_SHOT')
    return {
      kind: 'DELETE' as const,
      ...base,
      spatialStateChecksum: effect.spatialStateChecksum
    }
  if (!effect.spatialState.revealed && effect.placement.revealOnTrigger)
    return {
      kind: 'UPDATE' as const,
      ...base,
      afterVersion: effect.version + 1,
      beforeSpatialStateChecksum: effect.spatialStateChecksum,
      afterSpatialStateChecksum: checksumRuleDocument({
        schemaVersion: 1,
        revealed: true
      }),
      beforeRevealed: false as const,
      afterRevealed: true as const
    }
  return {
    kind: 'UNCHANGED' as const,
    ...base,
    spatialStateChecksum: effect.spatialStateChecksum
  }
}

/** Restores only a movement root's proved lifecycle change, never a later unrelated mutation. */
export function spatialMovementEffectBeforeTransition(input: {
  current: EncounterSpatialRuleEffectRecord | null
  consumed?: EncounterSpatialRuleEffectRecord
  effectId: string
  transition: Transition
  encounterId: string
  sceneId: string
  allowUnapplied: boolean
}): EncounterSpatialRuleEffectRecord {
  const { current, transition } = input
  let original = current
  if (transition.kind === 'DELETE' && current === null) original = input.consumed ?? null
  else if (
    transition.kind === 'UPDATE' &&
    current?.version === transition.afterVersion &&
    current.spatialStateChecksum === transition.afterSpatialStateChecksum
  )
    original = {
      ...current,
      version: transition.expectedVersion,
      spatialState: { schemaVersion: 1, revealed: false },
      spatialStateChecksum: transition.beforeSpatialStateChecksum
    }
  else if (!input.allowUnapplied && transition.kind !== 'UNCHANGED')
    throw new Error('The recorded spatial lifecycle transition is no longer current.')
  if (
    !original ||
    original.id !== input.effectId ||
    original.encounterId !== input.encounterId ||
    original.sceneId !== input.sceneId ||
    checksumRuleDocument(spatialEffectTransition(original)) !== checksumRuleDocument(transition) ||
    checksumRuleDocument(original.definition) !== original.definitionChecksum ||
    checksumRuleDocument(original.lifecycle) !== original.lifecycleChecksum ||
    checksumRuleDocument(original.placement) !== original.placementChecksum ||
    checksumRuleDocument(original.spatialState) !== original.spatialStateChecksum
  )
    throw new Error('The spatial continuation does not match its consumed effect.')
  return original
}
