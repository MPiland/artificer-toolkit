import { describe, expect, it } from 'vitest'

import {
  CHARACTER_GRANT_FOLD_MODEL_KEY,
  characterGrantFoldInputSchema,
  characterGrantFoldOutputSchema,
  type CharacterGrantFoldOutput
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { RulePackDocumentDto } from '@artificer-toolkit/schema/api/rules'
import type {
  CharacterAssemblyRegistry,
  CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'

import { compileCharacterGrantFoldRuleFacts } from '../../../../character/characterGrantFoldRuleFacts.js'
import { dnd5e2014CharacterGrantFoldModel } from './characterGrantFoldSource.js'
import { evaluateZenRuleModel } from '../../../zenRuleEngine.js'

const document: RulePackDocumentDto = {
  schemaVersion: 1,
  models: { [CHARACTER_GRANT_FOLD_MODEL_KEY]: dnd5e2014CharacterGrantFoldModel },
  fixtures: []
}

function snapshot(overrides: Partial<CharacterBuildSnapshot> = {}): CharacterBuildSnapshot {
  return {
    characterId: 'character-1',
    systemId: 'dnd5e2014',
    totalLevel: 1,
    classes: [],
    abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    hitpoints: [],
    features: [],
    equipmentItems: [],
    ...overrides
  }
}

function registry(overrides: Partial<CharacterAssemblyRegistry> = {}): CharacterAssemblyRegistry {
  return {
    classes: {},
    equipment: {},
    feats: {},
    races: {},
    spells: {},
    features: {},
    ...overrides
  }
}

function modifier(id: string, restrictions?: unknown) {
  return {
    id,
    grantKind: 'MODIFIER_GRANT',
    order: 1,
    selectionKind: 'GRANTED',
    valueDomainCode: 'INITIATIVE',
    domain: {},
    modifierKind: 'BONUS',
    scope: 'GLOBAL',
    payload: { valueKind: 'FIXED', amount: 1 },
    ...(restrictions ? { restrictions } : {})
  }
}

function restriction(
  id: string,
  predicateCode: string,
  fields: Record<string, unknown> = {},
  constraint: 'INCLUDE' | 'EXCLUDE' = 'INCLUDE'
) {
  return {
    id: `${id}-facet`,
    groups: [
      {
        id: `${id}-group`,
        order: 1,
        contexts: [
          {
            id: `${id}-context`,
            order: 1,
            subject: 'CHARACTER',
            conditions: [
              {
                id: `${id}-condition`,
                order: 1,
                kind: 'PREDICATE',
                constraint,
                predicateCode,
                ...fields
              }
            ]
          }
        ]
      }
    ]
  }
}

function existsRestriction(id: string, constraint: 'INCLUDE' | 'EXCLUDE') {
  return {
    id: `${id}-facet`,
    groups: [
      {
        id: `${id}-group`,
        order: 1,
        contexts: [
          {
            id: `${id}-context`,
            order: 1,
            subject: 'CHARACTER',
            conditions: [
              {
                id: `${id}-condition`,
                order: 1,
                kind: 'EXISTS',
                constraint,
                relationCode: 'UNSUPPORTED_RELATION'
              }
            ]
          }
        ]
      }
    ]
  }
}

function modifierGrantId(value: CharacterGrantFoldOutput['modifiers'][number]['grant']): string {
  if (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof value.id === 'string'
  ) {
    return value.id
  }
  throw new Error('Expected a normalized modifier grant ID.')
}

async function evaluateFold(
  character: CharacterBuildSnapshot,
  records: CharacterAssemblyRegistry,
  upstreamSpellIds: string[] = []
) {
  const facts = characterGrantFoldInputSchema.parse({
    ...compileCharacterGrantFoldRuleFacts({
      snapshot: character,
      registry: records
    }),
    upstreamSpellIds
  })
  const evaluated = await evaluateZenRuleModel({
    document,
    modelKey: CHARACTER_GRANT_FOLD_MODEL_KEY,
    context: facts
  })
  const actual = characterGrantFoldOutputSchema.parse(evaluated.result)
  return actual
}

describe('D&D 5e 2014 Character grant fold', () => {
  it('preserves authored proficiency IDs while emitting canonical match identities', async () => {
    const records = registry({
      system: {
        skills: [{ id: 'skill-perception', code: 'perception', label: 'Perception' }]
      },
      features: {
        'alias-feature': {
          id: 'alias-feature',
          proficiencies: [
            {
              id: 'perception-grant',
              grantKind: 'PROFICIENCY_GRANT',
              order: 1,
              selectionKind: 'GRANTED',
              authoringModeKind: 'SELECTED',
              proficiencyKind: 'SKILL',
              skillIds: ['skill-perception'],
              level: 'FULL'
            },
            {
              id: 'wisdom-save-grant',
              grantKind: 'PROFICIENCY_GRANT',
              order: 2,
              selectionKind: 'GRANTED',
              authoringModeKind: 'SELECTED',
              proficiencyKind: 'SAVE_ABILITY',
              abilities: ['WIS'],
              level: 'FULL'
            }
          ],
          modifiers: [
            modifier(
              'canonical-perception-restriction',
              restriction('canonical-perception-restriction', 'SKILL_PROFICIENCY', {
                authoringModeKind: 'SELECTED',
                skillIds: ['perception'],
                level: 'FULL'
              })
            ),
            modifier(
              'canonical-wisdom-restriction',
              restriction('canonical-wisdom-restriction', 'SAVE_ABILITY_PROFICIENCY', {
                authoringModeKind: 'SELECTED',
                abilities: 'WISDOM',
                level: 'FULL'
              })
            )
          ]
        }
      }
    } as unknown as Partial<CharacterAssemblyRegistry>)
    const character = snapshot({
      features: [
        {
          featureId: 'alias-feature',
          source: { kind: 'FEATURE', featureId: 'alias-feature' },
          timing: { kind: 'IMMEDIATE' }
        }
      ]
    })
    const facts = compileCharacterGrantFoldRuleFacts({
      snapshot: character,
      registry: records
    })

    expect(facts.features[0]?.definition?.proficiencies).toMatchObject([
      { targetIds: ['skill-perception'], matchIds: ['perception'] },
      { targetIds: ['WIS'], matchIds: ['WISDOM'] }
    ])
    expect(
      facts.features[0]?.definition?.modifiers.map(
        (entry) => entry.restrictions[0]?.conditions[0]?.requiredIds
      )
    ).toEqual([['perception'], ['WISDOM']])

    const evaluated = await evaluateZenRuleModel({
      document,
      modelKey: CHARACTER_GRANT_FOLD_MODEL_KEY,
      context: facts
    })
    const output = characterGrantFoldOutputSchema.parse(evaluated.result)
    expect(output.proficiencies).toMatchObject([
      { subjectId: 'skill-perception', matchId: 'perception' },
      { subjectId: 'WIS', matchId: 'WISDOM' }
    ])
    expect(output.modifiers.map(({ grant }) => modifierGrantId(grant))).toEqual([
      'canonical-perception-restriction',
      'canonical-wisdom-restriction'
    ])
  })

  it('emits each eligible source identity once, including sources without grants', async () => {
    const records = registry({
      features: {
        'active-source': { id: 'active-source' },
        'inactive-source': {
          id: 'inactive-source',
          restrictions: restriction('inactive-source', 'CHARACTER_LEVEL', { min: 2 })
        }
      }
    } as unknown as Partial<CharacterAssemblyRegistry>)
    const character = snapshot({
      features: [
        {
          featureId: 'active-source',
          source: { kind: 'FEATURE', featureId: 'active-source' },
          timing: { kind: 'IMMEDIATE' }
        },
        {
          featureId: 'inactive-source',
          source: { kind: 'FEATURE', featureId: 'inactive-source' },
          timing: { kind: 'IMMEDIATE' }
        }
      ]
    })
    const facts = compileCharacterGrantFoldRuleFacts({ snapshot: character, registry: records })
    const activeSource = facts.features[0]?.definition
    if (activeSource == null) throw new Error('Expected active source facts.')
    const evaluated = await evaluateZenRuleModel({
      document,
      modelKey: CHARACTER_GRANT_FOLD_MODEL_KEY,
      context: {
        ...facts,
        background: activeSource
      }
    })
    const output = characterGrantFoldOutputSchema.parse(evaluated.result)

    expect(output.activeSourceIds).toEqual([activeSource.sourceId])
  })

  it('matches ordered class, subclass, multiclass, choice, progression, and stateful grants', async () => {
    const sharedSkillGrant = {
      id: 'shared-skill',
      grantKind: 'PROFICIENCY_GRANT',
      order: 1,
      selectionKind: 'CHOSEN',
      selectionDuplicatePolicy: 'UNIQUE',
      count: 1,
      authoringModeKind: 'SELECTED',
      proficiencyKind: 'SKILL',
      skillIds: ['arcana', 'history'],
      level: 'FULL'
    }
    const raceFeature = {
      id: 'race-feature',
      proficiencies: [sharedSkillGrant],
      senses: [
        {
          id: 'race-senses',
          grantKind: 'SENSE_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'PER_LEVEL',
          levels: [
            { level: 1, senseIds: ['00000000-0000-4000-8000-000000000091'] },
            { level: 5, senseIds: ['00000000-0000-4000-8000-000000000092'] }
          ]
        }
      ],
      modifiers: [
        modifier(
          'same-source-proficiency',
          restriction('same-source-proficiency', 'SKILL_PROFICIENCY', {
            authoringModeKind: 'SELECTED',
            skillIds: ['arcana'],
            level: 'FULL'
          })
        ),
        modifier(
          'same-source-feat-too-early',
          restriction('same-source-feat-too-early', 'FEAT_OBTAINED', {
            featIds: ['race-feat']
          })
        ),
        modifier(
          'same-source-spell-too-early',
          restriction('same-source-spell-too-early', 'SPELL_OBTAINED', {
            spellIds: ['race-spell-5']
          })
        ),
        modifier(
          'skill-score-without-engine-output',
          restriction('skill-score-without-engine-output', 'SKILL_SCORE', {
            authoringModeKind: 'SELECTED',
            skillIds: ['arcana'],
            min: 1
          })
        ),
        modifier(
          'excluded-skill-score-without-engine-output',
          restriction(
            'excluded-skill-score-without-engine-output',
            'SKILL_SCORE',
            { authoringModeKind: 'SELECTED', skillIds: ['arcana'], min: 1 },
            'EXCLUDE'
          )
        ),
        modifier(
          'saving-throw-without-engine-output',
          restriction('saving-throw-without-engine-output', 'SAVING_THROW_ABILITY_BONUS', {
            authoringModeKind: 'SELECTED',
            abilities: 'DEXTERITY',
            min: 1
          })
        ),
        modifier(
          'excluded-saving-throw-without-engine-output',
          restriction(
            'excluded-saving-throw-without-engine-output',
            'SAVING_THROW_ABILITY_BONUS',
            { authoringModeKind: 'SELECTED', abilities: 'DEXTERITY', min: 1 },
            'EXCLUDE'
          )
        ),
        modifier(
          'all-ability-score-include',
          restriction('all-ability-score-include', 'ABILITY_SCORE', {
            authoringModeKind: 'ALL',
            min: 1
          })
        ),
        modifier(
          'all-ability-score-exclude',
          restriction(
            'all-ability-score-exclude',
            'ABILITY_SCORE',
            { authoringModeKind: 'ALL', min: 1 },
            'EXCLUDE'
          )
        ),
        modifier('unsupported-exists-include', existsRestriction('exists-include', 'INCLUDE')),
        modifier('unsupported-exists-exclude', existsRestriction('exists-exclude', 'EXCLUDE'))
      ],
      feats: [
        {
          id: 'race-feat-grant',
          grantKind: 'FEAT_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          featIds: ['race-feat']
        }
      ],
      spells: [
        {
          id: 'race-spell-grant',
          grantKind: 'SPELL_GRANT',
          order: 1,
          selectionKind: 'CHOSEN',
          scalingKind: 'PER_LEVEL',
          levels: [
            { level: 1, spellIds: ['race-spell-1'] },
            { level: 5, spellIds: ['race-spell-5'] }
          ]
        }
      ]
    }
    const laterFeature = {
      id: 'later-feature',
      proficiencies: [sharedSkillGrant],
      modifiers: [
        modifier(
          'later-feat-dependent',
          restriction('later-feat-dependent', 'FEAT_OBTAINED', { featIds: ['race-feat'] })
        ),
        modifier(
          'later-spell-dependent',
          restriction('later-spell-dependent', 'SPELL_OBTAINED', {
            spellIds: ['race-spell-5']
          })
        ),
        modifier(
          'baseline-spell-dependent',
          restriction('baseline-spell-dependent', 'SPELL_OBTAINED', {
            spellIds: ['baseline-spell']
          })
        )
      ],
      options: [{ id: 'later-option', modifiers: [modifier('selected-option')] }]
    }
    const fighter = {
      id: 'fighter',
      category: 'BASE',
      proficiencies: [
        {
          id: 'fighter-starting-skill',
          grantKind: 'PROFICIENCY_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          authoringModeKind: 'SELECTED',
          proficiencyKind: 'SKILL',
          skillIds: ['athletics'],
          level: 'FULL'
        }
      ],
      startingGold: { multiplier: 1, currencyId: 'gp', dieConfig: '1d4' },
      startingEquipment: { id: 'fighter-equipment', sets: [] },
      hitpoint: { ability: 'CONSTITUTION', dieConfig: '1d10' },
      multiclass: {
        id: 'fighter-multiclass',
        requirementGroups: { id: 'fighter-requirements', groups: [] },
        proficiencies: []
      }
    }
    const rogue = {
      id: 'rogue',
      category: 'BASE',
      proficiencies: [
        {
          id: 'rogue-starting-skill',
          grantKind: 'PROFICIENCY_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          authoringModeKind: 'SELECTED',
          proficiencyKind: 'SKILL',
          skillIds: ['stealth'],
          level: 'FULL'
        }
      ],
      startingGold: { multiplier: 1, currencyId: 'gp', dieConfig: '1d4' },
      startingEquipment: { id: 'rogue-equipment', sets: [] },
      hitpoint: { ability: 'CONSTITUTION', dieConfig: '1d8' },
      multiclass: {
        id: 'rogue-multiclass',
        requirementGroups: { id: 'rogue-requirements', groups: [] },
        proficiencies: [
          {
            id: 'rogue-multiclass-tool',
            grantKind: 'PROFICIENCY_GRANT',
            order: 1,
            selectionKind: 'GRANTED',
            authoringModeKind: 'SELECTED',
            proficiencyKind: 'EQUIPMENT',
            equipmentIds: ['thieves-tools'],
            level: 'FULL'
          }
        ]
      }
    }
    const champion = {
      id: 'champion',
      category: 'SUBCLASS',
      parentClassId: 'fighter',
      modifiers: [modifier('champion-modifier')]
    }
    const records = registry({
      backgrounds: {
        sage: { id: 'sage', modifiers: [modifier('background-modifier')] }
      },
      classes: { fighter, rogue, champion },
      features: { 'race-feature': raceFeature, 'later-feature': laterFeature }
    } as unknown as Partial<CharacterAssemblyRegistry>)
    const character = snapshot({
      totalLevel: 5,
      backgroundId: 'sage',
      classes: [
        { classId: 'fighter', level: 3, subclassId: 'champion' },
        { classId: 'rogue', level: 2, subclassId: 'champion' }
      ],
      features: [
        {
          featureId: 'race-feature',
          source: { kind: 'RACE', raceId: 'elf' },
          timing: { kind: 'CHARACTER_LEVEL', level: 5 }
        },
        {
          featureId: 'later-feature',
          acquisitionId: 'later-acquisition',
          source: { kind: 'FEATURE', featureId: 'later-feature' },
          timing: { kind: 'IMMEDIATE' },
          selections: [{ selectionKey: 'options', values: [{ kind: 'ID', id: 'later-option' }] }]
        }
      ],
      chosenGrantSelections: [
        {
          id: 'race-skill-choice',
          grantId: 'shared-skill',
          source: { kind: 'RACE', raceId: 'elf' },
          timing: { kind: 'IMMEDIATE' },
          targetIds: ['arcana', 'arcana']
        },
        {
          id: 'feature-skill-choice',
          grantId: 'shared-skill',
          source: { kind: 'FEATURE', featureId: 'later-feature' },
          timing: { kind: 'IMMEDIATE' },
          targetIds: ['medicine']
        },
        {
          id: 'race-spell-level-1',
          grantId: 'race-spell-grant',
          source: { kind: 'RACE', raceId: 'elf' },
          timing: { kind: 'CHARACTER_LEVEL', level: 1 },
          progressionLevel: 1,
          targetIds: ['race-spell-1']
        },
        {
          id: 'race-spell-level-5',
          grantId: 'race-spell-grant',
          source: { kind: 'RACE', raceId: 'elf' },
          timing: { kind: 'CHARACTER_LEVEL', level: 5 },
          progressionLevel: 5,
          targetIds: ['race-spell-5']
        }
      ]
    })

    const actual = await evaluateFold(character, records, ['baseline-spell'])
    expect(actual.proficiencies.map((entry) => entry.grantId)).toEqual([
      'shared-skill',
      'shared-skill',
      'fighter-starting-skill',
      'rogue-multiclass-tool',
      'shared-skill'
    ])
    expect(actual.proficiencies.map((entry) => entry.subjectId)).toEqual([
      'arcana',
      'arcana',
      'athletics',
      'thieves-tools',
      'medicine'
    ])
    expect(actual.modifiers.map((entry) => modifierGrantId(entry.grant))).toEqual([
      'same-source-proficiency',
      'excluded-skill-score-without-engine-output',
      'excluded-saving-throw-without-engine-output',
      'all-ability-score-exclude',
      'background-modifier',
      'champion-modifier',
      'later-feat-dependent',
      'later-spell-dependent',
      'baseline-spell-dependent',
      'selected-option'
    ])
    expect(actual.unlockedSpellIds).toEqual(['race-spell-1', 'race-spell-5'])
    expect(
      actual.modifiers.filter((entry) => modifierGrantId(entry.grant) === 'champion-modifier')
    ).toHaveLength(1)
  })

  it('matches item eligibility, source state, attunement, provenance, and source charges', async () => {
    const sourceChargeFeature = {
      id: 'wand-burst',
      order: 1,
      restrictions: restriction('equipped-wand-feature', 'WHILE_SOURCE_EQUIPPED'),
      modifiers: [modifier('equipped-wand-modifier')],
      charges: {
        id: 'wand-burst-use',
        limitKind: 'SOURCE_CHARGES',
        scalingKind: 'NONE',
        cost: 2
      }
    }
    const inactiveFeature = {
      id: 'wand-inactive',
      order: 2,
      restrictions: restriction('wand-inactive', 'CHARACTER_LEVEL', { min: 3 })
    }
    const compiledItem = {
      id: 'wand',
      category: 'ADVENTURING_GEAR',
      properties: [],
      rarityId: 'uncommon',
      requiresAttunement: true,
      charges: {
        id: 'wand-charges',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        resetKind: 'DAWN',
        amount: 7
      },
      features: [sourceChargeFeature, inactiveFeature]
    }
    const item = (
      instanceId: string,
      state: { equipped: boolean; attuned: boolean }
    ): CharacterBuildSnapshot['equipmentItems'][number] => ({
      instanceId,
      contentRef: {
        definitionId: 'wand',
        binding: { kind: 'ACTIVE' },
        systemId: 'dnd5e2014'
      },
      ...(state.equipped ? { equippedState: { slot: 'GENERIC' as const } } : {}),
      attuned: state.attuned,
      compiledItem:
        compiledItem as unknown as CharacterBuildSnapshot['equipmentItems'][number]['compiledItem']
    })
    const character = snapshot({
      totalLevel: 2,
      equipmentItems: [
        item('wand-equipped', { equipped: true, attuned: true }),
        item('wand-carried', { equipped: false, attuned: true }),
        item('wand-unattuned', { equipped: true, attuned: false })
      ]
    })
    const facts = compileCharacterGrantFoldRuleFacts({ snapshot: character, registry: registry() })

    const actual = await evaluateFold(character, registry())
    expect(actual.activeEquipmentInstanceIds).toEqual(['wand-equipped', 'wand-carried'])
    expect(actual.modifiers.map((entry) => entry.source)).toEqual([
      {
        kind: 'EQUIPMENT_INSTANCE',
        equipmentId: 'wand',
        itemInstanceId: 'wand-equipped'
      }
    ])
    expect(actual.equipmentFeatureChargeUses.map((entry) => entry.itemInstanceId)).toEqual([
      'wand-equipped'
    ])
    expect(facts.equipmentItems[0]?.features.map((feature) => feature.source.sourceId)).toEqual([
      `${facts.equipmentItems[0]?.rootSourceId}:FEATURE:wand-burst`,
      `${facts.equipmentItems[0]?.rootSourceId}:FEATURE:wand-inactive`
    ])
    expect(actual.activeSourceIds).toEqual([facts.equipmentItems[0]?.features[0]?.source.sourceId])
  })

  it('uses summed class levels for immediate per-level feature grants', async () => {
    const character = snapshot({
      totalLevel: 20,
      classes: [
        { classId: 'fighter', level: 3 },
        { classId: 'rogue', level: 2 }
      ],
      features: [
        {
          featureId: 'immediate-scaling-feature',
          source: { kind: 'FEATURE', featureId: 'immediate-scaling-feature' },
          timing: { kind: 'IMMEDIATE' }
        }
      ]
    })
    const records = registry({
      features: {
        'immediate-scaling-feature': {
          id: 'immediate-scaling-feature',
          feats: [
            {
              id: 'immediate-scaling-feats',
              grantKind: 'FEAT_GRANT',
              order: 1,
              selectionKind: 'GRANTED',
              scalingKind: 'PER_LEVEL',
              levels: [
                { level: 1, featIds: ['class-sum-tier'] },
                { level: 6, featIds: ['total-level-tier'] }
              ]
            }
          ]
        }
      }
    } as unknown as Partial<CharacterAssemblyRegistry>)

    const actual = await evaluateFold(character, records)
    expect(actual.unlockedFeatIds).toEqual(['class-sum-tier'])
  })
})
