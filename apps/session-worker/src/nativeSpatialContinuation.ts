import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  liveSessionMovementSettlementSchema,
  type LiveSessionMovementSettlement
} from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterActionEconomyConsumption } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import { moveEndHolds } from '@artificer-toolkit/rules-runtime/encounterEndedEffectRelease'
import { spatialEffectTransition } from '@artificer-toolkit/rules-runtime/encounterSpatialMovementEffects'
import {
  heldUntilLeavingZoneId,
  leavingAreaHolds
} from '@artificer-toolkit/rules-runtime/encounterSpatialHeldCondition'
import {
  encounterActorsAfterEscape,
  encounterEscapeEndedConditionIds
} from '@artificer-toolkit/rules-runtime/encounterEscapeCheck'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import {
  bindEncounterActorRuleOutputToFacts,
  reconcileEncounterActorRuleOutput
} from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformEncounterPolicy'
import {
  prepareEncounterSpatialMovement,
  projectPreparedSpatialMovementReceipt,
  type PreparedSpatialMovementPlan
} from '@artificer-toolkit/rules-runtime/encounterSpatialMovementPreparation'
import type {
  MovementContinuationInput,
  prepareEncounterMovementContinuation
} from '@artificer-toolkit/rules-runtime/encounterMovementContinuation'
import type { EncounterAutoRollByActorId } from '@artificer-toolkit/rules-runtime/encounterEvidenceMode'
import type { MovementConcentrationSettlement } from '@artificer-toolkit/rules-runtime/encounterMovementConcentration'
import type { MovementReactionSettlementInput } from '@artificer-toolkit/rules-runtime/encounterMovementReactionPlan'
import type { readNativeLiveMovementInputs } from './nativeEncounterMovementInputs.js'
import {
  prepareNativeLiveMovementConcentration,
  readNativeLiveMovementConcentrationState
} from './nativeEncounterMovementConcentration.js'
import type {
  NativeLiveMovementMaintenanceProjection,
  readNativeLiveMaintenanceCharacter
} from './nativeEncounterMaintenance.js'
import type { PreparedLiveCharacterSheet } from './nativeCharacterRules.js'

export type CharacterFacts = PreparedLiveCharacterSheet
export type CharacterRow = Parameters<typeof readNativeLiveMaintenanceCharacter>[0]
export type ContinuationInput = MovementContinuationInput<
  CharacterFacts,
  NativeLiveMovementMaintenanceProjection
>
export type NativeLiveMovementSettlement =
  | { kind: 'SPATIAL'; plan: PreparedSpatialMovementPlan<CharacterFacts> }
  | { kind: 'REACTION'; plan: MovementReactionSettlementInput<CharacterFacts, CharacterRow> }
  | { kind: 'CONCENTRATION'; plan: MovementConcentrationSettlement }
  | {
      kind: 'PASSAGE'
      plan: {
        actor: EncounterRunActorState
        consumption: EncounterActionEconomyConsumption
        consumedGrants: ActiveRuleEffectRecord[]
      }
    }

type ContinuationCallbacks = Parameters<
  typeof prepareEncounterMovementContinuation<
    CharacterFacts,
    NativeLiveMovementMaintenanceProjection,
    PreparedSpatialMovementPlan<CharacterFacts>,
    NativeLiveMovementSettlement
  >
>[1]

type Captured = Pick<
  Awaited<ReturnType<typeof readNativeLiveMovementInputs>>,
  'actors' | 'capture' | 'drag' | 'spatialEffects' | 'runtime'
>

/**
 * The spatial contact steps of one movement continuation: a voluntary move and the forced move an
 * action carries (D170) settle their zone contacts, and the Concentration saves they cause, through
 * these. `finalActors` collects each actor the contacts leave changed.
 */
