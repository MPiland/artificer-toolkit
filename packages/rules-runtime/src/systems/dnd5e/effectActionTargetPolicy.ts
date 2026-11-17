import {
  chosenCreaturesAreaSupported,
  chosenCreaturesListResolves,
  encounterAreaTargetKind,
  hitPointPoolDiceOptions,
  hitPointPoolIsAuthored
} from '../../encounterAreaAction.js'
import { scaledShapeMeasurements, shapeExtent } from '../../shapeMeasurement.js'
import { dnd5eAttackKind, isDnd5eMeleeAttackKind } from './attackKind.js'
import { parseBoundedDiceConfiguration } from './effectActionScalingFacts.js'
import {
  unsupported,
  type Dnd5eActionInvocation,
  type Dnd5eCompiledEffectActionSource
} from './effectActionContracts.js'
import type { Dnd5eTestKind } from './effectActionTest.js'

/**
 * What an Effect action targets, apart from how it is taken, tested or what it leaves behind (ADR
 * 0039 decision 1):
 * - `SELF`: its user alone. A Self action with a distance range in feet carries that range as its
 *   `reachFeet`, which only its user's own teleport may read (Misty Step).
 * - `SINGLE`: one creature in range.
 * - `CHOSEN`: a resolved list of chosen creatures, inside a round area when it names one.
 * - `AREA`: the creatures a fixed-size area catches, or a hit-point pool rolled over them (Sleep).
 *   `outcomeKind` is the one outcome it may land with no test: a hit-point pool puts the creatures
 *   it covers under a timed condition, and any other area is a GM ruling on each creature it
 *   catches (Zone of Truth).
 * `willing` marks a target that must be willing; an unwilling one only warns, so the outcome decides
 * whether it may ask for one.
 */
export type Dnd5eTargeting =
  | Readonly<{ kind: 'SELF'; reachFeet: number | null }>
  | Readonly<{ kind: 'SINGLE'; willing: boolean }>
  | Readonly<{ kind: 'CHOSEN'; willing: boolean }>
  | Readonly<{ kind: 'AREA'; outcomeKind: 'CONDITION' | 'MANUAL_ADJUDICATION' }>

/**
 * The targeting aspect of an activated Effect action, given the test that decides it (see
 * `compileDnd5eTest`). Excluded creature types stay on the invocation: the room warns for an
 * excluded target and the table can override it, so they never refuse an action.
 */
export function compileDnd5eTargeting(
  action: Dnd5eCompiledEffectActionSource,
  test: Dnd5eTestKind
): Dnd5eTargeting {
  const { invocation } = action.compiledEffect
  if (invocation.kind !== 'ACTION') unsupported('D&D Effect is not an activated action.')
  const { targeting, range, shape } = invocation
  switch (targeting?.selectionKind) {
    case 'AREA_CONTENTS':
      requireSupportedArea(invocation, targeting, action.zoneAppearSave === true)
      return {
        kind: 'AREA',
        outcomeKind: hitPointPoolIsAuthored(targeting) ? 'CONDITION' : 'MANUAL_ADJUDICATION'
      }
    case 'SELF':
      return selfTargeting(invocation, test)
    case 'SINGLE_TARGET':
      // A single target on a Self range can only be its user: the single-target evaluator holds a
      // Self range to the user (Etherealness).
      if (range.rangeKind === 'SELF') return selfTargeting(invocation, test)
      if (shape) unsupported('D&D single target names no area shape.')
      requireDisposition(targeting.dispositionKind)
      requireTargetRange(invocation)
      return { kind: 'SINGLE', willing: targeting.dispositionKind === 'WILLING' }
    case 'CHOSEN_CREATURES': {
      // A save list tests each creature once: a creature named again would save twice. An attack
      // list (Scorching Ray) is one roll per ray, and a list with no test resolves one outcome per
      // entry (Magic Missile's darts), so either may name a creature again, outside an area.
      const repeated = targeting.allowRepeatedTargets === true
      if (repeated && test === 'SAVE') unsupported('D&D save list must name each creature once.')
      if (!chosenCreaturesListResolves(targeting))
        unsupported('D&D chosen-creature list must resolve its cap at every cast.')
      // A list that names each creature once may be bounded by a round area at a point (Volley,
      // Mass Cure Wounds, D156).
      if (shape && (repeated || !chosenCreaturesAreaSupported(range.rangeKind, shape.shapeKind)))
        unsupported('D&D chosen-creature area must be a round area at a point.')
      requireDisposition(targeting.dispositionKind)
      // The room measures each chosen creature by distance; only a single target is held to sight.
      if (range.rangeKind === 'SIGHT')
        unsupported('D&D chosen-creature list needs a measured range, not Sight.')
      requireTargetRange(invocation)
      return { kind: 'CHOSEN', willing: targeting.dispositionKind === 'WILLING' }
    }
    case undefined:
      // An action with a Self range that names no targeting is taken on its user alone, as a single
      // target on a Self range is (Change Shape).
      if (range.rangeKind === 'SELF') return selfTargeting(invocation, test)
      unsupported('D&D action off a Self range must name its targeting.')
  }
}

