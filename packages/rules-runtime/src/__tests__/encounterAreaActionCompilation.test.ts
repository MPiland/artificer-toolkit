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
function compile(
  invocation: Partial<Invocation>,
  effect: typeof FIREBALL = FIREBALL,
  spellCastLevel?: number
) {
  const descriptor = characterActionDescriptor(
    compileEffect({
      ...effect,
      id: ACTION_EFFECT_ID,
      invocation: JSON.parse(JSON.stringify({ ...effect.invocation, ...invocation }))
    })
  )
  const action = spellCastLevel === undefined ? descriptor : { ...descriptor, spellCastLevel }
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
    [
      'a circle',
      { id: 's', shapeKind: 'CIRCLE', radius: feet(5) },
      { kind: 'RADIUS', radius: feet(5) }
    ]
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

describe('chosen-creature heal compilation from the SRD (D118)', () => {
  const MASS_CURE_WOUNDS = spellEffect('Mass Cure Wounds')
  const MASS_HEALING_WORD = spellEffect('Mass Healing Word')
  const targetOf = (effect: typeof FIREBALL, castLevel: number) =>
    encounterActionChoiceTarget(
      buildCompiledActionTargetPolicy(compile({}, effect, castLevel).action)
    )

  it('takes a list of up to the authored cap, inside the sphere the spell names', () => {
    expect(compile({}, MASS_CURE_WOUNDS, 5).plan).toBeDefined()
    expect(targetOf(MASS_CURE_WOUNDS, 5)).toEqual({
      kind: 'ACTORS',
      maxTargets: 6,
      area: { kind: 'RADIUS', radius: feet(30) }
    })
  })

  it('takes a list with no area when the spell names none', () => {
    expect(compile({}, MASS_HEALING_WORD, 3).plan).toBeDefined()
    expect(targetOf(MASS_HEALING_WORD, 3)).toEqual({ kind: 'ACTORS', maxTargets: 6, area: null })
  })

  it('takes the travelling creatures of a teleport spell as a list (SPELLS-28)', () => {
    expect(targetOf(spellEffect('Word of Recall'), 6)).toEqual({
      kind: 'ACTORS',
      maxTargets: 6,
      area: null
    })
    expect(targetOf(spellEffect('Plane Shift'), 7)).toEqual({
      kind: 'ACTORS',
      maxTargets: 8,
      area: null
    })
  })

  it('plans Telepathic Bond as a one-hour bond that Intelligence 2 or less cannot join (SPELLS-28)', () => {
    const { action } = compile({}, spellEffect('Telepathic Bond'), 5)
    expect(targetOf(spellEffect('Telepathic Bond'), 5)).toEqual({
      kind: 'ACTORS',
      maxTargets: 8,
      area: null
    })
    const [plan, ...rest] =
      dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({
        action,
        published: dnd5eCharacterRuleActionSystemAdapter.compile({ action })
      }) ?? []
    expect(rest).toEqual([])
    expect(plan).toMatchObject({
      recurrenceStage: 'END_OF_TURN',
      initialRemaining: 600,
      actorLinkContribution: { linkKind: 'TELEPATHIC', excludesIntelligenceAtOrBelow: 2 }
    })
    expect(plan?.conditionContribution ?? null).toBeNull()
    expect(plan?.modifierGrantContribution ?? null).toBeNull()
  })

  describe('creature forms (D130)', () => {
    const GIANT_INSECT = spellEffect('Giant Insect')
    const formPlan = (effect: typeof FIREBALL) => {
      const { action } = compile({}, effect, 4)
      const [plan, ...rest] =
        dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({
          action,
          published: dnd5eCharacterRuleActionSystemAdapter.compile({ action })
        }) ?? []
      expect(rest).toEqual([])
      return plan
    }

    it('plans Giant Insect as a one-hour swap into the chosen form, with no carry-over', () => {
      expect(targetOf(GIANT_INSECT, 4)).toEqual({ kind: 'ACTORS', maxTargets: 10, area: null })
      expect(formPlan(GIANT_INSECT)).toMatchObject({
        recurrenceStage: 'END_OF_TURN',
        initialRemaining: 600,
        creatureFormContribution: {
          excessDamageCarriesOver: false,
          forms: [{ maxTargets: 10 }, { maxTargets: 3 }, { maxTargets: 5 }, { maxTargets: 1 }]
        }
      })
    })

    it('compiles a Polymorph-shaped authoring (excess damage carries over) on the same executor', () => {
      const polymorphShaped = JSON.parse(JSON.stringify(GIANT_INSECT)) as typeof GIANT_INSECT
      for (const path of polymorphShaped.paths ?? [])
        for (const outcome of path.resultBlock?.outcomes ?? [])
          if (outcome.effectKind === 'MANIFEST') outcome.excessDamageCarriesOver = true
      expect(formPlan(polymorphShaped)).toMatchObject({
        creatureFormContribution: { excessDamageCarriesOver: true }
      })
    })
  })

  it('refuses an area it cannot aim at a point, or a list that repeats a creature through a save', () => {
    expect(() =>
      compile({ shape: { id: 's', shapeKind: 'CUBE', edgeLength: feet(15) } }, MASS_CURE_WOUNDS, 5)
    ).toThrow(CharacterRuleActionUnsupportedCompilationError)
    expect(() =>
      compile({
        shape: undefined,
        targeting: {
          selectionKind: 'CHOSEN_CREATURES',
          dispositionKind: 'ANY',
          maxTargets: 3,
          allowRepeatedTargets: true
        }
      })
    ).toThrow(CharacterRuleActionUnsupportedCompilationError)
  })
})

describe('chosen-creature save compilation from the SRD (SPELLS-26)', () => {
  const ACID_SPLASH = spellEffect('Acid Splash')
  const CHAIN_LIGHTNING = spellEffect('Chain Lightning')
  const targetOf = (effect: typeof FIREBALL, castLevel: number) =>
    encounterActionChoiceTarget(
      buildCompiledActionTargetPolicy(compile({}, effect, castLevel).action)
    )

  it('takes a list of up to two creatures, each with its own save', () => {
    const { action, plan } = compile({}, ACID_SPLASH, 0)
    expect(plan?.kind).toBe('TEST_OUTCOME')
    expect(encounterActionTargetKind(buildCompiledActionTargetPolicy(action))).toBe('ACTORS')
    expect(targetOf(ACID_SPLASH, 0)).toEqual({ kind: 'ACTORS', maxTargets: 2, area: null })
  })

  it.each([
    [6, 4],
    [7, 5],
    [8, 6],
    [9, 7]
  ])(
    'takes one more creature for each level above the 6th (level %i, %i creatures)',
    (level, cap) => {
      expect(compile({}, CHAIN_LIGHTNING, level).plan?.kind).toBe('TEST_OUTCOME')
      expect(targetOf(CHAIN_LIGHTNING, level)).toEqual({
        kind: 'ACTORS',
        maxTargets: cap,
        area: null
      })
    }
  )
})

describe('chosen-creature projectile compilation from the SRD (SPELLS-26)', () => {
  const MAGIC_MISSILE = spellEffect('Magic Missile')
  const targetOf = (effect: typeof FIREBALL, castLevel: number) =>
    encounterActionChoiceTarget(
      buildCompiledActionTargetPolicy(compile({}, effect, castLevel).action)
    )

  it.each([
    [1, 3],
    [3, 5],
    [9, 11]
  ])('takes one dart per cap at level %i, a creature named once per dart', (level, darts) => {
    const { action, plan } = compile({}, MAGIC_MISSILE, level)
    expect(plan?.kind).toBe('SINGLE_GRAPH')
    expect(encounterActionTargetKind(buildCompiledActionTargetPolicy(action))).toBe('ACTORS')
    expect(targetOf(MAGIC_MISSILE, level)).toEqual({
      kind: 'ACTORS',
      maxTargets: darts,
      area: null,
      allowRepeatedTargets: true
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

describe('excluded creature types in a compiled save', () => {
  const UNDEAD = '00000000-0000-4000-8000-00000000d0d0'
  const singleTarget = { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' } as const

  it('compiles a single-target save that excludes a creature type, which the room warns about', () => {
    const plain = { range: { rangeKind: 'TOUCH' }, shape: undefined, targeting: singleTarget }
    expect(compile(plain as Partial<Invocation>).plan?.kind).toBe('TEST_OUTCOME')
    expect(
      compile({
        ...plain,
        targeting: { ...singleTarget, excludedCreatureTypeIds: [UNDEAD] }
      } as Partial<Invocation>).plan?.kind
    ).toBe('TEST_OUTCOME')
  })

  it('compiles a single-target save restricted to a creature type, which the room warns about', () => {
    expect(
      compile({
        range: { rangeKind: 'TOUCH' },
        shape: undefined,
        targeting: { ...singleTarget, allowedCreatureTypeIds: [UNDEAD] }
      } as Partial<Invocation>).plan?.kind
    ).toBe('TEST_OUTCOME')
  })

  it('still refuses an area restricted to a creature type', () => {
    expect(() =>
      compile({
        targeting: {
          selectionKind: 'AREA_CONTENTS',
          dispositionKind: 'ANY',
          allowedCreatureTypeIds: [UNDEAD]
        }
      } as Partial<Invocation>)
    ).toThrow(CharacterRuleActionUnsupportedCompilationError)
  })

  it('still refuses an area that excludes a creature type', () => {
    expect(() =>
      compile({
        targeting: {
          selectionKind: 'AREA_CONTENTS',
          dispositionKind: 'ANY',
          excludedCreatureTypeIds: [UNDEAD]
        }
      } as Partial<Invocation>)
    ).toThrow(CharacterRuleActionUnsupportedCompilationError)
  })
})
