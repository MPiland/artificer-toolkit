import { v5 as uuidv5 } from 'uuid'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  prepareActiveRuleEffectRecord,
  prepareMaintainedEffectStateRecord
} from './activeRuleEffectRecords.js'
import {
  prepareNativeActionEffectsPlan,
  prepareNativeIncomingDamageGrantTriggers
} from './encounterActionEffects.js'
import { decoyStrikeEffects } from './encounterAttackDecoys.js'
import { linkedRiderPlan } from './encounterActionEffectPlans.js'
import { preparedCastsSpell } from './encounterPreparedSpellCast.js'
import {
  actionEndedEffects,
  actsAgainstEnemy,
  incomingDamageGrantRecords,
  targetEndedEffects
} from './encounterEndedEffectRelease.js'
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
  const activeEffectsByActorId = new Map(
    [...prepared.movementTargets].map(([actorId, target]) => [actorId, target.activeEffects])
  )
  const effects = prepareNativeActionEffectsPlan({
    prepared,
    execution: input.execution,
    occurrenceId: input.occurrenceId,
    commandId: input.commandId,
    activeEffectsByActorId
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
  const create = (kind: 'STATE' | 'RECURRING' | 'RIDER', plan: typeof effects.stateEffect) => {
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
      maintainedEffectStateId: kind === 'STATE' ? undefined : maintainedState?.id,
      currentEffects,
      occurredAt: input.occurredAt
    })
    currentEffects.push(record)
    createdEffects.push(record)
    return record
  }
  const state = create('STATE', effects.stateEffect)
  const recurring = create('RECURRING', effects.recurringEffect)
  const rider = create('RIDER', linkedRiderPlan(effects.riderEffect, recurring))
  // The reactor's attack roll or spell cast uses up its grants; the mover's effects that end on
  // damage end, and its own damage triggers give it timed grants, each freeing the conditions it
  // alone held in its holder's own batch.
  const dispositions = new Map([
    [prepared.actor.id, prepared.actor.disposition],
    [prepared.target.id, prepared.target.disposition]
  ])
  const makesAttackRoll = typeof prepared.binding.actionMechanic.attackBonus === 'number'
  const reactor = actionEndedEffects({
    holderActorId: prepared.actor.id,
    held: prepared.movementTargets.get(prepared.actor.id)?.activeEffects ?? [],
    makesAttackRoll,
    castsSpell: preparedCastsSpell(prepared),
    againstEnemy: actsAgainstEnemy({
      actorId: prepared.actor.id,
      targetActorIds: [prepared.target.id],
      dispositions
    })
  })
  // A hit on one of the mover's decoys destroys it: the last ends the effect, any other spends a use.
  const decoyStrike = decoyStrikeEffects(prepared.attackDecoy, input.execution.d20?.resultPath)
  const mover = targetEndedEffects({
    holderActorId: prepared.target.id,
    held: (prepared.movementTargets.get(prepared.target.id)?.activeEffects ?? []).filter(
      ({ id }) => !reactor.consumedGrants.some((ended) => ended.id === id)
    ),
    attacked: makesAttackRoll,
    testEvidence: [input.execution.d20, input.execution.nestedD20],
    turnActorId: prepared.state.currentActorId,
    applications: [...input.execution.applications, ...effects.relationshipConditionApplications],
    damagerActorId: prepared.actor.id,
    dispositions,
    grantTriggers: prepareNativeIncomingDamageGrantTriggers({
      encounter: prepared.state,
      holder: prepared.target,
      held: prepared.targetFacts.activeEffects,
      occurrenceId: input.occurrenceId,
      commandId: input.commandId,
      ordinal: input.ordinal,
      activeEffectsByActorId
    })
  })
  const grants = incomingDamageGrantRecords({
    grants: mover.grants,
    owner,
    current: currentEffects,
    occurredAt: input.occurredAt
  })
  createdEffects.push(...grants)
  return {
    effects,
    maintainedState,
    createdEffects,
    ended: {
      consumedGrants: [
        ...reactor.consumedGrants,
        ...decoyStrike.endedGrants,
        ...mover.endedEffects
      ],
      decoyStrike,
      sourceReleases: reactor.sourceReleases,
      damageReleases: mover.releases
    },
    grantEffectTransitions: grants.flatMap(
      (grant) =>
        projectNativeActionEffectTransitions({
          state: null,
          recurring: grant,
          targetActorId: prepared.target.id
        }).activeEffectTransitions
    ),
    ...projectNativeActionEffectTransitions({
      state,
      recurring,
      rider,
      targetActorId: prepared.target.id
    })
  }
}
