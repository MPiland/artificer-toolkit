import type { SceneGrid } from '@artificer-toolkit/shared/vtt'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { describe, expect, it } from 'vitest'

import { findEncounterRescues } from '../encounterEscapeCheck.js'
import { escapeGrappleEffectDefinition } from '../testing/escapeGrappleEffectFixture.js'

/**
 * ATTACK-7.9: which holds a creature within reach may break for the held creature. Nothing names a
 * creature; the authored escape module carries the permission.
 */

const FEET_GRID: SceneGrid = {
  kind: 'SQUARE',
  cellSize: 100,
  diagonalPolicy: 'EQUAL',
  distancePerCell: 5,
  origin: { x: 0, y: 0 },
  unit: 'FEET'
}
const ENCOUNTER = '00000000-0000-4000-8000-000000000001'
const HOLDER = 'holder'
const HELD = 'held'
const RESCUER = 'rescuer'

const placed = (actorId: string, column: number) => ({
  actorId,
  position: { x: column * 100 + 50, y: 50 },
  width: 100,
  height: 100,
  rotationDegrees: 0
})

type HoldInput = Partial<Parameters<typeof escapeGrappleEffectDefinition>[0]>
const hold = (input: HoldInput = {}) => ({
  id: 'effect',
  definition: escapeGrappleEffectDefinition({
    encounterId: ENCOUNTER,
    grapplerId: HOLDER,
    conditionIds: [],
    actorKinds: ['TARGET', 'CREATURE_WITHIN_REACH'],
    ...input
  })
})

function rescues(input: {
  actorId?: string
  hold?: ReturnType<typeof hold>
  tokens?: ReturnType<typeof placed>[] | null
}) {
  return findEncounterRescues({
    actorId: input.actorId ?? RESCUER,
    activeEffectsByActorId: new Map([[HELD, [input.hold ?? hold()]]]),
    scene:
      input.tokens === null
        ? null
        : {
            grid: FEET_GRID,
            tokens: input.tokens ?? [placed(HOLDER, 0), placed(HELD, 1), placed(RESCUER, 2)]
          }
  })
}

describe('the holds a creature within reach may break for another creature', () => {
  it('offers the hold with the module’s own activation, checks and DC while the rescuer is within reach', () => {
    expect(
      rescues({}).map(({ heldActorId, sourceActorId, dc, activation, checks }) => ({
        heldActorId,
        sourceActorId,
        dc,
        activation,
        checks
      }))
    ).toMatchObject([
      {
        heldActorId: HELD,
        sourceActorId: HOLDER,
        dc: 13,
        activation: { code: 'ACTION', amount: 1 }
      }
    ])
  })

  it('offers nothing to a creature beyond the reach the hold sealed', () => {
    expect(rescues({ tokens: [placed(HOLDER, 0), placed(HELD, 1), placed(RESCUER, 5)] })).toEqual(
      []
    )
  })

  it('offers nothing when the Scene does not place the pair', () => {
    expect(rescues({ tokens: null })).toEqual([])
    expect(rescues({ tokens: [placed(HOLDER, 0), placed(HELD, 1)] })).toEqual([])
  })

  it('offers nothing to the hold’s own source: letting go of a hold is a release, not an escape', () => {
    expect(rescues({ actorId: HOLDER, tokens: [placed(HOLDER, 0), placed(HELD, 1)] })).toEqual([])
  })

  it('offers nothing for a hold on the rescuer itself', () => {
    expect(rescues({ actorId: HELD, tokens: [placed(HOLDER, 0), placed(HELD, 1)] })).toEqual([])
  })

  it('offers nothing when the module allows only the held creature', () => {
    expect(rescues({ hold: hold({ actorKinds: ['TARGET'] }) })).toEqual([])
  })

  it('offers nothing for a CONTEST escape: a rescuer has no contest to make', () => {
    const contested = hold({ contestChecks: { skillIds: [], abilityDefinitionIds: [] } })
    expect(rescues({ hold: contested })).toEqual([])
  })
})

/** Every authored escape that lets a creature within reach attempt it, in the SRD baseline. */
function authoredRescueModules(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(authoredRescueModules)
  if (typeof value !== 'object' || value === null) return []
  const record = value as Record<string, unknown>
  const own =
    record.kind === 'ESCAPE_CHECK' &&
    Array.isArray(record.actorKinds) &&
    record.actorKinds.includes('CREATURE_WITHIN_REACH')
      ? [record]
      : []
  return [...own, ...Object.values(record).flatMap(authoredRescueModules)]
}

describe('parity: authored escapes that allow a creature within reach (ATTACK-7.9)', () => {
  const modules = authoredRescueModules(srdBaselineContent)

  it('authors at least one, each with a fixed DC', () => {
    expect(modules.length).toBeGreaterThan(0)
    for (const module of modules) expect(module.dc).toMatchObject({ kind: 'FIXED' })
  })

  it('offers each as the rescue the module itself describes', () => {
    for (const module of modules) {
      const fixed = module.dc as { value: number }
      const [offered] = rescues({
        hold: hold({
          dc: fixed.value,
          activation: module.activation as never,
          checks: module.checks as never
        })
      })
      expect(offered).toMatchObject({
        dc: fixed.value,
        activation: module.activation,
        checks: module.checks
      })
    }
  })
})
