import { describe, expect, it } from 'vitest'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import type { CompiledActionTargetPolicy } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { SceneGrid } from '@artificer-toolkit/shared/vtt'
import { glaive } from '@artificer-toolkit/source-data/srd/equipment/glaive.js'
import { longbow } from '@artificer-toolkit/source-data/srd/equipment/longbow.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'

import { normalizeCharacterActionMechanicFacts } from '../character/characterActionRuleFacts.js'
import { encounterActionChoiceRange } from '../encounterActionRange.js'
import { buildCompiledActionTargetPolicy } from '../encounterActionEntryPointCompiler.js'
import { evaluateEncounterAreaTargetPolicy } from '../encounterAreaAction.js'
import { evaluateDnd5e2014CharacterActions } from '../systems/dnd5e/characterActions.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'

type AuthoredEffect = Parameters<typeof compileEffect>[0]

const compiledEffectOf = (effect: AuthoredEffect | undefined) => {
  if (!effect) throw new Error('Missing SRD effect.')
  return compileEffect({ ...effect, id: ACTION_EFFECT_ID })
}

/** The target policy an Encounter Action compiles from one authored SRD effect. */
const policyOf = (effect: AuthoredEffect | undefined): CompiledActionTargetPolicy =>
  buildCompiledActionTargetPolicy(characterActionDescriptor(compiledEffectOf(effect)))

/** The range label the Sheet shows for one authored effect, through the real action model. */
function sheetRangeLabel(effect: AuthoredEffect | undefined): string | null {
  const output = evaluateDnd5e2014CharacterActions({
    candidates: [],
    abilityDefinitions: [],
    spellCandidates: [],
    spellSlots: [],
    spellMechanics: [],
    proficiencies: [],
    itemAdjustments: [],
    spellcastingLocked: false,
    spellEffects: [
      {
        spellId: 'spell',
        level: 3,
        magicSchoolId: 'evocation',
        readsCastLevel: false,
        effects: [
          {
            effectId: ACTION_EFFECT_ID,
            mechanicFacts: normalizeCharacterActionMechanicFacts(compiledEffectOf(effect))
          }
        ]
      }
    ],
    activeSourceIds: [],
    activeEquipmentInstanceIds: [],
    resources: [],
    modifierGroups: [],
    totalLevel: 1,
    classLevels: [],
    proficiencyBonus: 2,
    abilities: [],
    skills: [],
    spellcasting: null
  })
  return output.spellReferenceMechanics[0]!.mechanics[0]!.rangeLabel
}

const spellEffect = (label: string) =>
  srdSpells.find((spell) => spell.label === label)?.effects?.[0]
/** 100 px cells of 5 feet; a Medium token fills one cell and is anchored at its center. */
const FEET_GRID: SceneGrid = {
  kind: 'SQUARE',
  cellSize: 100,
  diagonalPolicy: 'EQUAL',
  distancePerCell: 5,
  origin: { x: 0, y: 0 },
  unit: 'FEET'
}
const SOURCE_TOKEN = { position: { x: 50, y: 50 }, width: 100, height: 100, rotationDegrees: 0 }
const SINGLE_TARGET: CompiledActionTargetPolicy['targeting'] = {
  selectionKind: 'SINGLE_TARGET',
  dispositionKind: 'ANY'
}
const feet = (amount: number) => ({ amount, unit: 'FEET' as const })