export function nativeSpatialStepCallbacks(
  context: {
    state: EncounterRunState
    userId: string
    autoRoll: EncounterAutoRollByActorId
    carefully: boolean | undefined
    captured: Captured
    random(maximum: number): number
    finalActors: Map<string, EncounterRunActorState>
  },
  step: Pick<ContinuationInput, 'occurrenceId' | 'executionCommandId' | 'occurredAt'>
): Pick<ContinuationCallbacks, 'evaluateSpatial' | 'spatialSettlement' | 'prepareConcentration'> {
  const { state, userId, autoRoll, carefully, captured, random, finalActors } = context
  const { actors, capture, drag, spatialEffects, runtime } = captured
  return {
    evaluateSpatial: (spatial, targets, stageTerminalSettlement) =>
      prepareEncounterSpatialMovement({
        input: {
          ...spatial,
          carefully,
          draggedTokenIds: drag?.tokens.map(({ tokenId }) => tokenId),
          leavingAreaHolds: leavingAreaHolds(targets.values()),
          moveEndHolds: moveEndHolds(targets.values())
        },
        state,
        actors,
        userId,
        runtime: state.automationMode === 'MANUAL' ? undefined : runtime,
        random,
        spatialScope: {
          list: async () => spatialEffects,
          get: async (id) => spatialEffects.find((effect) => effect.id === id) ?? null
        },
        loadTargets: async (actorIds) =>
          new Map(
            actorIds.map((id) => {
              const target = targets.get(id)
              if (
                !target ||
                target.actor.id !== id ||
                target.actor.encounterId !== state.id ||
                target.actor.systemId !== state.gameSystemId ||
                !state.actorIds.includes(id)
              )
                throw new Error('Projected spatial target does not match the Run.')
              return [id, target] as const
            })
          ),
        determineConcentrationActorIds:
          state.automationMode === 'MANUAL'
            ? undefined
            : async (actorIds, selected) => {
                const active = await Promise.all(
                  actorIds.map(async (targetActorId) =>
                    (await readNativeLiveMovementConcentrationState({
                      state,
                      targetActorId,
                      targets: selected,
                      projection: spatial.maintenanceProjection,
                      capture
                    }))
                      ? targetActorId
                      : null
                  )
                )
                return new Set(active.filter((id): id is string => id !== null))
              },
        settleTerminal: async (plan) => {
          if (plan.executions.length) {
            for (const { plan: settlement } of plan.mechanicsPlan.settlements)
              finalActors.set(settlement.updatedActor.id, settlement.updatedActor)
            stageTerminalSettlement(plan)
          }
          return projectPreparedSpatialMovementReceipt(plan)
        }
      }),
    spatialSettlement: (plan) => {
      for (const { plan: settlement } of plan.mechanicsPlan.settlements)
        finalActors.set(settlement.updatedActor.id, settlement.updatedActor)
      return { kind: 'SPATIAL', plan }
    },
    prepareConcentration: async ({ executionOrdinal, ...args }) => {
      const prepared = await prepareNativeLiveMovementConcentration({
        ...args,
        state,
        userId,
        autoRoll,
        occurrenceId: step.occurrenceId,
        sourceCommandId: step.executionCommandId,
        occurredAt: step.occurredAt,
        source: { kind: 'SPATIAL', executionOrdinal },
        capture,
        runtime,
        random
      })
      for (const target of prepared.targets.values()) finalActors.set(target.actor.id, target.actor)
      return {
        ...prepared,
        settlements: prepared.settlements.map((plan) => ({
          kind: 'CONCENTRATION' as const,
          plan
        }))
      }
    }
  }
}

/**
 * The receipts a continuation's settlements persist as, the releases a terminal move owes (a zone
 * left, a held effect ended by moving) and the rule output of the actors it leaves; `finalActors`
 * gathers each actor those releases change.
 */
