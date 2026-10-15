import { describe, expect, it } from 'vitest'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import type { SceneGrid } from '@artificer-toolkit/shared/vtt'

import { CharacterRuleActionUnsupportedCompilationError } from '../characterRuleActionSystemAdapter.js'
import {
  buildCompiledActionCompilerSource,
  buildCompiledActionTargetPolicy
} from '../encounterActionEntryPointCompiler.js'
import { catchEncounterAreaActorIds } from '../encounterAreaActionExecution.js'
import {
  compileEncounterPointArea,
  encounterActionChoiceTarget,
  encounterActionTargetKind
} from '../encounterAreaAction.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'

/** 100px cells of 5 feet. */
const FEET_GRID: SceneGrid = {
  kind: 'SQUARE',
  cellSize: 100,
  diagonalPolicy: 'EQUAL',
  distancePerCell: 5,
  origin: { x: 0, y: 0 },
  unit: 'FEET'
}

const spellEffect = (label: string) => {
  const effect = srdSpells.find((spell) => spell.label === label)?.effects?.[0]
  if (!effect) throw new Error(`${label} has no effect`)
  return effect
}

const FIREBALL = spellEffect('Fireball')
const FAERIE_FIRE_CUBE = spellEffect('Faerie Fire').invocation.shape
const feet = (amount: number) => ({ amount, unit: 'FEET' as const })

type Invocation = typeof FIREBALL.invocation

/** Compiles the effect the way an Encounter Action does: descriptor, then the system plan. */
function compile(invocation: Partial<Invocation>) {
  const action = characterActionDescriptor(
    compileEffect({
      ...FIREBALL,
      id: ACTION_EFFECT_ID,
      invocation: JSON.parse(JSON.stringify({ ...FIREBALL.invocation, ...invocation }))
    })
  )
  const plan = dnd5eCharacterRuleActionSystemAdapter.compileExecutionPlan?.({
    action,
    compilerSource: buildCompiledActionCompilerSource(action)
  })
  return { action, plan }
}

describe('area action compilation from the SRD', () => {
  it('compiles SRD Fireball to the per-creature test plan, carrying the sphere and range', () => {
    const { action, plan } = compile({})
    expect(plan?.kind).toBe('TEST_OUTCOME')
    const policy = buildCompiledActionTargetPolicy(action)
    expect(policy.targeting?.selectionKind).toBe('AREA_CONTENTS')
    expect(policy.range).toMatchObject({ rangeKind: 'DISTANCE', amount: 150, unit: 'FEET' })
    expect(policy.shape).toMatchObject({ shapeKind: 'SPHERE', radius: feet(20) })
    expect(encounterActionTargetKind(policy)).toBe('POINT')
    expect(compileEncounterPointArea(policy, FEET_GRID)).toEqual({ kind: 'RADIUS', radius: 400 })
  })

  it('catches the creatures inside the radius the data gives and none beyond it', () => {
    const policy = buildCompiledActionTargetPolicy(compile({}).action)
    const shape = compileEncounterPointArea(policy, FEET_GRID)
    if (!shape) throw new Error('Fireball has no point area.')
    const at = (id: string, x: number) => ({
      id: `00000000-0000-4000-8000-00000000${id}`,
      actorId: `00000000-0000-4000-8000-0000000a${id}`,
      position: { x, y: 0 },
      width: 100,
      height: 100
    })
    expect(
      catchEncounterAreaActorIds({
        origin: { x: 0, y: 0 },
        shape,
        casterActorId: '00000000-0000-4000-8000-0000000a0000',
        tokens: [at('0001', 300), at('0002', 700)]
      })
    ).toEqual(['00000000-0000-4000-8000-0000000a0001'])
  })

  it('shapes the area plan like the single-target test plan', () => {
    const area = compile({}).plan
    const single = compile({
      shape: undefined,
      targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
    }).plan
    expect(area?.kind).toBe('TEST_OUTCOME')
    expect(single?.kind).toBe('TEST_OUTCOME')
    expect(
      area?.kind === 'TEST_OUTCOME' && area.outcomes.map((outcome) => outcome.pathCode)
    ).toEqual(single?.kind === 'TEST_OUTCOME' && single.outcomes.map((outcome) => outcome.pathCode))
  })

  it('compiles a cube whose edge is taken from the authored data', () => {
    if (FAERIE_FIRE_CUBE?.shapeKind !== 'CUBE') throw new Error('Faerie Fire is not a cube')
    const { action, plan } = compile({ shape: FAERIE_FIRE_CUBE })
    expect(plan?.kind).toBe('TEST_OUTCOME')
    const policy = buildCompiledActionTargetPolicy(action)
    expect(encounterActionTargetKind(policy)).toBe('POINT')
    expect(compileEncounterPointArea(policy, FEET_GRID)).toEqual({
      kind: 'CUBE',
      edgeLength: (FAERIE_FIRE_CUBE.edgeLength.amount / 5) * FEET_GRID.cellSize
    })
  })

  it('compiles a cylinder and a circle', () => {
    for (const shape of [
      { id: 's', shapeKind: 'CYLINDER', radius: feet(10), height: feet(40) },
      { id: 's', shapeKind: 'CIRCLE', radius: feet(5) }
    ] as const)
      expect(compile({ shape }).plan?.kind, shape.shapeKind).toBe('TEST_OUTCOME')
  })
})

