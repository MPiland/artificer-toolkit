import { speedDtoSchema } from '@artificer-toolkit/schema/shared/speed'
import { lengthInFeet } from './character/characterSceneVision.js'
import {
  encounterAttackAgainstContributors,
  hasEncounterDefensiveGrants,
  withActiveGrantSpeeds,
  withHolderStateGrantSaves,
  type EncounterHolderState
} from './encounterActiveGrants.js'
import { encounterActorCannotAct } from './encounterBasicActions.js'
import { encounterConditionSpeed } from './encounterConditionMechanics.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import { snapshotStatBlock } from './encounterProjection.js'
import type { CurrentReusableDefinitionSource } from './ruleCapabilityStateService.js'

/**
 * What the target can do now: whether its System's actor-action capability is available, and
 * whether any speed it has is above 0 after its condition mechanics (a holder with no speeds is not
 * stopped by speed).
 */
export async function encounterHolderState(input: {
  target: MovementTarget
  gameSystemId: string
  definitions: CurrentReusableDefinitionSource
}): Promise<EncounterHolderState> {
  const { target } = input
  const speeds =
    target.actor.kind === 'CHARACTER'
      ? (target.effectiveRulePolicyOutput?.movement.speeds ?? [])
      : target.actor.kind === 'CREATURE'
        ? withActiveGrantSpeeds(snapshotStatBlock(target.actor)?.speeds ?? [], target.activeEffects)
        : []
  const feet = speeds.flatMap((entry: unknown) => {
    const speed = speedDtoSchema.safeParse(entry)
    return speed.success
      ? [
          encounterConditionSpeed({
            mechanics: target.conditionMechanics,
            speed: lengthInFeet(speed.data) ?? 0
          })
        ]
      : []
  })
  return {
    canAct: !(await encounterActorCannotAct({
      conditionIds: target.state.conditions,
      activeEffects: target.activeEffects,
      gameSystemId: input.gameSystemId,
      definitions: input.definitions
    })),
    speedAboveZero: !feet.length || feet.some((value) => value > 0)
  }
}

/**
 * Applies the target's own defensive grants (Dodge) to its target facts: the attack-roll
 * contributors attacks against it gain, and the saving-throw advantage or disadvantage its
 * holder-state-restricted grants give. Grants whose restrictions do not hold now (the holder can't
 * act or its speed is 0) apply nothing. Whether the holder sees its attacker is decided per attack
 * by `prepareEncounterActionMechanics` (`loadAttackPerception`); flows that do not load perception
 * keep the contributors.
 */
export async function withEncounterHolderDefense<T extends MovementTarget>(input: {
  target: T
  gameSystemId: string
  definitions: CurrentReusableDefinitionSource
}): Promise<T> {
  const { target } = input
  if (!hasEncounterDefensiveGrants(target.activeEffects)) return target
  const holderState = await encounterHolderState(input)
  const savingThrowDefinitions = target.targetDerivedFacts.savingThrowDefinitions
  return {
    ...target,
    attackAgainstContributors: encounterAttackAgainstContributors(
      target.actor.id,
      target.activeEffects,
      holderState
    ),
    targetDerivedFacts: {
      ...target.targetDerivedFacts,
      ...(Array.isArray(savingThrowDefinitions)
        ? {
            savingThrowDefinitions: withHolderStateGrantSaves(
              savingThrowDefinitions,
              target.actor.id,
              target.activeEffects,
              holderState
            )
          }
        : {})
    }
  }
}
