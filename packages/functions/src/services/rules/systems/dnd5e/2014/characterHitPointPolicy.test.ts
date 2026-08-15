import { describe, expect, it } from 'vitest'

import {
  type CharacterAssemblyRegistry,
  type CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'
import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema,
  type CharacterRulePolicyInput
} from '@artificer-toolkit/schema/api/characterRules'

import { buildCharacterDerivedRuleFacts } from '../../../../character/characterDerivedRuleFacts.js'
import { compileCharacterGrantFoldRuleFacts } from '../../../../character/characterGrantFoldRuleFacts.js'
import { buildCharacterHitPointRuleFacts } from '../../../../character/characterHitPointRuleFacts.js'
import { dnd5e2014CharacterPolicyDocument } from './characterPolicy.js'
import { evaluateZenRuleModel } from '../../../zenRuleEngine.js'

const registry: CharacterAssemblyRegistry = {
  classes: {},
  equipment: {},
  feats: {},
  races: {},
  spells: {},
  features: {
    'constitution-bonus': {
      modifiers: [
        {
          id: 'constitution-bonus',
          grantKind: 'MODIFIER_GRANT',
          order: 0,
          selectionKind: 'GRANTED',
          valueDomainCode: 'ABILITY_SCORE',
          modifierKind: 'BONUS',
          domain: { ability: 'CONSTITUTION' },
          scope: 'GLOBAL',
          payload: { amount: 2 }
        }
      ]
    },
    'hit-point-bonus': {
      modifiers: [
        {
          id: 'hit-point-bonus',
          grantKind: 'MODIFIER_GRANT',
          order: 0,
          selectionKind: 'GRANTED',
          valueDomainCode: 'HIT_POINTS_MAX',
          modifierKind: 'BONUS',
          domain: {},
          scope: 'GLOBAL',
          payload: { amount: 4 }
        }
      ]
    }
  }
}

function snapshot(): CharacterBuildSnapshot {
  return {
    characterId: 'character-1',
    systemId: 'dnd5e2014',
    totalLevel: 2,
    classes: [],
    abilities: { CONSTITUTION: 12 },
    hitpoints: [
      { classId: 'fighter', classLevel: 1, value: 12 },
      { classId: 'fighter', classLevel: 2, value: 8 }
    ],
    features: [
      {
        featureId: 'constitution-bonus',
        source: { kind: 'FEATURE', featureId: 'constitution-bonus' },
        timing: { kind: 'IMMEDIATE' }
      },
      {
        featureId: 'hit-point-bonus',
        source: { kind: 'FEATURE', featureId: 'hit-point-bonus' },
        timing: { kind: 'IMMEDIATE' }
      }
    ],
    equipmentItems: [],
    adjustments: [
      {
        id: 'manual-con',
        family: 'ABILITY',
        ability: 'CONSTITUTION',
        field: 'OTHER_MODIFIER',
        value: 2
      },
      { id: 'manual-hp', family: 'HIT_POINTS', field: 'MAXIMUM_MODIFIER', value: 3 }
    ]
  }
}

type HitPointProgression = NonNullable<
  NonNullable<CharacterRulePolicyInput['hitPointFacts']>['progression']
>

async function evaluateOutput(
  value: CharacterBuildSnapshot,
  progression: HitPointProgression | null = null
) {
  const input = characterRulePolicyInputSchema.parse({
    contractVersion: 4,
    grantFoldFacts: compileCharacterGrantFoldRuleFacts({
      snapshot: value,
      registry
    }),
    totalLevel: value.totalLevel,
    derivedBaseFacts: buildCharacterDerivedRuleFacts(value, registry),
    ...buildCharacterHitPointRuleFacts(value, progression),
    spellAccessCandidates: [],
    spellClasses: [],
    spellPreparationClasses: [],
    spellPreparationCatalog: [],
    spellPreparationRequest: null,
    spellCastCandidates: [],
    spellCastSlots: [],
    spellCastResources: [],
    spellcastingClasses: [],
    chargeCalculations: [],
    eligibilityFacets: [],
    rest: { totalHitDice: 0, currentExhaustion: 0, attunementSlotOverride: null }
  })
  const result = await evaluateZenRuleModel({
    document: dnd5e2014CharacterPolicyDocument,
    modelKey: 'character-policy',
    context: input
  })
  return characterRulePolicyOutputSchema.parse(result.result)
}

