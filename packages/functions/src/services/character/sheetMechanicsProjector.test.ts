import type {
  CharacterSheetMechanicsInvocationRow,
  CharacterSheetMechanicsOwnerKind,
  CharacterSheetMechanicsOwnerRow,
  CharacterSheetMechanicsPathRow,
  CharacterSheetMechanicsQueryResult
} from '@artificer-toolkit/db'
import type { EngineCharacterOutput } from '@artificer-toolkit/shared/core'
import { describe, expect, it } from 'vitest'

import {
  projectCharacterSheetMechanics,
  type CharacterSheetMechanicsByOwner,
  type CharacterSheetProjectedMechanic
} from './sheetMechanicsProjector.js'

function numericCalculation(value: number) {
  return {
    base: value,
    contributions: [],
    effective: value
  }
}

const engine: EngineCharacterOutput = {
  characterId: 'character-1',
  systemId: 'system-1',
  proficiencies: [],
  senses: [],
  defenses: [],
  derivedStats: {
    proficiencyBonus: 3,
    abilityScores: {
      CHARISMA: 10,
      CONSTITUTION: 14,
      DEXTERITY: 16,
      INTELLIGENCE: 18,
      STRENGTH: 12,
      WISDOM: 14
    },
    abilityModifiers: {
      CHARISMA: 0,
      CONSTITUTION: 2,
      DEXTERITY: 3,
      INTELLIGENCE: 4,
      STRENGTH: 1,
      WISDOM: 2
    },
    savingThrows: {},
    skillBonuses: {},
    skillGoverningAbilities: {},
    passiveChecks: {},
    movementSpeeds: [],
    initiative: 3,
    armorClass: 15,
    maxHitPoints: 38,
    spellSaveDC: 15,
    spellAttackBonus: 7
  },
  calculations: {
    proficiencyBonus: numericCalculation(3),
    abilityScores: {},
    abilityModifiers: {},
    savingThrowProficiencyLevels: {},
    savingThrows: {},
    skillGoverningAbilities: {},
    skillProficiencyLevels: {},
    skillBonuses: {},
    passiveChecks: {},
    movementSpeeds: {},
    senseRanges: {},
    initiative: numericCalculation(3),
    armorClass: numericCalculation(15),
    maxHitPoints: numericCalculation(38),
    spellSaveDC: numericCalculation(15),
    spellAttackBonus: numericCalculation(7)
  },
  spellSlots: { maxByLevel: {}, fusionStrategy: 'SINGLE_CLASS' },
  resources: [],
  spellMechanics: [],
  spellAccess: [],
  itemMechanics: [],
  companions: [],
  activeItemContributions: []
}