/**
 * A creature target names whether it may be any creature, a willing one or a hostile one: the room
 * warns against that disposition and cannot evaluate a target without one.
 */
function requireDisposition(dispositionKind: 'ANY' | 'WILLING' | 'HOSTILE' | undefined): void {
  if (dispositionKind === undefined) unsupported('D&D creature target must name its disposition.')
}

function selfTargeting(invocation: Dnd5eActionInvocation, test: Dnd5eTestKind): Dnd5eTargeting {
  if (test === 'ATTACK') unsupported('D&D attack roll needs a target other than its user.')
  if (invocation.shape) unsupported('D&D Self target names no area shape.')
  const { range } = invocation
  if (range.rangeKind === 'SELF') return { kind: 'SELF', reachFeet: null }
  if (isPlainDistance(range) && range.unit === 'FEET')
    return { kind: 'SELF', reachFeet: range.amount }
  unsupported('D&D Self target needs a Self range, or a distance its own teleport may reach.')
}

/** A positive whole distance, with no long or close range of disadvantage. */
function isPlainDistance(
  range: Dnd5eActionInvocation['range']
): range is Extract<Dnd5eActionInvocation['range'], { rangeKind: 'DISTANCE' }> {
  return (
    range.rangeKind === 'DISTANCE' &&
    Number.isSafeInteger(range.amount) &&
    range.amount > 0 &&
    range.longAmount === undefined &&
    range.closeAmount === undefined
  )
}

/**
 * The range a creature target must be in. A distance or Touch range only warns when the target is
 * out of range (D11); a Sight range bounds no distance. Only a ranged weapon attack has a long range
 * ("range 80/320 ft."), only an attack has a close range it has disadvantage within (a Lance, D217),
 * and a melee attack may reach 0 ft. (a swarm's "one target in the swarm's space").
 */
function requireTargetRange(invocation: Dnd5eActionInvocation): void {
  const { range } = invocation
  if (range.rangeKind === 'UNLIMITED' || range.rangeKind === 'SIGHT' || range.rangeKind === 'TOUCH')
    return
  if (range.rangeKind !== 'DISTANCE')
    unsupported('D&D creature target needs a distance, Touch, Sight or unlimited range.')
  const attackKind = dnd5eAttackKind(invocation.triggerCode)
  const minimumDistance = isDnd5eMeleeAttackKind(attackKind) ? 0 : 1
  if (!Number.isSafeInteger(range.amount) || range.amount < minimumDistance)
    unsupported('D&D target distance must be a whole number of feet in reach.')
  if (
    range.longAmount !== undefined &&
    (attackKind !== 'RANGED' || !Number.isSafeInteger(range.longAmount))
  )
    unsupported('D&D long range belongs to a ranged weapon attack.')
  if (
    range.closeAmount !== undefined &&
    (attackKind === null || !Number.isSafeInteger(range.closeAmount))
  )
    unsupported('D&D close range belongs to an attack.')
}

