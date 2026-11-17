import { describe, expect, it } from 'vitest'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import {
  SRD_CONDITION_TYPES,
  SRD_CREATURE_TYPES,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
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
  encounterActionTargetKind,
  evaluateEncounterAreaTargetPolicy,
  evaluateEncounterCasterCenteredAreaTarget
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
  spellCastLevel?: number,
  characterLevel?: number
) {
  const action = {
    ...characterActionDescriptor(
      compileEffect({
        ...effect,
        id: ACTION_EFFECT_ID,
        invocation: JSON.parse(JSON.stringify({ ...effect.invocation, ...invocation }))
      }),
      spellCastLevel,
      characterLevel
    ),
    conditionDefinitionIds: SRD_CONDITION_TYPES.map((condition) => condition.id)
  }
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
      'a cone scaled by Character level',
      {
        id: 's',
        shapeKind: 'CONE',
        length: {
          ...feet(15),
          scaling: {
            scalingKind: 'BREAKPOINTS',
            scalingSource: 'CHARACTER_LEVEL',
            breakpoints: [{ id: 'b', level: 4, order: 1, value: feet(30) }]
          }
        }
      }
    ],
    ['a line of no width', { id: 's', shapeKind: 'LINE', length: feet(100), width: feet(0) }],
    [
      'a line with a width scaled by Character level',
      {
        id: 's',
        shapeKind: 'LINE',
        length: feet(100),
        width: {
          ...feet(5),
          scaling: {
            scalingKind: 'BREAKPOINTS',
            scalingSource: 'CHARACTER_LEVEL',
            breakpoints: [{ id: 'b', level: 4, order: 1, value: feet(10) }]
          }
        }
      }
    ],
    ['a self wall', { id: 's', shapeKind: 'WALL', length: feet(60), height: feet(20) }],
    ['a self dome', { id: 's', shapeKind: 'DOME', radius: feet(10) }]
  ])('still refuses %s', (_name, shape) => {
    // Only the spell's cast level resolves an area's size at the cast (QUALITY-15.T3ac).
    expect(() => compile({ range: SELF, shape })).toThrow(
      CharacterRuleActionUnsupportedCompilationError
    )
  })

  it('aims a cone scaled by the cast level at the length it is at the cast', () => {
    const shape: NonNullable<Invocation['shape']> = {
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
    const at = (level: number) =>
      buildCompiledActionTargetPolicy(compile({ range: SELF, shape }, FIREBALL, level).action)
    expect(at(3).shape).toEqual({ id: 's', shapeKind: 'CONE', length: feet(15) })
    expect(encounterActionChoiceTarget(at(4))).toMatchObject({
      kind: 'DIRECTED',
      area: { kind: 'CONE', length: feet(30) }
    })
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

describe('area centered on its user over a distance range (QUALITY-15.T3ac3)', () => {
  const sphere = { id: 's', shapeKind: 'SPHERE', radius: feet(20) } as const

  it('compiles SRD Find Traps to a GM ruling over the sphere centered on its caster, keeping its 120 ft range', () => {
    const { action, plan } = compile({}, spellEffect('Find Traps'))
    expect(plan?.kind).toBe('SINGLE_GRAPH')
    const policy = buildCompiledActionTargetPolicy(action)
    expect(policy.range).toMatchObject({ rangeKind: 'DISTANCE', amount: 120, unit: 'FEET' })
    expect(encounterActionTargetKind(policy)).toBe('CASTER_CENTERED')
    expect(encounterActionChoiceTarget(policy)).toEqual({
      kind: 'CASTER_CENTERED',
      area: { kind: 'RADIUS', radius: feet(120) }
    })
  })

  it('centers a distance-ranged sphere on its user only when the shape says so', () => {
    const centered = buildCompiledActionTargetPolicy(
      compile({ shape: { ...sphere, centeredOnUser: true } }).action
    )
    expect(encounterActionTargetKind(centered)).toBe('CASTER_CENTERED')
    expect(compileEncounterPointArea(centered, FEET_GRID)).toEqual({
      kind: 'RADIUS',
      radius: 4 * FEET_GRID.cellSize
    })
    const aimed = compile({ shape: sphere })
    expect(encounterActionTargetKind(buildCompiledActionTargetPolicy(aimed.action))).toBe('POINT')
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
      actorLinkContribution: {
        linkKind: 'TELEPATHIC',
        excludesAbilityAtOrBelow: { ability: 'INTELLIGENCE', score: 2 }
      }
    })
    expect(plan?.conditionContributions ?? []).toEqual([])
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
        if (path.selectionKind === 'FIXED')
          for (const outcome of path.resultBlock.outcomes)
            if (outcome.effectKind === 'MANIFEST' && outcome.manifestKind === 'CREATURE')
              outcome.excessDamageCarriesOver = true
      expect(formPlan(polymorphShaped)).toMatchObject({
        creatureFormContribution: { excessDamageCarriesOver: true }
      })
    })

    it('plans Polymorph as a save whose failure enters any beast, with the excess carried over', () => {
      const POLYMORPH = spellEffect('Polymorph')
      const { action, plan } = compile({}, POLYMORPH, 4)
      expect(plan?.kind).toBe('TEST_OUTCOME')
      expect(
        encounterActionChoiceTarget(
          buildCompiledActionTargetPolicy(action),
          formPlan(POLYMORPH)?.creatureFormContribution
        )
      ).toEqual({ kind: 'ACTORS', maxTargets: 1, area: null, choosesCreatureForm: true })
      expect(formPlan(POLYMORPH)).toMatchObject({
        initialRemaining: 600,
        resultGate: { paths: ['ON_SAVE_FAIL'] },
        creatureFormContribution: {
          excessDamageCarriesOver: true,
          // Polymorph replaces every score, the mental ones included.
          retainedAbilityIds: [],
          // Polymorph replaces the holder's proficiencies with the form's (D191).
          retainsProficiencies: false,
          holderEnd: null,
          endOnConditionIds: [],
          forms: [],
          filter: { challengeRatingCapKind: 'TARGET', maxChallengeRatingId: null }
        }
      })
    })

    it('refuses a creature form after a save that no bounded timed form can carry', () => {
      const untimed = JSON.parse(JSON.stringify(spellEffect('Polymorph'))) as typeof GIANT_INSECT
      for (const path of untimed.paths ?? [])
        if (path.selectionKind === 'FIXED') path.resultBlock.duration = undefined
      expect(() => compile({}, untimed, 4)).toThrow(CharacterRuleActionUnsupportedCompilationError)
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

describe('chosen-creature attack compilation from the SRD (SPELLS-26)', () => {
  const SCORCHING_RAY = spellEffect('Scorching Ray')
  const ELDRITCH_BLAST = spellEffect('Eldritch Blast')
  const targetOf = (action: ReturnType<typeof compile>['action']) =>
    encounterActionChoiceTarget(buildCompiledActionTargetPolicy(action))

  it.each([
    [2, 3],
    [3, 4],
    [9, 10]
  ])('takes one ray per cap at slot level %i, several at one creature', (level, rays) => {
    const { action, plan } = compile({}, SCORCHING_RAY, level)
    expect(plan?.kind).toBe('TEST_OUTCOME')
    expect(encounterActionTargetKind(buildCompiledActionTargetPolicy(action))).toBe('ACTORS')
    expect(targetOf(action)).toEqual({
      kind: 'ACTORS',
      maxTargets: rays,
      area: null,
      allowRepeatedTargets: true
    })
  })

  it.each([
    [1, 1],
    [4, 1],
    [5, 2],
    [10, 2],
    [11, 3],
    [16, 3],
    [17, 4],
    [20, 4]
  ])('takes one beam per cap at Character level %i (%i beams)', (level, beams) => {
    const { action, plan } = compile({}, ELDRITCH_BLAST, 0, level)
    expect(plan?.kind).toBe('TEST_OUTCOME')
    expect(targetOf(action)).toEqual({
      kind: 'ACTORS',
      maxTargets: beams,
      area: null,
      allowRepeatedTargets: true
    })
  })

  it('refuses a beam cap when the Character has no level, as it refuses a single-target cast', () => {
    const { action } = compile({}, ELDRITCH_BLAST, 0)
    expect(encounterActionTargetKind(buildCompiledActionTargetPolicy(action))).toBeNull()
  })

  it('refuses an attack list that names an area', () => {
    const area = FIREBALL.invocation.shape
    expect(() => compile({ shape: area }, SCORCHING_RAY, 2)).toThrow(
      CharacterRuleActionUnsupportedCompilationError
    )
  })
})

describe('area action compilation refusals', () => {
  const refused: Array<[string, Partial<Invocation>]> = [
    ['a cone', { shape: { id: 's', shapeKind: 'CONE', length: feet(15) } }],
    ['a line', { shape: { id: 's', shapeKind: 'LINE', length: feet(100), width: feet(5) } }],
    ['a wall', { shape: { id: 's', shapeKind: 'WALL', length: feet(60), height: feet(20) } }],
    ['a dome', { shape: { id: 's', shapeKind: 'DOME', radius: feet(10) } }],
    ['a touch range', { range: { id: 'r', rangeKind: 'TOUCH' } }],
    // Only the spell's cast level resolves an area's size at the cast (QUALITY-15.T3ac).
    [
      'a radius scaled by Character level',
      {
        shape: {
          id: 's',
          shapeKind: 'SPHERE',
          radius: {
            ...feet(20),
            scaling: {
              scalingKind: 'BREAKPOINTS',
              scalingSource: 'CHARACTER_LEVEL',
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

  // The area still catches a creature of a type it has no effect on; the room leaves it out of the
  // saves (SPELLS-33.T3a3).
  it.each([
    ['restricted to a creature type', { allowedCreatureTypeIds: [UNDEAD] }],
    ['that excludes a creature type', { excludedCreatureTypeIds: [UNDEAD] }]
  ])('compiles an area %s, carrying the restriction on its target policy', (_name, restriction) => {
    const { action, plan } = compile({
      targeting: { selectionKind: 'AREA_CONTENTS', dispositionKind: 'ANY', ...restriction }
    } as Partial<Invocation>)
    expect(plan?.kind).toBe('TEST_OUTCOME')
    expect(buildCompiledActionTargetPolicy(action).targeting).toMatchObject(restriction)
  })
})

describe('chosen-creature spells in the SRD corpus (SPELLS-26.1)', () => {
  /** Whether the effect compiles, and the reason it does not. */
  const outcomeOf = (run: () => unknown) => {
    try {
      run()
      return { compiled: true as const }
    } catch (error) {
      if (!(error instanceof CharacterRuleActionUnsupportedCompilationError)) throw error
      return { compiled: false as const, reason: error.message }
    }
  }
  const capped = srdSpells.flatMap((spell) =>
    (spell.effects ?? []).flatMap((effect) => {
      const { targeting } = effect.invocation
      return targeting?.selectionKind === 'CHOSEN_CREATURES' &&
        (targeting.maxTargets !== undefined || targeting.maxTargetsScaling !== undefined)
        ? [{ label: `${spell.label} (${effect.id})`, level: spell.level, effect, targeting }]
        : []
    })
  )

  it('finds the capped chosen-creature spells', () => {
    expect(capped.length).toBeGreaterThan(0)
  })

  it.each(capped.map((entry) => [entry.label, entry] as const))(
    '%s compiles, or is refused for the reason a single-target cast is',
    (_label, { level, effect, targeting }) => {
      const cast = (invocationTargeting: Invocation['targeting']) =>
        outcomeOf(() => compile({ targeting: invocationTargeting }, effect, level, 20).plan)
      const authored = cast(targeting)
      const single = cast({
        selectionKind: 'SINGLE_TARGET',
        dispositionKind: targeting.dispositionKind
      })
      if (!authored.compiled)
        expect(single, 'the list is refused, though a single target is not').toEqual(authored)
    }
  )
})

describe('a timed save condition with no authored way to end early (SPELLS-19.T3)', () => {
  /** `effect` with its repeat save left unauthored, as a spell that prints one but does not author it. */
  const withoutRepeatSave = (effect: typeof FIREBALL): typeof FIREBALL => ({
    ...effect,
    paths: effect.paths.map((path) =>
      path.selectionKind === 'FIXED'
        ? {
            ...path,
            resultBlock: {
              ...path.resultBlock,
              resultKind: 'SINGLE' as const,
              outcomes: path.resultBlock.outcomes.filter(
                ({ effectKind }) => effectKind !== 'FOLLOW_UP_SAVE'
              )
            }
          }
        : path
    )
  })

  // A spell that prints a repeat save or an early end the effect does not author would run its
  // condition to its full duration and drop that rule.
  it.each(['Dominate Beast', 'Dominate Person', 'Dominate Monster'])(
    'refuses %s rather than run its condition without the rider the spell prints',
    (label) => {
      expect(() => compile({}, withoutRepeatSave(spellEffect(label)), 9, 20)).toThrow(
        CharacterRuleActionUnsupportedCompilationError
      )
    }
  )

  it.each(['Dominate Beast', 'Dominate Person', 'Dominate Monster'])(
    'compiles %s once its damage-triggered repeat save is authored (QUALITY-15.T3k)',
    (label) => {
      expect(compile({}, spellEffect(label), 9, 20).plan?.kind).toBe('TEST_OUTCOME')
    }
  )

  it('compiles Hold Monster once its printed repeat save is authored (SPELLS-31.T5l)', () => {
    expect(compile({}, spellEffect('Hold Monster'), 9, 20).plan?.kind).toBe('TEST_OUTCOME')
  })
})

describe('hit-point pool area compilation from the SRD (SPELLS-27.T8)', () => {
  const SLEEP = spellEffect('Sleep')
  const unconscious = srdSystemRecord.conditionTypes.find(({ code }) => code === 'UNCONSCIOUS')
  const undead = SRD_CREATURE_TYPES.find(({ code }) => code === 'UNDEAD')
  if (!unconscious || !undead)
    throw new Error('The SRD names the Unconscious condition and Undead.')

  /** Sleep written out from core options alone: the SRD helpers and ids are not used. */
  const AUTHORED_SLEEP: typeof SLEEP = {
    id: '00000000-0000-4000-8000-000000008201',
    order: 1,
    invocation: {
      kind: 'ACTION',
      triggerCode: 'ACTIVATED',
      activation: { code: 'ACTION', amount: 1 },
      range: {
        id: '00000000-0000-4000-8000-000000008202',
        rangeKind: 'DISTANCE',
        amount: 90,
        unit: 'FEET'
      },
      targeting: {
        selectionKind: 'AREA_CONTENTS',
        dispositionKind: 'ANY',
        excludedCreatureTypeIds: [undead.id],
        hitPointPool: { diceConfig: '5d8' },
        hitPointPoolIgnoredConditionIds: [unconscious.id],
        hitPointPoolScaling: {
          scalingKind: 'BREAKPOINTS',
          scalingSource: 'SPELL_CAST_LEVEL',
          breakpoints: Array.from({ length: 8 }, (_, index) => ({
            id: `00000000-0000-4000-8000-00000000821${index}`,
            level: index + 2,
            order: index + 1,
            value: { diceConfig: `${7 + index * 2}d8` }
          }))
        }
      },
      shape: {
        id: '00000000-0000-4000-8000-000000008203',
        shapeKind: 'SPHERE',
        radius: { amount: 20, unit: 'FEET' }
      }
    },
    paths: [
      {
        id: '00000000-0000-4000-8000-000000008204',
        order: 1,
        pathCode: 'ON_USE',
        groupType: 'SINGLE',
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: '00000000-0000-4000-8000-000000008205',
          resultKind: 'SINGLE',
          duration: {
            id: '00000000-0000-4000-8000-000000008206',
            durationKind: 'MINUTE',
            amount: 1
          },
          lifecycle: { endTriggers: [{ event: 'DAMAGE_TAKEN', by: 'ANYONE' }] },
          outcomes: [
            {
              id: '00000000-0000-4000-8000-000000008207',
              effectKind: 'CONDITION',
              conditionId: unconscious.id
            }
          ]
        }
      }
    ]
  }

  it('compiles Sleep to the one-roll plan over a point sphere, carrying its pool and exclusions', () => {
    const { action, plan } = compile({}, SLEEP, 1)
    expect(plan?.kind).toBe('SINGLE_GRAPH')
    const policy = buildCompiledActionTargetPolicy(action)
    expect(encounterActionTargetKind(policy)).toBe('POINT')
    expect(policy.range).toMatchObject({ rangeKind: 'DISTANCE', amount: 90, unit: 'FEET' })
    expect(policy.shape).toMatchObject({ shapeKind: 'SPHERE', radius: feet(20) })
    expect(policy.targeting).toMatchObject({
      selectionKind: 'AREA_CONTENTS',
      excludedCreatureTypeIds: [undead.id],
      hitPointPool: { diceConfig: '5d8' }
    })
  })

  it.each([
    [1, '5d8'],
    [2, '7d8'],
    [5, '13d8'],
    [9, '21d8']
  ])('rolls the pool the slot level %i gives: %s', (level, diceConfig) => {
    const policy = buildCompiledActionTargetPolicy(compile({}, SLEEP, level).action)
    expect(policy.targeting).toMatchObject({ hitPointPool: { diceConfig } })
    expect(policy.targeting).not.toHaveProperty('hitPointPoolScaling')
  })

  it('compiles Sleep authored from core options alone to the same plan and policy as the SRD', () => {
    for (const level of [1, 4]) {
      const srd = compile({}, SLEEP, level)
      const authored = compile({}, AUTHORED_SLEEP, level)
      expect(authored.plan?.kind).toBe(srd.plan?.kind)
      expect(buildCompiledActionTargetPolicy(authored.action).targeting).toEqual(
        buildCompiledActionTargetPolicy(srd.action).targeting
      )
    }
  })
})

describe('area ruling compilation from the SRD (QUALITY-15.T3m)', () => {
  // Each area that tests no one and leaves each creature it catches to the GM compiles to the one
  // ruling plan the room commits at once over the creatures it catches.
  it.each([
    ['Gust of Wind', 'DIRECTED'],
    ['Zone of Truth', 'POINT'],
    ['Purify Food and Drink', 'POINT'],
    ['Private Sanctum', 'POINT'],
    ['Reverse Gravity', 'POINT'],
    ['Major Image', 'POINT'],
    ['Minor Illusion', 'POINT'],
    ['Programmed Illusion', 'POINT'],
    ['Move Earth', 'POINT'],
    ['Fabricate', 'POINT'],
    ['Creation', 'POINT'],
    ['Detect Magic', 'CASTER_CENTERED'],
    ['Detect Poison and Disease', 'CASTER_CENTERED'],
    ['Speak with Plants', 'CASTER_CENTERED'],
    // QUALITY-15.T3ac: a Sight range, a Self radius and a size scaled by the slot level.
    ['Storm of Vengeance', 'POINT'],
    ['Control Weather', 'CASTER_CENTERED'],
    ['Create or Destroy Water', 'POINT']
  ] as const)('compiles %s to a GM ruling over the %s area it catches', (label, targetKind) => {
    const effect = spellEffect(label)
    const { action, plan } = compile({}, effect)
    expect(plan?.kind).toBe('SINGLE_GRAPH')
    const policy = buildCompiledActionTargetPolicy(action)
    expect(policy.targeting?.selectionKind).toBe('AREA_CONTENTS')
    expect(policy.targeting).not.toHaveProperty('hitPointPool')
    expect(encounterActionTargetKind(policy)).toBe(targetKind)
  })

  it('places the Storm of Vengeance cloud at any point its caster sees, however far', () => {
    const policy = buildCompiledActionTargetPolicy(
      compile({}, spellEffect('Storm of Vengeance')).action
    )
    const place = (pointSeen: boolean) =>
      evaluateEncounterAreaTargetPolicy({
        targetPolicy: policy,
        point: { x: 100_000, y: 0 },
        grid: FEET_GRID,
        sourceToken: { position: { x: 0, y: 0 }, width: 100, height: 100, rotationDegrees: 0 },
        pointSeen
      })
    // 360 feet is 72 cells of 100px.
    expect(place(true)).toEqual({ shape: { kind: 'RADIUS', radius: 7200 }, warnings: [] })
    expect(place(false)?.warnings.map(({ code }) => code)).toEqual(['TARGET_OUT_OF_SIGHT'])
  })

  it('centers Control Weather on its caster, 5 miles around', () => {
    const policy = buildCompiledActionTargetPolicy(
      compile({}, spellEffect('Control Weather')).action
    )
    const area = evaluateEncounterCasterCenteredAreaTarget({
      targetPolicy: policy,
      grid: FEET_GRID,
      sourceToken: { position: { x: 0, y: 0 }, width: 100, height: 100 }
    })
    // 5 miles is 26,400 feet: 5,280 cells of 100px.
    expect(area).toEqual({ shape: { kind: 'RADIUS', radius: 528_000 }, warnings: [] })
  })

  it.each([
    [1, 30],
    [2, 35],
    [5, 50],
    [9, 70]
  ])('sizes the Create or Destroy Water cube at slot level %i: %i feet', (level, edge) => {
    const effect = spellEffect('Create or Destroy Water')
    const policy = buildCompiledActionTargetPolicy(compile({}, effect, level).action)
    expect(policy.shape).toEqual({
      id: effect.invocation.shape?.id,
      shapeKind: 'CUBE',
      edgeLength: feet(edge)
    })
    expect(compileEncounterPointArea(policy, FEET_GRID)).toEqual({
      kind: 'CUBE',
      edgeLength: (edge / 5) * FEET_GRID.cellSize
    })
  })

  // Each area row that stays refused, with why it stays refused.
  it.each([
    // A passage aimed into a surface from a point within range is a line placed away from its
    // caster: the room aims a line only from its caster.
    ['Passwall', 'D&D area shape is not one its range places.'],
    // The warded area is "shaped as you desire": the SRD gives it no shape.
    ['Guards and Wards', "D&D area outside its user's own space must name its shape."],
    // Find Traps' "within range" is a sphere centered on its caster (QUALITY-15.T3ac3, above).
    // A summoned or created creature is a summon, not a ruling on the creatures an area catches.
    ['Planar Ally', "D&D area outside its user's own space must name its shape."],
    ['Create Undead', "D&D area outside its user's own space must name its shape."]
  ])('still refuses %s', (label, reason) => {
    expect(() => compile({}, spellEffect(label))).toThrow(reason)
  })

  it('refuses an area that tests no one when its outcome is not a GM ruling', () => {
    // Sleep's Unconscious over its sphere, with no hit-point pool deciding who it reaches.
    const targeting = { selectionKind: 'AREA_CONTENTS', dispositionKind: 'ANY' } as const
    expect(() => compile({ targeting }, spellEffect('Sleep'), 1)).toThrow(
      'D&D area that tests no one must land its timed pool condition or GM ruling.'
    )
  })
})