describe('projectCharacterSheetMechanics', () => {
  it('resolves Fire Bolt at the current character-level breakpoint', () => {
    const result = project(
      mechanicsQuery({
        owners: [spellOwner('fire-bolt', 'Fire Bolt', 0)],
        ownerEffects: [ownerEffect('SPELL', 'fire-bolt', 'fire-bolt-effect')],
        invocations: [invocation('fire-bolt-effect', 'SPELL_ATTACK', 'fire-bolt-range')],
        paths: [fixedPath('fire-bolt-path', 'fire-bolt-effect', 'ON_HIT', 'fire-bolt-result')],
        outcomes: [outcome('fire-bolt-result', 'fire-bolt-damage', 'DAMAGE')],
        characteristics: [distanceRange('fire-bolt-range', 120)],
        damages: [
          {
            damageId: 'fire-bolt-damage',
            damageTypeId: 'fire',
            damageTypeCode: 'FIRE',
            damageTypeLabel: 'Fire',
            valueKind: 'DICE',
            scalingKind: 'BREAKPOINTS',
            amountKind: null,
            amountMultiplier: null,
            scalingSource: 'CHARACTER_LEVEL',
            classId: null,
            order: 1,
            valueId: null,
            amount: null,
            dice: null,
            valueMultiplier: null,
            valueMin: null,
            valueMax: null
          }
        ],
        damageScaling: [
          damageScaling('fire-bolt-damage', 1, '1d10'),
          damageScaling('fire-bolt-damage', 5, '2d10'),
          damageScaling('fire-bolt-damage', 11, '3d10'),
          damageScaling('fire-bolt-damage', 17, '4d10')
        ]
      }),
      5
    )

    const mechanic = requireMechanic(result, 'SPELL', 'fire-bolt')
    expect(mechanic).toEqual({
      effectId: 'fire-bolt-effect',
      trigger: 'SPELL_ATTACK',
      activation: { kind: 'ACTION', amount: 1 },
      rangeLabel: '120 ft',
      attackBonus: 7,
      outcomes: [
        {
          kind: 'DAMAGE',
          pathCode: 'ON_HIT',
          expression: '2d10',
          damageTypeId: 'fire',
          damageTypeLabel: 'Fire'
        }
      ]
    })
  })

  it('keeps Fireball failed- and successful-save damage as separate paths', () => {
    const result = project(
      mechanicsQuery({
        owners: [spellOwner('fireball', 'Fireball', 3)],
        ownerEffects: [ownerEffect('SPELL', 'fireball', 'fireball-effect')],
        invocations: [
          invocation('fireball-effect', 'SAVING_THROW', 'fireball-range', 'fireball-save')
        ],
        paths: [
          fixedPath('fireball-fail', 'fireball-effect', 'ON_SAVE_FAIL', 'fireball-fail-result', 1),
          fixedPath(
            'fireball-success',
            'fireball-effect',
            'ON_SAVE_SUCCESS',
            'fireball-success-result',
            2
          )
        ],
        outcomes: [
          outcome('fireball-fail-result', 'fireball-full-damage', 'DAMAGE'),
          outcome('fireball-success-result', 'fireball-half-damage', 'DAMAGE')
        ],
        characteristics: [distanceRange('fireball-range', 150)],
        savingThrows: [
          {
            savingThrowId: 'fireball-save',
            dcMethod: 'SOURCE_SAVE_DC',
            abilityCode: 'DEXTERITY',
            baseDc: null
          }
        ],
        damages: [
          spellCastDamage('fireball-full-damage', null),
          spellCastDamage('fireball-half-damage', 'HALF')
        ],
        damageScaling: [
          damageScaling('fireball-full-damage', 3, '8d6'),
          damageScaling('fireball-full-damage', 4, '9d6'),
          damageScaling('fireball-half-damage', 3, '8d6'),
          damageScaling('fireball-half-damage', 4, '9d6')
        ]
      })
    )

    const mechanic = requireMechanic(result, 'SPELL', 'fireball')
    expect(mechanic.save).toEqual({ ability: 'DEXTERITY', dc: 15 })
    expect(mechanic.outcomes).toEqual([
      {
        kind: 'DAMAGE',
        pathCode: 'ON_SAVE_FAIL',
        expression: '8d6',
        damageTypeId: 'fire',
        damageTypeLabel: 'Fire',
        scaling: [
          { level: 3, expression: '8d6' },
          { level: 4, expression: '9d6' }
        ]
      },
      {
        kind: 'DAMAGE',
        pathCode: 'ON_SAVE_SUCCESS',
        expression: 'half of 8d6',
        damageTypeId: 'fire',
        damageTypeLabel: 'Fire',
        scaling: [
          { level: 3, expression: 'half of 8d6' },
          { level: 4, expression: 'half of 9d6' }
        ]
      }
    ])
  })

  it('resolves Healing Word and exposes its cast-level progression', () => {
    const result = project(
      mechanicsQuery({
        owners: [spellOwner('healing-word', 'Healing Word', 1)],
        ownerEffects: [ownerEffect('SPELL', 'healing-word', 'healing-word-effect')],
        invocations: [
          {
            ...invocation('healing-word-effect', 'ACTIVATED', 'healing-word-range'),
            activationType: 'BONUS_ACTION'
          }
        ],
        paths: [
          fixedPath('healing-word-path', 'healing-word-effect', 'ON_USE', 'healing-word-result')
        ],
        outcomes: [outcome('healing-word-result', 'healing-word-heal', 'HEAL')],
        characteristics: [distanceRange('healing-word-range', 60)],
        genericOutcomes: [
          {
            outcomeId: 'healing-word-heal',
            effectKind: 'HEAL',
            payload: {
              id: 'healing-word-heal',
              effectKind: 'HEAL',
              valueKind: 'DICE',
              scalingKind: 'PER_LEVEL',
              scalingSource: 'SPELL_CAST_LEVEL',
              levels: [
                { id: 'healing-word-1', level: 1, order: 1, diceConfig: '1d4' },
                { id: 'healing-word-2', level: 2, order: 2, diceConfig: '2d4' }
              ],
              bonuses: [
                {
                  id: 'healing-word-spellcasting',
                  bonusKind: 'ABILITY_BONUS',
                  ability: 'SPELLCASTING',
                  order: 1
                }
              ]
            }
          }
        ]
      })
    )

    const mechanic = requireMechanic(result, 'SPELL', 'healing-word')
    expect(mechanic.activation).toEqual({ kind: 'BONUS_ACTION', amount: 1 })
    expect(mechanic.outcomes).toEqual([
      {
        kind: 'HEAL',
        pathCode: 'ON_USE',
        expression: '1d4 + 4',
        temporary: false,
        scaling: [
          { level: 1, expression: '1d4 + 4' },
          { level: 2, expression: '2d4 + 4' }
        ]
      }
    ])
  })

  it('keys a feature-option action independently from its owning feature', () => {
    const result = project(
      mechanicsQuery({
        owners: [
          {
            ownerKind: 'FEATURE_OPTION',
            ownerId: 'flamethrower',
            label: 'Flamethrower',
            description: 'A cone of arcane fire.',
            order: 1,
            chargeId: null
          }
        ],
        ownerEffects: [ownerEffect('FEATURE_OPTION', 'flamethrower', 'flamethrower-effect')],
        invocations: [
          invocation(
            'flamethrower-effect',
            'SAVING_THROW',
            'flamethrower-range',
            'flamethrower-save'
          )
        ],
        paths: [
          fixedPath(
            'flamethrower-path',
            'flamethrower-effect',
            'ON_SAVE_FAIL',
            'flamethrower-result'
          )
        ],
        outcomes: [outcome('flamethrower-result', 'flamethrower-damage', 'DAMAGE')],
        characteristics: [distanceRange('flamethrower-range', 15)],
        savingThrows: [
          {
            savingThrowId: 'flamethrower-save',
            dcMethod: 'DERIVED_DC',
            abilityCode: 'DEXTERITY',
            baseDc: 8
          }
        ],
        savingThrowBonuses: [
          {
            bonusId: 'flamethrower-intelligence',
            savingThrowId: 'flamethrower-save',
            order: 1,
            bonusKind: 'ABILITY_MODIFIER',
            abilityCode: 'INTELLIGENCE',
            amount: null
          },
          {
            bonusId: 'flamethrower-proficiency',
            savingThrowId: 'flamethrower-save',
            order: 2,
            bonusKind: 'PROFICIENCY_BONUS',
            abilityCode: null,
            amount: null
          }
        ],
        damages: [
          {
            damageId: 'flamethrower-damage',
            damageTypeId: 'fire',
            damageTypeCode: 'FIRE',
            damageTypeLabel: 'Fire',
            valueKind: 'DICE',
            scalingKind: 'NONE',
            amountKind: null,
            amountMultiplier: null,
            scalingSource: null,
            classId: null,
            order: 1,
            valueId: 'flamethrower-damage-value',
            amount: null,
            dice: '2d8',
            valueMultiplier: null,
            valueMin: null,
            valueMax: null
          }
        ]
      })
    )

    expect(result.FEATURE.has('flamethrower')).toBe(false)
    expect(requireMechanic(result, 'FEATURE_OPTION', 'flamethrower')).toEqual({
      effectId: 'flamethrower-effect',
      trigger: 'SAVING_THROW',
      activation: { kind: 'ACTION', amount: 1 },
      rangeLabel: '15 ft',
      save: { ability: 'DEXTERITY', dc: 15 },
      outcomes: [
        {
          kind: 'DAMAGE',
          pathCode: 'ON_SAVE_FAIL',
          expression: '2d8',
          damageTypeId: 'fire',
          damageTypeLabel: 'Fire'
        }
      ]
    })
  })
})

