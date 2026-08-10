import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterBuilderResolution } from './builderService.js'
import { buildCharacterSheetResponse } from './sheetProjection.js'
import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  FEATURE_ATTRIBUTE,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  VALUE_DOMAIN_CODE
} from '@artificer-toolkit/shared/core'
import {
  createCharacter,
  createConditionDb,
  createSystem,
  createResolution,
  createSpellcastingClass,
  createEquipment
} from './sheetTestFixtures.js'

describe('character sheet projection', () => {
  it('hydrates exhaustion notes into the sheet overview', async () => {
    const character = createCharacter()
    character.state.exhaustion = {
      level: 1,
      notes: 'Forced march through the swamp.'
    }

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution: createResolution(),
      streamVersion: 1
    })

    expect(sheet.overview.exhaustion.level).toBe(1)
    expect(sheet.overview.exhaustion.notes).toBe('Forced march through the swamp.')
  })

  it('hydrates condition descriptions from system vocabulary', async () => {
    const character = createCharacter()
    character.state.conditions = [
      {
        conditionTypeId: 'condition-1',
        notes: 'Spider venom'
      }
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb([
        {
          id: 'condition-1',
          code: 'POISONED',
          label: 'Poisoned',
          description: 'A poisoned creature suffers from toxins affecting its body.'
        }
      ]),
      hasBuilderDraft: false,
      resolution: createResolution(),
      streamVersion: 1
    })

    expect(sheet.overview.conditions).toEqual([
      {
        conditionTypeId: 'condition-1',
        label: 'Poisoned',
        description: 'A poisoned creature suffers from toxins affecting its body.',
        notes: 'Spider venom'
      }
    ])
    expect(sheet.reference.conditionOptions).toEqual([
      {
        id: 'condition-1',
        code: 'POISONED',
        label: 'Poisoned',
        description: 'A poisoned creature suffers from toxins affecting its body.'
      }
    ])
  })

  it('hydrates only displayable engine proficiencies into typed reference facts', async () => {
    const resolution = createResolution()
    const fighter = createSpellcastingClass({
      id: 'class-1',
      label: 'Fighter',
      resetKind: 'LONG_REST',
      spellLimits: []
    })
    fighter.proficiencies = [
      {
        id: 'prof-skill-1',
        order: 1,
        grantKind: 'PROFICIENCY_GRANT',
        proficiencyKind: 'SKILL',
        selectionKind: 'GRANTED',
        scalingKind: 'NONE',
        authoringModeKind: 'SELECTED',
        skillIds: ['skill-athletics'],
        level: 'FULL'
      },
      {
        id: 'prof-save-1',
        order: 2,
        grantKind: 'PROFICIENCY_GRANT',
        proficiencyKind: 'SAVE_ABILITY',
        selectionKind: 'GRANTED',
        scalingKind: 'NONE',
        authoringModeKind: 'SELECTED',
        abilities: ['DEXTERITY'],
        level: 'DOUBLE'
      },
      {
        id: 'prof-armor-1',
        order: 3,
        grantKind: 'PROFICIENCY_GRANT',
        proficiencyKind: 'EQUIPMENT_PROPERTY',
        selectionKind: 'GRANTED',
        scalingKind: 'NONE',
        authoringModeKind: 'SELECTED',
        category: 'ARMOR',
        properties: ['LIGHT'],
        level: 'FULL'
      },
      {
        id: 'prof-weapon-1',
        order: 4,
        grantKind: 'PROFICIENCY_GRANT',
        proficiencyKind: 'EQUIPMENT_PROPERTY',
        selectionKind: 'GRANTED',
        scalingKind: 'NONE',
        authoringModeKind: 'SELECTED',
        category: 'WEAPON',
        properties: ['MARTIAL', 'FINESSE'],
        level: 'FULL'
      },
      {
        id: 'prof-tool-1',
        order: 5,
        grantKind: 'PROFICIENCY_GRANT',
        proficiencyKind: 'EQUIPMENT_PROPERTY',
        selectionKind: 'GRANTED',
        scalingKind: 'NONE',
        authoringModeKind: 'SELECTED',
        category: 'TOOL',
        properties: ['MUSICAL_INSTRUMENT'],
        level: 'FULL'
      },
      {
        id: 'prof-explicit-tool-1',
        order: 6,
        grantKind: 'PROFICIENCY_GRANT',
        proficiencyKind: 'EQUIPMENT',
        selectionKind: 'GRANTED',
        scalingKind: 'NONE',
        authoringModeKind: 'SELECTED',
        category: 'TOOL',
        equipmentIds: ['smiths-tools'],
        level: 'FULL'
      }
    ]
    resolution.catalog.equipment = [
      {
        id: 'smiths-tools',
        label: "Smith's Tools",
        category: 'TOOL',
        isContainer: false,
        properties: [],
        requiresAttunement: false
      }
    ]
    resolution.registry.classes = [fighter]
    resolution.registry.system = createSystem({
      skills: [
        {
          id: 'skill-athletics',
          code: 'ATHLETICS',
          label: 'Athletics'
        }
      ]
    })
    resolution.summary.totalLevel = 1

    const character = createCharacter()
    character.intent.featureAcquisitions = [
      {
        id: 'feature-acquisition-1',
        featureId: 'fighter-training',
        source: { kind: 'CLASS', classId: 'class-1', classLevel: 1 },
        timing: { kind: 'IMMEDIATE' }
      }
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.reference.proficiencies).toEqual([
      expect.objectContaining({ kind: 'ARMOR', label: 'Light Armor' }),
      expect.objectContaining({ kind: 'WEAPON', label: 'Martial Weapons' }),
      expect.objectContaining({ kind: 'TOOL', label: 'Musical Instrument' }),
      expect.objectContaining({ kind: 'TOOL', label: "Smith's Tools" })
    ])
  })

  it('applies grants from automatic class features without a redundant acquisition record', async () => {
    const resolution = createResolution()
    const fighter = createSpellcastingClass({
      id: 'class-1',
      label: 'Fighter',
      resetKind: 'LONG_REST',
      spellLimits: []
    })
    fighter.features = [
      {
        id: 'automatic-training',
        label: 'Automatic Training',
        description: 'Gain proficiency in Athletics.',
        order: 1,
        availableAtLevel: 1,
        grants: {
          proficiencies: [
            {
              id: 'automatic-athletics',
              order: 1,
              grantKind: 'PROFICIENCY_GRANT',
              proficiencyKind: 'SKILL',
              selectionKind: 'GRANTED',
              scalingKind: 'NONE',
              authoringModeKind: 'SELECTED',
              skillIds: ['skill-athletics'],
              level: 'FULL'
            }
          ]
        }
      }
    ]
    resolution.registry.classes = [fighter]
    resolution.registry.system = createSystem({
      skills: [{ id: 'skill-athletics', code: 'ATHLETICS', label: 'Athletics' }]
    })
    resolution.summary.totalLevel = 1
    resolution.grants.features = [
      {
        id: 'automatic-training',
        label: 'Automatic Training',
        description: 'Gain proficiency in Athletics.',
        sourceLabel: 'Fighter',
        source: { kind: 'CLASS', classId: 'class-1', classLevel: 1 }
      }
    ]

    const character = createCharacter()
    character.intent.featureAcquisitions = []

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.reference.proficiencies).toEqual([])
    expect(sheet.overview.skills).toContainEqual(
      expect.objectContaining({ label: 'Athletics', proficiency: 'FULL' })
    )
  })

  it('hydrates engine-derived saving throw overview rows with proficiency levels', async () => {
    const resolution = createResolution()
    const fighter = createSpellcastingClass({
      id: 'class-1',
      label: 'Fighter',
      resetKind: 'LONG_REST',
      spellLimits: []
    })
    fighter.proficiencies = [
      {
        id: 'prof-save-1',
        order: 1,
        grantKind: 'PROFICIENCY_GRANT',
        proficiencyKind: 'SAVE_ABILITY',
        selectionKind: 'GRANTED',
        scalingKind: 'NONE',
        authoringModeKind: 'SELECTED',
        abilities: ['DEXTERITY'],
        level: 'FULL'
      }
    ]
    resolution.registry.classes = [fighter]
    resolution.summary.totalLevel = 1
    resolution.summary.abilities = { DEXTERITY: 14 }

    const character = createCharacter()
    character.intent.featureAcquisitions = [
      {
        id: 'feature-acquisition-1',
        featureId: 'fighter-training',
        source: { kind: 'CLASS', classId: 'class-1', classLevel: 1 },
        timing: { kind: 'IMMEDIATE' }
      }
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.overview.savingThrows).toEqual(
      expect.arrayContaining([
        {
          ability: 'DEXTERITY',
          label: 'Dexterity',
          total: 4,
          proficiency: 'FULL',
          rollMode: 'NORMAL'
        }
      ])
    )
    expect(sheet.overview.abilities).toContainEqual({
      ability: 'DEXTERITY',
      score: 14,
      modifier: 2,
      rollMode: 'NORMAL'
    })
  })

  it('hydrates engine-derived skill overview rows with vocabulary-id skill matching', async () => {
    const resolution = createResolution()
    const athleticsSkillId = '00000000-0000-0000-0000-000000000101'
    const fighter = createSpellcastingClass({
      id: 'class-1',
      label: 'Fighter',
      resetKind: 'LONG_REST',
      spellLimits: []
    })
    fighter.proficiencies = [
      {
        id: 'prof-skill-1',
        order: 1,
        grantKind: 'PROFICIENCY_GRANT',
        proficiencyKind: 'SKILL',
        selectionKind: 'GRANTED',
        scalingKind: 'NONE',
        authoringModeKind: 'SELECTED',
        skillIds: [athleticsSkillId],
        level: 'FULL'
      }
    ]
    fighter.features = [
      {
        id: 'athletics-roll-mode',
        label: 'Athletics Roll Mode',
        description: 'Tests projected check modes.',
        order: 1,
        availableAtLevel: 1,
        grants: {
          modifiers: [
            {
              id: 'global-ability-advantage',
              grantKind: 'MODIFIER_GRANT',
              valueDomainCode: 'ABILITY_CHECK',
              modifierKind: 'ADVANTAGE',
              domain: {},
              scope: 'GLOBAL',
              selectionKind: 'GRANTED',
              order: 0
            },
            {
              id: 'athletics-disadvantage',
              grantKind: 'MODIFIER_GRANT',
              valueDomainCode: 'SKILL_MODIFIER',
              modifierKind: 'DISADVANTAGE',
              domain: { skillId: athleticsSkillId },
              scope: 'GLOBAL',
              selectionKind: 'GRANTED',
              order: 1
            }
          ]
        }
      }
    ]
    resolution.registry.classes = [fighter]
    resolution.registry.system = createSystem({
      skills: [
        {
          id: athleticsSkillId,
          code: 'ATHLETICS',
          label: 'Athletics'
        }
      ]
    })
    resolution.summary.totalLevel = 1
    resolution.summary.abilities = { STRENGTH: 14 }

    const character = createCharacter()
    character.intent.featureAcquisitions = [
      {
        id: 'feature-acquisition-1',
        featureId: 'athletics-roll-mode',
        source: { kind: 'CLASS', classId: 'class-1', classLevel: 1 },
        timing: { kind: 'IMMEDIATE' }
      }
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.overview.skills).toEqual(
      expect.arrayContaining([
        {
          skillId: athleticsSkillId,
          code: 'ATHLETICS',
          label: 'Athletics',
          ability: 'STRENGTH',
          total: 4,
          rollMode: 'NORMAL',
          proficiency: 'FULL'
        }
      ])
    )
    expect(sheet.overview.abilities).toContainEqual({
      ability: 'STRENGTH',
      score: 14,
      modifier: 2,
      rollMode: 'ADVANTAGE'
    })
  })

  it('projects passive sense facts from resolved skill totals', async () => {
    const resolution = createResolution()
    resolution.registry.system = createSystem({
      passives: [
        { id: 'passive-perception', code: 'PASSIVE_PERCEPTION', label: 'Passive Perception' },
        {
          id: 'passive-investigation',
          code: 'PASSIVE_INVESTIGATION',
          label: 'Passive Investigation'
        },
        { id: 'passive-insight', code: 'PASSIVE_INSIGHT', label: 'Passive Insight' }
      ],
      skills: [
        { id: 'skill-perception', code: 'PERCEPTION', label: 'Perception' },
        { id: 'skill-investigation', code: 'INVESTIGATION', label: 'Investigation' },
        { id: 'skill-insight', code: 'INSIGHT', label: 'Insight' }
      ]
    })
    resolution.summary.abilities = {
      INTELLIGENCE: 12,
      WISDOM: 14
    }

    const sheet = await buildCharacterSheetResponse({
      character: createCharacter(),
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.overview.facts).toEqual(
      expect.arrayContaining([
        { label: 'Passive Perception', value: '12' },
        { label: 'Passive Investigation', value: '11' },
        { label: 'Passive Insight', value: '12' }
      ])
    )
  })

  it('filters sheet reference features without inventing actions from attributes alone', async () => {
    const resolution = createResolution()
    resolution.grants.features = [
      {
        id: 'feature-hidden',
        label: 'Ability Score Increase',
        description: '<p>Your Strength score increases by 2.</p>',
        attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
        sourceLabel: 'Dragonborn',
        source: { kind: 'RACE', raceId: 'race-1' }
      },
      {
        id: 'feature-visible',
        label: 'Danger Sense',
        description: '<p>You have advantage on Dexterity saving throws.</p>',
        sourceLabel: 'Barbarian',
        source: { kind: 'CLASS', classId: 'class-1', classLevel: 2 }
      },
      {
        id: 'feature-limited',
        label: 'Second Wind',
        description: '<p>Regain hit points as a bonus action.</p>',
        attributes: [FEATURE_ATTRIBUTE.LIMITED_USE],
        sourceLabel: 'Fighter',
        source: { kind: 'CLASS', classId: 'class-1', classLevel: 1 }
      }
    ]

    const sheet = await buildCharacterSheetResponse({
      character: createCharacter(),
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.actions.items).toEqual([])
    expect(sheet.reference.features).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'feature-visible' }),
        expect.objectContaining({ id: 'feature-limited' })
      ])
    )
    expect(sheet.reference.features).not.toContainEqual(
      expect.objectContaining({ id: 'feature-hidden' })
    )
  })

  it('links a recovery-only feature action to its resource row', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'class-1', subclassId: 'subclass-1', classLevel: 3 }]
    const resolution = createResolution()
    resolution.grants.features = [
      {
        id: 'subclass-1',
        label: 'Superiority Dice',
        description: '<p>Recover your expended superiority dice.</p>',
        sourceLabel: 'Battle Master',
        source: { kind: 'SUBCLASS', subclassId: 'subclass-1', classLevel: 3 }
      }
    ]
    const rowsByTable = {
      features: [
        {
          ownerId: 'subclass-1',
          label: 'Superiority Dice',
          description: 'Recover your expended superiority dice.',
          sectionCode: 'ACTION',
          availableAtLevel: 3,
          chargeId: null,
          effectId: 'recover-superiority-dice',
          ownerEffectOrder: 1,
          effectOrder: 1
        }
      ],
      effect_invocations: [
        {
          effectId: 'recover-superiority-dice',
          triggerCode: 'ACTIVATED',
          activationType: 'OTHER',
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
          pathId: 'recover-superiority-dice-path',
          effectId: 'recover-superiority-dice',
          order: 1,
          pathCode: 'ON_USE',
          groupType: 'SINGLE',
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
          resultBlockId: 'recover-superiority-dice-result',
          rollTableKind: null,
          die: null
        }
      ],
      effect_result_blocks: [
        {
          resultBlockId: 'recover-superiority-dice-result',
          resultKind: 'SINGLE',
          durationCharacteristicId: null,
          lifecycleRecurringKind: null,
          lifecycleConsumeOnFirstEvent: null,
          lifecycleEndOnEvents: null
        }
      ],
      effect_result_block_outcomes: [
        {
          resultBlockId: 'recover-superiority-dice-result',
          outcomeId: 'recover-superiority-dice-outcome',
          effectKind: 'RESOURCE_RECOVERY',
          order: 1
        }
      ],
      effect_generic_outcomes: [
        {
          outcomeId: 'recover-superiority-dice-outcome',
          effectKind: 'RESOURCE_RECOVERY',
          payload: { label: 'Recover expended superiority dice' }
        }
      ]
    }

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb([], rowsByTable),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    const resource = sheet.resources.items.find(({ label }) => label === 'Superiority Dice')
    expect(resource).toBeDefined()
    expect(sheet.actions.items).toContainEqual(
      expect.objectContaining({
        label: 'Superiority Dice',
        kind: 'OTHER',
        resourceGrantId: resource?.id
      })
    )
  })

  it('binds source-charged feature actions to each physical equipment copy', async () => {
    const character = createCharacter()
    character.state.equipment.inventory = [
      {
        id: 'astral-tear-one',
        equipmentId: 'astral-tear',
        quantity: 1,
        customName: 'Vyrre’s Blade'
      },
      {
        id: 'astral-tear-two',
        equipmentId: 'astral-tear',
        quantity: 1,
        customName: 'Vyrre’s Blade'
      }
    ]
    character.state.equipment.attuned = ['astral-tear-one', 'astral-tear-two']
    const resolution = createResolution()
    const equipment = createEquipment({
      category: 'WEAPON',
      id: 'astral-tear',
      label: 'Astral Tear'
    })
    equipment.requiresAttunement = true
    equipment.charges = {
      id: 'astral-tear-charges',
      resetKind: 'DAWN',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      amount: 3
    }
    equipment.features = [
      {
        id: 'astral-tear-warping-strike',
        label: 'Warping Strike',
        description: 'Teleport before or after the attack.',
        attributes: ['LIMITED_USE'],
        charges: {
          id: 'astral-tear-warping-strike-charges',
          limitKind: 'SOURCE_CHARGES',
          scalingKind: 'NONE',
          cost: 2
        },
        section: 'ACTION',
        order: 1
      },
      {
        id: 'astral-tear-void-step',
        label: 'Void Step',
        description: 'Step through the void.',
        attributes: ['LIMITED_USE'],
        charges: {
          id: 'astral-tear-void-step-charges',
          limitKind: 'SOURCE_CHARGES',
          scalingKind: 'NONE',
          cost: 1
        },
        section: 'ACTION',
        order: 2
      }
    ]
    resolution.registry.equipment = [equipment]
    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb([], {
        features: [
          {
            ownerId: 'astral-tear-warping-strike',
            label: 'Warping Strike',
            description: 'Teleport before or after the attack.',
            sectionCode: 'ACTION',
            availableAtLevel: 1,
            chargeId: 'astral-tear-warping-strike-charges',
            effectId: 'warping-strike-effect',
            ownerEffectOrder: 1,
            effectOrder: 1
          }
        ],
        effect_invocations: [
          {
            effectId: 'warping-strike-effect',
            triggerCode: 'ACTIVATED',
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
        ]
      }),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    const actions = sheet.actions.items.filter(({ label }) => label === 'Warping Strike')
    expect(actions).toEqual([
      expect.objectContaining({
        id: 'FEATURE:astral-tear-warping-strike:astral-tear-one:warping-strike-effect',
        resourceGrantId: 'ITEM_INSTANCE:astral-tear-one:astral-tear-charges',
        resourceCost: 2,
        sourceLabel: 'Vyrre’s Blade #1'
      }),
      expect.objectContaining({
        id: 'FEATURE:astral-tear-warping-strike:astral-tear-two:warping-strike-effect',
        resourceGrantId: 'ITEM_INSTANCE:astral-tear-two:astral-tear-charges',
        resourceCost: 2,
        sourceLabel: 'Vyrre’s Blade #2'
      })
    ])
    expect(
      sheet.resources.items
        .filter(({ owner }) => owner.kind === 'ITEM_INSTANCE')
        .map(({ owner }) => (owner.kind === 'ITEM_INSTANCE' ? owner.itemInstanceId : ''))
    ).toEqual(['astral-tear-one', 'astral-tear-two'])
    expect(
      sheet.reference.features
        .filter((feature) => feature.source.kind === 'EQUIPMENT_INSTANCE')
        .map((feature) => ({
          id: feature.id,
          resourceGrantId: feature.resourceGrantId,
          source: feature.source
        }))
    ).toEqual([
      {
        id: 'astral-tear-warping-strike:astral-tear-one',
        resourceGrantId: 'ITEM_INSTANCE:astral-tear-one:astral-tear-charges',
        source: {
          kind: 'EQUIPMENT_INSTANCE',
          equipmentId: 'astral-tear',
          itemInstanceId: 'astral-tear-one'
        }
      },
      {
        id: 'astral-tear-void-step:astral-tear-one',
        resourceGrantId: 'ITEM_INSTANCE:astral-tear-one:astral-tear-charges',
        source: {
          kind: 'EQUIPMENT_INSTANCE',
          equipmentId: 'astral-tear',
          itemInstanceId: 'astral-tear-one'
        }
      },
      {
        id: 'astral-tear-warping-strike:astral-tear-two',
        resourceGrantId: 'ITEM_INSTANCE:astral-tear-two:astral-tear-charges',
        source: {
          kind: 'EQUIPMENT_INSTANCE',
          equipmentId: 'astral-tear',
          itemInstanceId: 'astral-tear-two'
        }
      },
      {
        id: 'astral-tear-void-step:astral-tear-two',
        resourceGrantId: 'ITEM_INSTANCE:astral-tear-two:astral-tear-charges',
        source: {
          kind: 'EQUIPMENT_INSTANCE',
          equipmentId: 'astral-tear',
          itemInstanceId: 'astral-tear-two'
        }
      }
    ])
  })

  it('hydrates inventory item reference details from equipment records', async () => {
    const resolution = createResolution()
    resolution.registry.system = createSystem({
      currencies: [{ id: 'gp', code: 'GP', label: 'Gold' }]
    })
    const equipment = createEquipment({
      category: 'WEAPON',
      id: 'equipment-1',
      label: 'Longsword'
    })
    equipment.description = '<p>A balanced knightly blade.</p>'
    equipment.cost = { amount: 15, currencyId: 'gp' }
    equipment.properties = ['MARTIAL', 'ONE_HANDED']
    equipment.armorClass = 1
    resolution.registry.equipment = [equipment]

    const sheet = await buildCharacterSheetResponse({
      character: createCharacter(),
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.inventory.items).toContainEqual(
      expect.objectContaining({
        id: 'item-1',
        equipmentLabel: 'Longsword',
        description: '<p>A balanced knightly blade.</p>',
        category: 'WEAPON',
        cost: { amount: 15, currencyId: 'gp' },
        costLabel: 'Gold',
        weight: { amount: 0, unit: 'POUNDS' },
        properties: [
          { code: 'MARTIAL', label: 'Martial' },
          { code: 'ONE_HANDED', label: 'One-Handed' }
        ],
        armorClass: 1
      })
    )
  })

  it('uses the slim equipment catalog for add-item options', async () => {
    const resolution = createResolution()
    resolution.catalog.equipment = [
      {
        id: 'backpack',
        label: 'Backpack',
        isContainer: true,
        properties: [],
        requiresAttunement: false
      }
    ]

    const sheet = await buildCharacterSheetResponse({
      character: createCharacter(),
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.reference.equipmentOptions).toEqual([
      {
        id: 'backpack',
        label: 'Backpack',
        isContainer: true,
        requiresAttunement: false
      }
    ])
    expect(resolution.registry.equipment).toEqual([])
  })

  it('hydrates inventory custom names and notes for sheet editing', async () => {
    const character = createCharacter()
    character.state.equipment.inventory = [
      {
        id: 'item-1',
        equipmentId: 'equipment-1',
        quantity: 1,
        customName: 'Moonlit Blade',
        notes: 'Loaned by the captain'
      }
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution: createResolution(),
      streamVersion: 1
    })

    expect(sheet.inventory.items).toEqual([
      expect.objectContaining({
        id: 'item-1',
        label: 'Moonlit Blade',
        customName: 'Moonlit Blade',
        notes: 'Loaned by the captain'
      })
    ])
  })

  it('derives overview combat stats from engine equipment and ability output', async () => {
    const character = createCharacter()
    character.state.equipment.equipped = ['item-1']
    const resolution = createResolution()
    resolution.summary.abilities = { DEXTERITY: 16 }
    resolution.registry.equipment = [
      createEquipment({
        armorClass: 2,
        category: 'SHIELD',
        id: 'equipment-1',
        label: 'Shield'
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.overview.armorClass).toBe(15)
    expect(sheet.overview.initiative).toBe(3)
    expect(sheet.overview.proficiencyBonus).toBe(2)
    expect(sheet.overview.facts).toEqual(
      expect.arrayContaining([
        { label: 'Initiative', value: '+3' },
        { label: 'Proficiency', value: '+2' }
      ])
    )
  })

  it('derives resource maximums and recovery from class resource charges', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'class-1', subclassId: 'subclass-1', classLevel: 3 }]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution: createResolution(),
      streamVersion: 1
    })

    expect(sheet.resources.items).toEqual([
      expect.objectContaining({
        owner: expect.objectContaining({
          kind: 'AUTHORED_GRANT',
          resourceGrantId: 'resource-1'
        }),
        description: 'Spend a die to fuel combat maneuvers.',
        max: 4,
        recoveries: [{ trigger: 'SHORT_REST', amount: { kind: 'ALL' } }],
        remaining: 3,
        used: 1
      })
    ])
  })

  it('uses the current source class level for per-level resource charges', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'class-1', subclassId: 'subclass-1', classLevel: 3 }]
    const resolution = createResolution()
    const resource = resolution.registry.classes[0]?.resources
    if (!resource) throw new Error('resource fixture missing')
    resource.charges = {
      id: 'charge-1',
      resetKind: 'LONG_REST',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'PER_LEVEL',
      levels: [
        { id: 'charge-level-1', level: 1, amount: 2 },
        { id: 'charge-level-3', level: 3, amount: 3 }
      ]
    }

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.resources.items[0]?.max).toBe(3)
  })

  it('uses engine-resolved resource recovery when charge reset modifiers apply', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'class-1', subclassId: 'subclass-1', classLevel: 5 }]
    character.intent.featureAcquisitions = [
      {
        id: 'font-of-inspiration',
        featureId: 'font-of-inspiration',
        source: { kind: 'SUBCLASS', subclassId: 'subclass-1', classLevel: 5 },
        timing: { kind: 'CLASS_LEVEL', classId: 'class-1', classLevel: 5 }
      }
    ]

    const resolution = createResolution()
    resolution.registry.classes = resolution.registry.classes.map((classRecord) => ({
      ...classRecord,
      resources: classRecord.resources
        ? {
            ...classRecord.resources,
            charges: {
              ...classRecord.resources.charges,
              resetKind: 'LONG_REST'
            }
          }
        : classRecord.resources
    }))
    resolution.registry.features = [
      {
        id: 'font-of-inspiration',
        label: 'Font of Inspiration',
        description: '',
        order: 1,
        grants: {
          modifiers: [
            {
              id: 'font-of-inspiration-reset',
              grantKind: GRANT_KIND.MODIFIER_GRANT,
              order: 1,
              valueDomainCode: VALUE_DOMAIN_CODE.CHARGE_RESET,
              domain: {},
              modifierKind: MODIFIER_KIND.REPLACE_CHARGE_RESET_KIND,
              scope: MODIFIER_SCOPE_KIND.SOURCE,
              selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
              payload: { resetKind: 'SHORT_REST' },
              restrictions: {
                id: 'font-of-inspiration-reset-restriction',
                groups: [
                  {
                    id: 'font-of-inspiration-reset-restriction-group',
                    order: 1,
                    contexts: [
                      {
                        id: 'font-of-inspiration-reset-resource',
                        order: 1,
                        subject: 'RESOURCE',
                        authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                        resourceIds: ['resource-1']
                      }
                    ]
                  }
                ]
              }
            }
          ]
        }
      }
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.resources.items).toEqual([
      expect.objectContaining({
        owner: expect.objectContaining({
          kind: 'AUTHORED_GRANT',
          resourceGrantId: 'resource-1'
        }),
        recoveries: [{ trigger: 'SHORT_REST', amount: { kind: 'ALL' } }]
      })
    ])
  })

  it('uses resource grant ids for sheet usage when grant and definition ids differ', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'class-1', subclassId: 'subclass-1', classLevel: 3 }]
    character.intent.resourceGrants = [
      {
        id: 'resource:subclass-1:resource-1',
        resourceId: 'resource-1',
        source: { kind: 'SUBCLASS', subclassId: 'subclass-1', classLevel: 1 },
        timing: { kind: 'CLASS_LEVEL', classId: 'class-1', classLevel: 1 }
      }
    ]
    character.state.resources = [{ resourceGrantId: 'resource:subclass-1:resource-1', used: 2 }]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution: createResolution(),
      streamVersion: 1
    })

    expect(sheet.resources.items).toEqual([
      expect.objectContaining({
        owner: expect.objectContaining({
          kind: 'AUTHORED_GRANT',
          resourceGrantId: 'resource:subclass-1:resource-1'
        }),
        max: 4,
        remaining: 2,
        used: 2
      })
    ])
  })

  it('resolves subclass resource definitions without requiring the subclass source id to be a class row id', async () => {
    const character = createCharacter()
    character.intent.classes = [
      { classId: 'class-1', subclassId: 'subclass-choice-1', classLevel: 3 }
    ]
    const resolution = createResolution()
    resolution.grants.resources = resolution.grants.resources.map((resource) => ({
      ...resource,
      source: { kind: 'SUBCLASS', subclassId: 'subclass-choice-1', classLevel: 3 }
    }))

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.resources.items).toEqual([
      expect.objectContaining({
        owner: expect.objectContaining({
          kind: 'AUTHORED_GRANT',
          resourceGrantId: 'resource-1'
        }),
        max: 4,
        recoveries: [{ trigger: 'SHORT_REST', amount: { kind: 'ALL' } }]
      })
    ])
  })
})

