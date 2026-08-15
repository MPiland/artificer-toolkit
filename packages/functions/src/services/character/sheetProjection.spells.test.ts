import { describe, expect, it, vi } from 'vitest'
import type { CharacterBuilderResolution } from './builderService.js'
import { CharacterSheetCommandError, applyCharacterSheetCommand } from './sheetCommandReducer.js'
import {
  buildCharacterSheetResponse as buildPinnedCharacterSheetResponse,
  type BuildCharacterSheetResponseParams
} from './sheetProjection.js'
import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  SCALING,
  SPELL_GRANT_ATTRIBUTE,
  SPELLCASTING_ATTRIBUTE
} from '@artificer-toolkit/shared/core'
import {
  createCharacter,
  createAuthoredSpell,
  createConditionDb,
  createResolution,
  createSpellcastingClass,
  createSpellcastingSubclass,
  createSpell,
  createFullCasterSpellLimits
} from './sheetTestFixtures.js'

vi.mock('./characterRuleEvaluation.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./characterRuleEvaluation.js')>()
  const { evaluateCharacterBuilderTestPolicy } =
    await import('./characterBuilderRuleEvaluation.testUtils.js')
  return { ...original, evaluateCharacterRulePolicy: evaluateCharacterBuilderTestPolicy }
})

function buildCharacterSheetResponse(
  params: Omit<BuildCharacterSheetResponseParams, 'ruleEvaluation'>
) {
  return buildPinnedCharacterSheetResponse({
    ...params,
    ruleEvaluation: {
      context: {
        catalog: params.resolution.catalog,
        registry: params.resolution.sourceRegistry
      },
      revisionId: 'sheet-spell-projection-test-revision'
    }
  })
}

