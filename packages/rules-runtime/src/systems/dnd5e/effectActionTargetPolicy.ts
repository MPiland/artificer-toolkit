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
import {
  unsupported,
  type Dnd5eCompiledEffectActionSource,
  type TestKind
} from './effectActionContracts.js'

type Invocation = Dnd5eCompiledEffectActionSource['compiledEffect']['invocation']
type ActionInvocation = Extract<Invocation, { kind: 'ACTION' }>

/**
 * What an Effect action targets, apart from how it is taken, tested or what it leaves behind (ADR
 * 0039 decision 1):
 * - `SELF`: its user alone. A Self action with a distance range in feet carries that range as its
 *   `reachFeet`, which only its user's own teleport may read (Misty Step).
 * - `SINGLE`: one creature in range.
 * - `CHOSEN`: a resolved list of chosen creatures, inside a round area when it names one.
 * - `AREA`: the creatures a fixed-size area catches, or a hit-point pool rolled over them (Sleep).
 * `willing` marks a target that must be willing; an unwilling one only warns, so the outcome decides
 * whether it may ask for one.
 */
export type Dnd5eTargeting =
  | Readonly<{ kind: 'SELF'; reachFeet: number | null }>
  | Readonly<{ kind: 'SINGLE'; willing: boolean }>
  | Readonly<{ kind: 'CHOSEN'; willing: boolean }>
  | Readonly<{ kind: 'AREA'; pooled: boolean }>

/**
 * The targeting aspect of an activated Effect action, given the test that decides it (none for a
 * direct or check action). Excluded creature types stay on the invocation: the room warns for an
 * excluded target and the table can override it, so they never refuse an action.
 */
export function compileDnd5eTargeting(
  action: Dnd5eCompiledEffectActionSource,
  test: TestKind | null
): Dnd5eTargeting {
  const { invocation } = action.compiledEffect
  if (invocation.kind !== 'ACTION') unsupported('D&D Effect is not an activated action.')
  const { targeting, range, shape } = invocation
  switch (targeting?.selectionKind) {
    case 'AREA_CONTENTS':
      if (!isSupportedArea(invocation, action.zoneAppearSave))
        unsupported('D&D area must be one fixed-size shape the area target policy measures.')
      return { kind: 'AREA', pooled: hitPointPoolIsAuthored(targeting) }
    case 'SELF':
      return selfTargeting(invocation, test)
    case 'SINGLE_TARGET':
      // A single target on a Self range can only be its user: the single-target evaluator holds a
      // Self range to the user (Etherealness).
      if (range.rangeKind === 'SELF') return selfTargeting(invocation, test)
      if (shape) unsupported('D&D single target names no area shape.')
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
      requireTargetRange(invocation)
      return { kind: 'CHOSEN', willing: targeting.dispositionKind === 'WILLING' }
    }
    default:
      unsupported('D&D action targeting is not a supported selection.')
  }
}

function selfTargeting(invocation: ActionInvocation, test: TestKind | null): Dnd5eTargeting {
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
  range: ActionInvocation['range']
): range is Extract<ActionInvocation['range'], { rangeKind: 'DISTANCE' }> {
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
function requireTargetRange(invocation: ActionInvocation): void {
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
 * An AREA_CONTENTS action over a fixed-size area: a save action, or a hit-point pool action (Sleep)
 * that rolls a pool and tests no one. Either may filter by creature type: the area still catches a
 * creature of a type it has no effect on, which takes no save. Either a sphere, cylinder, circle or cube
 * centered on a point within a distance (or unlimited), or a cone, line or cube that extends from
 * the caster (a Self range), or no shape at all on a Self range (the caster's own space). Walls,
 * domes, a Self sphere, Touch origins and breakpoint-scaled sizes stay refused. The area only
 * decides who is caught: each caught creature runs the same
 * per-creature test plan a single target does.
 */
function isSupportedArea(invocation: ActionInvocation, overZone = false): boolean {
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
      (targeting.allowedCreatureTypeIds?.length || targeting.excludedCreatureTypeIds?.length))
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
  if (range.rangeKind !== 'SELF' && range.rangeKind !== 'UNLIMITED' && !isPlainDistance(range))
    return false
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

function isBoundedDice(value: string): boolean {
  try {
    parseBoundedDiceConfiguration(value)
    return true
  } catch {
    return false
  }
}