const mocks = vi.hoisted(() => ({
  appendEvent: vi.fn(),
  findAllCreatures: vi.fn(),
  findAllVehicles: vi.fn(),
  findByCommandId: vi.fn(),
  findById: vi.fn(),
  findAuthoredById: vi.fn(),
  getMovementPreference: vi.fn(),
  listAdjustments: vi.fn(),
  listResourceUsage: vi.fn(),
  listSpellCustomizations: vi.fn(),
  patchSheetState: vi.fn(),
  removeAdjustment: vi.fn(),
  consumeRollForUser: vi.fn(),
  findRollByIdForUser: vi.fn(),
  resolveCharacterBuilder: vi.fn(),
  setMovementPreference: vi.fn(),
  setResourceUsage: vi.fn(),
  setSpellCustomization: vi.fn(),
  upsertAdjustment: vi.fn()
}))

mocks.findAllCreatures.mockResolvedValue([])
mocks.findAllVehicles.mockResolvedValue([])

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  class MockConcurrencyError extends Error {
    constructor(characterId: string, expected: number) {
      super(`Character "${characterId}" stream_version conflict: expected ${expected}.`)
      this.name = 'ConcurrencyError'
    }
  }
  return {
    ...actual,
    ConcurrencyError: MockConcurrencyError,
    createCharacterEventRepository: () => ({
      append: mocks.appendEvent,
      findByCommandId: mocks.findByCommandId
    }),
    createCharacterRepository: () => ({
      findById: mocks.findById,
      findAuthoredById: mocks.findAuthoredById,
      patchSheetState: mocks.patchSheetState
    }),
    createCampaignContentRepository: () => ({
      findAssignedCampaign: async () => null
    }),
    createRollHistoryRepository: () => ({
      consumeForUser: mocks.consumeRollForUser,
      findAvailableByIdForUser: mocks.findRollByIdForUser
    }),
    createCreatureRepository: () => ({
      findByIds: async () =>
        new Map(
          ((await mocks.findAllCreatures()) as CreatureAuthored[]).map((creature) => [
            creature.id,
            creature
          ])
        )
    }),
    createVehicleRepository: () => ({
      findByIds: async () => {
        const vehicles = (await mocks.findAllVehicles()) as Array<{ id: string }>
        return new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]))
      }
    }),
    getCharacterSheetExtraCatalogQuery: async () => ({
      creatures: await mocks.findAllCreatures(),
      vehicles: await mocks.findAllVehicles()
    }),
    createCharacterSheetAdjustmentRepository: () => ({
      getMovementPreference: mocks.getMovementPreference,
      listByCharacter: mocks.listAdjustments,
      remove: mocks.removeAdjustment,
      setMovementPreference: mocks.setMovementPreference,
      upsert: mocks.upsertAdjustment
    }),
    createCharacterSheetPlayStateRepository: () => ({
      listResourceUsage: mocks.listResourceUsage,
      listSpellCustomizations: mocks.listSpellCustomizations,
      setResourceUsage: mocks.setResourceUsage,
      setSpellCustomization: mocks.setSpellCustomization
    })
  }
})