/**
 * An AREA_CONTENTS action over a fixed-size area: a save action, a hit-point pool action (Sleep)
 * that rolls a pool and tests no one, or an area ruling that tests no one and leaves each creature it
 * catches to the GM (its outcome is checked with its result). Any of them may filter by creature type: the area still catches a
 * creature of a type it has no effect on, which takes no save. Either a sphere, cylinder, circle or cube
 * centered on a point within a distance (or unlimited, or in sight), or a cone, line or cube that
 * extends from the caster (a Self range), or no shape at all on a Self range (the caster's own
 * space). Its size may scale with the spell's cast level. Walls, domes, Touch origins and sizes
 * scaled by anything else stay refused. The area only
 * decides who is caught: each caught creature runs the same
 * per-creature test plan a single target does. Each part an area breaks refuses with its own rule.
 */
function requireSupportedArea(
  invocation: Dnd5eActionInvocation,
  targeting: Extract<
    NonNullable<Dnd5eActionInvocation['targeting']>,
    { selectionKind: 'AREA_CONTENTS' }
  >,
  overZone: boolean
): void {
  const { shape, range } = invocation
  if (targeting.dispositionKind !== 'ANY')
    unsupported('D&D area catches every creature in it: its disposition must be Any.')
  if (hitPointPoolIsAuthored(targeting)) {
    if (invocation.triggerCode !== 'ACTIVATED')
      unsupported('D&D hit-point pool tests no one: its action rolls no attack or save.')
    if (!hitPointPoolDiceOptions(targeting).every(isBoundedDice))
      unsupported('D&D hit-point pool must roll bounded dice.')
  } else if (invocation.triggerCode !== 'SAVING_THROW' && invocation.triggerCode !== 'ACTIVATED')
    unsupported(
      'D&D area with no hit-point pool tests each creature it catches with a save or not at all.'
    )
  // A zone's later entry saves do not filter by creature type, so its appear save may not either.
  if (
    overZone &&
    (targeting.allowedCreatureTypeIds?.length || targeting.excludedCreatureTypeIds?.length)
  )
    unsupported('D&D zone appear save cannot filter by creature type: its entry saves do not.')
  // A Self action that names no shape reaches the creatures in the caster's own space.
  if (!shape) {
    if (range.rangeKind === 'SELF' && !overZone) return
    unsupported("D&D area outside its user's own space must name its shape.")
  }
  // A wall is drawn only as a zone (D154): only the save made as the zone appears is tested over it.
  if (
    !(overZone && shape.shapeKind === 'WALL') &&
    encounterAreaTargetKind(range.rangeKind, shape.shapeKind) === null
  )
    unsupported('D&D area shape is not one its range places.')
  // A Sight range bounds no distance: the area is centered on any point its user can see.
  if (
    range.rangeKind !== 'SELF' &&
    range.rangeKind !== 'UNLIMITED' &&
    range.rangeKind !== 'SIGHT' &&
    !isPlainDistance(range)
  )
    unsupported('D&D area needs a Self, unlimited, Sight or plain distance range.')
  // A size scaled by the spell's cast level is the size it is at each cast (Create or Destroy
  // Water's cube), which the target policy resolves.
  const size = shapeExtent(shape)
  if (
    size === null ||
    scaledShapeMeasurements(shape).some(
      ({ scalingSource }) => scalingSource !== 'SPELL_CAST_LEVEL'
    ) ||
    !(size.amount > 0) ||
    (shape.shapeKind === 'LINE' && shape.width !== undefined && !(shape.width.amount > 0))
  )
    unsupported('D&D area size must be a positive extent, fixed or scaled by its cast level.')
}

function isBoundedDice(value: string): boolean {
  try {
    parseBoundedDiceConfiguration(value)
    return true
  } catch {
    return false
  }
}
