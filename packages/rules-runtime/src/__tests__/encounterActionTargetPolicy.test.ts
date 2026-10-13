import { describe, expect, it } from 'vitest'
import type { EncounterActorDispositionDto } from '@artificer-toolkit/schema/api/encounterData'
import type { CompiledActionTargetPolicy } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { SceneGrid } from '@artificer-toolkit/shared/vtt'

import {
  encounterActionLongRangeContributor,
  encounterActorRelationship,
  evaluateEncounterActionTargetPolicy
} from '../encounterActionTargetPolicy.js'
import {
  ENCOUNTER_LONG_RANGE_CONTRIBUTOR_SOURCE_ID,
  labelEncounterRollModeReasons
} from '../encounterRollModeReasons.js'

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
    sceneContext: null,
    makesAttackRoll: false
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

/** SRD "Targeting Yourself" (D99): a creature may target itself unless the action says otherwise. */
describe('encounter action self target', () => {
  function selfWarnings(input: {
    targeting: CompiledActionTargetPolicy['targeting']
    makesAttackRoll?: boolean
  }) {
    const warnings = evaluateEncounterActionTargetPolicy({
      actor: { id: 'source', disposition: 'FRIENDLY' },
      target: { id: 'source', disposition: 'FRIENDLY' },
      targetPolicy: {
        range: { id: 'range', rangeKind: 'UNLIMITED' },
        targeting: input.targeting,
        shape: null,
        pathOverrides: []
      },
      sceneContext: null,
      makesAttackRoll: input.makesAttackRoll ?? false
    })
    if (warnings === null) throw new Error('Expected a resolvable single-target policy.')
    return warnings.filter((warning) => warning.code === 'TARGET_DISPOSITION')
  }

  it('lets a non-attack, non-hostile action target its own user without a warning', () => {
    expect(
      selfWarnings({ targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' } })
    ).toEqual([])
    expect(
      selfWarnings({ targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'WILLING' } })
    ).toEqual([])
  })

  it('warns when a hostile-only action targets its own user', () => {
    expect(
      selfWarnings({ targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'HOSTILE' } })
    ).toHaveLength(1)
  })

  it('warns when the authored targeting excludes its own user', () => {
    expect(
      selfWarnings({
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY', excludesSelf: true }
      })
    ).toEqual([{ code: 'TARGET_DISPOSITION', message: 'This action targets another creature.' }])
  })

  it('warns when an any-target action that makes an attack roll targets its own user', () => {
    expect(
      selfWarnings({
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' },
        makesAttackRoll: true
      })
    ).toHaveLength(1)
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
    makesAttackRoll: false,
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

  it('counts the target square, so a 5-foot reach reaches only an adjacent target', () => {
    const range = { id: 'range', rangeKind: 'DISTANCE' as const, amount: 5, unit: 'FEET' as const }
    expect(rangeWarnings({ range, scene: { source: token(0, 0), target: token(1, 0) } })).toEqual(
      []
    )
    expect(rangeWarnings({ range, scene: { source: token(0, 0), target: token(1, 1) } })).toEqual(
      []
    )
    expect(rangeWarnings({ range, scene: { source: token(0, 0), target: token(2, 0) } })).toEqual([
      OUT_OF_RANGE
    ])
  })

  it('lets a 10-foot reach reach a target two squares away', () => {
    const range = { id: 'range', rangeKind: 'DISTANCE' as const, amount: 10, unit: 'FEET' as const }
    expect(rangeWarnings({ range, scene: { source: token(0, 0), target: token(2, 0) } })).toEqual(
      []
    )
    expect(rangeWarnings({ range, scene: { source: token(0, 0), target: token(3, 0) } })).toEqual([
      OUT_OF_RANGE
    ])
  })

  it('lets a swarm’s 0-foot reach reach only a target in its space', () => {
    const range = { id: 'range', rangeKind: 'DISTANCE' as const, amount: 0, unit: 'FEET' as const }
    const notInSpace = {
      code: 'TARGET_OUT_OF_RANGE',
      message: "The target isn't in this creature's space."
    }
    expect(rangeWarnings({ range, scene: { source: token(0, 0), target: token(0, 0) } })).toEqual(
      []
    )
    // A Medium swarm in one square of a Large target shares its space.
    expect(
      rangeWarnings({ range, scene: { source: token(1, 1), target: token(0, 0, 2) } })
    ).toEqual([])
    expect(rangeWarnings({ range, scene: { source: token(0, 0), target: token(1, 0) } })).toEqual([
      notInSpace
    ])
    // A gridless Scene measures adjacency as 5 feet too, so reach 0 checks overlap, not distance.
    const gridless: SceneGrid = { kind: 'GRIDLESS', pixelsPerUnit: 20, unit: 'FEET' }
    expect(
      rangeWarnings({ range, scene: { grid: gridless, source: token(0, 0), target: token(0, 0) } })
    ).toEqual([])
    expect(
      rangeWarnings({ range, scene: { grid: gridless, source: token(0, 0), target: token(1, 0) } })
    ).toEqual([notInSpace])
    expect(rangeWarnings({ range, scene: null })).toEqual([UNCHECKED])
  })

  it('reaches a Large target from any square adjacent to one of its squares', () => {
    const range = { id: 'range', rangeKind: 'DISTANCE' as const, amount: 5, unit: 'FEET' as const }
    const large = token(1, 1, 2)
    expect(rangeWarnings({ range, scene: { source: token(0, 0), target: large } })).toEqual([])
    expect(rangeWarnings({ range, scene: { source: token(3, 2), target: large } })).toEqual([])
    expect(rangeWarnings({ range, scene: { source: token(4, 1), target: large } })).toEqual([
      OUT_OF_RANGE
    ])
  })

  it('measures the token positions it is given, so a moved token changes the verdict', () => {
    const target = token(12, 0)
    expect(rangeWarnings({ scene: { source: token(0, 0), target } })).toEqual([OUT_OF_RANGE])
    expect(rangeWarnings({ scene: { source: token(8, 0), target } })).toEqual([])
  })

  it('converts a feet range onto a meters grid', () => {
    const grid: SceneGrid = { ...FEET_GRID, distancePerCell: 1.5, unit: 'METERS' }
    // 30 feet is 9.144 meters: 6 squares away (9 m) is in range, 8 (12 m) is not.
    expect(rangeWarnings({ scene: { grid, source: token(0, 0), target: token(6, 0) } })).toEqual([])
    expect(rangeWarnings({ scene: { grid, source: token(0, 0), target: token(8, 0) } })).toEqual([
      OUT_OF_RANGE
    ])
  })

  it('reports an unchecked range without both tokens', () => {
    expect(rangeWarnings({ scene: null })).toEqual([UNCHECKED])
  })

  it('measures a feet range as 5-foot squares on a SQUARES grid', () => {
    const grid: SceneGrid = { ...FEET_GRID, distancePerCell: 1, unit: 'SQUARES' }
    // 30 feet is 6 squares: 6 squares away is in range, 8 is not.
    expect(rangeWarnings({ scene: { grid, source: token(0, 0), target: token(6, 0) } })).toEqual([])
    expect(rangeWarnings({ scene: { grid, source: token(0, 0), target: token(8, 0) } })).toEqual([
      OUT_OF_RANGE
    ])
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

  it('warns an excludes-self action aimed at its own user, whatever the dispositions', () => {
    expect(
      rangeWarnings({
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY', excludesSelf: true },
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

  it('reaches a ranged attack’s long range and warns only beyond it (D62)', () => {
    // A light crossbow: range 80/320 ft., 16 and 64 squares.
    const range = {
      id: 'range',
      rangeKind: 'DISTANCE' as const,
      amount: 80,
      longAmount: 320,
      unit: 'FEET' as const
    }
    expect(rangeWarnings({ range, scene: { source: token(0, 0), target: token(40, 0) } })).toEqual(
      []
    )
    expect(rangeWarnings({ range, scene: { source: token(0, 0), target: token(64, 0) } })).toEqual(
      []
    )
    expect(rangeWarnings({ range, scene: { source: token(0, 0), target: token(65, 0) } })).toEqual([
      OUT_OF_RANGE
    ])
  })

  it('gives a ranged attack disadvantage beyond its normal range, up to its long range (D62)', () => {
    const targetPolicy = {
      range: {
        id: 'range',
        rangeKind: 'DISTANCE' as const,
        amount: 80,
        longAmount: 320,
        unit: 'FEET' as const
      },
      targeting: { selectionKind: 'SINGLE_TARGET' as const, dispositionKind: 'ANY' as const },
      shape: null,
      pathOverrides: []
    }
    const contributor = (column: number | null) =>
      encounterActionLongRangeContributor({
        targetPolicy,
        sceneContext:
          column === null
            ? null
            : { grid: FEET_GRID, sourceToken: token(0, 0), targetToken: token(column, 0) }
      })
    const longRange = {
      sourceId: ENCOUNTER_LONG_RANGE_CONTRIBUTOR_SOURCE_ID,
      grantId: null,
      domainKey: ENCOUNTER_LONG_RANGE_CONTRIBUTOR_SOURCE_ID,
      influence: 'DISADVANTAGE' as const
    }
    expect(contributor(16)).toBeNull()
    expect(contributor(17)).toEqual(longRange)
    expect(contributor(64)).toEqual(longRange)
    // Beyond the long range the policy warns instead, and nothing measures without a Scene.
    expect(contributor(65)).toBeNull()
    expect(contributor(null)).toBeNull()
    // A range without a long range never gives disadvantage.
    expect(
      encounterActionLongRangeContributor({
        targetPolicy: {
          ...targetPolicy,
          range: { id: 'range', rangeKind: 'DISTANCE', amount: 80, unit: 'FEET' }
        },
        sceneContext: { grid: FEET_GRID, sourceToken: token(0, 0), targetToken: token(40, 0) }
      })
    ).toBeNull()
    // Assisted names the reason.
    expect(
      labelEncounterRollModeReasons(new Map())({
        rollMode: 'DISADVANTAGE',
        contributors: [longRange]
      })
    ).toEqual(['Long range'])
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