vi.mock('./builderService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./builderService.js')>()
  return {
    ...actual,
    resolveCharacterBuilder: mocks.resolveCharacterBuilder
  }
})

const emptyQuery = {
  select: () => emptyQuery,
  selectAll: () => emptyQuery,
  innerJoin: () => emptyQuery,
  leftJoin: () => emptyQuery,
  where: () => emptyQuery,
  orderBy: () => emptyQuery,
  execute: async () => []
}

const db = { selectFrom: () => emptyQuery }

describe('character sheet projection extras', () => {
  function createCharacter(overrides: Partial<CharacterAuthored> = {}): CharacterAuthored {
    return {
      id: 'character-1',
      label: 'Aria',
      status: 'ACTIVE',
      profile: {},
      systemId: 'system-1',
      userId: 'user-1',
      intent: {
        advancement: { method: 'MILESTONE' },
        race: { raceId: 'race-1' },
        background: { backgroundId: 'background-1' },
        classes: [{ classId: 'class-1', classLevel: 1 }],
        abilities: {
          method: 'STANDARD_ARRAY',
          assignments: [{ ability: 'DEXTERITY', option: '14' }]
        },
        hitpoints: {
          method: 'FIXED',
          levels: [{ level: 1, classId: 'class-1', classLevel: 1, value: 10 }]
        },
        featureAcquisitions: []
      },
      state: {
        equipment: {
          inventory: [],
          equipped: [],
          attuned: []
        },
        currency: [],
        hitpoints: {
          current: 10,
          hitDice: []
        }
      },
      ...overrides
    }
  }

  function createResolution(): CharacterBuilderResolution {
    return {
      mode: 'edit',
      catalog: {
        races: [],
        classes: [],
        backgrounds: [],
        equipment: [],
        feats: [],
        spells: []
      },
      registry: {
        system: {
          rulesetCode: 'dnd5e',
          rulesetVersion: '2014',
          currencies: [{ id: 'currency-1', label: 'Gold' }],
          speeds: [
            { id: 'speed-walk', code: 'WALK', label: 'Walking Speed' },
            { id: 'speed-fly', code: 'FLY', label: 'Flying Speed' },
            { id: 'speed-climb', code: 'CLIMB', label: 'Climbing Speed' }
          ]
        } as CharacterBuilderResolution['registry']['system'],
        races: [],
        classes: [],
        backgrounds: [],
        equipment: [],
        features: []
      },
      summary: {
        totalLevel: 1,
        abilities: { DEXTERITY: 14 },
        classes: []
      },
      grants: {
        features: [],
        resources: [],
        spellcasting: []
      },
      chosenGrantChoices: [],
      outstandingChoices: [],
      validations: [],
      readiness: {
        ready: true,
        blockingIssues: [],
        outstandingRequiredChoices: []
      },
      recommendedSectionId: 'REVIEW'
    }
  }

  function createCreature(overrides: Partial<CreatureAuthored> = {}): CreatureAuthored {
    return {
      id: 'creature-1',
      label: 'Owl',
      userId: 'user-1',
      systemId: 'system-1',
      category: 'COMPANION',
      creatureTypeId: '00000000-0000-4000-8000-000000000021',
      size: 'SMALL',
      alignmentId: '00000000-0000-4000-8000-000000000022',
      abilityScores: {
        STRENGTH: 3,
        DEXTERITY: 13,
        CONSTITUTION: 10,
        INTELLIGENCE: 2,
        WISDOM: 12,
        CHARISMA: 7
      },
      armorClass: 11,
      hitPoints: 3,
      speeds: [],
      ...overrides
    }
  }

  beforeEach(() => {
    mocks.appendEvent.mockReset()
    mocks.findAllCreatures.mockReset()
    mocks.findAllCreatures.mockResolvedValue([])
    mocks.findAllVehicles.mockReset()
    mocks.findAllVehicles.mockResolvedValue([])
    mocks.findById.mockReset()
    mocks.findByCommandId.mockReset()
    mocks.findAuthoredById.mockReset()
    mocks.consumeRollForUser.mockReset()
    mocks.consumeRollForUser.mockResolvedValue(true)
    mocks.findRollByIdForUser.mockReset()
    mocks.getMovementPreference.mockReset()
    mocks.getMovementPreference.mockResolvedValue({ mode: 'AUTO' })
    mocks.listAdjustments.mockReset()
    mocks.listAdjustments.mockResolvedValue([])
    mocks.listResourceUsage.mockReset()
    mocks.listResourceUsage.mockResolvedValue([])
    mocks.listSpellCustomizations.mockReset()
    mocks.listSpellCustomizations.mockResolvedValue([])
    mocks.removeAdjustment.mockReset()
    mocks.upsertAdjustment.mockReset()
    mocks.resolveCharacterBuilder.mockReset()
    mocks.setMovementPreference.mockReset()
    mocks.setResourceUsage.mockReset()
    mocks.setSpellCustomization.mockReset()
    mocks.patchSheetState.mockReset()
    mocks.findById.mockResolvedValue({
      id: 'character-1',
      stream_version: 1
    })
    mocks.findByCommandId.mockResolvedValue(null)
    mocks.findAuthoredById.mockResolvedValue(createCharacter())
    mocks.resolveCharacterBuilder.mockResolvedValue(createResolution())
    mocks.patchSheetState.mockImplementation(async (_characterId, _patches, options) => {
      await options.afterPersist?.(db, 2)
      return 2
    })
  })

  it('hydrates inactive attached extras without offering them as add sources', async () => {
    const character = createCharacter()
    character.state.creatures = [
      {
        id: '00000000-0000-4000-8000-000000000112',
        creatureId: 'creature-1',
        relationshipKind: 'COMPANION',
        originKind: 'WORLD',
        isActive: true,
        currentHitPoints: 3
      }
    ]
    character.state.vehicles = [
      {
        id: '00000000-0000-4000-8000-000000000113',
        vehicleId: 'vehicle-1',
        isActive: true,
        currentHitPoints: 8
      }
    ]
    mocks.findAllCreatures.mockResolvedValue([createCreature({ status: 'DRAFT' })])
    mocks.findAllVehicles.mockResolvedValue([
      {
        id: 'vehicle-1',
        label: 'Cart',
        userId: 'user-1',
        systemId: 'system-1',
        status: 'DRAFT',
        category: 'LAND',
        features: [],
        hitPoints: 8
      }
    ])

    const sheet = await buildCharacterSheetResponse({
      db: db as unknown as DBLike,
      character,
      resolution: createResolution(),
      streamVersion: 1
    })
    expect(sheet.extras.items).toHaveLength(2)
    expect(sheet.extras.creatureOptions).toEqual([])
    expect(sheet.extras.vehicleOptions).toEqual([])
  })

  it('projects one non-walking creature speed and falls back to walking', async () => {
    const character = createCharacter()
    character.state.creatures = [
      {
        id: '00000000-0000-4000-8000-000000000114',
        creatureId: 'creature-1',
        relationshipKind: 'COMPANION',
        originKind: 'WORLD',
        isActive: true,
        currentHitPoints: 3
      }
    ]
    mocks.findAllCreatures.mockResolvedValue([
      createCreature({
        speeds: [
          { speedId: 'speed-walk', amount: 5, unit: 'FEET' },
          { speedId: 'speed-fly', amount: 60, unit: 'FEET' },
          { speedId: 'speed-climb', amount: 30, unit: 'FEET' }
        ]
      })
    ])

    const sheet = await buildCharacterSheetResponse({
      db: db as unknown as DBLike,
      character,
      resolution: createResolution(),
      streamVersion: 1
    })
    expect(sheet.extras.items[0]?.speedLabel).toBe('Flying 60 feet')
    expect(sheet.extras.creatureOptions[0]?.speedLabel).toBe('Flying 60 feet')

    mocks.findAllCreatures.mockResolvedValue([
      createCreature({
        speeds: [{ speedId: 'speed-walk', amount: 5, unit: 'FEET' }]
      })
    ])
    const walkingSheet = await buildCharacterSheetResponse({
      db: db as unknown as DBLike,
      character,
      resolution: createResolution(),
      streamVersion: 1
    })
    expect(walkingSheet.extras.items[0]?.speedLabel).toBe('5 feet')
    expect(walkingSheet.extras.creatureOptions[0]?.speedLabel).toBe('5 feet')
  })

  it('projects every companion override into the effective sheet values', async () => {
    const character = createCharacter()
    character.state.creatures = [
      {
        id: '00000000-0000-4000-8000-000000000114',
        creatureId: 'creature-1',
        relationshipKind: 'COMPANION',
        originKind: 'WORLD',
        isActive: true,
        currentHitPoints: 9
      }
    ]
    mocks.findAllCreatures.mockResolvedValue([createCreature()])
    const metadata = {
      characterId: 'character-1',
      createdBy: 'user-1',
      updatedBy: 'user-1',
      createdAt: '2026-07-27T00:00:00.000Z',
      updatedAt: '2026-07-27T00:00:00.000Z'
    }
    const sheet = await buildCharacterSheetResponse({
      db: db as unknown as DBLike,
      character,
      resolution: createResolution(),
      streamVersion: 1,
      adjustments: [
        {
          ...metadata,
          id: '00000000-0000-4000-8000-000000000115',
          family: 'COMPANION',
          companionInstanceId: '00000000-0000-4000-8000-000000000114',
          field: 'ARMOR_CLASS_OVERRIDE',
          value: 16
        },
        {
          ...metadata,
          id: '00000000-0000-4000-8000-000000000116',
          family: 'COMPANION',
          companionInstanceId: '00000000-0000-4000-8000-000000000114',
          field: 'MAXIMUM_HIT_POINTS_OVERRIDE',
          value: 5
        },
        {
          ...metadata,
          id: '00000000-0000-4000-8000-000000000117',
          family: 'COMPANION',
          companionInstanceId: '00000000-0000-4000-8000-000000000114',
          field: 'SIZE_OVERRIDE',
          value: 'TINY'
        },
        {
          ...metadata,
          id: '00000000-0000-4000-8000-000000000118',
          family: 'COMPANION',
          companionInstanceId: '00000000-0000-4000-8000-000000000114',
          field: 'ALIGNMENT_OVERRIDE',
          value: '00000000-0000-4000-8000-000000000119'
        },
        {
          ...metadata,
          id: '00000000-0000-4000-8000-000000000120',
          family: 'COMPANION',
          companionInstanceId: '00000000-0000-4000-8000-000000000114',
          field: 'CREATURE_TYPE_OVERRIDE',
          value: '00000000-0000-4000-8000-000000000121'
        }
      ]
    })
    expect(sheet.extras.items).toContainEqual(
      expect.objectContaining({
        armorClass: 16,
        size: 'TINY',
        alignmentId: '00000000-0000-4000-8000-000000000119',
        creatureTypeId: '00000000-0000-4000-8000-000000000121',
        hitPoints: expect.objectContaining({ current: 5, maximum: 5 })
      })
    )
  })
})