function project(queryResult: CharacterSheetMechanicsQueryResult, totalCharacterLevel = 8) {
  return projectCharacterSheetMechanics({
    queryResult,
    engine,
    totalCharacterLevel,
    classLevels: new Map([['wizard', totalCharacterLevel]])
  })
}

function requireMechanic(
  result: CharacterSheetMechanicsByOwner,
  kind: keyof CharacterSheetMechanicsByOwner,
  ownerId: string
): CharacterSheetProjectedMechanic {
  const mechanic = result[kind].get(ownerId)?.[0]
  if (!mechanic) throw new Error(`Missing ${kind} mechanic for ${ownerId}.`)
  return mechanic
}

function mechanicsQuery(
  overrides: Partial<CharacterSheetMechanicsQueryResult>
): CharacterSheetMechanicsQueryResult {
  return {
    owners: [],
    ownerAttributes: [],
    ownerEffects: [],
    ownerCharges: [],
    invocations: [],
    paths: [],
    choiceOptions: [],
    rollTableRows: [],
    resultBlocks: [],
    outcomes: [],
    characteristics: [],
    shapeDimensions: [],
    savingThrows: [],
    savingThrowBonuses: [],
    damages: [],
    damageScaling: [],
    damageBonusKinds: [],
    damageBonuses: [],
    conditions: [],
    genericOutcomes: [],
    charges: [],
    chargeScaling: [],
    chargeBonuses: [],
    ...overrides
  }
}

