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
import {
  attackHitDamageTypeIds,
  discoverAttackReactionActions
} from '@artificer-toolkit/rules-runtime/encounterAttackReactionDiscovery'
import { advanceNativeActionGraphs } from '@artificer-toolkit/rules-runtime/encounterActionExecution'
import { prepareNativeActionEffectsPlan } from '@artificer-toolkit/rules-runtime/encounterActionEffects'
import type { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { StaleCharacterActionError } from '@artificer-toolkit/rules-runtime/encounterErrors'
import { ASSISTED_REACTION_CHOICE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/encounterMovementReactionDecision'
import {
  encounterReactionEffectId,
  type EncounterAttackReactionCandidate
} from '@artificer-toolkit/rules-runtime/encounterReactionChoice'
import { createReactionChoiceDefinition } from '@artificer-toolkit/rules-runtime/reactionChoiceDefinition'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'

import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
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
 * The reactions the attacked Character may use against this attack, each one it holds and can afford
 * now, by action id. They are offered together as a menu (a Character has one reaction a round); a
 * decided offer names the reaction it answers (`answering`) so that one is found again, whatever the
 * hit's severity then. A creature that attacks itself, a defeated Character (D63) and one with its
 * reactions suppressed (D99) answer nothing.
 */
export function discoverNativeAttackReaction(input: {
  state: EncounterRunState
  attack: Pick<Prepared, 'actor' | 'target' | 'movementTargets' | 'source'>
  prepareReaction(actionId: string): Promise<Prepared>
  capture: (
    request: LiveSessionEncounterRulesRequest
  ) => ReturnType<LiveCaptureReads['encounterRules']>
}) {
  return async (
    hit: { critical: boolean } | { answering: string }
  ): Promise<readonly NativeAttackReaction[]> => {
    const { actor, target, movementTargets } = input.attack
    const reactor = movementTargets.get(target.id)
    if (
      target.kind !== 'CHARACTER' ||
      target.id === actor.id ||
      !reactor ||
      isEncounterActorDefeated(target, deadCharacterIdsOfTargets(movementTargets.values()))
    )
      return []
    const { source } = input.attack
    const hitDamageTypeIds = attackHitDamageTypeIds(
      source.kind === 'CHARACTER_ACTION'
        ? source.candidate.mechanicFacts
        : source.capability.mechanicFacts,
      'answering' in hit || hit.critical
    )
    const reactions: NativeAttackReaction[] = []
    for (const { actionId, trigger } of discoverAttackReactionActions(reactor, hitDamageTypeIds)) {
      if ('answering' in hit && actionId !== hit.answering) continue
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
      reactions.push({
        prepared,
        economy,
        candidate: {
          trigger,
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
          choiceGraph: createReactionChoiceDefinition({
            definitionId: ASSISTED_REACTION_CHOICE_DEFINITION_ID,
            gameSystemId: input.state.gameSystemId
          })
        }
      })
    }
    return reactions
  }
}

const unsupportedReaction = (message: string) =>
  new LiveSessionDomainRejectionError(422, {
    code: 'DOMAIN_REJECTED',
    reason: 'REACTION_UNSUPPORTED',
    message
  })

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
  activeEffectsByActorId: Map<string, ActiveRuleEffectRecord[]>
  prepareAttack(movementTargets: MovementTargets): Promise<Prepared>
  loadTarget(
    actor: EncounterRunActorState,
    activeEffectsByActorId: Map<string, ActiveRuleEffectRecord[]>
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
    throw unsupportedReaction('A reaction that needs rolls cannot answer an attack.')
  const effects = prepareNativeActionEffectsPlan({
    prepared,
    execution,
    occurrenceId: input.occurrenceId,
    commandId: input.commandId,
    activeEffectsByActorId: input.activeEffectsByActorId
  })
  if (effects.stateEffect || !effects.recurringEffect || effects.maintenance)
    throw unsupportedReaction('A reaction must create exactly one effect on its reactor.')
  const reactorId = prepared.target.id
  const held = input.activeEffectsByActorId.get(reactorId) ?? []
  const pending = prepareActiveRuleEffectRecord({
    id: encounterReactionEffectId(input),
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
  return {
    execution,
    effects,
    reactionEffect: { id: pending.id, plan: effects.recurringEffect },
    adjustedBinding: adjustedAttack.binding
  }
}
