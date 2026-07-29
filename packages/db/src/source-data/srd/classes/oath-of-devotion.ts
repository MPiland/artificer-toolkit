import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  CLASS_CATEGORY,
  GRANT_KIND,
  SCALING,
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

const P = 7

const devotionOathSpellLevels = [
  { level: 3, spellIds: [SPELL_IDS.PROTECTION_FROM_EVIL_AND_GOOD, SPELL_IDS.SANCTUARY] },
  { level: 5, spellIds: [SPELL_IDS.LESSER_RESTORATION, SPELL_IDS.ZONE_OF_TRUTH] },
  { level: 9, spellIds: [SPELL_IDS.BEACON_OF_HOPE, SPELL_IDS.DISPEL_MAGIC] },
  { level: 13, spellIds: [SPELL_IDS.FREEDOM_OF_MOVEMENT, SPELL_IDS.GUARDIAN_OF_FAITH] },
  { level: 17, spellIds: [SPELL_IDS.COMMUNE, SPELL_IDS.FLAME_STRIKE] }
]

export const oathOfDevotion: ClassAuthored = {
  id: SUBCLASS_IDS.DEVOTION,
  label: 'Oath of Devotion',
  category: CLASS_CATEGORY.SUBCLASS,
  parentClassId: CLASS_IDS.PALADIN,
  description:
    'The Oath of Devotion binds a paladin to the loftiest ideals of justice, virtue, and order.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: classRowId(P, 11, 1),
      label: 'Oath Spells',
      description:
        'You gain oath spells at the paladin levels listed. Protection from Evil and Good, Sanctuary (L3); Lesser Restoration, Zone of Truth (L5); Beacon of Hope, Dispel Magic (L9); Freedom of Movement, Guardian of Faith (L13); Commune, Flame Strike (L17).',
      availableAtLevel: 3,
      order: 0,
      grants: {
        spells: [
          {
            id: classRowId(P, 11, 10),
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.PER_LEVEL,
            progression: {
              scalingSource: SCALING_SOURCE.PARENT_CLASS_LEVEL,
              levels: devotionOathSpellLevels.map((spellLevel, index) => ({
                id: classRowId(P, 16, index + 1),
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
      id: classRowId(P, 11, 2),
      label: 'Channel Divinity: Sacred Weapon',
      description:
        'As an action, you can imbue one weapon that you are holding with positive energy, using your Channel Divinity. For 1 minute, you add your Charisma modifier to attack rolls made with that weapon.',
      availableAtLevel: 3,
      order: 1
    },
    {
      id: classRowId(P, 11, 3),
      label: 'Channel Divinity: Turn the Unholy',
      description:
        'As an action, you present your holy symbol and speak a prayer censuring fiends and undead, using your Channel Divinity. Each fiend or undead that can see or hear you within 30 feet of you must make a Wisdom saving throw.',
      availableAtLevel: 3,
      order: 2
    },
    {
      id: classRowId(P, 11, 4),
      label: 'Aura of Devotion',
      description:
        "Starting at 7th level, you and friendly creatures within 10 feet of you can't be charmed while you are conscious.",
      availableAtLevel: 7,
      order: 3
    },
    {
      id: classRowId(P, 11, 5),
      label: 'Purity of Spirit',
      description:
        'Beginning at 15th level, you are always under the effects of a Protection from Evil and Good spell.',
      availableAtLevel: 15,
      order: 4
    },
    {
      id: classRowId(P, 11, 6),
      label: 'Holy Nimbus',
      description:
        'At 20th level, as an action, you can emanate an aura of sunlight. For 1 minute, bright light shines from you in a 30-foot radius, and dim light shines 30 feet beyond that.',
      availableAtLevel: 20,
      order: 5
    }
  ]
}
