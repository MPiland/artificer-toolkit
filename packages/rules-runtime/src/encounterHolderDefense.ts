import { heldConditionIds } from './encounterInnateConditions.js'
import {
  EQUIPMENT_PROPERTY_CODE,
  resolveHandOccupancy,
  type HandOccupancyItem
} from '@artificer-toolkit/shared/core'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  encounterAttackAgainstContributors,
  encounterSourceSightSaveGrants,
  hasEncounterDefensiveGrants,
  hasFeatureHolderStateSkillGrants,
  hasFeatureAttacksAgainstGrants,
  holderStateRestrictionsHold,
  withActiveGrantSpeeds,
  withHolderStateGrantSaves,
  type EncounterHolderState
} from './encounterActiveGrants.js'
import { snapshotCreatureTypeId } from './encounterActorState.js'
import { encounterActorCannotAct } from './encounterBasicActions.js'
import { encounterConditionSpeed } from './encounterConditionMechanics.js'
import { snapshotCreatureEquipmentItems } from './encounterCreatureEquipmentSources.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import { encounterSourceHandHolds } from './encounterRelationshipActionFacts.js'
import { snapshotStatBlock } from './encounterProjection.js'
import type { CurrentReusableDefinitionSource } from './ruleCapabilityStateService.js'
import { resolveSpeedsFeet } from './walkingSpeed.js'

/**
 * What the target is (its kind and creature type) and can do now: whether its System's actor-action capability is available, and
 * whether any speed it has is above 0 after its condition mechanics (a holder with no speeds is not
 * stopped by speed), and whether a hand is free once each creature it holds by hand fills one.
 */
export async function encounterHolderState(input: {
  target: MovementTarget
  gameSystemId: string
  definitions: CurrentReusableDefinitionSource
  /** The System speed vocabulary every holder speed, granted or stored, must belong to. */
  speedDefinitions: readonly { id: string }[]
  /** Every Run actor's active effects: the creatures the holder holds keep their hold effects. */
  runEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
  /** Reads the feet the holder has moved this turn (0 off its turn); called once per state. */
  readTurnMovedFeet: () => Promise<number>
}): Promise<EncounterHolderState> {
  const { target } = input
  const speeds =
    target.actor.kind === 'CHARACTER'
      ? (target.effectiveRulePolicyOutput?.movement.speeds ?? [])
      : target.actor.kind === 'CREATURE'
        ? withActiveGrantSpeeds(snapshotStatBlock(target.actor)?.speeds ?? [], target.activeEffects)
        : []
  const feet = resolveSpeedsFeet(speeds, input.speedDefinitions).map(({ feet: speedFeet }) =>
    encounterConditionSpeed({ mechanics: target.conditionMechanics, speed: speedFeet })
  )
  const creatureTypeId = snapshotCreatureTypeId(target.actor)
  const items = encounterActorHeldItems(target)
  const holds = encounterSourceHandHolds(input.runEffectsByActorId, target.actor.id)
  const freeHand = resolveHandOccupancy(items).emptyHands > holds
  return {
    kind: target.actor.kind,
    creatureTypeIds: creatureTypeId === null ? [] : [creatureTypeId],
    canAct: !(await encounterActorCannotAct({
      conditionIds: heldConditionIds(target),
      activeEffects: target.activeEffects,
      gameSystemId: input.gameSystemId,
      definitions: input.definitions
    })),
    speedAboveZero: !feet.length || feet.some((value) => value > 0),
    freeHand,
    turnMovement: { usedFeet: await input.readTurnMovedFeet(), speedFeet: Math.max(0, ...feet) },
    stowableHeldItemInstanceId: freeHand ? null : stowableHeldWeapon(target, items, holds)
  }
}

/** The Character's held weapon whose stow frees a hand beyond its holds: the off hand first. */
function stowableHeldWeapon(
  target: MovementTarget,
  items: readonly HandOccupancyItem[],
  holds: number
): string | null {
  if (target.actor.kind !== 'CHARACTER') return null
  const shieldIds = new Set(
    (target.characterFacts?.ruleEvaluation.facts.armorClassFacts?.equipment ?? []).flatMap(
      ({ itemInstanceId, category }) => (category === 'SHIELD' ? [itemInstanceId] : [])
    )
  )
  const { offHandId, mainHandId } = resolveHandOccupancy(items)
  return (
    [offHandId, mainHandId].find(
      (id): id is string =>
        id !== null &&
        !shieldIds.has(id) &&
        resolveHandOccupancy(items.filter((item) => item.id !== id)).emptyHands > holds
    ) ?? null
  )
}

