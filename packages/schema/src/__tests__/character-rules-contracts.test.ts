import { describe, expect, it } from 'vitest'
import { createCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'
import { characterResourcePoolIdentitySchema } from '../shared/characterResourceIdentity.js'

import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema
} from '../api/characterRules.js'
import { characterGrantFoldInputSchema } from '../api/characterGrantFoldRules.js'
import {
  characterResourceUsageFactsSchema,
  characterResourcePoolCandidatesSchema,
  characterResourcesSchema
} from '../api/characterResourceRules.js'
import {
  characterActionModelInputSchema,
  characterActionModelOutputSchema
} from '../api/characterActionRules.js'

describe('Character rule contracts', () => {
  it('preserves bounded composite pool identities built from full UUID spell sources', () => {
    const id = '00000000-0000-4000-8000-000000000001'
    const sourceInstanceId = `SUBCLASS:${id}:${id}:${id}:${id}`
    const accessId = `${sourceInstanceId}:${id}`
    const poolId = createCharacterResourceOwnerKey({
      kind: 'SPELL_SOURCE',
      resourceGrantId: accessId,
      spellId: id,
      sourceKind: 'FEATURE',
      sourceInstanceId
    })
    expect(poolId).toHaveLength(426)
    expect(characterResourcePoolIdentitySchema.parse(poolId)).toBe(poolId)
    expect(characterResourcePoolIdentitySchema.safeParse('x'.repeat(1_001)).success).toBe(false)
    expect(characterResourcePoolIdentitySchema.safeParse(' ').success).toBe(false)
    const candidate = {
      sequence: 0,
      poolId,
      resourceDefinitionId: id,
      chargeId: id,
      chargeCalculationId: poolId,
      baseResetKind: 'LONG_REST' as const,
      ownerKind: 'SPELL_SOURCE' as const,
      accessId,
      sourceInstanceId,
      spellId: id
    }
    expect(characterResourcePoolCandidatesSchema.parse([candidate])[0]!.poolId).toBe(poolId)
    expect(characterResourceUsageFactsSchema.parse([{ poolId, rawUsed: 1 }])[0]!.poolId).toBe(
      poolId
    )
    const maximum = {
      calculationId: poolId,
      sourceId: id,
      state: 'RESOLVED' as const,
      maximum: 2,
      reasonCode: 'CALCULATED' as const,
      baseContribution: { sourceId: id, value: 2 },
      bonusContributions: []
    }
    expect(
      characterRulePolicyOutputSchema.shape.chargeMaximums.parse([maximum])[0]!.calculationId
    ).toBe(poolId)
    expect(
      characterRulePolicyInputSchema.shape.chargeCalculations.parse([
        {
          calculationId: poolId,
          sourceId: id,
          base: {
            kind: 'ABILITY_MODIFIER',
            abilityId: 'INTELLIGENCE',
            multiplier: null,
            minimum: null,
            maximum: null
          },
          bonuses: []
        }
      ])[0]!.calculationId
    ).toBe(poolId)
    const { baseResetKind, ...outputCandidate } = candidate
    expect(
      characterResourcesSchema.parse([
        {
          ...outputCandidate,
          state: 'RESOLVED',
          maximum: 2,
          rawUsed: 1,
          effectiveUsed: 1,
          remaining: 1,
          reasonCode: 'CALCULATED',
          baseContribution: maximum.baseContribution,
          bonusContributions: [],
          resetKind: baseResetKind,
          resetResolution: { baseResetKind, appliedGrantId: null, source: null }
        }
      ])[0]!.poolId
    ).toBe(poolId)
  })

  it('defaults the bounded action model spell lane for historical inputs and outputs', () => {
    const input = characterActionModelInputSchema.parse({
      candidates: [],
      activeSourceIds: [],
      activeEquipmentInstanceIds: [],
      resources: [],
      totalLevel: 0,
      classLevels: [],
      proficiencyBonus: 2,
      abilities: [],
      skills: [],
      spellcasting: null,
      spellcastingLocked: false
    })
    const output = characterActionModelOutputSchema.parse({
      actionDecisions: [],
      spellCastMechanics: [],
      spellReferenceMechanics: []
    })

    expect(input.spellSlots).toEqual([])
    expect(output.spellCastDecisions).toEqual([])
  })

  it('preserves typed source explanations across the policy boundary', () => {
    const input = characterRulePolicyInputSchema.parse({
      contractVersion: 4,
      totalLevel: 5,
      grantFoldFacts: characterGrantFoldInputSchema.parse({
        contractVersion: 1,
        base: {
          systemId: 'dnd5e',
          totalLevel: 0,
          raceId: null,
          subraceId: null,
          size: null,
          abilities: {},
          heritageIds: [],
          featureIds: [],
          optionIds: [],
          featIds: [],
          classes: [],
          equipment: []
        },
        upstreamSpellIds: [],
        classes: [],
        background: null,
        features: [],
        activeEffects: [],
        equipmentItems: []
      }),
      derivedBaseFacts: {
        abilities: [
          {
            abilityId: 'STR',
            baseScore: 16,
            bonuses: [],
            scoreOverride: null
          }
        ],
        savingThrows: [],
        skills: [],
        initiative: { abilityId: 'STR', abilityIndex: 0, bonuses: [] },
        spellcasting: null
      },
      spellAccessCandidates: [
        {
          sequence: 0,
          accessId: 'CLASS:wizard:wizard:spellcasting:spellbook:shield',
          sourceInstanceId: 'CLASS:wizard:wizard:spellcasting:spellbook',
          spellId: 'shield',
          sourceFeatureId: 'spellcasting',
          grantId: 'spellbook',
          sourceKind: 'CLASS',
          sourceId: 'wizard',
          owningClassId: 'wizard',
          activeSourceLevel: 5,
          featureAvailableAtLevel: 1,
          inheritedFeatureDuplicate: false,
          specializationId: null,
          specializationRestrictionIds: null,
          selectionKind: 'GRANTED',
          authoringMode: 'SELECTED',
          selectedByCharacter: false,
          scalingKind: 'NONE',
          scalingSource: null,
          progressionLevel: null,
          totalLevel: 5,
          classLevel: 5,
          attributes: ['KNOWN'],
          castAtLevel: null,
          castingAbility: null,
          charge: null
        }
      ],
      spellClasses: [{ classId: 'wizard' }],
      spellPreparationClasses: [
        {
          classId: 'wizard',
          classLevel: 5,
          sources: [
            {
              sourceKind: 'CLASS',
              sourceId: 'wizard',
              attributes: ['PREPARES_SPELLS'],
              abilityIndex: 0,
              spellLimits: [
                {
                  classLevel: 5,
                  preparedSpellsLimit: null,
                  spellLevels: [1, 2, 3]
                }
              ],
              prepareLimit: {
                methodKinds: ['SPELLCASTING_ABILITY', 'CLASS_LEVEL'],
                scaling: 'FULL',
                rounding: null,
                perLevel: []
              }
            }
          ],
          learnedStatePresent: true,
          learnedStateSpellIds: ['shield'],
          intentSpellIds: [],
          preparedStateSpellIds: ['shield']
        }
      ],
      spellPreparationCatalog: [{ spellId: 'shield', spellLevel: 1, classIds: ['wizard'] }],
      spellPreparationRequest: { classId: 'wizard', spellIds: ['shield'] },
      spellCastCandidates: [],
      spellCastSlots: [],
      spellCastResources: [],
      spellcastingClasses: [],
      chargeCalculations: [],
      eligibilityFacets: [],
      rest: {
        totalHitDice: 5,
        currentExhaustion: 2,
        attunementSlotOverride: null
      }
    })

    expect(input.derivedBaseFacts.abilities[0]?.abilityId).toBe('STR')
    expect(input.itemMechanicsFacts).toEqual({ items: [], adjustments: [] })
    expect(
      characterRulePolicyInputSchema.safeParse({
        ...input,
        spellPreparationClasses: [
          {
            ...input.spellPreparationClasses[0]!,
            sources: [
              {
                ...input.spellPreparationClasses[0]!.sources[0]!,
                abilityScore: 16
              }
            ]
          }
        ]
      }).success
    ).toBe(false)
    expect(
      characterRulePolicyInputSchema.safeParse({
        ...input,
        itemMechanicsFacts: {
          items: [],
          adjustments: [
            { id: 'invalid', itemInstanceId: 'item-1', field: 'ATTACK_BONUS', value: true }
          ]
        }
      }).success
    ).toBe(false)
    expect(
      characterRulePolicyInputSchema.safeParse({
        ...input,
        totalLevel: 0
      }).success
    ).toBe(true)
    const hitPointProgression = {
      method: 'FIXED' as const,
      rows: [
        {
          sequence: 0,
          level: 1,
          classId: 'fighter',
          classLevel: 1,
          die: 10,
          abilityIndex: 0,
          fallbackValue: 10,
          rollValue: null
        }
      ]
    }
    expect(
      characterRulePolicyInputSchema.safeParse({
        ...input,
        hitPointFacts: {
          rows: [],
          constitutionAbilityId: 'CONSTITUTION',
          constitutionAbilityIndex: 0,
          progression: hitPointProgression,
          manualMaximumModifier: null,
          manualMaximumOverride: null
        }
      }).success
    ).toBe(true)
    expect(
      characterRulePolicyInputSchema.safeParse({
        ...input,
        hitPointFacts: {
          rows: [],
          constitutionAbilityId: 'CONSTITUTION',
          constitutionAbilityIndex: 0,
          progression: {
            ...hitPointProgression,
            rows: [{ ...hitPointProgression.rows[0], sequence: 1 }]
          },
          manualMaximumModifier: null,
          manualMaximumOverride: null
        }
      }).success
    ).toBe(false)
    const rawChargeCalculation = {
      calculationId: 'arcane-charge',
      sourceId: 'arcane-charge',
      base: {
        kind: 'ABILITY_MODIFIER' as const,
        abilityId: 'INTELLIGENCE',
        multiplier: null,
        minimum: null,
        maximum: null
      },
      bonuses: [
        {
          sourceId: 'arcane-charge:bonus:1:0',
          kind: 'SKILL_BONUS' as const,
          skillId: 'arcana',
          multiplier: null,
          minimum: null,
          maximum: null
        }
      ]
    }
    expect(
      characterRulePolicyInputSchema.safeParse({
        ...input,
        chargeCalculations: [rawChargeCalculation]
      }).success
    ).toBe(true)
    expect(
      characterRulePolicyInputSchema.safeParse({
        ...input,
        chargeCalculations: [rawChargeCalculation, rawChargeCalculation]
      }).success
    ).toBe(false)
    const sourceLevelChargeCalculation = {
      ...rawChargeCalculation,
      base: {
        kind: 'PARENT_CLASS_LEVEL' as const,
        sourceLevel: { kind: 'CLASS_LEVEL' as const, classId: 'wizard' },
        multiplier: null,
        minimum: null,
        maximum: null
      }
    }
    expect(
      characterRulePolicyInputSchema.safeParse({
        ...input,
        chargeCalculations: [sourceLevelChargeCalculation],
        resourcePoolCandidates: [
          {
            sequence: 0,
            poolId: 'AUTHORED_GRANT:arcane-charge',
            resourceDefinitionId: 'arcane-resource',
            chargeId: 'arcane-charge-definition',
            chargeCalculationId: 'AUTHORED_GRANT:arcane-charge',
            baseResetKind: 'LONG_REST',
            ownerKind: 'AUTHORED_GRANT',
            resourceGrantId: 'arcane-charge',
            availableAtLevel: 1,
            activeSourceLevel: 5
          }
        ]
      }).success
    ).toBe(true)
    expect(
      characterRulePolicyInputSchema.safeParse({
        ...input,
        chargeCalculations: [
          {
            ...sourceLevelChargeCalculation,
            base: {
              ...sourceLevelChargeCalculation.base,
              sourceClassId: 'wizard'
            }
          }
        ]
      }).success
    ).toBe(false)
    expect(
      characterRulePolicyInputSchema.safeParse({
        ...input,
        resourcePoolCandidates: [
          {
            sequence: 0,
            poolId: 'AUTHORED_GRANT:arcane-charge',
            resourceDefinitionId: 'arcane-resource',
            chargeId: 'arcane-charge-definition',
            chargeCalculationId: 'different-calculation',
            baseResetKind: 'LONG_REST',
            ownerKind: 'AUTHORED_GRANT',
            resourceGrantId: 'arcane-charge',
            availableAtLevel: 1,
            activeSourceLevel: 5
          }
        ]
      }).success
    ).toBe(false)
    expect(
      characterRulePolicyInputSchema.safeParse({
        ...input,
        chargeCalculations: [
          {
            ...rawChargeCalculation,
            base: { ...rawChargeCalculation.base, factValue: 4 }
          }
        ]
      }).success
    ).toBe(false)
    expect(
      characterRulePolicyInputSchema.safeParse({
        ...input,
        spellAccessCandidates: input.spellAccessCandidates.map((candidate) => ({
          ...candidate,
          sequence: 1
        }))
      }).success
    ).toBe(false)
    const output = characterRulePolicyOutputSchema.parse({
      grantFold: {
        proficiencies: [],
        senses: [],
        modifiers: [],
        unlockedFeatIds: [],
        unlockedSpellIds: [],
        activeSourceIds: [],
        activeEquipmentInstanceIds: [],
        equipmentFeatureChargeUses: [],
        modifierGroups: []
      },
      proficiencies: [],
      proficiencyBonus: 3,
      abilityModifiers: [{ ability: 'STR', value: 3 }],
      passiveChecks: [{ checkId: 'PERCEPTION', value: 14 }],
      rollModes: {
        initiative: 'NORMAL',
        abilityChecks: {
          STRENGTH: 'NORMAL',
          DEXTERITY: 'NORMAL',
          CONSTITUTION: 'NORMAL',
          INTELLIGENCE: 'NORMAL',
          WISDOM: 'NORMAL',
          CHARISMA: 'NORMAL'
        },
        savingThrows: {
          STRENGTH: 'NORMAL',
          DEXTERITY: 'NORMAL',
          CONSTITUTION: 'NORMAL',
          INTELLIGENCE: 'NORMAL',
          WISDOM: 'NORMAL',
          CHARISMA: 'NORMAL'
        },
        skillChecks: {
          acrobatics: 'NORMAL',
          'animal-handling': 'NORMAL',
          arcana: 'NORMAL',
          athletics: 'NORMAL',
          deception: 'NORMAL',
          history: 'NORMAL',
          insight: 'NORMAL',
          intimidation: 'NORMAL',
          investigation: 'NORMAL',
          medicine: 'NORMAL',
          nature: 'NORMAL',
          perception: 'NORMAL',
          performance: 'NORMAL',
          persuasion: 'NORMAL',
          religion: 'NORMAL',
          'sleight-of-hand': 'NORMAL',
          stealth: 'NORMAL',
          survival: 'NORMAL'
        },
        attacks: { MELEE: 'NORMAL', RANGED: 'NORMAL', SPELL: 'NORMAL', UNARMED: 'NORMAL' }
      },
      modifierGroups: [
        {
          domainKey: 'ARMOR_CLASS:BONUS',
          effective: 2,
          contributions: [
            {
              sourceId: 'feature:a',
              value: 1,
              state: 'SUPPRESSED',
              reasonCode: 'SUPPRESSED_BY_STACKING'
            },
            {
              sourceId: 'equipment:b',
              value: 2,
              state: 'APPLIED',
              reasonCode: 'STACKED'
            }
          ]
        }
      ],
      derivedStats: {
        proficiencyBonus: {
          base: 3,
          effective: 3,
          contributions: [],
          override: null
        },
        abilities: [
          {
            abilityId: 'STR',
            score: {
              base: 16,
              effective: 16,
              contributions: [],
              override: null
            },
            modifier: {
              base: 3,
              effective: 3,
              contributions: [],
              override: null
            }
          }
        ],
        savingThrows: [],
        skills: [],
        initiative: {
          base: 3,
          effective: 3,
          contributions: [],
          override: null
        },
        spellcasting: null
      },
      defenses: [],
      hitPointProgression: [],
      spellAccessDecisions: [],
      spellAccess: [],
      spellMechanics: [],
      itemMechanics: [],
      companions: [],
      classSpellStates: [],
      spellPreparation: {
        sources: [
          {
            classId: 'wizard',
            sourceIds: ['wizard'],
            preparedSpellLimit: 8,
            maxPreparableSpellLevel: 3,
            availableSpellIds: ['shield'],
            learnedSpellIds: ['shield'],
            preparedSpellIds: ['shield']
          }
        ],
        requestDecision: {
          classId: 'wizard',
          requestedSpellIds: ['shield'],
          status: 'ALLOWED',
          reasonCode: 'REQUEST_ALLOWED',
          unavailableSpellId: null
        }
      },
      spellCastDecisions: [],
      spellSlots: {
        calculationId: 'spell-slots',
        sourceClassIds: [],
        maxByLevel: [],
        slotPools: [],
        fusionStrategy: 'NONE'
      },
      chargeMaximums: [],
      eligibilityFacets: [],
      rest: {
        hitDieConstitutionModifier: 2,
        hitDiceRecoveredAfterLongRest: 2,
        currentExhaustion: 2,
        minimumExhaustion: 0,
        maximumExhaustion: 6,
        exhaustionAfterLongRest: 1,
        attunementSlotLimit: 3,
        companionHitDiceRecoveredAfterLongRest: []
      }
    })
    expect(output.modifierGroups[0]?.contributions).toEqual([
      {
        sourceId: 'feature:a',
        value: 1,
        state: 'SUPPRESSED',
        reasonCode: 'SUPPRESSED_BY_STACKING'
      },
      {
        sourceId: 'equipment:b',
        value: 2,
        state: 'APPLIED',
        reasonCode: 'STACKED'
      }
    ])

    const inputWithClosedCodes = {
      ...input,
      movementFacts: {
        speeds: [
          {
            speedId: 'walk',
            base: { amount: 30, unit: 'FEET' },
            override: null
          }
        ],
        defaultSpeedId: 'walk',
        preference: { mode: 'AUTO' as const, speedId: null }
      },
      itemMechanicsFacts: {
        items: [{ itemInstanceId: 'item-1', costAmount: 1, weight: { amount: 2, unit: 'POUNDS' } }],
        adjustments: []
      },
      companionMechanicsFacts: {
        companions: [
          {
            companionInstanceId: 'companion-1',
            creatureId: 'creature-1',
            abilityScores: {},
            armorClass: 12,
            maxHitPoints: 8,
            size: 'MEDIUM',
            alignmentId: null,
            creatureTypeId: null
          }
        ],
        adjustments: [
          {
            id: 'companion-1-size',
            companionInstanceId: 'companion-1',
            field: 'SIZE_OVERRIDE' as const,
            value: 'LARGE'
          }
        ]
      },
      spellAccessCandidates: input.spellAccessCandidates.map((candidate) => ({
        ...candidate,
        castingAbility: 'INTELLIGENCE'
      }))
    }
    expect(characterRulePolicyInputSchema.safeParse(inputWithClosedCodes).success).toBe(true)
    expect(
      characterRulePolicyInputSchema.safeParse({
        ...inputWithClosedCodes,
        movementFacts: {
          ...inputWithClosedCodes.movementFacts,
          speeds: [
            {
              ...inputWithClosedCodes.movementFacts.speeds[0]!,
              base: { amount: 30, unit: 'METERS' }
            }
          ]
        }
      }).success
    ).toBe(false)
    expect(
      characterRulePolicyInputSchema.safeParse({
        ...inputWithClosedCodes,
        itemMechanicsFacts: {
          ...inputWithClosedCodes.itemMechanicsFacts,
          items: [
            {
              ...inputWithClosedCodes.itemMechanicsFacts.items[0]!,
              weight: { amount: 2, unit: 'STONE' }
            }
          ]
        }
      }).success
    ).toBe(false)
    expect(
      characterRulePolicyInputSchema.safeParse({
        ...inputWithClosedCodes,
        companionMechanicsFacts: {
          ...inputWithClosedCodes.companionMechanicsFacts,
          companions: [
            { ...inputWithClosedCodes.companionMechanicsFacts.companions[0]!, size: 'average' }
          ]
        }
      }).success
    ).toBe(false)
    expect(
      characterRulePolicyInputSchema.safeParse({
        ...inputWithClosedCodes,
        companionMechanicsFacts: {
          ...inputWithClosedCodes.companionMechanicsFacts,
          adjustments: [
            {
              ...inputWithClosedCodes.companionMechanicsFacts.adjustments[0]!,
              value: 'average'
            }
          ]
        }
      }).success
    ).toBe(false)
    expect(
      characterRulePolicyInputSchema.safeParse({
        ...inputWithClosedCodes,
        spellAccessCandidates: inputWithClosedCodes.spellAccessCandidates.map((candidate) => ({
          ...candidate,
          castingAbility: 'arcana'
        }))
      }).success
    ).toBe(false)

    // The System-neutral contract cannot name abilities, so it defaults to empty ability records.
    expect(output.rollContributorEvidence).toEqual({
      initiative: [],
      abilityChecks: {},
      savingThrows: {},
      skillChecks: {},
      attacks: { MELEE: [], RANGED: [], SPELL: [], UNARMED: [] }
    })
    const contributor = {
      sourceId: 'feature-1',
      source: { kind: 'AUTHORED' as const, id: 'adjustment-1', holderActorId: null },
      grantId: 'grant-1',
      domainKey: 'INITIATIVE:ADVANTAGE',
      influence: 'ADVANTAGE' as const
    }
    expect(
      characterRulePolicyOutputSchema.safeParse({
        ...output,
        rollContributorEvidence: {
          ...output.rollContributorEvidence,
          initiative: Array.from({ length: 501 }, () => contributor)
        }
      }).success
    ).toBe(false)
    expect(
      characterRulePolicyOutputSchema.safeParse({
        ...output,
        rollContributorEvidence: {
          ...output.rollContributorEvidence,
          initiative: [{ ...contributor, influence: 'NORMAL' }]
        }
      }).success
    ).toBe(true)
    expect(
      characterRulePolicyOutputSchema.safeParse({
        ...output,
        rollContributorEvidence: {
          ...output.rollContributorEvidence,
          initiative: [{ ...contributor, influence: 'normal' }]
        }
      }).success
    ).toBe(false)

    const outputWithClosedCodes = {
      ...output,
      proficiencies: [
        {
          kind: 'EQUIPMENT',
          subjectId: 'armor',
          scaling: 'FULL' as const,
          source: { kind: 'MANUAL_ADJUSTMENT' as const, adjustmentId: 'armor-proficiency' },
          category: 'ARMOR'
        }
      ],
      movement: {
        speeds: [
          {
            speedId: 'walk',
            amount: 30,
            unit: 'FEET',
            calculation: output.derivedStats.initiative
          }
        ],
        primaryMovementSpeedId: 'walk'
      },
      senses: [
        {
          senseDefinitionId: '00000000-0000-4000-8000-000000000010',
          range: {
            id: 'darkvision',
            rangeKind: 'DISTANCE',
            amount: 60,
            unit: 'FEET',
            calculation: output.derivedStats.initiative
          }
        }
      ],
      itemMechanics: [
        {
          itemInstanceId: 'item-1',
          attackBonus: 0,
          damageBonus: 0,
          displayAsAttack: false,
          properties: { adamantine: false, dualWield: false, silvered: false },
          weight: { amount: 2, unit: 'POUNDS' },
          calculations: {
            attackBonus: output.derivedStats.initiative,
            damageBonus: output.derivedStats.initiative,
            weight: output.derivedStats.initiative
          }
        }
      ],
      companions: [
        {
          companionInstanceId: 'companion-1',
          creatureId: 'creature-1',
          abilityScores: {},
          armorClass: 12,
          maxHitPoints: 8,
          size: 'MEDIUM',
          calculations: {
            armorClass: output.derivedStats.initiative,
            maxHitPoints: output.derivedStats.initiative,
            size: { base: 'MEDIUM', effective: 'MEDIUM', contributions: [], override: null }
          }
        }
      ],
      spellAccess: [
        {
          sequence: 0,
          accessId: 'spell-access',
          sourceInstanceId: 'source-instance',
          spellId: 'shield',
          sourceFeatureId: 'spellcasting',
          grantId: 'spell-grant',
          sourceKind: 'CLASS' as const,
          sourceId: 'wizard',
          owningClassId: 'wizard',
          timingKind: 'CLASS_LEVEL' as const,
          timingLevel: 1,
          attributes: ['KNOWN' as const],
          acquisition: 'KNOWN' as const,
          castMode: 'SPELL_SLOT' as const,
          castAtLevel: null,
          castingAbility: 'INTELLIGENCE',
          charge: null,
          learned: true,
          prepared: false
        }
      ]
    }
    expect(characterRulePolicyOutputSchema.safeParse(outputWithClosedCodes).success).toBe(true)
    expect(
      characterRulePolicyOutputSchema.safeParse({
        ...outputWithClosedCodes,
        proficiencies: [{ ...outputWithClosedCodes.proficiencies[0]!, category: 'CLOTHING' }]
      }).success
    ).toBe(false)
    expect(
      characterRulePolicyOutputSchema.safeParse({
        ...outputWithClosedCodes,
        movement: {
          ...outputWithClosedCodes.movement,
          speeds: [{ ...outputWithClosedCodes.movement.speeds[0]!, unit: 'METERS' }]
        }
      }).success
    ).toBe(false)
    expect(
      characterRulePolicyOutputSchema.safeParse({
        ...outputWithClosedCodes,
        senses: [
          {
            ...outputWithClosedCodes.senses[0]!,
            range: { ...outputWithClosedCodes.senses[0]!.range, unit: 'METERS' }
          }
        ]
      }).success
    ).toBe(false)
    expect(
      characterRulePolicyOutputSchema.safeParse({
        ...outputWithClosedCodes,
        itemMechanics: [
          {
            ...outputWithClosedCodes.itemMechanics[0]!,
            weight: { amount: 2, unit: 'STONE' }
          }
        ]
      }).success
    ).toBe(false)
    expect(
      characterRulePolicyOutputSchema.safeParse({
        ...outputWithClosedCodes,
        companions: [{ ...outputWithClosedCodes.companions[0]!, size: 'average' }]
      }).success
    ).toBe(false)
    expect(
      characterRulePolicyOutputSchema.safeParse({
        ...outputWithClosedCodes,
        companions: [
          {
            ...outputWithClosedCodes.companions[0]!,
            calculations: {
              ...outputWithClosedCodes.companions[0]!.calculations,
              size: { base: 'MEDIUM', effective: 'average', contributions: [], override: null }
            }
          }
        ]
      }).success
    ).toBe(false)
    expect(
      characterRulePolicyOutputSchema.safeParse({
        ...outputWithClosedCodes,
        spellAccess: [{ ...outputWithClosedCodes.spellAccess[0]!, castingAbility: 'arcana' }]
      }).success
    ).toBe(false)
  })

  it('enforces authoritative resource output identity and state invariants', () => {
    const resource = {
      sequence: 0,
      poolId: 'ITEM_INSTANCE:item-1:charge-1',
      ownerKind: 'ITEM_INSTANCE',
      itemInstanceId: 'item-1',
      sourceId: null,
      chargeId: 'charge-1',
      resourceDefinitionId: 'wand-charge',
      chargeCalculationId: 'ITEM_INSTANCE:item-1:charge-1',
      state: 'RESOLVED',
      maximum: 2,
      rawUsed: 3,
      effectiveUsed: 2,
      remaining: 0,
      reasonCode: 'CALCULATED',
      baseContribution: { sourceId: 'charge-1', value: 2 },
      bonusContributions: [],
      resetKind: 'LONG_REST',
      resetResolution: { baseResetKind: 'LONG_REST', appliedGrantId: null, source: null }
    }

    expect(characterResourcesSchema.safeParse([resource]).success).toBe(true)
    expect(
      characterResourcesSchema.safeParse([
        { ...resource, chargeCalculationId: 'different-calculation' }
      ]).success
    ).toBe(false)
    expect(
      characterResourcesSchema.safeParse([
        { ...resource, rawUsed: 3, effectiveUsed: 3, remaining: 0 }
      ]).success
    ).toBe(false)
    expect(
      characterResourceUsageFactsSchema.safeParse([
        { poolId: 'pool-1', rawUsed: 2 },
        { poolId: 'pool-1', rawUsed: 3 }
      ]).success
    ).toBe(false)
    expect(
      characterResourcesSchema.safeParse([resource, { ...resource, sequence: 1 }]).success
    ).toBe(false)
    expect(
      characterResourcesSchema.safeParse([
        {
          ...resource,
          state: 'RESOLVED',
          maximum: null,
          reasonCode: 'MISSING_REQUIRED_FACT',
          baseContribution: null
        }
      ]).success
    ).toBe(false)
  })
})