async function evaluate(value: CharacterBuildSnapshot) {
  return (await evaluateOutput(value)).derivedStats.maxHitPoints
}

describe('D&D 5e 2014 Character maximum hit point policy', () => {
  it('matches pre-manual Constitution baseline, manual delta, modifier, and override suppression', async () => {
    const value = { ...snapshot(), systemId: 'dnd5e' }
    const resolved = await evaluate(value)
    expect(resolved.effective).toBe(29)
    expect(resolved.contributions).toContainEqual(
      expect.objectContaining({
        sourceId: 'hit-points:constitution-modifier-delta',
        source: { kind: 'SYSTEM', systemId: value.systemId }
      })
    )
    const overridden = await evaluate({
      ...value,
      adjustments: [
        ...(value.adjustments ?? []),
        { id: 'override', family: 'HIT_POINTS', field: 'MAXIMUM_OVERRIDE', value: -2 }
      ]
    })
    expect(overridden.effective).toBe(-2)
    expect(
      overridden.contributions.every((contribution) => contribution.state === 'SUPPRESSED')
    ).toBe(true)
  })

  it('preserves empty level-zero and negative maximums without clamping', async () => {
    const empty: CharacterBuildSnapshot = {
      ...snapshot(),
      totalLevel: 0,
      abilities: {},
      hitpoints: [],
      features: [],
      adjustments: []
    }
    const negative: CharacterBuildSnapshot = {
      ...empty,
      hitpoints: [{ classId: 'fighter', classLevel: 0, value: -4 }],
      adjustments: [
        { id: 'negative-modifier', family: 'HIT_POINTS', field: 'MAXIMUM_MODIFIER', value: -3 }
      ]
    }

    await expect(evaluate(empty)).resolves.toMatchObject({ effective: 0 })
    await expect(evaluate(negative)).resolves.toMatchObject({ effective: -7 })
  })

  it('resolves fixed and manual Builder progression from same-evaluation abilities', async () => {
    const value = { ...snapshot(), totalLevel: 4, systemId: 'dnd5e' }
    const commonRows = [
      {
        sequence: 0,
        level: 1,
        classId: 'fighter',
        classLevel: 1,
        die: 10,
        abilityIndex: 0,
        fallbackValue: 1,
        rollValue: null,
        legacyOverrideValue: null
      },
      {
        sequence: 1,
        level: 2,
        classId: 'fighter',
        classLevel: 2,
        die: 10,
        abilityIndex: 0,
        fallbackValue: 1,
        rollValue: 7,
        legacyOverrideValue: null
      }
    ]

    const fixed = await evaluateOutput(value, { method: 'FIXED', rows: commonRows })
    expect(fixed.hitPointProgression.map((row) => row.value)).toEqual([13, 9])

    const manual = await evaluateOutput(value, {
      method: 'MANUAL',
      rows: [
        ...commonRows,
        {
          sequence: 2,
          level: 3,
          classId: 'fighter',
          classLevel: 3,
          die: 10,
          abilityIndex: 0,
          fallbackValue: 1,
          rollValue: null,
          legacyOverrideValue: 4
        },
        {
          sequence: 3,
          level: 4,
          classId: 'fighter',
          classLevel: 4,
          die: 10,
          abilityIndex: 0,
          fallbackValue: 1,
          rollValue: null,
          legacyOverrideValue: null
        }
      ]
    })
    expect(manual.hitPointProgression.map((row) => row.value)).toEqual([13, 10, 4, 4])
    expect(manual.derivedStats.maxHitPoints.base).toBe(31)
  })
})
