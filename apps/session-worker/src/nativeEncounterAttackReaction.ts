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
  encounterReactorCandidates
} from '@artificer-toolkit/rules-runtime/encounterReactors'
import { discoverEncounterEventHooks } from '@artificer-toolkit/rules-runtime/events/encounterEventHooks'
import { advanceNativeActionGraphs } from '@artificer-toolkit/rules-runtime/encounterActionExecution'
import { prepareNativeActionEffectsPlan } from '@artificer-toolkit/rules-runtime/encounterActionEffects'
import type { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { StaleCharacterActionError } from '@artificer-toolkit/rules-runtime/encounterErrors'
import {
  encounterReactionEffectId,
  type EncounterAttackReactionCandidate
} from '@artificer-toolkit/rules-runtime/encounterReactionChoice'
import { isInstalledMeleeAttackTrigger } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import type { CompiledSpell } from '@artificer-toolkit/shared/subjects/compilers'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'

import { evaluateNativeLiveActionEconomy } from './nativeEncounterActionEconomy.js'
import type { LiveCaptureReads } from './nativeEncounterReads.js'
import { nativeEffectOwner } from './nativeEncounterSettlement.js'
import {
  nativeReactionCandidate,
  unsupportedReaction,
  type NativeReaction
} from './nativeEncounterReactionCandidate.js'
import type { prepareNativeLiveMovementTarget } from './nativeEncounterTargets.js'

type Prepared = Awaited<ReturnType<typeof prepareEncounterActionMechanics>>
type MovementTargets = Prepared['movementTargets']

/** A reaction its holder could use against the attack being resolved, prepared as it stands now. */
export type NativeAttackReaction = NativeReaction<EncounterAttackReactionCandidate> & {
  /** The damage types that triggered it, which its effect may bind (none for an attack reaction). */
  triggerDamageTypeIds: readonly string[]
}

/**
 * The reactions the attacked Character or Creature may use against this attack, each one it holds and
 * can afford now, by action id. They are offered together as a menu (a creature has one reaction a
 * round); a decided offer names the reaction it answers (`answering`) so that one is found again, on
 * the same severity of hit it was offered for. A creature that attacks itself, a defeated one (D63) and
 * one with its reactions suppressed (D99) answer nothing. Whether the reactor sees the attacker is read
 * from the attack's own perception; an attack that reads none counts as seen.
 */
export function discoverNativeAttackReaction(input: {
  state: EncounterRunState
  attack: Pick<Prepared, 'actor' | 'target' | 'movementTargets' | 'source' | 'attackSight'>
  system: SystemAuthoredDto
  /** The Run's pinned Spells (D163). */
  spells: ReadonlyMap<string, CompiledSpell>
  prepareReaction(actionId: string): Promise<Prepared>
  /** Creatures whose reaction this action already spent (a failed counter), though the run still shows it unspent. */
  reactionSpentActorIds: readonly string[]
  capture: (
    request: LiveSessionEncounterRulesRequest
  ) => ReturnType<LiveCaptureReads['encounterRules']>
}) {
  return async (hit: {
    critical: boolean
    answering?: string
  }): Promise<readonly NativeAttackReaction[]> => {
    const { actor, target, movementTargets } = input.attack
    const reactor = movementTargets.get(target.id)
    if (
      target.id === actor.id ||
      input.reactionSpentActorIds.includes(target.id) ||
      !reactor ||
      isEncounterActorDefeated(target, deadCharacterIdsOfTargets(movementTargets.values()))
    )
      return []
    const { source, attackSight } = input.attack
    const attackFacts =
      source.kind === 'CHARACTER_ACTION'
        ? source.candidate.mechanicFacts
        : source.capability.mechanicFacts
    const reactions: NativeAttackReaction[] = []
    const { reactions: hooks } = discoverEncounterEventHooks({
      reactions: encounterReactorCandidates({
        actor: target,
        target: reactor,
        system: input.system,
        spells: input.spells
      }),
      events: [
        {
          kind: 'HIT_BY_ATTACK',
          damageTypeIds: attackHitDamageTypeIds(attackFacts, hit.critical),
          melee: isInstalledMeleeAttackTrigger(
            input.state.gameSystemId,
            attackFacts.invocation.triggerCode
          ),
          attackerSeen: attackSight?.actual.targetSeesAttacker !== 'UNSEEN'
        }
      ]
    })
    for (const {
      reaction: { actionId },
      trigger,
      triggerDamageTypeIds
    } of hooks) {
      if (hit.answering !== undefined && actionId !== hit.answering) continue
      const prepared = await input.prepareReaction(actionId).catch((error: unknown) => {
        // A reaction its holder cannot pay for (no slot, not prepared) is simply not offered.
        if (error instanceof StaleCharacterActionError) return null
        throw error
      })
      if (
        !prepared ||
        (prepared.source.kind !== 'CHARACTER_ACTION' && prepared.source.kind !== 'CREATURE')
      )
        continue
      // A reaction's receipt carries no pool or charge spend, so one paid from either would never use it up.
      if (
        prepared.characterActionState?.resourceConsumption ||
        (prepared.source.kind === 'CREATURE' && prepared.source.capability.featureResourceUse)
      )
        continue
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
        triggerDamageTypeIds,
        candidate: nativeReactionCandidate({
          trigger,
          reactorActorId: target.id,
          source: prepared.source,
          actionId,
          consumption: economy.consumption,
          gameSystemId: input.state.gameSystemId
        })
      })
    }
    return reactions
  }
}

/**
 * Runs a used reaction (to an attack, or to being chosen as a cast's target) and works out the action
 * it answered once the reaction's effect holds: the effect plan to settle with the outcome, and the
 * action's binding against the reactor's facts as that effect leaves them. Nothing is stored; the
 * commit settles the plan.
 */
export async function applyNativeReactionEffect(input: {
  reaction: Pick<NativeAttackReaction, 'prepared' | 'triggerDamageTypeIds'>
  runtime: RulesRuntimeService
  occurrenceId: string
  commandId: string
  /** Names the reactor in the effect id when several creatures react to one command. */
  reactorActorId?: string
  occurredAt: string
  activeEffectsByActorId: Map<string, ActiveRuleEffectRecord[]>
  /** Re-prepares the answered action; the reactor's target as the reaction's effect leaves it is given too. */
  prepareAttack(
    movementTargets: MovementTargets,
    adjustedTarget: Awaited<ReturnType<typeof prepareNativeLiveMovementTarget>>['target']
  ): Promise<Prepared>
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
    activeEffectsByActorId: input.activeEffectsByActorId,
    trigger: { damageTypeIds: input.reaction.triggerDamageTypeIds }
  })
  if (
    effects.stateEffect ||
    !effects.recurringEffect ||
    effects.riderEffects.some(Boolean) ||
    effects.maintenance
  )
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
    new Map(prepared.movementTargets).set(reactorId, adjustedTarget),
    adjustedTarget
  )
  return {
    execution,
    effects,
    reactionEffect: { id: pending.id, plan: effects.recurringEffect },
    pendingEffect: pending,
    adjustedBinding: adjustedAttack.binding
  }
}
