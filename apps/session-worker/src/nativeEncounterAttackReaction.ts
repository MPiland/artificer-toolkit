import type { LiveSessionEncounterRulesRequest } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { prepareActiveRuleEffectRecord } from '@artificer-toolkit/rules-runtime/activeRuleEffectRecords'
import {
  deadCharacterIdsOfTargets,
  isEncounterActorDefeated
} from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { discoverAttackReactionActions } from '@artificer-toolkit/rules-runtime/encounterAttackReactionDiscovery'
import { advanceNativeActionGraphs } from '@artificer-toolkit/rules-runtime/encounterActionExecution'
import { prepareNativeActionEffectsPlan } from '@artificer-toolkit/rules-runtime/encounterActionEffects'
import type { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { StaleCharacterActionError } from '@artificer-toolkit/rules-runtime/encounterErrors'
import { ASSISTED_MOVEMENT_REACTION_CHOICE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/encounterMovementReactionDecision'
import type { EncounterAttackReactionCandidate } from '@artificer-toolkit/rules-runtime/encounterReactionChoice'
import { createMovementReactionChoiceDefinition } from '@artificer-toolkit/rules-runtime/movementReactionChoice'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'

import { evaluateNativeLiveActionEconomy } from './nativeEncounterActionEconomy.js'
import type { LiveCaptureReads } from './nativeEncounterReads.js'
import { nativeEffectOwner } from './nativeEncounterSettlement.js'
import type { prepareNativeLiveMovementTarget } from './nativeEncounterTargets.js'

type Prepared = Awaited<ReturnType<typeof prepareEncounterActionMechanics>>
type MovementTargets = Prepared['movementTargets']

/** A reaction its holder could use against the attack being resolved, prepared as it stands now. */
export type NativeAttackReaction = {
  candidate: EncounterAttackReactionCandidate
  /** The reaction action prepared against its reactor's own facts. */
  prepared: Prepared
  economy: NonNullable<Awaited<ReturnType<typeof evaluateNativeLiveActionEconomy>>['economy']>
}

/**
 * The reaction the attacked Character may use against this attack, if it holds one it can afford now.
 * Only the first eligible reaction is offered. A creature that attacks itself, a defeated Character
 * (D63) and one with its reactions suppressed (D99) answer nothing.
 */
export function discoverNativeAttackReaction(input: {
  state: EncounterRunState
  attack: Pick<Prepared, 'actor' | 'target' | 'movementTargets'>
  prepareReaction(actionId: string): Promise<Prepared>
  capture: (request: LiveSessionEncounterRulesRequest) => ReturnType<LiveCaptureReads['encounterRules']>
}) {
  return async (): Promise<NativeAttackReaction | null> => {
    const { actor, target, movementTargets } = input.attack
    const reactor = movementTargets.get(target.id)
    if (
      target.kind !== 'CHARACTER' ||
      target.id === actor.id ||
      !reactor ||
      isEncounterActorDefeated(target, deadCharacterIdsOfTargets(movementTargets.values()))
    )
      return null
    for (const { actionId } of discoverAttackReactionActions(reactor)) {
      const prepared = await input.prepareReaction(actionId).catch((error: unknown) => {
        // A reaction its holder cannot pay for (no slot, not prepared) is simply not offered.
        if (error instanceof StaleCharacterActionError) return null
        throw error
      })
      if (!prepared || prepared.source.kind !== 'CHARACTER_ACTION') continue
      const { economy, suppressed } = await evaluateNativeLiveActionEconomy({
        prepared,
        state: input.state,
        actionId,
        sourceTarget: reactor,
        targetIds: [target.id],
        capture: input.capture
      })
      if (!economy?.available || suppressed) continue
      return {
        prepared,
        economy,
        candidate: {
          reactorActorId: target.id,
          characterId: prepared.source.characterId,
          characterStreamVersion: prepared.source.characterStreamVersion,
          actionId,
          effectId: prepared.source.candidate.effectId,
          allowance: {
            definitionId: economy.consumption.definitionId,
            beforeUsed: economy.consumption.beforeUsed,
            maximum: economy.consumption.maximum
          },
          choiceGraph: createMovementReactionChoiceDefinition({
            definitionId: ASSISTED_MOVEMENT_REACTION_CHOICE_DEFINITION_ID,
            gameSystemId: input.state.gameSystemId
          })
        }
      }
    }
    return null
  }
}

/**
 * Runs a used reaction and works out the attack it answered once the reaction's effect holds: the
 * effect plan to settle with the outcome, and the attack's binding against the reactor's facts as that
 * effect leaves them. Nothing is stored; the commit settles the plan.
 */
export async function applyNativeAttackReaction(input: {
  reaction: NativeAttackReaction
  runtime: RulesRuntimeService
  occurrenceId: string
  commandId: string
  occurredAt: string
  activeEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
  prepareAttack(movementTargets: MovementTargets): Promise<Prepared>
  loadTarget(
    actor: EncounterRunActorState,
    activeEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
  ): Promise<Awaited<ReturnType<typeof prepareNativeLiveMovementTarget>>['target']>
}) {
  const { prepared } = input.reaction
  const execution = await advanceNativeActionGraphs({
    runtime: input.runtime,
    adapter: prepared.adapter,
    plan: prepared.plan,
    occurrenceId: input.occurrenceId,
    // A reaction that asks for dice is not resolved inline; it pauses and is refused below.
    autoRoll: { SOURCE: false, TARGET: false },
    binding: prepared.binding,
    afterTest: async () => undefined
  })
  if (execution.kind !== 'COMPLETE')
    throw new Error('A reaction that needs rolls cannot answer an attack.')
  const effects = prepareNativeActionEffectsPlan({
    prepared,
    execution,
    occurrenceId: input.occurrenceId,
    commandId: input.commandId,
    activeEffectsByActorId: input.activeEffectsByActorId
  })
  if (effects.stateEffect || !effects.recurringEffect || effects.maintenance)
    throw new Error('The reaction must create exactly one effect on its reactor.')
  const reactorId = prepared.target.id
  const held = input.activeEffectsByActorId.get(reactorId) ?? []
  const pending = prepareActiveRuleEffectRecord({
    id: crypto.randomUUID(),
    owner: nativeEffectOwner(prepared.target, prepared.state.id),
    definition: effects.recurringEffect.definition,
    lifecycle: effects.recurringEffect.lifecycle,
    currentEffects: [...held],
    occurredAt: input.occurredAt
  })
  const adjustedTarget = await input.loadTarget(
    prepared.target,
    new Map(input.activeEffectsByActorId).set(reactorId, [...held, pending])
  )
  const adjustedAttack = await input.prepareAttack(
    new Map(prepared.movementTargets).set(reactorId, adjustedTarget)
  )
  return { execution, effects, adjustedBinding: adjustedAttack.binding }
}
