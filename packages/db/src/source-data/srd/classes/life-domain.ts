import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  CLASS_CATEGORY,
  GRANT_KIND,
  PROFICIENCY_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  SCALING_SOURCE,
  SPELL_GRANT_ATTRIBUTE,
  type ClassAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS, SUBCLASS_IDS } from '../ids.js'
import { SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'

function classRowId(classIndex: number, group: number, entry: number): string {
  const xx = classIndex.toString(16).padStart(2, '0')
  const gg = group.toString(16).padStart(2, '0')
  const nn = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-c0${xx}-${gg}${nn}00000000`
}

const C = 3

const lifeDomainSpellLevels = [
  { level: 1, spellIds: [SPELL_IDS.BLESS, SPELL_IDS.CURE_WOUNDS] },
  { level: 3, spellIds: [SPELL_IDS.LESSER_RESTORATION, SPELL_IDS.SPIRITUAL_WEAPON] },
  { level: 5, spellIds: [SPELL_IDS.BEACON_OF_HOPE, SPELL_IDS.REVIVIFY] },
  { level: 7, spellIds: [SPELL_IDS.DEATH_WARD, SPELL_IDS.GUARDIAN_OF_FAITH] },
  { level: 9, spellIds: [SPELL_IDS.MASS_CURE_WOUNDS, SPELL_IDS.RAISE_DEAD] }
]

export const lifeDomainCleric: ClassAuthored = {
  id: SUBCLASS_IDS.LIFE,
  label: 'Life Domain',
  category: CLASS_CATEGORY.SUBCLASS,
  parentClassId: CLASS_IDS.CLERIC,
  description:
    'The Life domain focuses on the vibrant positive energy — one of the fundamental forces of the universe — that sustains all life.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: classRowId(C, 11, 1),
      label: 'Domain Spells',
      description:
        'You gain domain spells at the cleric levels listed. Bless, Cure Wounds (L1); Lesser Restoration, Spiritual Weapon (L3); Beacon of Hope, Revivify (L5); Death Ward, Guardian of Faith (L7); Mass Cure Wounds, Raise Dead (L9).',
      availableAtLevel: 1,
      order: 0,
      grants: {
        spells: [
          {
            id: classRowId(C, 11, 10),
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.PER_LEVEL,
            progression: {
              scalingSource: SCALING_SOURCE.PARENT_CLASS_LEVEL,
              levels: lifeDomainSpellLevels.map((spellLevel, index) => ({
                id: classRowId(C, 16, index + 1),
                level: spellLevel.level,
                order: index + 1,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: spellLevel.spellIds
              }))
            },
            attributes: [SPELL_GRANT_ATTRIBUTE.PREPARED],
            order: 0
          }
        ]
      }
    },
    {
      id: classRowId(C, 11, 2),
      label: 'Bonus Proficiency',
      description:
        'When you choose this domain at 1st level, you gain proficiency with heavy armor.',
      availableAtLevel: 1,
      order: 1,
      grants: {
        proficiencies: [
          {
            id: classRowId(C, 11, 11),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            properties: ['HEAVY'],
            category: 'ARMOR',
            order: 0
          }
        ]
      }
    },
    {
      id: classRowId(C, 11, 3),
      label: 'Disciple of Life',
      description:
        "Also starting at 1st level, your healing spells are more effective. Whenever you use a spell of 1st level or higher to restore hit points to a creature, the creature regains additional hit points equal to 2 + the spell's level.",
      availableAtLevel: 1,
      order: 2
    },
    {
      id: classRowId(C, 11, 4),
      label: 'Channel Divinity: Preserve Life',
      description:
        'Starting at 2nd level, you can use your Channel Divinity to heal the badly injured. As an action, you present your holy symbol and evoke healing energy that can restore a number of hit points equal to five times your cleric level.',
      availableAtLevel: 2,
      order: 3
    },
    {
      id: classRowId(C, 11, 5),
      label: 'Blessed Healer',
      description:
        "Beginning at 6th level, the healing spells you cast on others heal you as well. When you cast a spell of 1st level or higher that restores hit points to a creature other than you, you regain hit points equal to 2 + the spell's level.",
      availableAtLevel: 6,
      order: 4
    },
    {
      id: classRowId(C, 11, 6),
      label: 'Divine Strike',
      description:
        'At 8th level, you gain the ability to infuse your weapon strikes with divine energy. Once on each of your turns when you hit a creature with a weapon attack, you can cause the attack to deal an extra 1d8 radiant damage to the target.',
      availableAtLevel: 8,
      order: 5
    },
    {
      id: classRowId(C, 11, 7),
      label: 'Supreme Healing',
      description:
        'Starting at 17th level, when you would normally roll one or more dice to restore hit points with a spell, you instead use the highest number possible for each die.',
      availableAtLevel: 17,
      order: 6
    }
  ]
}