function spellOwner(id: string, label: string, level: number): CharacterSheetMechanicsOwnerRow {
  return {
    ownerKind: 'SPELL',
    ownerId: id,
    label,
    description: null,
    level,
    magicSchoolId: 'evocation',
    magicSchoolCode: 'EVOCATION',
    magicSchoolLabel: 'Evocation',
    castingTimeUnit: 'ACTION',
    castingTimeAmount: 1,
    materialDescription: null
  }
}

function ownerEffect(
  ownerKind: CharacterSheetMechanicsOwnerKind,
  ownerId: string,
  effectId: string
): CharacterSheetMechanicsQueryResult['ownerEffects'][number] {
  return { ownerKind, ownerId, effectId, ownerEffectOrder: 1, effectOrder: 1 }
}

function invocation(
  effectId: string,
  triggerCode: string,
  rangeCharacteristicId: string,
  savingThrowId: string | null = null
): CharacterSheetMechanicsInvocationRow {
  return {
    effectId,
    triggerCode,
    activationType: 'ACTION',
    activationValue: 1,
    rangeCharacteristicId,
    shapeCharacteristicId: null,
    savingThrowId,
    targetSelectionKind: null,
    targetDispositionKind: null,
    maxTargets: null,
    maxTargetsScaling: null,
    excludedCreatureTypeIds: null
  }
}

function fixedPath(
  pathId: string,
  effectId: string,
  pathCode: string,
  resultBlockId: string,
  order = 1
): CharacterSheetMechanicsPathRow {
  return {
    pathId,
    effectId,
    order,
    pathCode,
    groupType: 'SINGLE',
    selectionKind: 'FIXED',
    originKind: null,
    rangeOverrideCharacteristicId: null,
    targetSelectionKind: null,
    targetDispositionKind: null,
    maxTargets: null,
    maxTargetsScaling: null,
    excludedCreatureTypeIds: null,
    resultBlockId,
    rollTableKind: null,
    die: null
  }
}

function outcome(
  resultBlockId: string,
  outcomeId: string,
  effectKind: string
): CharacterSheetMechanicsQueryResult['outcomes'][number] {
  return { resultBlockId, outcomeId, effectKind, order: 1 }
}

function distanceRange(
  characteristicId: string,
  amount: number
): CharacterSheetMechanicsQueryResult['characteristics'][number] {
  return {
    characteristicId,
    code: 'RANGE',
    rangeKind: 'DISTANCE',
    rangeMin: amount,
    rangeMax: null,
    rangeUnitCode: 'FEET',
    rangeScaling: null,
    shapeKind: null,
    durationKind: null,
    durationAmount: null,
    durationScaling: null
  }
}

function damageScaling(
  damageId: string,
  level: number,
  dice: string
): CharacterSheetMechanicsQueryResult['damageScaling'][number] {
  return {
    scalingId: `${damageId}-${level}`,
    damageId,
    level,
    order: level,
    amount: null,
    dice
  }
}

function spellCastDamage(
  damageId: string,
  amountKind: string | null
): CharacterSheetMechanicsQueryResult['damages'][number] {
  return {
    damageId,
    damageTypeId: 'fire',
    damageTypeCode: 'FIRE',
    damageTypeLabel: 'Fire',
    valueKind: 'DICE',
    scalingKind: 'PER_LEVEL',
    amountKind,
    amountMultiplier: null,
    scalingSource: 'SPELL_CAST_LEVEL',
    classId: null,
    order: 1,
    valueId: null,
    amount: null,
    dice: null,
    valueMultiplier: null,
    valueMin: null,
    valueMax: null
  }
}
