import { describe, expect, it } from 'vitest'

import { actorRelationshipModuleDtoSchema } from '../effects/actorRelationship.js'
import { forcedMovementDtoSchema } from '../effects/forcedMovement.js'
import { manifestDtoSchema } from '../effects/manifest.js'
import { movementRuleDtoSchema } from '../effects/movementRule.js'
import { plantPortalDtoSchema } from '../effects/plantPortal.js'
import { treeStrideDtoSchema } from '../effects/treeStride.js'
import { AUTHORED_LENGTH_AMOUNT_MAX } from '../shared/authoredLimits.js'
import { facetDtoSchema } from '../shared/facet.js'
import { rangeDtoSchema } from '../shared/range.js'
import { conditionMechanicAttackRangeDtoSchema } from '../shared/ruleState.js'
import { shapeDtoSchema } from '../shared/shape.js'
import { speedDtoSchema } from '../shared/speed.js'

const breakpoints = (amount: number) => ({
  scalingKind: 'BREAKPOINTS' as const,
  scalingSource: 'CHARACTER_LEVEL' as const,
  breakpoints: [{ id: 'b1', level: 5, order: 0, value: { amount, unit: 'FEET' as const } }]
})

const distanceRange = (fields: Record<string, unknown>) => ({
  id: 'range-1',
  rangeKind: 'DISTANCE',
  amount: 10,
  unit: 'MILES',
  ...fields
})

const sphere = (radius: Record<string, unknown>) => ({
  id: 'shape-1',
  shapeKind: 'SPHERE',
  radius: { amount: 10, unit: 'MILES', ...radius }
})

const measurement = (amount: number) => ({ amount, unit: 'MILES' })

const manifest = (fields: Record<string, unknown>) => ({
  id: 'manifest-1',
  effectKind: 'MANIFEST',
  manifestKind: 'ZONE',
  attachmentKind: 'PLACED_SPACE',
  ...fields
})

const proximityBehavior = {
  id: '00000000-0000-4000-8000-0000000000f2',
  order: 1,
  invocation: {
    triggerCode: 'RANGED_SPELL_ATTACK',
    activation: { code: 'BONUS_ACTION', amount: 1 },
    range: { id: 'proximity-range', rangeKind: 'DISTANCE', amount: 5, unit: 'FEET' }
  },
  paths: [
    {
      id: 'proximity-path',
      order: 1,
      pathCode: 'ON_HIT',
      groupType: 'SINGLE',
      selectionKind: 'FIXED',
      resultBlock: {
        id: 'proximity-result',
        resultKind: 'SINGLE',
        outcomes: [
          {
            id: 'proximity-damage',
            effectKind: 'DAMAGE',
            damageTypeId: 'force',
            valueKind: 'DICE',
            scalingKind: 'NONE',
            diceConfig: '3d10'
          }
        ]
      }
    }
  ]
}

const rangeFacet = (fields: Record<string, unknown>) => ({
  id: 'facet-1',
  groups: [
    {
      id: 'group-1',
      order: 1,
      contexts: [
        {
          id: 'context-1',
          order: 1,
          subject: 'SPELL',
          authoringModeKind: 'ALL',
          conditions: [
            {
              id: 'condition-1',
              order: 1,
              kind: 'PREDICATE',
              constraint: 'INCLUDE',
              predicateCode: 'RANGE',
              authoringModeKind: 'SELECTED',
              rangeKind: ['DISTANCE'],
              min: 0,
              unit: 'MILES',
              ...fields
            }
          ]
        }
      ]
    }
  ]
})

const relationshipModule = (fields: Record<string, unknown>) => ({
  id: '00000000-0000-4000-8000-0000000000a1',
  order: 0,
  kind: 'SOURCE_RELEASE_MOVEMENT_COST',
  amount: 5,
  unit: 'MILES',
  ...fields
})

const treeStride = (fields: Record<string, unknown>) => ({
  id: 'stride-1',
  effectKind: 'TREE_STRIDE',
  destinationDistance: measurement(5),
  entryMovementCost: measurement(5),
  exitMovementCost: measurement(5),
  sameTreeKind: true,
  livingTreesOnly: true,
  minimumTreeSizeRelativeToTraveler: false,
  usesPerRound: 1,
  mustEndTurnOutside: true,
  ...fields
})

