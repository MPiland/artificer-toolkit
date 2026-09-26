import { describe, expect, it } from 'vitest'
import type { EncounterActorDispositionDto } from '@artificer-toolkit/schema/api/encounterData'
import type { CompiledActionTargetPolicy } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { SceneGrid } from '@artificer-toolkit/shared/vtt'

import {
  encounterActorRelationship,
  evaluateEncounterActionTargetPolicy
} from '../encounterActionTargetPolicy.js'

const DISPOSITIONS: readonly EncounterActorDispositionDto[] = ['FRIENDLY', 'NEUTRAL', 'HOSTILE']

function dispositionWarnings(
  dispositionKind: 'ANY' | 'WILLING' | 'HOSTILE',
  source: EncounterActorDispositionDto,
  target: EncounterActorDispositionDto
) {
  const warnings = evaluateEncounterActionTargetPolicy({
    actor: { id: 'source', disposition: source },
    target: { id: 'target', disposition: target },
    targetPolicy: {
      range: { id: 'range', rangeKind: 'UNLIMITED' },
      targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind },
      shape: null,
      pathOverrides: []
    },
    sceneContext: null
  })
  if (warnings === null) throw new Error('Expected a resolvable single-target policy.')
  return warnings.filter((warning) => warning.code === 'TARGET_DISPOSITION')
}

describe('encounter action target disposition', () => {
  it('treats neutral as neutral to everyone, equal dispositions as allied, and opposites as hostile', () => {
    expect(encounterActorRelationship('FRIENDLY', 'FRIENDLY')).toBe('ALLIED')
    expect(encounterActorRelationship('HOSTILE', 'HOSTILE')).toBe('ALLIED')
    expect(encounterActorRelationship('FRIENDLY', 'HOSTILE')).toBe('HOSTILE')
    expect(encounterActorRelationship('HOSTILE', 'FRIENDLY')).toBe('HOSTILE')
    for (const other of DISPOSITIONS) {
      expect(encounterActorRelationship('NEUTRAL', other)).toBe('NEUTRAL')
      expect(encounterActorRelationship(other, 'NEUTRAL')).toBe('NEUTRAL')
    }
  })

  it('warns a willing-target action only when source and target are hostile to each other', () => {
    for (const source of DISPOSITIONS)
      for (const target of DISPOSITIONS) {
        const hostile = encounterActorRelationship(source, target) === 'HOSTILE'
        expect(dispositionWarnings('WILLING', source, target)).toEqual(
          hostile
            ? [{ code: 'TARGET_DISPOSITION', message: 'This action needs a willing target.' }]
            : []
        )
      }
  })

  it('warns a hostile-target action only when source and target are allied', () => {
    for (const source of DISPOSITIONS)
      for (const target of DISPOSITIONS) {
        const allied = source !== 'NEUTRAL' && source === target
        expect(dispositionWarnings('HOSTILE', source, target)).toEqual(
          allied
            ? [{ code: 'TARGET_DISPOSITION', message: 'This action targets hostile creatures.' }]
            : []
        )
      }
  })

  it('never warns an any-target action about disposition', () => {
    for (const source of DISPOSITIONS)
      for (const target of DISPOSITIONS)
        expect(dispositionWarnings('ANY', source, target)).toEqual([])
  })
})

/** 100px cells of 5 feet; a Medium token fills one cell and is anchored at its center. */
const FEET_GRID: SceneGrid = {
  kind: 'SQUARE',
  cellSize: 100,
  diagonalPolicy: 'EQUAL',
  distancePerCell: 5,
  origin: { x: 0, y: 0 },
  unit: 'FEET'
}
const OUT_OF_RANGE = { code: 'TARGET_OUT_OF_RANGE', message: 'The target is out of range.' }
const UNCHECKED = {
  code: 'TARGET_RANGE_UNCHECKED',
  message: "Range can't be checked without both tokens on the map."
}