describe('encounter action range from SRD actions', () => {
  it.each([
    {
      name: 'a reach weapon (Glaive)',
      effect: glaive.effects?.[0],
      range: { kind: 'WITHIN', distance: feet(10) },
      label: '10 ft'
    },
    {
      name: 'a ranged weapon (Longbow)',
      effect: longbow.effects?.[0],
      range: { kind: 'RANGED', normal: feet(150), long: feet(600) },
      label: '150/600 ft'
    },
    {
      name: 'a Touch spell (Shocking Grasp)',
      effect: spellEffect('Shocking Grasp'),
      range: { kind: 'WITHIN', distance: feet(5) },
      label: 'Touch'
    },
    {
      name: 'a Touch spell whose excluded creature types only warn (Cure Wounds)',
      effect: spellEffect('Cure Wounds'),
      range: { kind: 'WITHIN', distance: feet(5) },
      label: 'Touch'
    },
    {
      name: 'a self spell (Shield)',
      effect: spellEffect('Shield'),
      range: { kind: 'SELF' },
      label: 'Self'
    },
    {
      name: 'a point-area spell (Fireball), whose origin the area evaluator measures',
      effect: spellEffect('Fireball'),
      range: { kind: 'WITHIN', distance: feet(150) },
      label: '150 ft'
    }
  ] as const)('maps $name to its range and label', ({ effect, range, label }) => {
    expect(encounterActionChoiceRange(policyOf(effect), 'Fallback')).toEqual({
      ...(range ? { range } : {}),
      rangeLabel: label
    })
  })

  it.each([
    { name: 'a ranged weapon (Longbow)', effect: longbow.effects?.[0], label: '150/600 ft' },
    {
      name: 'a Touch spell (Shocking Grasp)',
      effect: spellEffect('Shocking Grasp'),
      label: 'Touch'
    }
  ])('words $name the same on the Sheet and in the encounter choice', ({ effect, label }) => {
    expect(sheetRangeLabel(effect)).toBe(label)
    expect(encounterActionChoiceRange(policyOf(effect)).rangeLabel).toBe(label)
  })

  it('maps an unlimited range, the 0 ft swarm space and a distance in other units', () => {
    const choice = (range: CompiledActionTargetPolicy['range']) =>
      encounterActionChoiceRange({
        range,
        targeting: SINGLE_TARGET,
        shape: null,
        pathOverrides: []
      })
    expect(choice({ id: 'r', rangeKind: 'UNLIMITED' })).toEqual({
      range: { kind: 'UNLIMITED' },
      rangeLabel: 'Unlimited'
    })
    expect(choice({ id: 'r', rangeKind: 'DISTANCE', amount: 0, unit: 'FEET' })).toEqual({
      range: { kind: 'WITHIN', distance: feet(0) },
      rangeLabel: '0 ft'
    })
    expect(choice({ id: 'r', rangeKind: 'DISTANCE', amount: 1.5, unit: 'MILES' })).toEqual({
      range: { kind: 'WITHIN', distance: { amount: 1.5, unit: 'MILES' } },
      rangeLabel: '1.5 mi'
    })
  })

  it('leaves the range off for a sight or special range but keeps the authored label', () => {
    for (const [rangeKind, rangeLabel] of [
      ['SIGHT', 'Sight'],
      ['SPECIAL', 'Special']
    ] as const)
      expect(
        encounterActionChoiceRange(
          { range: { id: 'r', rangeKind }, targeting: null, shape: null, pathOverrides: [] },
          'Fallback'
        )
      ).toEqual({ rangeLabel })
  })

  it('advertises the origin range the area evaluator warns on, never a long range', () => {
    const policy = policyOf(spellEffect('Fireball'))
    const advertised = encounterActionChoiceRange(policy).range
    if (advertised?.kind !== 'WITHIN') throw new Error('Fireball advertises a WITHIN range.')
    const warningsAt = (distance: number) =>
      evaluateEncounterAreaTargetPolicy({
        targetPolicy: policy,
        // The token's near edge is 50 px from its center; 20 px is one foot.
        point: { x: 100 + distance * 20, y: 50 },
        grid: FEET_GRID,
        sourceToken: SOURCE_TOKEN,
        pointSeen: true
      })?.warnings.map(({ code }) => code)
    expect(warningsAt(advertised.distance.amount - 1)).toEqual([])
    expect(warningsAt(advertised.distance.amount + 1)).toEqual(['TARGET_OUT_OF_RANGE'])
  })

  it('advertises an unlimited point-area range and none for a range or path the evaluators refuse', () => {
    const area = (range: CompiledActionTargetPolicy['range']): CompiledActionTargetPolicy => ({
      ...policyOf(spellEffect('Fireball')),
      range
    })
    expect(encounterActionChoiceRange(area({ id: 'r', rangeKind: 'UNLIMITED' })).range).toEqual({
      kind: 'UNLIMITED'
    })
    // A touch origin is measured against the 5 ft. a single-target touch reaches.
    expect(encounterActionChoiceRange(area({ id: 'r', rangeKind: 'TOUCH' })).range).toEqual({
      kind: 'WITHIN',
      distance: { amount: 5, unit: 'FEET' }
    })
    for (const rangeKind of ['SELF', 'SIGHT', 'SPECIAL'] as const)
      expect(
        encounterActionChoiceRange(area({ id: 'r', rangeKind })).range,
        rangeKind
      ).toBeUndefined()
    expect(
      encounterActionChoiceRange({
        ...policyOf(longbow.effects?.[0]),
        pathOverrides: [
          {
            entryId: 'entry',
            pathGroupId: 'group',
            pathCode: 'path',
            pathOrder: 0,
            entryOrder: 0,
            range: null,
            targeting: { selectionKind: 'SINGLE_TARGET' }
          }
        ]
      }).range
    ).toBeUndefined()
  })

  it('advertises no range for a policy the single-target evaluator refuses', () => {
    const longbowPolicy = policyOf(longbow.effects?.[0])
    expect(encounterActionChoiceRange(longbowPolicy).range).toBeDefined()
    const refused: Record<string, Partial<CompiledActionTargetPolicy>> = {
      'area contents with no shape': {
        targeting: { selectionKind: 'AREA_CONTENTS', dispositionKind: 'ANY' }
      },
      'no disposition': { targeting: { selectionKind: 'SINGLE_TARGET' } },
      'no targeting': { targeting: null }
    }
    for (const [name, override] of Object.entries(refused))
      expect(
        encounterActionChoiceRange({ ...longbowPolicy, ...override }).range,
        name
      ).toBeUndefined()
  })

  it('keeps the label an action already carries when it has no policy', () => {
    expect(encounterActionChoiceRange(undefined, 'Touch')).toEqual({ rangeLabel: 'Touch' })
    expect(encounterActionChoiceRange(undefined)).toEqual({})
  })
})
