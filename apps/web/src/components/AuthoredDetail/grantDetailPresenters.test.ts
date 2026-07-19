import { describe, expect, it } from 'vitest'
import type { ProficiencyGrantDto } from '@artificer-toolkit/schema/grants/proficiency'
import type { StartingEquipmentDto } from '@artificer-toolkit/schema/shared/startingEquipment'
import {
  formatGrantDetailLinesHtml,
  formatProficiencyGrantLines,
  formatStartingEquipmentLine,
  type GrantReferenceData
} from './grantDetailPresenters'

const references: GrantReferenceData = {
  currencies: [{ value: 'gp', label: 'Gold Piece' }],
  equipment: [
    { value: 'holy-symbol', label: 'Holy Symbol' },
    { value: 'prayer-book', label: 'Prayer Book' },
    { value: 'prayer-wheel', label: 'Prayer Wheel' },
    { value: 'pouch', label: 'Pouch' }
  ],
  languages: [
    { value: 'common', label: 'Common' },
    { value: 'elvish', label: 'Elvish' }
  ],
  skills: [
    { value: 'insight', label: 'Insight' },
    { value: 'religion', label: 'Religion' },
    { value: 'stealth', label: 'Stealth' },
    { value: 'arcana', label: 'Arcana' }
  ]
}

describe('grant detail presenters', () => {
  it('formats granted and chosen background proficiencies as labeled prose lines', () => {
    const grants = [
      {
        id: 'skills',
        grantKind: 'PROFICIENCY_GRANT',
        scalingKind: 'NONE',
        proficiencyKind: 'SKILL',
        selectionKind: 'GRANTED',
        level: 'FULL',
        authoringModeKind: 'SELECTED',
        skillIds: ['insight', 'religion'],
        order: 0
      },
      {
        id: 'languages',
        grantKind: 'PROFICIENCY_GRANT',
        scalingKind: 'NONE',
        proficiencyKind: 'LANGUAGE',
        selectionKind: 'CHOSEN',
        level: 'FULL',
        count: 2,
        authoringModeKind: 'SELECTED',
        languageIds: ['common', 'elvish'],
        order: 1
      }
    ] satisfies ProficiencyGrantDto[]

    const lines = formatProficiencyGrantLines(grants, references, { skillLabel: 'Skill Proficiencies' })

    expect(lines).toEqual([
      { id: 'skills', label: 'Skill Proficiencies', description: 'Insight, Religion' },
      { id: 'languages', label: 'Languages', description: 'Choose any 2 languages.' }
    ])
    expect(formatGrantDetailLinesHtml(lines)).toContain('<strong>Languages:</strong> Choose any 2 languages.')
  })

  it('groups class armor, weapon, save, and skill proficiencies', () => {
    const grants = [
      {
        id: 'armor',
        grantKind: 'PROFICIENCY_GRANT',
        scalingKind: 'NONE',
        proficiencyKind: 'EQUIPMENT_PROPERTY',
        selectionKind: 'GRANTED',
        level: 'FULL',
        authoringModeKind: 'SELECTED',
        properties: ['LIGHT'],
        category: 'ARMOR',
        order: 0
      },
      {
        id: 'shield',
        grantKind: 'PROFICIENCY_GRANT',
        scalingKind: 'NONE',
        proficiencyKind: 'EQUIPMENT',
        selectionKind: 'GRANTED',
        level: 'FULL',
        authoringModeKind: 'ALL',
        category: 'SHIELD',
        order: 1
      },
      {
        id: 'weapons',
        grantKind: 'PROFICIENCY_GRANT',
        scalingKind: 'NONE',
        proficiencyKind: 'EQUIPMENT_PROPERTY',
        selectionKind: 'GRANTED',
        level: 'FULL',
        authoringModeKind: 'SELECTED',
        properties: ['SIMPLE', 'MARTIAL'],
        category: 'WEAPON',
        order: 2
      },
      {
        id: 'saves',
        grantKind: 'PROFICIENCY_GRANT',
        scalingKind: 'NONE',
        proficiencyKind: 'SAVE_ABILITY',
        selectionKind: 'GRANTED',
        level: 'FULL',
        authoringModeKind: 'SELECTED',
        abilities: ['STRENGTH', 'CONSTITUTION'],
        order: 3
      },
      {
        id: 'skills',
        grantKind: 'PROFICIENCY_GRANT',
        scalingKind: 'NONE',
        proficiencyKind: 'SKILL',
        selectionKind: 'CHOSEN',
        level: 'FULL',
        count: 2,
        authoringModeKind: 'SELECTED',
        skillIds: ['insight', 'religion', 'stealth'],
        order: 4
      }
    ] satisfies ProficiencyGrantDto[]

    expect(formatProficiencyGrantLines(grants, references)).toEqual([
      { id: 'armor', label: 'Armor', description: 'Light armor, shields' },
      { id: 'weapons', label: 'Weapons', description: 'Simple weapons, martial weapons' },
      { id: 'saves', label: 'Saving Throws', description: 'Strength, Constitution' },
      { id: 'skills', label: 'Skills', description: 'Choose 2 from Insight, Religion, or Stealth.' }
    ])
  })

  it('formats starting equipment as a single equipment prose line', () => {
    const startingEquipment = {
      id: 'equipment',
      sets: [
        {
          id: 'set',
          order: 0,
          groups: [
            {
              id: 'group',
              order: 0,
              options: [
                {
                  id: 'option',
                  order: 0,
                  items: [
                    {
                      id: 'holy-symbol-item',
                      order: 0,
                      startingEquipmentKind: 'EQUIPMENT',
                      selectionKind: 'GRANTED',
                      authoringModeKind: 'SELECTED',
                      equipmentIds: ['holy-symbol'],
                      quantity: 1
                    },
                    {
                      id: 'prayer-item',
                      order: 1,
                      startingEquipmentKind: 'EQUIPMENT',
                      selectionKind: 'CHOSEN',
                      authoringModeKind: 'SELECTED',
                      equipmentIds: ['prayer-book', 'prayer-wheel'],
                      count: 1
                    },
                    {
                      id: 'pouch',
                      order: 2,
                      startingEquipmentKind: 'EQUIPMENT',
                      selectionKind: 'GRANTED',
                      authoringModeKind: 'SELECTED',
                      equipmentIds: ['pouch'],
                      quantity: 1
                    },
                    {
                      id: 'gold',
                      order: 3,
                      startingEquipmentKind: 'CURRENCY',
                      currencies: [{ currencyId: 'gp', amount: 15 }]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    } satisfies StartingEquipmentDto

    expect(formatStartingEquipmentLine(startingEquipment, references)).toEqual({
      id: 'equipment',
      label: 'Equipment',
      description: 'A holy symbol, choose either a prayer book or prayer wheel, and a pouch containing 15 gp.'
    })
  })
})
