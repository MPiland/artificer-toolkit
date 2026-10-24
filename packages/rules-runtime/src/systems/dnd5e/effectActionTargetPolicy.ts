import {
  chosenCreaturesAreaSupported,
  chosenCreaturesListResolves,
  encounterAreaTargetKind,
  hitPointPoolDiceOptions,
  hitPointPoolIsAuthored
} from '../../encounterAreaAction.js'
import { shapeExtent } from '../../shapeMeasurement.js'
import { dnd5eAttackKind, isDnd5eMeleeAttackKind } from './attackKind.js'
import { parseBoundedDiceConfiguration } from './effectActionScalingFacts.js'
import type { Dnd5eCompiledEffectActionSource } from './effectActionContracts.js'

/**
 * An AREA_CONTENTS action over a fixed-size area: a save action, or a hit-point pool action (Sleep)
 * that rolls a pool and tests no one. Either may filter by creature type: the area still catches a
 * creature of a type it has no effect on, which takes no save. Either a sphere, cylinder, circle or cube
 * centered on a point within a distance (or unlimited), or a cone, line or cube that extends from
 * the caster (a Self range), or no shape at all on a Self range (the caster's own space). Walls,
 * domes, a Self sphere, Touch origins and breakpoint-scaled sizes stay refused. The area only
 * decides who is caught: each caught creature runs the same
 * per-creature test plan a single target does.
 */
export function isSupportedArea(
  invocation: Dnd5eCompiledEffectActionSource['compiledEffect']['invocation'],
  overZone = false
): boolean {
  if (invocation.kind !== 'ACTION') return false
  const { shape, targeting, range } = invocation
  if (targeting?.selectionKind !== 'AREA_CONTENTS') return false
  const pooled = hitPointPoolIsAuthored(targeting)
  if (
    targeting.dispositionKind !== 'ANY' ||
    (pooled
      ? invocation.triggerCode !== 'ACTIVATED' ||
        !hitPointPoolDiceOptions(targeting).every(isBoundedDice)
      : invocation.triggerCode !== 'SAVING_THROW') ||
    // A zone's later entry saves do not filter by creature type, so its appear save may not either.
    (overZone &&
      (targeting.allowedCreatureTypeIds?.length || targeting.excludedCreatureTypeIds?.length)) ||
    invocation.activation.code !== 'ACTION' ||
    invocation.activation.amount !== 1
  )
    return false
  // A Self action that names no shape reaches the creatures in the caster's own space.
  if (!shape) return range.rangeKind === 'SELF' && !overZone
  // A wall is drawn only as a zone (D154): only the save made as the zone appears is tested over it.
  if (
    !(overZone && shape.shapeKind === 'WALL') &&
    encounterAreaTargetKind(range.rangeKind, shape.shapeKind) === null
  )
    return false
  if (range.rangeKind !== 'SELF' && range.rangeKind !== 'UNLIMITED') {
    if (
      range.rangeKind !== 'DISTANCE' ||
      !Number.isSafeInteger(range.amount) ||
      range.amount < 1 ||
      range.longAmount !== undefined
    )
      return false
  }
  const size = shapeExtent(shape)
  return (
    size !== null &&
    size.scaling === undefined &&
    size.amount > 0 &&
    !(
      shape.shapeKind === 'LINE' &&
      shape.width !== undefined &&
      (shape.width.scaling !== undefined || !(shape.width.amount > 0))
    ) &&
    !(shape.shapeKind === 'CYLINDER' && shape.height.scaling !== undefined)
  )
}

/** A Legendary Action option is free; the Feature charge it spends is its cost. */
export function isChargedFreeActivation(
  invocation: Extract<
    Dnd5eCompiledEffectActionSource['compiledEffect']['invocation'],
    { activation: unknown }
  >
): boolean {
  return invocation.activation.code === 'FREE' && invocation.resourceUse !== undefined
}

function isBoundedDice(value: string): boolean {
  try {
    parseBoundedDiceConfiguration(value)
    return true
  } catch {
    return false
  }
}

