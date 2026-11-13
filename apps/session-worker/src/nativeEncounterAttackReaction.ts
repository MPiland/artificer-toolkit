import type { LiveSessionEncounterRulesRequest } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  deadCharacterIdsOfTargets,
  isEncounterActorDefeated
} from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import {
  attackHitDamageTypeIds,
  encounterReactorCandidates
} from '@artificer-toolkit/rules-runtime/encounterReactors'
import type { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import type { EncounterReactionCandidate } from '@artificer-toolkit/rules-runtime/encounterReactionChoice'
import {
  isInstalledMeleeAttackTrigger,
  isInstalledSpellAttackTrigger
} from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { CompiledSpell } from '@artificer-toolkit/shared/subjects/compilers'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'

import type { LiveCaptureReads } from './nativeEncounterReads.js'
import { offerNativeReactions, type NativeReaction } from './nativeEncounterReactionCandidate.js'

type Prepared = Awaited<ReturnType<typeof prepareEncounterActionMechanics>>

/** A reaction its holder could use against the attack being resolved, prepared as it stands now. */
export type NativeAttackReaction = NativeReaction<EncounterReactionCandidate> & {
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
  prepareReaction: Parameters<typeof offerNativeReactions>[0]['prepare']
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
      !reactor ||
      isEncounterActorDefeated(target, deadCharacterIdsOfTargets(movementTargets.values()))
    )
      return []
    const { source, attackSight } = input.attack
    const attackFacts =
      source.kind === 'CHARACTER_ACTION'
        ? source.candidate.mechanicFacts
        : source.capability.mechanicFacts
    return offerNativeReactions({
      state: input.state,
      reactorActorId: target.id,
      reactorTarget: reactor,
      held: encounterReactorCandidates({
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
          weapon: !isInstalledSpellAttackTrigger(
            input.state.gameSystemId,
            attackFacts.invocation.triggerCode
          ),
          attackerSeen: attackSight?.actual.targetSeesAttacker !== 'UNSEEN'
        }
      ],
      answering: hit.answering,
      prepare: input.prepareReaction,
      // A reaction's receipt carries no pool or charge spend, so one paid from either would never use it up.
      admit: (prepared, hook) =>
        hook.event !== 'HIT_BY_ATTACK' ||
        prepared.characterActionState?.resourceConsumption ||
        (prepared.source.kind === 'CREATURE' && prepared.source.capability.featureResourceUse)
          ? null
          : { triggerDamageTypeIds: hook.triggerDamageTypeIds },
      range: null,
      targetIds: [target.id],
      capture: input.capture
    })
  }
}
