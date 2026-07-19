import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_DUPLICATE_POLICY,
  AUTHORING_SELECTION_KIND,
  CLASS_CATEGORY,
  GRANT_KIND,
  SCALING,
  SCALING_SOURCE,
  SPELL_GRANT_ATTRIBUTE,
  SUBCLASS_ATTRIBUTE,
  type ClassAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS, SUBCLASS_IDS } from '../ids.js'
import { SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
import { srdSpells } from '../spells/index.js'

function classRowId(classIndex: number, group: number, entry: number): string {
  const xx = classIndex.toString(16).padStart(2, '0')
  const gg = group.toString(16).padStart(2, '0')
  const nn = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-c0${xx}-${gg}${nn}00000000`
}

const D = 4

const druidCantripIds = srdSpells
  .filter((spell) => spell.level === 0 && spell.classIds.includes(CLASS_IDS.DRUID))
  .map((spell) => spell.id)

type LandSpellLevel = {
  availableAtLevel: number
  spellIds: string[]
}

type LandSpecializationData = {
  id: string
  label: string
  order: number
  spellLevels: LandSpellLevel[]
}

const LAND_SPECIALIZATIONS: LandSpecializationData[] = [
  {
    id: classRowId(D, 4, 1),
    label: 'Arctic',
    order: 1,
    spellLevels: [
      { availableAtLevel: 3, spellIds: [SPELL_IDS.HOLD_PERSON, SPELL_IDS.SPIKE_GROWTH] },
      { availableAtLevel: 5, spellIds: [SPELL_IDS.SLEET_STORM, SPELL_IDS.SLOW] },
      { availableAtLevel: 7, spellIds: [SPELL_IDS.FREEDOM_OF_MOVEMENT, SPELL_IDS.ICE_STORM] },
      { availableAtLevel: 9, spellIds: [SPELL_IDS.COMMUNE_WITH_NATURE, SPELL_IDS.CONE_OF_COLD] }
    ]
  },
  {
    id: classRowId(D, 4, 2),
    label: 'Coast',
    order: 2,
    spellLevels: [
      { availableAtLevel: 3, spellIds: [SPELL_IDS.MIRROR_IMAGE, SPELL_IDS.MISTY_STEP] },
      { availableAtLevel: 5, spellIds: [SPELL_IDS.WATER_BREATHING, SPELL_IDS.WATER_WALK] },
      { availableAtLevel: 7, spellIds: [SPELL_IDS.CONTROL_WATER, SPELL_IDS.FREEDOM_OF_MOVEMENT] },
      { availableAtLevel: 9, spellIds: [SPELL_IDS.CONJURE_ELEMENTAL, SPELL_IDS.SCRYING] }
    ]
  },
  {
    id: classRowId(D, 4, 3),
    label: 'Desert',
    order: 3,
    spellLevels: [
      { availableAtLevel: 3, spellIds: [SPELL_IDS.BLUR, SPELL_IDS.SILENCE] },
      { availableAtLevel: 5, spellIds: [SPELL_IDS.CREATE_FOOD_AND_WATER, SPELL_IDS.PROTECTION_FROM_ENERGY] },
      { availableAtLevel: 7, spellIds: [SPELL_IDS.BLIGHT, SPELL_IDS.HALLUCINATORY_TERRAIN] },
      { availableAtLevel: 9, spellIds: [SPELL_IDS.INSECT_PLAGUE, SPELL_IDS.WALL_OF_STONE] }
    ]
  },
  {
    id: classRowId(D, 4, 4),
    label: 'Forest',
    order: 4,
    spellLevels: [
      { availableAtLevel: 3, spellIds: [SPELL_IDS.SPIDER_CLIMB] },
      { availableAtLevel: 5, spellIds: [SPELL_IDS.CALL_LIGHTNING, SPELL_IDS.PLANT_GROWTH] },
      { availableAtLevel: 7, spellIds: [SPELL_IDS.LOCATE_CREATURE, SPELL_IDS.STONESKIN] },
      { availableAtLevel: 9, spellIds: [SPELL_IDS.COMMUNE_WITH_NATURE] }
    ]
  },
  {
    id: classRowId(D, 4, 5),
    label: 'Grassland',
    order: 5,
    spellLevels: [
      { availableAtLevel: 3, spellIds: [SPELL_IDS.INVISIBILITY, SPELL_IDS.PASS_WITHOUT_TRACE] },
      { availableAtLevel: 5, spellIds: [SPELL_IDS.DAYLIGHT, SPELL_IDS.HASTE] },
      { availableAtLevel: 7, spellIds: [SPELL_IDS.DIVINATION, SPELL_IDS.FREEDOM_OF_MOVEMENT] },
      { availableAtLevel: 9, spellIds: [SPELL_IDS.DREAM, SPELL_IDS.INSECT_PLAGUE] }
    ]
  },
  {
    id: classRowId(D, 4, 6),
    label: 'Mountain',
    order: 6,
    spellLevels: [
      { availableAtLevel: 3, spellIds: [SPELL_IDS.SPIDER_CLIMB, SPELL_IDS.SPIKE_GROWTH] },
      { availableAtLevel: 5, spellIds: [SPELL_IDS.LIGHTNING_BOLT, SPELL_IDS.MELD_INTO_STONE] },
      { availableAtLevel: 7, spellIds: [SPELL_IDS.STONE_SHAPE, SPELL_IDS.STONESKIN] },
      { availableAtLevel: 9, spellIds: [SPELL_IDS.PASSWALL, SPELL_IDS.WALL_OF_STONE] }
    ]
  },
  {
    id: classRowId(D, 4, 7),
    label: 'Swamp',
    order: 7,
    spellLevels: [
      { availableAtLevel: 3, spellIds: [SPELL_IDS.DARKNESS] },
      { availableAtLevel: 5, spellIds: [SPELL_IDS.WATER_WALK] },
      { availableAtLevel: 7, spellIds: [SPELL_IDS.FREEDOM_OF_MOVEMENT, SPELL_IDS.LOCATE_CREATURE] },
      { availableAtLevel: 9, spellIds: [SPELL_IDS.INSECT_PLAGUE, SPELL_IDS.SCRYING] }
    ]
  }
]

function circleSpellGrantId(specializationOrder: number): string {
  return classRowId(D, 13, specializationOrder)
}

function circleSpellProgressionLevelId(specializationOrder: number, tierOrder: number): string {
  return classRowId(D, 14, ((specializationOrder - 1) * 4) + tierOrder)
}

function circleSpellRestrictionId(specializationOrder: number, offset: number): string {
  return classRowId(D, 15, ((specializationOrder - 1) * 4) + offset)
}

function specializationRestriction(specializationId: string, specializationOrder: number) {
  return {
    id: circleSpellRestrictionId(specializationOrder, 1),
    groups: [
      {
        id: circleSpellRestrictionId(specializationOrder, 2),
        order: 1,
        contexts: [
          {
            id: circleSpellRestrictionId(specializationOrder, 3),
            order: 1,
            subject: 'SUBCLASS' as const,
            authoringModeKind: AUTHORING_MODE_KIND.ALL,
            conditions: [
              {
                id: circleSpellRestrictionId(specializationOrder, 4),
                order: 1,
                kind: 'PREDICATE' as const,
                constraint: 'INCLUDE' as const,
                predicateCode: 'SUBCLASS_SPECIALIZATION' as const,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                specializationIds: [specializationId]
              }
            ]
          }
        ]
      }
    ]
  }
}

const circleSpellGrants = LAND_SPECIALIZATIONS.map((specialization) => ({
  id: circleSpellGrantId(specialization.order),
  grantKind: GRANT_KIND.SPELL_GRANT,
  selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
  scalingKind: SCALING.PER_LEVEL,
  progression: {
    scalingSource: SCALING_SOURCE.PARENT_CLASS_LEVEL,
    levels: specialization.spellLevels.map((spellLevel, tierIndex) => ({
      id: circleSpellProgressionLevelId(specialization.order, tierIndex + 1),
      level: spellLevel.availableAtLevel,
      order: tierIndex + 1,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      spellIds: spellLevel.spellIds
    }))
  },
  attributes: [SPELL_GRANT_ATTRIBUTE.PREPARED],
  restrictions: specializationRestriction(specialization.id, specialization.order),
  order: specialization.order - 1
}))

export const circleOfTheLand: ClassAuthored = {
  id: SUBCLASS_IDS.LAND,
  label: 'Circle of the Land',
  category: CLASS_CATEGORY.SUBCLASS,
  parentClassId: CLASS_IDS.DRUID,
  description: 'The Circle of the Land is made up of mystics and sages who safeguard ancient knowledge and rites through a vast oral tradition.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  attributes: [SUBCLASS_ATTRIBUTE.SPECIALIZATION],
  specializations: LAND_SPECIALIZATIONS.map((specialization) => ({
    id: specialization.id,
    label: specialization.label,
    order: specialization.order
  })),
  features: [
    {
      id: classRowId(D, 11, 1),
      label: 'Bonus Cantrip',
      description: 'When you choose this circle at 2nd level, you learn one additional druid cantrip of your choice.',
      availableAtLevel: 2,
      order: 0,
      grants: {
        spells: [
          {
            id: classRowId(D, 12, 1),
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            count: 1,
            selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            spellIds: druidCantripIds,
            attributes: [SPELL_GRANT_ATTRIBUTE.KNOWN],
            order: 0
          }
        ]
      }
    },
    {
      id: classRowId(D, 11, 2),
      label: 'Natural Recovery',
      description: 'Starting at 2nd level, you can regain some of your magical energy during a short rest. Choose expended spell slots to recover with a combined level equal to or less than half your druid level, rounded up, and none of the slots can be 6th level or higher. You must finish a long rest before you can use this feature again.',
      availableAtLevel: 2,
      order: 1
    },
    {
      id: classRowId(D, 11, 3),
      label: 'Circle Spells',
      description: 'At 3rd, 5th, 7th, and 9th level, your chosen land specialization grants circle spells that are always prepared and do not count against the number of spells you can prepare each day.',
      availableAtLevel: 2,
      order: 2,
      grants: {
        spells: circleSpellGrants
      }
    },
    {
      id: classRowId(D, 11, 4),
      label: 'Land\'s Stride',
      description: 'Starting at 6th level, moving through nonmagical difficult terrain costs you no extra movement. You can also pass through nonmagical plants without being slowed by them and without taking damage from them if they have thorns, spines, or a similar hazard. You also have advantage on saving throws against plants magically created or manipulated to impede movement.',
      availableAtLevel: 6,
      order: 3
    },
    {
      id: classRowId(D, 11, 5),
      label: 'Nature\'s Ward',
      description: 'At 10th level, you can\'t be charmed or frightened by elementals or fey, and you are immune to poison and disease.',
      availableAtLevel: 10,
      order: 4
    },
    {
      id: classRowId(D, 11, 6),
      label: 'Nature\'s Sanctuary',
      description: 'At 14th level, beasts and plant creatures become hesitant to attack you. When a beast or plant creature attacks you, it must make a Wisdom saving throw against your druid spell save DC. On a failed save, it must choose a different target or the attack automatically misses. On a successful save, the creature is immune to this effect for 24 hours.',
      availableAtLevel: 14,
      order: 5
    }
  ]
}