export function isSupportedTestTargetPolicy(action: Dnd5eCompiledEffectActionSource): boolean {
  const { invocation } = action.compiledEffect
  if (invocation.kind !== 'ACTION') return false
  const { targeting } = invocation
  if (targeting?.selectionKind === 'AREA_CONTENTS')
    return isSupportedArea(invocation, action.zoneAppearSave)
  // A resolved list of chosen creatures runs the same test on each. A save list (Acid Splash) tests
  // each creature once: a creature named again would save twice, so a repeating save list is
  // refused. An attack list (Scorching Ray) is one roll per ray, so it may aim several rays at one
  // creature; one that names each creature once may be bounded by a round area at a point
  // (Volley, D156), which a repeating list is not.
  if (targeting?.selectionKind === 'CHOSEN_CREATURES') {
    const attacks = dnd5eAttackKind(invocation.triggerCode) !== null
    if (
      targeting.dispositionKind !== 'ANY' ||
      (!attacks &&
        (targeting.allowRepeatedTargets === true || invocation.triggerCode !== 'SAVING_THROW')) ||
      !chosenCreaturesListResolves(targeting) ||
      (invocation.shape !== undefined &&
        (targeting.allowRepeatedTargets === true ||
          !chosenCreaturesAreaSupported(invocation.range.rangeKind, invocation.shape.shapeKind)))
    )
      return false
  } else if (targeting?.selectionKind === 'SELF') {
    // A save its user makes (Contact Other Plane) tests the user alone: a Self range, no area.
    return (
      invocation.triggerCode === 'SAVING_THROW' &&
      invocation.range.rangeKind === 'SELF' &&
      !invocation.shape &&
      (invocation.activation.code === 'ACTION' || invocation.activation.code === 'BONUS_ACTION')
    )
  } else if (
    invocation.shape ||
    targeting?.selectionKind !== 'SINGLE_TARGET' ||
    targeting.dispositionKind !== 'ANY'
  )
    return false
  const attackKind = dnd5eAttackKind(invocation.triggerCode)
  // Only a ranged weapon attack has a long range ("range 80/320 ft.").
  if (
    invocation.range.rangeKind === 'DISTANCE' &&
    invocation.range.longAmount !== undefined &&
    (attackKind !== 'RANGED' || !Number.isSafeInteger(invocation.range.longAmount))
  )
    return false
  if (
    invocation.activation.code === 'ACTION' ||
    invocation.activation.code === 'BONUS_ACTION' ||
    isChargedFreeActivation(invocation)
  ) {
    // A melee attack may reach 0 ft.: a swarm's "one target in the swarm's space".
    const minimumDistance = isDnd5eMeleeAttackKind(attackKind) ? 0 : 1
    return (
      invocation.range.rangeKind === 'UNLIMITED' ||
      invocation.range.rangeKind === 'TOUCH' ||
      (invocation.range.rangeKind === 'DISTANCE' &&
        Number.isSafeInteger(invocation.range.amount) &&
        invocation.range.amount >= minimumDistance)
    )
  }
  return (
    invocation.activation.code === 'REACTION' &&
    invocation.range.rangeKind === 'DISTANCE' &&
    Number.isSafeInteger(invocation.range.amount) &&
    invocation.range.amount > 0
  )
}

export function isSupportedTestActivation(
  invocation: Dnd5eCompiledEffectActionSource['compiledEffect']['invocation']
): boolean {
  if (invocation.kind !== 'ACTION') return false
  if (invocation.activation.code === 'FREE') return isChargedFreeActivation(invocation)
  if (invocation.activation.amount !== 1) return false
  if (invocation.activation.code === 'ACTION') return true
  // A save or spell attack is a bonus action as a repeat offer's charge (Heat Metal's repeated
  // damage, D166; Spiritual Weapon's attack, D190a).
  if (invocation.activation.code === 'BONUS_ACTION')
    return (
      dnd5eAttackKind(invocation.triggerCode) !== null || invocation.triggerCode === 'SAVING_THROW'
    )
  return (
    invocation.activation.code === 'REACTION' &&
    'reactionTrigger' in invocation &&
    invocation.reactionTrigger?.kind === 'MOVEMENT'
  )
}

/**
 * Whether the action's range and targeting name only its user. A removal from play on a Self range
 * (Etherealness) names its one target, which can only be its user: the single-target evaluator
 * holds a Self range to the user.
 */
export function namesOnlyItsUser(
  invocation: Dnd5eCompiledEffectActionSource['compiledEffect']['invocation'],
  removesFromPlay: boolean
): boolean {
  return (
    invocation.range.rangeKind === 'SELF' &&
    (invocation.targeting?.selectionKind === 'SELF' ||
      (invocation.targeting?.selectionKind === 'SINGLE_TARGET' && removesFromPlay))
  )
}
