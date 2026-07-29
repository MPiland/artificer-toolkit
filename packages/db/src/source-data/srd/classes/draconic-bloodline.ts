import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  CLASS_CATEGORY,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PROFICIENCY_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  SUBCLASS_ATTRIBUTE,
  VALUE_DOMAIN_CODE,
  type ClassAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SUBCLASS_IDS } from '../ids.js'
import { SRD_LANGUAGES, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'

function classRowId(classIndex: number, group: number, entry: number): string {
  const xx = classIndex.toString(16).padStart(2, '0')
  const gg = group.toString(16).padStart(2, '0')
  const nn = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-c0${xx}-${gg}${nn}00000000`
}

function languageId(code: string): string {
  const entry = SRD_LANGUAGES.find((language) => language.code === code)
  if (!entry) throw new Error(`SRD language vocabulary entry for ${code} required.`)
  return entry.id
}

const S = 10

const DRACONIC_SPECIALIZATIONS = [
  {
    id: classRowId(S, 12, 1),
    label: 'Black Dragon',
    order: 1,
    description: 'Your draconic ancestor is a Black dragon, which has an affinity with acid damage.'
  },
  {
    id: classRowId(S, 12, 2),
    label: 'Blue Dragon',
    order: 2,
    description:
      'Your draconic ancestor is a Blue dragon, which has an affinity with lightning damage.'
  },
  {
    id: classRowId(S, 12, 3),
    label: 'Brass Dragon',
    order: 3,
    description: 'Your draconic ancestor is a Brass dragon, which has an affinity with fire damage.'
  },
  {
    id: classRowId(S, 12, 4),
    label: 'Bronze Dragon',
    order: 4,
    description:
      'Your draconic ancestor is a Bronze dragon, which has an affinity with lightning damage.'
  },
  {
    id: classRowId(S, 12, 5),
    label: 'Copper Dragon',
    order: 5,
    description:
      'Your draconic ancestor is a Copper dragon, which has an affinity with acid damage.'
  },
  {
    id: classRowId(S, 12, 6),
    label: 'Gold Dragon',
    order: 6,
    description: 'Your draconic ancestor is a Gold dragon, which has an affinity with fire damage.'
  },
  {
    id: classRowId(S, 12, 7),
    label: 'Green Dragon',
    order: 7,
    description:
      'Your draconic ancestor is a Green dragon, which has an affinity with poison damage.'
  },
  {
    id: classRowId(S, 12, 8),
    label: 'Red Dragon',
    order: 8,
    description: 'Your draconic ancestor is a Red dragon, which has an affinity with fire damage.'
  },
  {
    id: classRowId(S, 12, 9),
    label: 'Silver Dragon',
    order: 9,
    description:
      'Your draconic ancestor is a Silver dragon, which has an affinity with cold damage.'
  },
  {
    id: classRowId(S, 12, 10),
    label: 'White Dragon',
    order: 10,
    description: 'Your draconic ancestor is a White dragon, which has an affinity with cold damage.'
  }
]

export const draconicBloodlineOrigin: ClassAuthored = {
  id: SUBCLASS_IDS.DRACONIC_BLOODLINE,
  label: 'Draconic Bloodline',
  category: CLASS_CATEGORY.SUBCLASS,
  parentClassId: CLASS_IDS.SORCERER,
  description:
    'Your innate magic comes from draconic magic that was mingled with your blood or that of your ancestors.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  attributes: [SUBCLASS_ATTRIBUTE.SPECIALIZATION],
  specializations: DRACONIC_SPECIALIZATIONS.map(({ id, label, order }) => ({ id, label, order })),
  features: [
    {
      id: classRowId(S, 11, 1),
      label: 'Dragon Ancestor',
      description:
        'At 1st level, you choose one type of dragon as your ancestor. The damage type associated with that ancestor is used by features you gain later. You gain the ability to speak, read, and write Draconic.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        proficiencies: [
          {
            id: classRowId(S, 11, 10),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.LANGUAGE,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            languageIds: [languageId('DRACONIC')],
            order: 0
          }
        ]
      }
    },
    {
      id: classRowId(S, 11, 2),
      label: 'Draconic Resilience',
      description:
        "As magic flows through your body, it causes physical traits of your dragon ancestors to emerge. At 1st level, your hit point maximum increases by 1 and increases by 1 again whenever you gain a level in this class. Additionally, parts of your skin are covered by a thin sheen of dragon-like scales. When you aren't wearing armor, your AC equals 13 + your Dexterity modifier.",
      availableAtLevel: 1,
      order: 1,
      grants: {
        modifiers: [
          {
            id: classRowId(S, 12, 19),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.HIT_POINTS_MAX,
            domain: {},
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'CLASS_LEVEL', classId: CLASS_IDS.SORCERER, multiplier: 1 },
            order: 0
          },
          {
            id: classRowId(S, 12, 20),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ARMOR_CLASS,
            domain: {},
            modifierKind: MODIFIER_KIND.SET_VALUE,
            scope: MODIFIER_SCOPE_KIND.SOURCE,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { amount: 13 },
            order: 1
          }
        ]
      }
    },
    {
      id: classRowId(S, 11, 3),
      label: 'Elemental Affinity',
      description:
        'Starting at 6th level, when you cast a spell that deals damage of the type associated with your draconic ancestry, you can add your Charisma modifier to one damage roll of that spell.',
      availableAtLevel: 6,
      order: 2
    },
    {
      id: classRowId(S, 11, 4),
      label: 'Dragon Wings',
      description:
        'At 14th level, you gain the ability to sprout a pair of dragon wings from your back, gaining a flying speed equal to your current speed. You can create these wings as a bonus action on your turn.',
      availableAtLevel: 14,
      order: 3
    },
    {
      id: classRowId(S, 11, 5),
      label: 'Draconic Presence',
      description:
        'Beginning at 18th level, you can channel the dread presence of your dragon ancestor, causing those around you to become awestruck or frightened.',
      availableAtLevel: 18,
      order: 4
    }
  ]
}