/** A token occupying `cells` squares per side whose top-left square is (column, row). */
function token(column: number, row: number, cells = 1) {
  const size = cells * 100
  return {
    position: { x: column * 100 + size / 2, y: row * 100 + size / 2 },
    width: size,
    height: size,
    rotationDegrees: 0
  }
}

function rangeWarnings(input: {
  range?: CompiledActionTargetPolicy['range']
  targeting?: CompiledActionTargetPolicy['targeting']
  shape?: CompiledActionTargetPolicy['shape']
  pathOverrides?: CompiledActionTargetPolicy['pathOverrides']
  targetId?: string
  dispositions?: readonly [EncounterActorDispositionDto, EncounterActorDispositionDto]
  scene?: {
    grid?: SceneGrid
    source: ReturnType<typeof token>
    target: ReturnType<typeof token>
  } | null
}) {
  const [source, target] = input.dispositions ?? ['FRIENDLY', 'HOSTILE']
  return evaluateEncounterActionTargetPolicy({
    actor: { id: 'source', disposition: source },
    target: { id: input.targetId ?? 'target', disposition: target },
    targetPolicy: {
      range: input.range ?? { id: 'range', rangeKind: 'DISTANCE', amount: 30, unit: 'FEET' },
      targeting:
        input.targeting === undefined
          ? { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
          : input.targeting,
      shape: input.shape ?? null,
      pathOverrides: input.pathOverrides ?? []
    },
    sceneContext:
      input.scene === undefined || input.scene === null
        ? null
        : {
            grid: input.scene.grid ?? FEET_GRID,
            sourceToken: input.scene.source,
            targetToken: input.scene.target
          }
  })
}

describe('encounter action target range', () => {
  it('does not warn about a target well inside a distance range', () => {
    expect(rangeWarnings({ scene: { source: token(0, 0), target: token(1, 0) } })).toEqual([])
    expect(rangeWarnings({ scene: { source: token(0, 0), target: token(4, 3) } })).toEqual([])
  })

  it('warns about a target well beyond a distance range', () => {
    expect(rangeWarnings({ scene: { source: token(0, 0), target: token(12, 0) } })).toEqual([
      OUT_OF_RANGE
    ])
    expect(rangeWarnings({ scene: { source: token(0, 0), target: token(9, 9) } })).toEqual([
      OUT_OF_RANGE
    ])
  })

  it('measures to the nearest occupied square of a Large target, not its center', () => {
    const range = { id: 'range', rangeKind: 'DISTANCE' as const, amount: 15, unit: 'FEET' as const }
    // The Large target's nearest square is 3 columns away; its center is 4 away.
    expect(
      rangeWarnings({ range, scene: { source: token(0, 0), target: token(3, 0, 2) } })
    ).toEqual([])
    expect(
      rangeWarnings({ range, scene: { source: token(0, 0), target: token(6, 0, 2) } })
    ).toEqual([OUT_OF_RANGE])
  })

  it('measures the token positions it is given, so a moved token changes the verdict', () => {
    const target = token(12, 0)
    expect(rangeWarnings({ scene: { source: token(0, 0), target } })).toEqual([OUT_OF_RANGE])
    expect(rangeWarnings({ scene: { source: token(8, 0), target } })).toEqual([])
  })

  it('converts a feet range onto a meters grid', () => {
    const grid: SceneGrid = { ...FEET_GRID, distancePerCell: 1.5, unit: 'METERS' }
    // 30 feet is 9.144 meters: 5 empty squares (7.5 m) are in range, 7 (10.5 m) are not.
    expect(rangeWarnings({ scene: { grid, source: token(0, 0), target: token(6, 0) } })).toEqual([])
    expect(rangeWarnings({ scene: { grid, source: token(0, 0), target: token(8, 0) } })).toEqual([
      OUT_OF_RANGE
    ])
  })

  it('reports an unchecked range without both tokens or on an uncalibrated grid', () => {
    expect(rangeWarnings({ scene: null })).toEqual([UNCHECKED])
    const squares: SceneGrid = { ...FEET_GRID, unit: 'SQUARES' }
    expect(
      rangeWarnings({ scene: { grid: squares, source: token(0, 0), target: token(1, 0) } })
    ).toEqual([UNCHECKED])
  })

  it('never checks an unlimited range', () => {
    const range = { id: 'range', rangeKind: 'UNLIMITED' as const }
    expect(rangeWarnings({ range, scene: null })).toEqual([])
    expect(rangeWarnings({ range, scene: { source: token(0, 0), target: token(40, 40) } })).toEqual(
      []
    )
  })

  it('reads only geometry, so a hidden target token is measured like any other', () => {
    const hidden = { ...token(12, 0), hidden: true, label: 'Hidden assassin' }
    expect(rangeWarnings({ scene: { source: token(0, 0), target: hidden } })).toEqual([
      OUT_OF_RANGE
    ])
    expect(
      rangeWarnings({ scene: { source: token(0, 0), target: { ...hidden, ...token(1, 0) } } })
    ).toEqual([])
  })

  it('lists the disposition warning before the range warning', () => {
    expect(
      rangeWarnings({
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'WILLING' },
        scene: { source: token(0, 0), target: token(12, 0) }
      })
    ).toEqual([
      { code: 'TARGET_DISPOSITION', message: 'This action needs a willing target.' },
      OUT_OF_RANGE
    ])
    expect(
      rangeWarnings({
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'HOSTILE' },
        dispositions: ['HOSTILE', 'HOSTILE'],
        scene: null
      })
    ).toEqual([
      { code: 'TARGET_DISPOSITION', message: 'This action targets hostile creatures.' },
      UNCHECKED
    ])
  })

  it('warns a single-target action aimed at its own user, whatever the dispositions', () => {
    expect(
      rangeWarnings({
        targetId: 'source',
        dispositions: ['NEUTRAL', 'NEUTRAL'],
        scene: { source: token(0, 0), target: token(0, 0) }
      })
    ).toEqual([{ code: 'TARGET_DISPOSITION', message: 'This action targets another creature.' }])
  })

  it('lets a self-range action target only its user', () => {
    const range = { id: 'range', rangeKind: 'SELF' as const }
    const targeting = { selectionKind: 'SELF' as const }
    expect(rangeWarnings({ range, targeting, targetId: 'source' })).toEqual([])
    expect(rangeWarnings({ range, targeting })).toEqual([
      { code: 'TARGET_OUT_OF_RANGE', message: 'This action can only target its user.' }
    ])
  })

  it('refuses policies the single-target path cannot resolve', () => {
    const cone = {
      id: 'cone',
      shapeKind: 'CONE' as const,
      length: { amount: 15, unit: 'FEET' as const }
    }
    expect(rangeWarnings({ shape: cone })).toBeNull()
    expect(
      rangeWarnings({
        pathOverrides: [
          {
            entryId: 'entry',
            pathGroupId: 'group',
            pathCode: 'ON_HIT',
            pathOrder: 0,
            entryOrder: 0,
            range: null,
            targeting: null
          }
        ]
      })
    ).toBeNull()
    expect(rangeWarnings({ range: { id: 'range', rangeKind: 'SPECIAL' } })).toBeNull()
    expect(rangeWarnings({ targeting: null })).toBeNull()
    expect(
      rangeWarnings({ targeting: { selectionKind: 'CHOSEN_CREATURES', dispositionKind: 'ANY' } })
    ).toBeNull()
    expect(rangeWarnings({ targeting: { selectionKind: 'SINGLE_TARGET' } })).toBeNull()
    expect(
      rangeWarnings({
        targeting: {
          selectionKind: 'SINGLE_TARGET',
          dispositionKind: 'ANY',
          excludedCreatureTypeIds: ['00000000-0000-4000-8000-0000000000aa']
        }
      })
    ).toBeNull()
    expect(
      rangeWarnings({
        targeting: {
          selectionKind: 'SINGLE_TARGET',
          dispositionKind: 'ANY',
          excludedCreatureTypeIds: []
        },
        scene: { source: token(0, 0), target: token(1, 0) }
      })
    ).toEqual([])
  })
})