export function nativeMovementSettlementInputs(input: {
  state: EncounterRunState
  actors: readonly EncounterRunActorState[]
  targets: ReadonlyMap<string, { activeEffects: ActiveRuleEffectRecord[] }>
  finalActors: Map<string, EncounterRunActorState>
  planned: {
    outcome: SceneSpatialPreparation['outcome']
    settlements: readonly NativeLiveMovementSettlement[]
  }
  reactionSettlements?: ReadonlyMap<
    MovementReactionSettlementInput<CharacterFacts, CharacterRow>,
    Extract<LiveSessionMovementSettlement, { kind: 'REACTION' }>
  >
}) {
  const { state, actors, targets, finalActors, planned } = input
  const settlementInputs = planned.settlements.map((settlement): LiveSessionMovementSettlement => {
    if (settlement.kind === 'CONCENTRATION')
      return liveSessionMovementSettlementSchema.parse({
        kind: settlement.plan.kind === 'END' ? 'CONCENTRATION_END' : 'CONCENTRATION',
        execution: settlement.plan.execution
      })
    if (settlement.kind === 'REACTION') {
      const recorded = input.reactionSettlements?.get(settlement.plan)
      if (!recorded) throw new Error('Prepared movement reaction settlement is missing.')
      return liveSessionMovementSettlementSchema.parse(recorded)
    }
    if (settlement.kind === 'PASSAGE')
      return liveSessionMovementSettlementSchema.parse({
        kind: 'PASSAGE',
        actorId: settlement.plan.actor.id,
        consumption: settlement.plan.consumption,
        consumedGrants: settlement.plan.consumedGrants
      })
    return liveSessionMovementSettlementSchema.parse({
      kind: 'SPATIAL',
      executions: settlement.plan.executions,
      transitions: [
        ...new Set(settlement.plan.executions.map((entry) => entry.candidate.candidate.effectId))
      ]
        .sort()
        .map((effectId) => {
          const effect = settlement.plan.effects.get(effectId)
          if (!effect) throw new Error('Prepared movement spatial effect is missing.')
          return { effectId, transition: spatialEffectTransition(effect) }
        })
    })
  })
  // A creature that left a zone holding it until it leaves, or that moved while holding an effect
  // until it moved, is released after every other contact.
  const outcome = planned.outcome.kind === 'TERMINAL' ? planned.outcome : null
  const releases = [
    ...(outcome?.areaDepartures ?? []).map((departure) => ({
      kind: 'AREA_DEPARTURE' as const,
      key: { departure },
      holderActorId: departure.holderActorId,
      isHeld: (effect: ActiveRuleEffectRecord) =>
        heldUntilLeavingZoneId(effect) === departure.zoneEffectId
    })),
    ...(outcome?.moveEnds ?? []).map((moveEnd) => ({
      kind: 'MOVE_END' as const,
      key: { moveEnd },
      holderActorId: moveEnd.holderActorId,
      isHeld: (effect: ActiveRuleEffectRecord) => effect.id === moveEnd.effectId
    }))
  ]
  for (const release of releases) {
    const holderEffects = targets.get(release.holderActorId)?.activeEffects
    const endedEffect = holderEffects?.find(release.isHeld)
    if (!holderEffects || !endedEffect) throw new Error('Movement release holder is missing.')
    settlementInputs.push(
      liveSessionMovementSettlementSchema.parse({
        kind: release.kind,
        ...release.key,
        endedEffect,
        removedConditionIds: encounterEscapeEndedConditionIds(holderEffects, endedEffect.id)
      })
    )
    for (const actor of encounterActorsAfterEscape({
      encounterId: state.id,
      actors: actors.map((entry) => finalActors.get(entry.id)!),
      holderId: release.holderActorId,
      holderEffects,
      activeEffectId: endedEffect.id
    }))
      finalActors.set(actor.id, actor)
  }
  const ruleFacts =
    planned.outcome.kind === 'TERMINAL' || settlementInputs.length
      ? buildEncounterActorRuleFacts({
          actors: actors.map((actor) => finalActors.get(actor.id)!)
        })
      : null
  const rules = ruleFacts
    ? bindEncounterActorRuleOutputToFacts(
        reconcileEncounterActorRuleOutput(
          evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts: ruleFacts }),
          ruleFacts
        ),
        ruleFacts
      )
    : null
  return { settlementInputs, rules }
}