/** What the actor's hands hold now: a Character's equipped items or a Creature's loadout. */
export function encounterActorHeldItems(
  target: Pick<MovementTarget, 'actor' | 'characterFacts'>
): HandOccupancyItem[] {
  switch (target.actor.kind) {
    case 'CHARACTER':
      return (target.characterFacts?.ruleEvaluation.facts.handFacts?.items ?? []).map(
        ({ itemInstanceId, slot, twoHanded }) => ({ id: itemInstanceId, slot, twoHanded })
      )
    case 'CREATURE':
      return snapshotCreatureEquipmentItems(target.actor).map(({ entry, source }) => ({
        id: entry.id,
        slot: entry.useState,
        twoHanded: source.compiled.properties.includes(EQUIPMENT_PROPERTY_CODE.TWO_HANDED)
      }))
    case 'CUSTOM':
      return []
  }
}

/**
 * Applies the target's own defensive grants (Dodge, a Character's Elusive) to its target facts: the attack-roll
 * contributors attacks against it gain, and the saving-throw advantage or disadvantage its
 * holder-state-restricted grants give. Grants whose restrictions do not hold now (the holder can't
 * act or its speed is 0) apply nothing. Whether the holder sees its attacker, or the source of an
 * effect it saves against, is decided per roll by `prepareEncounterActionMechanics`
 * (`loadAttackPerception`); flows that do not load perception keep the attack contributors and
 * leave the source-sight saves out. The target keeps the holder state, so a rebuilt turn target
 * re-applies its grants as they stand then (SPELLS-20 T5d).
 */
export async function withEncounterHolderDefense<T extends MovementTarget>(input: {
  target: T
  gameSystemId: string
  definitions: CurrentReusableDefinitionSource
  speedDefinitions: readonly { id: string }[]
  runEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
  readTurnMovedFeet: () => Promise<number>
}): Promise<T> {
  const { target } = input
  if (!hasHolderDefenseGrants(input.gameSystemId, target)) return target
  return withHolderDefenseGrants(input.gameSystemId, target, await encounterHolderState(input))
}

function sourceSightSaveGrants(gameSystemId: string, target: MovementTarget) {
  return encounterSourceSightSaveGrants({
    gameSystemId,
    holderActorId: target.actor.id,
    effects: target.activeEffects,
    grantFold: target.effectiveRulePolicyOutput?.grantFold ?? null
  })
}

function hasHolderDefenseGrants(gameSystemId: string, target: MovementTarget): boolean {
  return (
    hasEncounterDefensiveGrants(target.activeEffects) ||
    hasFeatureAttacksAgainstGrants(target.effectiveRulePolicyOutput?.grantFold ?? null) ||
    hasFeatureHolderStateSkillGrants(target.effectiveRulePolicyOutput?.grantFold ?? null) ||
    sourceSightSaveGrants(gameSystemId, target).length > 0
  )
}

/** Applies the target's defensive grants for `holderState`, which the target then keeps. */
export function withHolderDefenseGrants<T extends MovementTarget>(
  gameSystemId: string,
  target: T,
  holderState: EncounterHolderState
): T {
  const sourceSightSaves = sourceSightSaveGrants(gameSystemId, target)
  const savingThrowDefinitions = target.targetDerivedFacts.savingThrowDefinitions
  return {
    ...target,
    holderState,
    attackAgainstContributors: encounterAttackAgainstContributors({
      holderActorId: target.actor.id,
      effects: target.activeEffects,
      grantFold: target.effectiveRulePolicyOutput?.grantFold ?? null,
      holderState
    }),
    sourceSightSaves: sourceSightSaves
      .filter(({ restrictions }) => holderStateRestrictionsHold(restrictions, holderState))
      .map(({ abilityDefinitionId, contributor }) => ({ abilityDefinitionId, contributor })),
    targetDerivedFacts: {
      ...target.targetDerivedFacts,
      ...(Array.isArray(savingThrowDefinitions)
        ? {
            savingThrowDefinitions: withHolderStateGrantSaves(
              gameSystemId,
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
