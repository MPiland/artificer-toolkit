import { v5 as uuidv5 } from 'uuid'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  prepareActiveRuleEffectRecord,
  prepareMaintainedEffectStateRecord
} from './activeRuleEffectRecords.js'
import { prepareNativeActionEffectsPlan } from './encounterActionEffects.js'
import { projectNativeActionEffectTransitions } from './encounterActionEffectReceipts.js'
import type { ProjectableCharacterFacts } from './encounterActionProjection.js'
import type { MovementCharacterRow } from './encounterMovementMaintenance.js'
import type { MovementReactionSettlementInput } from './encounterMovementReactionPlan.js'

/** Forecasts immutable effects before any later contact is evaluated or published. */
export function planEncounterMovementReactionEffects<
  TFacts extends ProjectableCharacterFacts,
  TRow extends MovementCharacterRow
>(
  input: MovementReactionSettlementInput<TFacts, TRow> & {
    execution: Extract<
      MovementReactionSettlementInput<TFacts, TRow>['execution'],
      { kind: 'COMPLETE' }
    >
  }
) {
  const prepared = input.prepared.prepared
  const effects = prepareNativeActionEffectsPlan({
    prepared,
    execution: input.execution,
    occurrenceId: input.occurrenceId,
    commandId: input.commandId,
    activeEffectsByActorId: new Map(
      [...prepared.movementTargets].map(([actorId, target]) => [actorId, target.activeEffects])
    )
  })
  const maintenance = effects.maintenance ? input.prepared.maintenance : null
  if (
    effects.maintenance &&
    (!maintenance ||
      checksumCanonicalJson(effects.maintenance) !== checksumCanonicalJson(maintenance.policy))
  )
    throw new Error('The movement maintenance preflight changed.')
  const maintainedState = maintenance
    ? prepareMaintainedEffectStateRecord({
        id: uuidv5(
          JSON.stringify([
            'MOVEMENT_MAINTENANCE',
            input.occurrenceId,
            input.ordinal,
            prepared.actor.id,
            maintenance.policy.definitionId
          ]),
          input.commandId
        ),
        encounterId: prepared.state.id,
        ownerActorId: prepared.actor.id,
        occurredAt: input.occurredAt,
        descriptor: {
          schemaVersion: 2,
          maintenanceDefinitionId: maintenance.policy.definitionId,
          definitionChecksum: maintenance.definitionChecksum,
          provenance: {
            kind: 'ACTION',
            sourceActionId: input.prepared.option.actionId,
            sourceOccurrenceId: input.occurrenceId
          },
          sourceActorId: prepared.actor.id,
          replacementPolicy: maintenance.policy.replacementPolicy,
          emptyDependentPolicy: maintenance.policy.emptyDependentPolicy
        }
      })
    : null
  const owner =
    prepared.target.kind === 'CHARACTER'
      ? {
          kind: 'CHARACTER' as const,
          characterId:
            prepared.target.sourceId ??
            (() => {
              throw new Error('Reaction Character effect owner is unavailable.')
            })()
        }
      : {
          kind: 'ENCOUNTER_ACTOR' as const,
          encounterId: prepared.state.id,
          targetActorId: prepared.target.id
        }
  const removedIds = new Set(maintenance?.removed.map((effect) => effect.id))
  const currentEffects = prepared.targetFacts.activeEffects.filter(
    (effect) => !removedIds.has(effect.id)
  )
  const createdEffects: ActiveRuleEffectRecord[] = []
  const create = (kind: 'STATE' | 'RECURRING', plan: typeof effects.stateEffect) => {
    if (!plan) return null
    const record = prepareActiveRuleEffectRecord({
      id: uuidv5(
        JSON.stringify([
          'MOVEMENT_REACTION_EFFECT',
          input.occurrenceId,
          input.ordinal,
          prepared.target.id,
          kind
        ]),
        input.commandId
      ),
      owner,
      definition: plan.definition,
      lifecycle: plan.lifecycle,
      maintainedEffectStateId: kind === 'RECURRING' ? maintainedState?.id : undefined,
      currentEffects,
      occurredAt: input.occurredAt
    })
    currentEffects.push(record)
    createdEffects.push(record)
    return record
  }
  const state = create('STATE', effects.stateEffect)
  const recurring = create('RECURRING', effects.recurringEffect)
  return {
    effects,
    maintainedState,
    createdEffects,
    ...projectNativeActionEffectTransitions({
      state,
      recurring,
      targetActorId: prepared.target.id
    })
  }
}