describe('directed area action compilation', () => {
  const SELF = { id: 'r', rangeKind: 'SELF' } as const

  it.each([
    [
      'a cone',
      { id: 's', shapeKind: 'CONE', length: feet(15) },
      { kind: 'CONE', length: feet(15) }
    ],
    [
      'a line',
      { id: 's', shapeKind: 'LINE', length: feet(100), width: feet(5) },
      { kind: 'LINE', length: feet(100), width: feet(5) }
    ],
    [
      'a cube',
      { id: 's', shapeKind: 'CUBE', edgeLength: feet(15) },
      { kind: 'CUBE_FROM_SIDE', edgeLength: feet(15) }
    ]
  ] as const)('compiles %s from the caster to the per-creature test plan', (_name, shape, area) => {
    const { action, plan } = compile({ range: SELF, shape })
    expect(plan?.kind).toBe('TEST_OUTCOME')
    const policy = buildCompiledActionTargetPolicy(action)
    expect(encounterActionTargetKind(policy)).toBe('DIRECTED')
    expect(encounterActionChoiceTarget(policy)).toEqual({ kind: 'DIRECTED', area })
  })

  it('compiles SRD Thunderwave as the cube that extends from the caster', () => {
    const action = characterActionDescriptor(
      compileEffect({ ...spellEffect('Thunderwave'), id: ACTION_EFFECT_ID })
    )
    const policy = buildCompiledActionTargetPolicy(action)
    expect(policy.range.rangeKind).toBe('SELF')
    expect(encounterActionChoiceTarget(policy)).toEqual({
      kind: 'DIRECTED',
      area: { kind: 'CUBE_FROM_SIDE', edgeLength: feet(15) }
    })
  })

  it.each<[string, NonNullable<Invocation['shape']>]>([
    [
      'a scaled cone',
      {
        id: 's',
        shapeKind: 'CONE',
        length: {
          ...feet(15),
          scaling: {
            scalingKind: 'BREAKPOINTS',
            scalingSource: 'SPELL_CAST_LEVEL',
            breakpoints: [{ id: 'b', level: 4, order: 1, value: feet(30) }]
          }
        }
      }
    ],
    ['a line of no width', { id: 's', shapeKind: 'LINE', length: feet(100), width: feet(0) }],
    [
      'a line with a scaled width',
      {
        id: 's',
        shapeKind: 'LINE',
        length: feet(100),
        width: {
          ...feet(5),
          scaling: {
            scalingKind: 'BREAKPOINTS',
            scalingSource: 'SPELL_CAST_LEVEL',
            breakpoints: [{ id: 'b', level: 4, order: 1, value: feet(10) }]
          }
        }
      }
    ],
    ['a self wall', { id: 's', shapeKind: 'WALL', length: feet(60), height: feet(20) }],
    ['a self dome', { id: 's', shapeKind: 'DOME', radius: feet(10) }]
  ])('still refuses %s', (_name, shape) => {
    expect(() => compile({ range: SELF, shape })).toThrow(
      CharacterRuleActionUnsupportedCompilationError
    )
  })
})

describe('caster-centered area action compilation', () => {
  const SELF = { id: 'r', rangeKind: 'SELF' } as const

  it.each([
    [
      'a sphere',
      { id: 's', shapeKind: 'SPHERE', radius: feet(10) },
      { kind: 'RADIUS', radius: feet(10) }
    ],
    [
      'a cylinder',
      { id: 's', shapeKind: 'CYLINDER', radius: feet(10), height: feet(40) },
      { kind: 'RADIUS', radius: feet(10) }
    ],
    ['a circle', { id: 's', shapeKind: 'CIRCLE', radius: feet(5) }, { kind: 'RADIUS', radius: feet(5) }]
  ] as const)('compiles Self %s to the per-creature test plan', (_name, shape, area) => {
    const { action, plan } = compile({ range: SELF, shape })
    expect(plan?.kind).toBe('TEST_OUTCOME')
    const policy = buildCompiledActionTargetPolicy(action)
    expect(encounterActionTargetKind(policy)).toBe('CASTER_CENTERED')
    expect(encounterActionChoiceTarget(policy)).toEqual({ kind: 'CASTER_CENTERED', area })
    expect(compileEncounterPointArea(policy, FEET_GRID)).toEqual({
      kind: 'RADIUS',
      radius: (area.radius.amount / 5) * FEET_GRID.cellSize
    })
  })
})

describe('area action compilation refusals', () => {
  const refused: Array<[string, Partial<Invocation>]> = [
    ['a cone', { shape: { id: 's', shapeKind: 'CONE', length: feet(15) } }],
    ['a line', { shape: { id: 's', shapeKind: 'LINE', length: feet(100), width: feet(5) } }],
    ['a wall', { shape: { id: 's', shapeKind: 'WALL', length: feet(60), height: feet(20) } }],
    ['a dome', { shape: { id: 's', shapeKind: 'DOME', radius: feet(10) } }],
    ['a touch range', { range: { id: 'r', rangeKind: 'TOUCH' } }],
    [
      'a scaled radius',
      {
        shape: {
          id: 's',
          shapeKind: 'SPHERE',
          radius: {
            ...feet(20),
            scaling: {
              scalingKind: 'BREAKPOINTS',
              scalingSource: 'SPELL_CAST_LEVEL',
              breakpoints: [{ id: 'b', level: 4, order: 1, value: feet(25) }]
            }
          }
        }
      }
    ],
    [
      'a non-ANY disposition',
      { targeting: { selectionKind: 'AREA_CONTENTS', dispositionKind: 'HOSTILE' } }
    ]
  ]

  it.each(refused)('refuses %s', (_name, invocation) => {
    expect(() => compile(invocation as Partial<Invocation>)).toThrow(
      CharacterRuleActionUnsupportedCompilationError
    )
  })
})