describe('character sheet spell projection', () => {
  it('hydrates spell casting reference details into sheet spells', async () => {
    const resolution = createResolution()
    const spell = createSpell({
      classIds: ['class-1'],
      id: 'spell-1',
      label: 'Shield',
      level: 1
    })
    spell.description = '<p>A shimmering barrier protects you.</p>'
    spell.components = ['VERBAL', 'SOMATIC', 'MATERIAL']
    spell.attributes = ['CONCENTRATION']
    spell.materialDescription = '<p>A pinch of powdered silver.</p>'
    resolution.catalog.spells = [spell]

    const sheet = await buildCharacterSheetResponse({
      character: createCharacter(),
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.spells).toContainEqual(
      expect.objectContaining({
        id: 'spell-1',
        description: '<p>A shimmering barrier protects you.</p>',
        castingTime: { unit: 'ROUND', amount: 1 },
        components: ['VERBAL', 'SOMATIC', 'MATERIAL'],
        attributes: ['CONCENTRATION'],
        materialDescription: '<p>A pinch of powdered silver.</p>'
      })
    )
  })

  it('keeps a removed known spell available for re-adding', async () => {
    const character = createCharacter()
    character.state.classes = [{ classId: 'class-1', spells: { learned: [] } }]
    const resolution = createResolution()
    resolution.registry.classes = [
      createSpellcastingClass({
        ability: 'CHARISMA',
        id: 'class-1',
        label: 'Sorcerer',
        attributes: [],
        resetKind: 'LONG_REST',
        spellLimits: createFullCasterSpellLimits()
      })
    ]
    resolution.catalog.spells = [
      createSpell({ classIds: ['class-1'], id: 'spell-1', label: 'Shield', level: 1 })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })
    expect(sheet.spells.spells).toEqual([
      expect.objectContaining({
        id: 'spell-1',
        known: false,
        sources: expect.arrayContaining([expect.objectContaining({ classId: 'class-1' })])
      })
    ])
  })

  it('hydrates class-scoped spell sources for preparation commands', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'wizard', classLevel: 1 }]
    character.intent.spellSelections = [
      {
        id: 'wizard-spells',
        source: { kind: 'CLASS', classId: 'wizard' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-1', 'spell-2']
      }
    ]
    character.state.classes = [
      {
        classId: 'wizard',
        spells: {
          learned: ['spell-1', 'spell-2'],
          prepared: ['spell-2']
        }
      }
    ]
    const resolution = createResolution()
    resolution.registry.classes = [
      createSpellcastingClass({
        id: 'wizard',
        label: 'Wizard',
        resetKind: 'LONG_REST',
        spellLimits: [
          { classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }], preparedSpellsLimit: 1 },
          { classLevel: 17, slots: [{ spellLevel: 9, slotCount: 1 }], preparedSpellsLimit: 9 }
        ]
      })
    ]
    resolution.catalog.spells = [
      createSpell({
        classIds: ['wizard'],
        id: 'spell-1',
        label: 'Shield',
        level: 1
      }),
      createSpell({
        classIds: ['wizard'],
        id: 'spell-2',
        label: 'Mage Armor',
        level: 1
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.spells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'spell-1',
          sources: expect.arrayContaining([
            expect.objectContaining({
              classId: 'wizard',
              label: 'Wizard',
              canPrepare: true,
              prepared: false
            })
          ])
        }),
        expect.objectContaining({
          id: 'spell-2',
          sources: expect.arrayContaining([
            expect.objectContaining({
              classId: 'wizard',
              label: 'Wizard',
              canPrepare: true,
              prepared: true
            })
          ])
        })
      ])
    )
    expect(sheet.spells.preparationSources).toEqual([
      {
        classId: 'wizard',
        label: 'Wizard',
        preparedSpellLimit: 1,
        preparedSpellIds: ['spell-2']
      }
    ])
    expect(sheet.spells.activeGroups).toEqual([
      expect.objectContaining({
        level: 1,
        entries: expect.arrayContaining([
          expect.objectContaining({
            spellId: 'spell-2',
            sourceLabel: 'Wizard',
            available: true
          })
        ])
      })
    ])
    expect(sheet.spells.activeGroups.flatMap((group) => group.entries)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ spellId: 'spell-1' })])
    )
    expect(sheet.spells.activeGroups[0]?.entries[0]).not.toHaveProperty('sourceQualifier')
  })

  it('projects source-specific granted spell access and exhausted limited uses', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'wizard', classLevel: 3 }]
    character.intent.abilities = {
      method: 'MANUAL_ROLLED',
      state: { assignments: [{ ability: 'INTELLIGENCE', score: 16 }] }
    }
    character.intent.spellSelections = []
    character.state.classes = []
    const resolution = createResolution()
    const grantedFeatures = [
      {
        id: 'at-will-feature',
        label: 'Arcane Gift',
        description: '',
        availableAtLevel: 1,
        order: 0,
        grants: {
          spells: [
            {
              id: 'at-will-grant',
              grantKind: GRANT_KIND.SPELL_GRANT,
              selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
              scalingKind: SCALING.NONE,
              authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
              spellIds: ['spell-1'],
              attributes: [SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
              order: 0
            }
          ]
        }
      },
      {
        id: 'duplicate-feature',
        label: 'Magic Initiate',
        description: '',
        availableAtLevel: 1,
        order: 1,
        grants: {
          spells: [
            {
              id: 'duplicate-grant',
              grantKind: GRANT_KIND.SPELL_GRANT,
              selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
              scalingKind: SCALING.NONE,
              authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
              spellIds: ['spell-1'],
              attributes: [SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
              order: 0
            }
          ]
        }
      },
      {
        id: 'fixed-feature',
        label: 'Fixed Magic',
        description: '',
        availableAtLevel: 1,
        order: 2,
        grants: {
          spells: [
            {
              id: 'fixed-grant',
              grantKind: GRANT_KIND.SPELL_GRANT,
              selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
              scalingKind: SCALING.NONE,
              authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
              spellIds: ['spell-2'],
              attributes: [SPELL_GRANT_ATTRIBUTE.CAST_AT_LEVEL],
              castAtLevel: 2,
              order: 0
            }
          ]
        }
      },
      {
        id: 'limited-feature',
        label: 'Limited Magic',
        description: '',
        availableAtLevel: 1,
        order: 3,
        grants: {
          spells: [
            {
              id: 'limited-grant',
              grantKind: GRANT_KIND.SPELL_GRANT,
              selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
              scalingKind: SCALING.NONE,
              authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
              spellIds: ['spell-3'],
              attributes: [SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
              charges: {
                id: 'limited-charge',
                resetKind: 'LONG_REST',
                limitKind: 'FIXED_AMOUNT',
                scalingKind: 'NONE',
                amount: 1
              },
              order: 0
            }
          ]
        }
      }
    ] satisfies CharacterBuilderResolution['registry']['features']
    resolution.registry.classes = [
      {
        ...createSpellcastingClass({
          id: 'wizard',
          label: 'Wizard',
          resetKind: 'LONG_REST',
          spellLimits: [{ classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }] }]
        }),
        features: grantedFeatures
      }
    ]
    resolution.grants.features = grantedFeatures.map((feature) => ({
      id: feature.id,
      label: feature.label,
      sourceLabel: 'Wizard',
      source: { kind: 'CLASS' as const, classId: 'wizard', classLevel: 3 }
    }))
    resolution.catalog.spells = [
      createSpell({ classIds: ['wizard'], id: 'spell-1', label: 'Magic Missile', level: 1 }),
      createSpell({ classIds: ['wizard'], id: 'spell-2', label: 'Misty Step', level: 2 }),
      createSpell({ classIds: ['wizard'], id: 'spell-3', label: 'Shield', level: 1 })
    ]
    const limitedSourceInstanceId = 'CLASS:wizard:wizard:limited-feature:limited-grant'
    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      resourceUsage: [
        {
          id: 'limited-spell-usage',
          characterId: character.id,
          owner: {
            kind: 'SPELL_SOURCE',
            resourceGrantId: `${limitedSourceInstanceId}:spell-3`,
            spellId: 'spell-3',
            sourceKind: 'FEATURE',
            sourceInstanceId: limitedSourceInstanceId
          },
          used: 1,
          createdBy: 'user-1',
          updatedBy: 'user-1',
          createdAt: '2026-07-25T00:00:00.000Z',
          updatedAt: '2026-07-25T00:00:00.000Z'
        }
      ],
      streamVersion: 1
    })

    const entries = sheet.spells.activeGroups.flatMap((group) => group.entries)
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          spellId: 'spell-1',
          available: true,
          sourceQualifier: 'Arcane Gift'
        }),
        expect.objectContaining({
          spellId: 'spell-1',
          available: true,
          sourceQualifier: 'Magic Initiate'
        }),
        expect.objectContaining({ spellId: 'spell-2', castLevel: 2, available: true }),
        expect.objectContaining({
          spellId: 'spell-3',
          available: false,
          unavailableReason: 'No uses remaining.'
        })
      ])
    )
    expect(sheet.resources.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          owner: expect.objectContaining({
            kind: 'SPELL_SOURCE',
            resourceGrantId: `${limitedSourceInstanceId}:spell-3`
          }),
          remaining: 0
        })
      ])
    )
  })

  it('projects active-spell activation, range, and source-adjusted attack or save facts', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'wizard', classLevel: 3 }]
    character.intent.abilities = {
      method: 'MANUAL_ROLLED',
      state: { assignments: [{ ability: 'INTELLIGENCE', score: 16 }] }
    }
    character.intent.spellSelections = [
      {
        id: 'wizard-spell-selection',
        source: { kind: 'CLASS', classId: 'wizard' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-attack', 'spell-save', 'spell-utility']
      }
    ]
    character.state.classes = [
      {
        classId: 'wizard',
        spells: { learned: ['spell-attack', 'spell-save', 'spell-utility'] }
      }
    ]
    const resolution = createResolution()
    resolution.registry.classes = [
      createSpellcastingClass({
        ability: 'INTELLIGENCE',
        attributes: [SPELLCASTING_ATTRIBUTE.LIMIT_KNOWN_SPELL_AMOUNT],
        id: 'wizard',
        label: 'Wizard',
        resetKind: 'LONG_REST',
        spellLimits: [{ classLevel: 3, slots: [{ spellLevel: 1, slotCount: 3 }] }]
      })
    ]
    resolution.catalog.spells = [
      createSpell({
        classIds: ['wizard'],
        id: 'spell-attack',
        label: 'Arcane Bolt',
        level: 1
      }),
      createSpell({
        classIds: ['wizard'],
        id: 'spell-save',
        label: 'Arcane Burst',
        level: 1
      }),
      createSpell({
        classIds: ['wizard'],
        id: 'spell-utility',
        label: 'Arcane Ward',
        level: 1
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb([], {
        spells: [
          {
            ownerId: 'spell-attack',
            label: 'Arcane Bolt',
            description: '',
            level: 1,
            magicSchoolId: 'school-1',
            magicSchoolCode: 'EVOCATION',
            magicSchoolLabel: 'Evocation',
            castingTimeUnit: 'ACTION',
            castingTimeAmount: 1,
            materialDescription: null,
            effectId: 'effect-attack',
            ownerEffectOrder: 0,
            effectOrder: 0
          },
          {
            ownerId: 'spell-save',
            label: 'Arcane Burst',
            description: '',
            level: 1,
            magicSchoolId: 'school-1',
            magicSchoolCode: 'EVOCATION',
            magicSchoolLabel: 'Evocation',
            castingTimeUnit: 'ACTION',
            castingTimeAmount: 1,
            materialDescription: null,
            effectId: 'effect-save',
            ownerEffectOrder: 0,
            effectOrder: 0
          },
          {
            ownerId: 'spell-utility',
            label: 'Arcane Ward',
            description: '',
            level: 1,
            magicSchoolId: 'school-1',
            magicSchoolCode: 'ABJURATION',
            magicSchoolLabel: 'Abjuration',
            castingTimeUnit: 'REACTION',
            castingTimeAmount: 1,
            materialDescription: null,
            effectId: 'effect-utility',
            ownerEffectOrder: 0,
            effectOrder: 0
          }
        ],
        effect_invocations: [
          {
            effectId: 'effect-attack',
            triggerCode: 'SPELL_ATTACK',
            activationType: 'ACTION',
            activationValue: 1,
            rangeCharacteristicId: 'range-attack',
            shapeCharacteristicId: null,
            savingThrowId: null,
            targetSelectionKind: null,
            targetDispositionKind: null,
            maxTargets: null,
            maxTargetsScaling: null,
            resolutionCount: null,
            resolutionCountScaling: null,
            allowRepeatedTargets: null,
            excludedCreatureTypeIds: null
          },
          {
            effectId: 'effect-save',
            triggerCode: 'SAVING_THROW',
            activationType: 'BONUS_ACTION',
            activationValue: 1,
            rangeCharacteristicId: 'range-save',
            shapeCharacteristicId: null,
            savingThrowId: 'save-dexterity',
            targetSelectionKind: null,
            targetDispositionKind: null,
            maxTargets: null,
            maxTargetsScaling: null,
            resolutionCount: null,
            resolutionCountScaling: null,
            allowRepeatedTargets: null,
            excludedCreatureTypeIds: null
          },
          {
            effectId: 'effect-utility',
            triggerCode: 'ACTIVATED',
            activationType: 'REACTION',
            activationValue: 1,
            rangeCharacteristicId: 'range-utility',
            shapeCharacteristicId: null,
            savingThrowId: null,
            targetSelectionKind: null,
            targetDispositionKind: null,
            maxTargets: null,
            maxTargetsScaling: null,
            resolutionCount: null,
            resolutionCountScaling: null,
            allowRepeatedTargets: null,
            excludedCreatureTypeIds: null
          }
        ],
        characteristics: [
          {
            characteristicId: 'range-attack',
            code: 'RANGE',
            rangeKind: 'DISTANCE',
            rangeMin: 120,
            rangeMax: null,
            rangeUnitCode: 'FEET',
            rangeScaling: null,
            shapeKind: null,
            durationKind: null,
            durationAmount: null,
            durationScaling: null
          },
          {
            characteristicId: 'range-save',
            code: 'RANGE',
            rangeKind: 'DISTANCE',
            rangeMin: 150,
            rangeMax: null,
            rangeUnitCode: 'FEET',
            rangeScaling: null,
            shapeKind: null,
            durationKind: null,
            durationAmount: null,
            durationScaling: null
          },
          {
            characteristicId: 'range-utility',
            code: 'RANGE',
            rangeKind: 'DISTANCE',
            rangeMin: 60,
            rangeMax: null,
            rangeUnitCode: 'FEET',
            rangeScaling: null,
            shapeKind: null,
            durationKind: null,
            durationAmount: null,
            durationScaling: null
          }
        ],
        saving_throws: [
          {
            savingThrowId: 'save-dexterity',
            dcMethod: 'SOURCE_SAVE_DC',
            abilityCode: 'DEXTERITY',
            baseDc: null
          }
        ]
      }, [
        createAuthoredSpell({
          classIds: ['wizard'],
          id: 'spell-attack',
          label: 'Arcane Bolt',
          level: 1,
          effects: [
            {
              id: 'effect-attack',
              order: 1,
              invocation: {
                kind: 'ACTION',
                triggerCode: 'SPELL_ATTACK',
                activation: { code: 'ACTION', amount: 1 },
                range: {
                  id: 'range-attack',
                  rangeKind: 'DISTANCE',
                  amount: 120,
                  unit: 'FEET'
                }
              },
              paths: []
            }
          ]
        }),
        createAuthoredSpell({
          classIds: ['wizard'],
          id: 'spell-save',
          label: 'Arcane Burst',
          level: 1,
          effects: [
            {
              id: 'effect-save',
              order: 1,
              invocation: {
                kind: 'ACTION',
                triggerCode: 'SAVING_THROW',
                activation: { code: 'BONUS_ACTION', amount: 1 },
                range: {
                  id: 'range-save',
                  rangeKind: 'DISTANCE',
                  amount: 150,
                  unit: 'FEET'
                },
                savingThrow: {
                  id: 'save-dexterity',
                  ability: 'DEXTERITY',
                  dcMethod: 'SOURCE_SAVE_DC'
                }
              },
              paths: []
            }
          ]
        }),
        createAuthoredSpell({
          classIds: ['wizard'],
          id: 'spell-utility',
          label: 'Arcane Ward',
          level: 1,
          effects: [
            {
              id: 'effect-utility',
              order: 1,
              invocation: {
                kind: 'ACTION',
                triggerCode: 'ACTIVATED',
                activation: { code: 'REACTION', amount: 1 },
                range: {
                  id: 'range-utility',
                  rangeKind: 'DISTANCE',
                  amount: 60,
                  unit: 'FEET'
                }
              },
              paths: []
            }
          ]
        })
      ]),
      hasBuilderDraft: false,
      resolution,
      adjustments: [
        {
          id: 'attack-bonus-1',
          characterId: character.id,
          family: 'SPELL',
          source: {
            spellId: 'spell-attack',
            sourceKind: 'CLASS',
            sourceInstanceId: 'CLASS:wizard-spell-selection'
          },
          field: 'ATTACK_BONUS',
          value: 2,
          createdBy: 'user-1',
          updatedBy: 'user-1',
          createdAt: '2026-07-25T00:00:00.000Z',
          updatedAt: '2026-07-25T00:00:00.000Z'
        },
        {
          id: 'save-dc-bonus-1',
          characterId: character.id,
          family: 'SPELL',
          source: {
            spellId: 'spell-save',
            sourceKind: 'CLASS',
            sourceInstanceId: 'CLASS:wizard-spell-selection'
          },
          field: 'DC_BONUS',
          value: 2,
          createdBy: 'user-1',
          updatedBy: 'user-1',
          createdAt: '2026-07-25T00:00:00.000Z',
          updatedAt: '2026-07-25T00:00:00.000Z'
        }
      ],
      streamVersion: 1
    })

    const entries = sheet.spells.activeGroups.flatMap((group) => group.entries)
    expect(entries.find((entry) => entry.spellId === 'spell-attack')).toEqual(
      expect.objectContaining({
        activationType: 'ACTION',
        activationLabel: 'Action',
        rangeLabel: '120 ft',
        hitOrDcLabel: '+7'
      })
    )
    expect(entries.find((entry) => entry.spellId === 'spell-save')).toEqual(
      expect.objectContaining({
        activationType: 'BONUS_ACTION',
        activationLabel: 'Bonus Action',
        rangeLabel: '150 ft',
        hitOrDcLabel: 'DEX 15'
      })
    )
    const utilityEntry = entries.find((entry) => entry.spellId === 'spell-utility')
    expect(utilityEntry).toEqual(
      expect.objectContaining({
        activationType: 'REACTION',
        activationLabel: 'Reaction',
        rangeLabel: '60 ft'
      })
    )
    expect(utilityEntry).not.toHaveProperty('hitOrDcLabel')
    expect(utilityEntry).not.toHaveProperty('primaryEffect')
  })

  it('projects only explicit upcast levels with source-specific damage bonuses', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'wizard', classLevel: 3 }]
    character.intent.abilities = {
      method: 'MANUAL_ROLLED',
      state: { assignments: [{ ability: 'INTELLIGENCE', score: 16 }] }
    }
    character.intent.spellSelections = [
      {
        id: 'wizard-spell-selection',
        source: { kind: 'CLASS', classId: 'wizard' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-1']
      }
    ]
    character.state.classes = [
      {
        classId: 'wizard',
        spells: { learned: ['spell-1'] }
      }
    ]
    const resolution = createResolution()
    resolution.registry.classes = [
      createSpellcastingClass({
        attributes: [SPELLCASTING_ATTRIBUTE.LIMIT_KNOWN_SPELL_AMOUNT],
        id: 'wizard',
        label: 'Wizard',
        resetKind: 'LONG_REST',
        spellLimits: [
          {
            classLevel: 3,
            slots: [
              { spellLevel: 1, slotCount: 2 },
              { spellLevel: 2, slotCount: 1 },
              { spellLevel: 3, slotCount: 1 }
            ]
          }
        ]
      })
    ]
    resolution.catalog.spells = [
      createSpell({ classIds: ['wizard'], id: 'spell-1', label: 'Arcane Burst', level: 1 })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb([], {
        spells: [
          {
            ownerId: 'spell-1',
            label: 'Arcane Burst',
            description: '',
            level: 1,
            magicSchoolId: 'school-1',
            magicSchoolCode: 'EVOCATION',
            magicSchoolLabel: 'Evocation',
            castingTimeUnit: 'ACTION',
            castingTimeAmount: 1,
            materialDescription: null,
            effectId: 'effect-1',
            ownerEffectOrder: 0,
            effectOrder: 0
          }
        ],
        effect_invocations: [
          {
            effectId: 'effect-1',
            triggerCode: 'SPELL_ATTACK',
            activationType: 'ACTION',
            activationValue: 1,
            rangeCharacteristicId: null,
            shapeCharacteristicId: null,
            savingThrowId: null,
            targetSelectionKind: null,
            targetDispositionKind: null,
            maxTargets: null,
            maxTargetsScaling: null,
            resolutionCount: null,
            resolutionCountScaling: null,
            allowRepeatedTargets: null,
            excludedCreatureTypeIds: null
          }
        ],
        effect_paths: [
          {
            pathId: 'path-1',
            effectId: 'effect-1',
            order: 0,
            pathCode: 'DEFAULT',
            groupType: 'SEQUENCE',
            selectionKind: 'FIXED',
            originKind: null,
            rangeOverrideCharacteristicId: null,
            targetSelectionKind: null,
            targetDispositionKind: null,
            maxTargets: null,
            maxTargetsScaling: null,
            resolutionCount: null,
            resolutionCountScaling: null,
            allowRepeatedTargets: null,
            excludedCreatureTypeIds: null,
            resultBlockId: 'result-1',
            rollTableKind: null,
            die: null
          }
        ],
        effect_result_blocks: [
          {
            resultBlockId: 'result-1',
            resultKind: 'DAMAGE',
            durationCharacteristicId: null,
            lifecycleRecurringKind: null,
            lifecycleConsumeOnFirstEvent: null,
            lifecycleEndOnEvents: null
          }
        ],
        effect_result_block_outcomes: [
          {
            resultBlockId: 'result-1',
            outcomeId: 'damage-1',
            effectKind: 'DAMAGE',
            order: 0
          }
        ],
        damages: [
          {
            damageId: 'damage-1',
            damageTypeId: 'force',
            damageTypeCode: 'FORCE',
            damageTypeLabel: 'Force',
            valueKind: 'DICE',
            scalingKind: 'PER_LEVEL',
            amountKind: null,
            amountMultiplier: null,
            scalingSource: 'SPELL_CAST_LEVEL',
            classId: null,
            order: 0,
            valueId: null,
            amount: null,
            dice: null,
            valueMultiplier: null,
            valueMin: null,
            valueMax: null
          }
        ],
        damage_scaling_levels: [
          {
            scalingId: 'damage-1-1',
            damageId: 'damage-1',
            level: 1,
            order: 0,
            amount: null,
            dice: '1d8'
          },
          {
            scalingId: 'damage-1-3',
            damageId: 'damage-1',
            level: 3,
            order: 1,
            amount: null,
            dice: '3d8'
          }
        ]
      }, [
        createAuthoredSpell({
          classIds: ['wizard'],
          id: 'spell-1',
          label: 'Arcane Burst',
          level: 1,
          effects: [
            {
              id: 'effect-1',
              order: 1,
              invocation: {
                kind: 'ACTION',
                triggerCode: 'SPELL_ATTACK',
                activation: { code: 'ACTION', amount: 1 },
                range: { id: 'range-self', rangeKind: 'SELF' }
              },
              paths: [
                {
                  id: 'path-1',
                  order: 1,
                  pathCode: 'ON_HIT',
                  groupType: 'SINGLE',
                  selectionKind: 'FIXED',
                  resultBlock: {
                    id: 'result-1',
                    resultKind: 'SINGLE',
                    outcomes: [
                      {
                        id: 'damage-1',
                        effectKind: 'DAMAGE',
                        damageTypeId: 'force',
                        valueKind: 'DICE',
                        scalingKind: 'PER_LEVEL',
                        scalingSource: 'SPELL_CAST_LEVEL',
                        levels: [
                          { id: 'damage-1-1', level: 1, order: 1, diceConfig: '1d8' },
                          { id: 'damage-1-3', level: 3, order: 2, diceConfig: '3d8' }
                        ]
                      }
                    ]
                  }
                }
              ]
            }
          ]
        })
      ]),
      hasBuilderDraft: false,
      resolution,
      adjustments: [
        {
          id: 'damage-bonus-1',
          characterId: character.id,
          family: 'SPELL',
          source: {
            spellId: 'spell-1',
            sourceKind: 'CLASS',
            sourceInstanceId: 'CLASS:wizard-spell-selection'
          },
          field: 'DAMAGE_BONUS',
          value: 2,
          createdBy: 'user-1',
          updatedBy: 'user-1',
          createdAt: '2026-07-25T00:00:00.000Z',
          updatedAt: '2026-07-25T00:00:00.000Z'
        }
      ],
      streamVersion: 1
    })

    const entries = sheet.spells.activeGroups.flatMap((group) => group.entries)
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ castLevel: 1, primaryEffect: '1d8 + 2 Force' }),
        expect.objectContaining({ castLevel: 3, primaryEffect: '3d8 + 2 Force' })
      ])
    )
    expect(entries).not.toEqual(expect.arrayContaining([expect.objectContaining({ castLevel: 2 })]))
  })

  it('exposes only current-level class-list spells for prepared casters', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'cleric', classLevel: 1 }]
    character.intent.spellSelections = []
    character.state.classes = []
    const resolution = createResolution()
    resolution.registry.classes = [
      createSpellcastingClass({
        id: 'cleric',
        label: 'Cleric',
        resetKind: 'LONG_REST',
        spellLimits: [
          { classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }], preparedSpellsLimit: 1 },
          { classLevel: 3, slots: [{ spellLevel: 2, slotCount: 2 }], preparedSpellsLimit: 3 }
        ]
      })
    ]
    resolution.catalog.spells = [
      createSpell({ classIds: ['cleric'], id: 'cleric-cantrip', label: 'Guidance', level: 0 }),
      createSpell({
        classIds: ['cleric'],
        id: 'cleric-first-level',
        label: 'Healing Word',
        level: 1
      }),
      createSpell({
        classIds: ['cleric'],
        id: 'cleric-second-level',
        label: 'Spiritual Weapon',
        level: 2
      }),
      createSpell({ classIds: ['wizard'], id: 'wizard-first-level', label: 'Shield', level: 1 })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.spells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'cleric-first-level',
          mechanics: undefined,
          sources: expect.arrayContaining([
            expect.objectContaining({
              canPrepare: true,
              classId: 'cleric',
              prepared: false
            })
          ])
        })
      ])
    )
    expect(sheet.spells.preparationSources).toEqual([
      {
        classId: 'cleric',
        label: 'Cleric',
        preparedSpellLimit: 1,
        preparedSpellIds: []
      }
    ])
  })

  it('derives prepared spell limits from prepare-limit method rules', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'wizard', classLevel: 3 }]
    character.intent.abilities = {
      method: 'MANUAL_ROLLED',
      state: { assignments: [{ ability: 'INTELLIGENCE', score: 16 }] }
    }
    character.intent.spellSelections = [
      {
        id: 'wizard-spells',
        source: { kind: 'CLASS', classId: 'wizard' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-1']
      }
    ]
    const wizard = createSpellcastingClass({
      ability: 'INTELLIGENCE',
      id: 'wizard',
      label: 'Wizard',
      resetKind: 'LONG_REST',
      spellLimits: [{ classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }] }]
    })
    if (!wizard.spellcasting) throw new Error('Test wizard should include spellcasting.')
    wizard.spellcasting.prepareLimit = {
      methodKinds: ['CLASS_LEVEL', 'SPELLCASTING_ABILITY']
    }
    const resolution = createResolution()
    resolution.registry.classes = [wizard]
    resolution.catalog.spells = [
      createSpell({
        classIds: ['wizard'],
        id: 'spell-1',
        label: 'Shield',
        level: 1
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.preparationSources).toEqual([
      {
        classId: 'wizard',
        label: 'Wizard',
        preparedSpellLimit: 6,
        preparedSpellIds: []
      }
    ])
  })

  it('floors formula-based prepared spell limits at one for prepared casters', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'wizard', classLevel: 1 }]
    character.intent.abilities = {
      method: 'MANUAL_ROLLED',
      state: { assignments: [{ ability: 'INTELLIGENCE', score: 8 }] }
    }
    character.intent.spellSelections = [
      {
        id: 'wizard-spells',
        source: { kind: 'CLASS', classId: 'wizard' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-1']
      }
    ]
    const wizard = createSpellcastingClass({
      ability: 'INTELLIGENCE',
      id: 'wizard',
      label: 'Wizard',
      resetKind: 'LONG_REST',
      spellLimits: [{ classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }] }]
    })
    if (!wizard.spellcasting) throw new Error('Test wizard should include spellcasting.')
    wizard.spellcasting.prepareLimit = {
      methodKinds: ['CLASS_LEVEL', 'SPELLCASTING_ABILITY']
    }
    const resolution = createResolution()
    resolution.registry.classes = [wizard]
    resolution.catalog.spells = [
      createSpell({
        classIds: ['wizard'],
        id: 'spell-1',
        label: 'Shield',
        level: 1
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.preparationSources).toEqual([
      {
        classId: 'wizard',
        label: 'Wizard',
        preparedSpellLimit: 1,
        preparedSpellIds: []
      }
    ])
  })

  it('does not hydrate spell source actions from orphaned class state', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'wizard', classLevel: 1 }]
    character.intent.spellSelections = [
      {
        id: 'wizard-spells',
        source: { kind: 'CLASS', classId: 'wizard' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-1']
      }
    ]
    character.state.classes = [
      {
        classId: 'wizard',
        spells: {
          learned: ['spell-1']
        }
      },
      {
        classId: 'removed-class',
        spells: {
          learned: ['orphan-spell'],
          prepared: ['orphan-spell']
        }
      }
    ]
    const resolution = createResolution()
    resolution.registry.classes = [
      createSpellcastingClass({
        id: 'wizard',
        label: 'Wizard',
        resetKind: 'LONG_REST',
        spellLimits: createFullCasterSpellLimits()
      }),
      createSpellcastingClass({
        id: 'removed-class',
        label: 'Removed Class',
        resetKind: 'LONG_REST',
        spellLimits: createFullCasterSpellLimits()
      })
    ]
    resolution.catalog.spells = [
      createSpell({
        classIds: ['wizard'],
        id: 'spell-1',
        label: 'Shield',
        level: 1
      }),
      createSpell({
        classIds: ['removed-class'],
        id: 'orphan-spell',
        label: 'Orphan Spell',
        level: 1
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.spells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'spell-1',
          sources: expect.arrayContaining([
            expect.objectContaining({
              classId: 'wizard',
              label: 'Wizard',
              canPrepare: true,
              prepared: false
            })
          ])
        }),
        expect.objectContaining({
          id: 'orphan-spell',
          sources: undefined
        })
      ])
    )
    expect(sheet.spells.preparationSources).toEqual([
      {
        classId: 'wizard',
        label: 'Wizard',
        preparedSpellIds: []
      }
    ])
  })

  it('filters stale learned spells before exposing class preparation actions', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'wizard', classLevel: 1 }]
    character.intent.spellSelections = []
    character.state.classes = [
      {
        classId: 'wizard',
        spells: {
          learned: ['spell-1', 'stale-spell']
        }
      }
    ]
    const resolution = createResolution()
    resolution.registry.classes = [
      createSpellcastingClass({
        id: 'wizard',
        label: 'Wizard',
        resetKind: 'LONG_REST',
        spellLimits: createFullCasterSpellLimits()
      })
    ]
    resolution.catalog.spells = [
      createSpell({
        classIds: ['wizard'],
        id: 'spell-1',
        label: 'Shield',
        level: 1
      }),
      createSpell({
        classIds: ['cleric'],
        id: 'stale-spell',
        label: 'Retired Spell',
        level: 1
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.spells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'spell-1',
          sources: [
            expect.objectContaining({
              classId: 'wizard',
              label: 'Wizard',
              canPrepare: true,
              prepared: false
            })
          ]
        }),
        expect.objectContaining({
          id: 'stale-spell',
          sources: undefined
        })
      ])
    )
    expect(() =>
      applyCharacterSheetCommand(
        character,
        {
          type: 'SET_PREPARED_SPELLS',
          classId: 'wizard',
          spellIds: ['stale-spell'],
          expectedVersion: 1
        },
        sheet
      )
    ).toThrow(CharacterSheetCommandError)
  })

  it('does not expose preparation commands for known-spell classes', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'bard', classLevel: 1 }]
    character.intent.spellSelections = [
      {
        id: 'bard-spells',
        source: { kind: 'CLASS', classId: 'bard' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-1']
      }
    ]
    character.state.classes = [
      {
        classId: 'bard',
        spells: {
          learned: ['spell-1']
        }
      }
    ]
    const resolution = createResolution()
    resolution.registry.classes = [
      createSpellcastingClass({
        attributes: [SPELLCASTING_ATTRIBUTE.LIMIT_KNOWN_SPELL_AMOUNT],
        ability: 'CHARISMA',
        id: 'bard',
        label: 'Bard',
        resetKind: 'LONG_REST',
        spellLimits: createFullCasterSpellLimits()
      })
    ]
    resolution.catalog.spells = [
      createSpell({
        classIds: ['bard'],
        id: 'spell-1',
        label: 'Charm Person',
        level: 1
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.spells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'spell-1',
          sources: expect.arrayContaining([
            expect.objectContaining({
              classId: 'bard',
              label: 'Bard',
              canPrepare: false,
              prepared: false
            })
          ])
        })
      ])
    )
    expect(sheet.spells.preparationSources).toBeUndefined()
    expect(sheet.spells.activeGroups).toEqual([
      expect.objectContaining({
        level: 1,
        entries: expect.arrayContaining([
          expect.objectContaining({ spellId: 'spell-1', available: true })
        ])
      })
    ])
    expect(() =>
      applyCharacterSheetCommand(
        character,
        {
          type: 'SET_PREPARED_SPELLS',
          classId: 'bard',
          spellIds: ['spell-1'],
          expectedVersion: 1
        },
        sheet
      )
    ).toThrow(CharacterSheetCommandError)
  })

  it('allows known-spell classes to clear stale prepared spell state', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'bard', classLevel: 1 }]
    character.state.classes = [
      {
        classId: 'bard',
        spells: {
          learned: ['spell-1'],
          prepared: ['spell-1']
        }
      }
    ]
    const resolution = createResolution()
    resolution.registry.classes = [
      createSpellcastingClass({
        attributes: [SPELLCASTING_ATTRIBUTE.LIMIT_KNOWN_SPELL_AMOUNT],
        id: 'bard',
        label: 'Bard',
        resetKind: 'LONG_REST',
        spellLimits: createFullCasterSpellLimits()
      })
    ]
    resolution.catalog.spells = [
      createSpell({
        classIds: ['bard'],
        id: 'spell-1',
        label: 'Charm Person',
        level: 1
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.preparationSources).toBeUndefined()
    const next = applyCharacterSheetCommand(
      character,
      {
        type: 'SET_PREPARED_SPELLS',
        classId: 'bard',
        spellIds: [],
        expectedVersion: 1
      },
      sheet
    )

    expect(next.state.classes).toEqual([
      {
        classId: 'bard',
        spells: {
          learned: ['spell-1']
        }
      }
    ])
  })

  it('matches subclass spells against canonical subclass class records', async () => {
    const character = createCharacter()
    character.intent.classes = [
      { classId: 'wizard', subclassId: 'subclass-choice-1', classLevel: 3 }
    ]
    character.intent.spellSelections = [
      {
        id: 'subclass-spells',
        source: { kind: 'SUBCLASS', subclassId: 'subclass-choice-1', classLevel: 3 },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-1']
      }
    ]
    character.state.classes = [
      {
        classId: 'wizard',
        spells: {
          learned: ['spell-1']
        }
      }
    ]
    const resolution = createResolution()
    resolution.registry.classes = [
      createSpellcastingClass({
        id: 'wizard',
        label: 'Wizard',
        resetKind: 'LONG_REST',
        spellLimits: createFullCasterSpellLimits()
      }),
      createSpellcastingSubclass({
        id: 'subclass-canonical',
        label: 'Order of Scribes',
        parentClassId: 'wizard',
        resetKind: 'LONG_REST',
        spellLimits: createFullCasterSpellLimits()
      })
    ]
    resolution.grants.spellcasting = [
      {
        id: 'subclass-canonical:spellcasting',
        label: 'Order of Scribes Spellcasting',
        sourceLabel: 'Order of Scribes',
        source: { kind: 'SUBCLASS', subclassId: 'subclass-choice-1', classLevel: 3 }
      }
    ]
    resolution.catalog.spells = [
      createSpell({
        classIds: ['subclass-canonical'],
        id: 'spell-1',
        label: 'Manifest Mind',
        level: 1
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.spells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'spell-1',
          sources: expect.arrayContaining([
            expect.objectContaining({
              classId: 'wizard',
              label: 'Wizard',
              canPrepare: true,
              prepared: false
            })
          ])
        })
      ])
    )
    expect(() =>
      applyCharacterSheetCommand(
        character,
        {
          type: 'SET_PREPARED_SPELLS',
          classId: 'wizard',
          spellIds: ['spell-1'],
          expectedVersion: 1
        },
        sheet
      )
    ).not.toThrow()
  })

  it('filters active-class prepared spells that are no longer known by that class', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'wizard', classLevel: 1 }]
    character.intent.spellSelections = [
      {
        id: 'wizard-spells',
        source: { kind: 'CLASS', classId: 'wizard' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-1']
      }
    ]
    character.state.classes = [
      {
        classId: 'wizard',
        spells: {
          learned: ['spell-1'],
          prepared: ['spell-1', 'stale-spell']
        }
      }
    ]
    const resolution = createResolution()
    resolution.registry.classes = [
      createSpellcastingClass({
        id: 'wizard',
        label: 'Wizard',
        resetKind: 'LONG_REST',
        spellLimits: createFullCasterSpellLimits()
      })
    ]
    resolution.catalog.spells = [
      createSpell({
        classIds: ['wizard'],
        id: 'spell-1',
        label: 'Shield',
        level: 1
      }),
      createSpell({
        classIds: ['cleric'],
        id: 'stale-spell',
        label: 'Retired Spell',
        level: 1
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.preparationSources).toEqual([
      {
        classId: 'wizard',
        label: 'Wizard',
        preparedSpellIds: ['spell-1']
      }
    ])
    expect(sheet.spells.spells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'stale-spell',
          sources: undefined
        })
      ])
    )
  })

  it('preserves sheet controls for active class prepared spells stored only in state', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'wizard', classLevel: 1 }]
    character.intent.spellSelections = []
    character.state.classes = [
      {
        classId: 'wizard',
        spells: {
          prepared: ['spell-1']
        }
      }
    ]
    const resolution = createResolution()
    resolution.registry.classes = [
      createSpellcastingClass({
        id: 'wizard',
        label: 'Wizard',
        resetKind: 'LONG_REST',
        spellLimits: createFullCasterSpellLimits()
      })
    ]
    resolution.catalog.spells = [
      createSpell({
        classIds: ['wizard'],
        id: 'spell-1',
        label: 'Shield',
        level: 1
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.spells).toEqual([
      expect.objectContaining({
        id: 'spell-1',
        sources: [
          expect.objectContaining({
            classId: 'wizard',
            label: 'Wizard',
            canPrepare: true,
            prepared: true
          })
        ]
      })
    ])
    expect(sheet.spells.preparationSources).toEqual([
      {
        classId: 'wizard',
        label: 'Wizard',
        preparedSpellIds: ['spell-1']
      }
    ])
  })

  it('leaves spell DC and attack bonus empty for non-casters', async () => {
    const sheet = await buildCharacterSheetResponse({
      character: createCharacter(),
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution: createResolution(),
      streamVersion: 1
    })

    expect(sheet.spells.saveDc).toBeNull()
    expect(sheet.spells.attackBonus).toBeNull()
  })

  it('derives spell DC and attack bonus from the engine spellcasting ability', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'wizard', classLevel: 1 }]
    character.intent.abilities = {
      method: 'MANUAL_ROLLED',
      state: { assignments: [{ ability: 'INTELLIGENCE', score: 16 }] }
    }
    const resolution = createResolution()
    resolution.registry.classes = [
      createSpellcastingClass({
        ability: 'INTELLIGENCE',
        id: 'wizard',
        label: 'Wizard',
        resetKind: 'LONG_REST',
        spellLimits: createFullCasterSpellLimits()
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.saveDc).toBe(13)
    expect(sheet.spells.attackBonus).toBe(5)
  })

  it('derives sheet spell slots from fused multiclass spellcasting rules', async () => {
    const character = createCharacter()
    character.intent.classes = [
      { classId: 'wizard', classLevel: 1 },
      { classId: 'cleric', classLevel: 1 }
    ]
    const resolution = createResolution()
    resolution.summary.totalLevel = 2
    resolution.registry.classes = [
      createSpellcastingClass({
        id: 'wizard',
        label: 'Wizard',
        resetKind: 'LONG_REST',
        spellLimits: createFullCasterSpellLimits()
      }),
      createSpellcastingClass({
        id: 'cleric',
        label: 'Cleric',
        resetKind: 'LONG_REST',
        spellLimits: createFullCasterSpellLimits()
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.slots).toEqual([
      expect.objectContaining({
        slotKey: 'STANDARD:1',
        max: 3,
        used: 1,
        remaining: 2
      })
    ])
  })

  it('derives pact magic as a separate short-rest spell slot pool', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'warlock', classLevel: 1 }]
    character.state.spellSlots = [{ slotKey: 'PACT', used: 1 }]
    const resolution = createResolution()
    resolution.registry.classes = [
      createSpellcastingClass({
        id: 'warlock',
        label: 'Warlock',
        resetKind: 'SHORT_REST',
        spellLimits: [{ classLevel: 1, slots: [{ spellLevel: 1, slotCount: 1 }] }],
        maxSpellLevel: 5
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.slots).toEqual([
      expect.objectContaining({
        slotKey: 'PACT',
        label: 'Pact Magic',
        level: 1,
        max: 1,
        used: 1,
        remaining: 0
      })
    ])
  })
})