/** Authored lengths where zero is meaningful, so zero parses. */
const parsers: Record<string, (amount: number) => boolean> = {
  'range amount': (amount) => rangeDtoSchema.safeParse(distanceRange({ amount })).success,
  'range scaling amount': (amount) =>
    rangeDtoSchema.safeParse(distanceRange({ scaling: breakpoints(amount) })).success,
  'shape amount': (amount) => shapeDtoSchema.safeParse(sphere({ amount })).success,
  'shape scaling amount': (amount) =>
    shapeDtoSchema.safeParse(sphere({ scaling: breakpoints(amount) })).success,
  'speed amount': (amount) =>
    speedDtoSchema.safeParse({ speedId: 'walk', amount, unit: 'MILES' }).success,
  'movement rule limit distance': (amount) =>
    movementRuleDtoSchema.safeParse({
      id: 'rule-1',
      effectKind: 'MOVEMENT_RULE',
      ruleKind: 'LIMIT_DISTANCE_FROM_ANCHOR',
      limitDistance: measurement(amount)
    }).success,
  'forced movement fixed distance': (amount) =>
    forcedMovementDtoSchema.safeParse({
      id: 'forced-1',
      effectKind: 'FORCED_MOVEMENT',
      direction: 'AWAY_FROM_SOURCE',
      actionEconomy: 'NONE',
      distanceMode: 'EXACT',
      ...measurement(amount)
    }).success,
  'manifest light bright': (amount) =>
    manifestDtoSchema.safeParse(
      manifest({ light: { bright: measurement(amount), dimAdditional: measurement(0) } })
    ).success,
  'manifest light dim': (amount) =>
    manifestDtoSchema.safeParse(
      manifest({ light: { bright: measurement(0), dimAdditional: measurement(amount) } })
    ).success,
  'manifest proximity distance': (amount) =>
    manifestDtoSchema.safeParse(
      manifest({
        proximityRule: {
          id: 'proximity-1',
          events: ['MOVE_WITHIN'],
          distance: measurement(amount),
          requiresSight: false,
          behavior: proximityBehavior
        }
      })
    ).success,
  'manifest summon speed': (amount) =>
    manifestDtoSchema.safeParse({
      id: 'summon-1',
      effectKind: 'MANIFEST',
      manifestKind: 'SUMMON',
      statBlock: { speeds: [{ speedId: 'walk', ...measurement(amount) }] }
    }).success,
  'facet range minimum': (amount) => facetDtoSchema.safeParse(rangeFacet({ min: amount })).success,
  'facet range maximum': (amount) =>
    facetDtoSchema.safeParse(rangeFacet({ min: 0, max: amount })).success,
  'condition mechanic attack range distance': (amount) =>
    conditionMechanicAttackRangeDtoSchema.safeParse({
      kind: 'WITHIN',
      distance: measurement(amount)
    }).success
}

/** Authored lengths where zero is meaningless (a long range must exceed the normal one), so zero is rejected. */
const positiveParsers: Record<string, (amount: number) => boolean> = {
  'range long amount': (amount) =>
    rangeDtoSchema.safeParse(distanceRange({ amount: 0, longAmount: amount })).success,
  'tree stride destination distance': (amount) =>
    treeStrideDtoSchema.safeParse(treeStride({ destinationDistance: measurement(amount) })).success,
  'tree stride entry movement cost': (amount) =>
    treeStrideDtoSchema.safeParse(treeStride({ entryMovementCost: measurement(amount) })).success,
  'tree stride exit movement cost': (amount) =>
    treeStrideDtoSchema.safeParse(treeStride({ exitMovementCost: measurement(amount) })).success,
  'plant portal movement cost': (amount) =>
    plantPortalDtoSchema.safeParse({
      id: 'portal-1',
      effectKind: 'PLANT_PORTAL',
      minimumPlantSize: 'LARGE',
      requiresInanimatePlant: false,
      samePlaneOnly: true,
      destinationMustBeSeenOrTouched: true,
      movementCost: measurement(amount)
    }).success,
  'actor relationship release movement cost': (amount) =>
    actorRelationshipModuleDtoSchema.safeParse(relationshipModule({ amount })).success,
  'manifest wall thickness': (amount) =>
    manifestDtoSchema.safeParse(manifest({ wallThickness: measurement(amount) })).success
}

describe('authored length amount bound', () => {
  it('pins the maximum to the Scene length bound', () => {
    expect(AUTHORED_LENGTH_AMOUNT_MAX).toBe(1_000_000)
  })

  it.each([...Object.entries(parsers), ...Object.entries(positiveParsers)])(
    '%s accepts the maximum only',
    (_name, parses) => {
      expect(parses(AUTHORED_LENGTH_AMOUNT_MAX)).toBe(true)
      expect(parses(AUTHORED_LENGTH_AMOUNT_MAX + 1)).toBe(false)
      expect(parses(Number.POSITIVE_INFINITY)).toBe(false)
      expect(parses(Number.MAX_VALUE)).toBe(false)
      expect(parses(-1)).toBe(false)
    }
  )

  it.each(Object.entries(parsers))('%s accepts zero', (_name, parses) => {
    expect(parses(0)).toBe(true)
  })

  it.each(Object.entries(positiveParsers))('%s rejects zero', (_name, parses) => {
    expect(parses(0)).toBe(false)
  })
})
