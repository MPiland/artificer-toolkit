import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import {
  ACTIVATION_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_DUPLICATE_POLICY,
  AUTHORING_SELECTION_KIND,
  CLASS_CATEGORY,
  CLOSED_RULE_KIND,
  DURATION_KIND,
  GRANT_KIND,
  MANUAL_ADJUDICATION_REASON,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  RANGE_KIND,
  SCALING,
  SCALING_SOURCE,
  SPELL_GRANT_ATTRIBUTE,
  SUBCLASS_ATTRIBUTE,
  TARGET_SELECTION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  type ClassAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS, SUBCLASS_IDS } from '../ids.js'
import { SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
import { srdSpells } from '../spells/index.js'
import { creatureTypeId } from '../spells/shared.js'
import { againstCreatureTypes } from '../spells/protection-from-evil-and-good.js'
import { conditionTypeId, damageTypeId } from '../equipment/shared.js'
import { closedRuleEffect, gmRulingEffect, landsStrideRuling } from './mechanics.js'

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
      {
        availableAtLevel: 5,
        spellIds: [SPELL_IDS.CREATE_FOOD_AND_WATER, SPELL_IDS.PROTECTION_FROM_ENERGY]
      },
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
  return classRowId(D, 14, (specializationOrder - 1) * 4 + tierOrder)
}

function circleSpellRestrictionId(specializationOrder: number, offset: number): string {
  return classRowId(D, 15, (specializationOrder - 1) * 4 + offset)
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
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            subclassIds: [SUBCLASS_IDS.LAND],
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
  description:
    "The Circle of the Land is made up of mystics and sages who safeguard ancient knowledge and rites through a vast oral tradition. These druids meet within sacred circles of trees or standing stones to whisper primal secrets in Druidic. The circle's wisest members preside as the chief priests of communities that hold to the Old Faith and serve as advisors to the rulers of those folk. As a member of this circle, your magic is influenced by the land where you were initiated into the circle's mysterious rites.",
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
      description:
        'When you choose this circle at 2nd level, you learn one additional druid cantrip of your choice.',
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
      description:
        "Starting at 2nd level, you can regain some of your magical energy by sitting in meditation and communing with nature. During a short rest, you choose expended spell slots to recover. The spell slots can have a combined level that is equal to or less than half your druid level (rounded up), and none of the slots can be 6th level or higher. You can't use this feature again until you finish a long rest. For example, when you are a 4th-level druid, you can recover up to two levels worth of spell slots. You can recover either a 2nd-level slot or two 1st-level slots.",
      availableAtLevel: 2,
      order: 1,
      attributes: ['LIMITED_USE'],
      charges: {
        id: classRowId(D, 22, 1),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: SCALING.NONE,
        resetKind: 'LONG_REST',
        amount: 1
      },
      effects: [
        closedRuleEffect({
          id: classRowId(D, 20, 1),
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.ACTIVATED,
            resourceUse: { chargeId: classRowId(D, 22, 1), cost: 1 },
            activation: { code: ACTIVATION_CODE.FREE },
            range: { id: classRowId(D, 21, 1), rangeKind: RANGE_KIND.SELF },
            targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: CLOSED_RULE_KIND.CLASS_CIRCLE_OF_THE_LAND_NATURAL_RECOVERY
        })
      ]
    },
    {
      id: classRowId(D, 11, 3),
      label: 'Circle Spells',
      description:
        "Your mystical connection to the land infuses you with the ability to cast certain spells. At 3rd, 5th, 7th, and 9th level you gain access to circle spells connected to the land where you became a druid. Choose that land—arctic, coast, desert, forest, grassland, mountain, or swamp—and consult the associated list of spells. Once you gain access to a circle spell, you always have it prepared, and it doesn't count against the number of spells you can prepare each day. If you gain access to a spell that doesn't appear on the druid spell list, the spell is nonetheless a druid spell for you.",
      availableAtLevel: 2,
      order: 2,
      grants: {
        spells: circleSpellGrants
      }
    },
    {
      id: classRowId(D, 11, 4),
      label: "Land's Stride",
      description:
        'Starting at 6th level, moving through nonmagical difficult terrain costs you no extra movement. You can also pass through nonmagical plants without being slowed by them and without taking damage from them if they have thorns, spines, or a similar hazard. In addition, you have advantage on saving throws against plants that are magically created or manipulated to impede movement, such those created by the entangle spell.',
      availableAtLevel: 6,
      order: 3,
      effects: [
        gmRulingEffect({
          ids: {
            effect: classRowId(D, 20, 2),
            range: classRowId(D, 21, 2),
            path: classRowId(D, 0xd0, 1),
            result: classRowId(D, 0xd1, 1),
            outcome: classRowId(D, 0xd2, 1)
          },
          label: "Land's Stride",
          instructions: landsStrideRuling,
          reasonCode: MANUAL_ADJUDICATION_REASON.EXTERNAL_WORLD_STATE
        })
      ]
    },
    {
      id: classRowId(D, 11, 5),
      label: "Nature's Ward",
      description:
        "When you reach 10th level, you can't be charmed or frightened by elementals or fey, and you are immune to poison and disease.",
      availableAtLevel: 10,
      order: 4,
      // Disease stays description: the engine has no disease model (Purity of Body precedent, D156).
      grants: {
        modifiers: [
          ...againstCreatureTypes(
            (part, entry) => classRowId(D, 0x90 + part, entry),
            (['CHARMED', 'FRIGHTENED'] as const).map((condition) => ({
              valueDomainCode: VALUE_DOMAIN_CODE.CONDITION_IMMUNITY,
              domain: {},
              modifierKind: MODIFIER_KIND.ADD_OPTION,
              payload: { conditionTypeId: conditionTypeId(condition) }
            })),
            ['ELEMENTAL', 'FEY']
          ),
          {
            id: classRowId(D, 0x90, 1),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE_IMMUNITY,
            domain: {},
            modifierKind: MODIFIER_KIND.ADD_OPTION,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { damageTypeId: damageTypeId('POISON') },
            order: 3
          },
          {
            id: classRowId(D, 0x90, 2),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.CONDITION_IMMUNITY,
            domain: {},
            modifierKind: MODIFIER_KIND.ADD_OPTION,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { conditionTypeId: conditionTypeId('POISONED') },
            order: 4
          }
        ]
      }
    },
    {
      id: classRowId(D, 11, 6),
      label: "Nature's Sanctuary",
      description:
        'When you reach 14th level, creatures of the natural world sense your connection to nature and become hesitant to attack you. When a beast or plant creature attacks you, that creature must make a Wisdom saving throw against your druid spell save DC. On a failed save, the creature must choose a different target, or the attack automatically misses. On a successful save, the creature is immune to this effect for 24 hours.',
      availableAtLevel: 14,
      order: 5,
      grants: {
        modifiers: [
          {
            id: classRowId(D, 0x8a, 1),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.INCOMING_ATTACK_GATE,
            domain: {},
            modifierKind: MODIFIER_KIND.ENABLE,
            payload: {
              savingThrow: {
                id: classRowId(D, 0x8b, 1),
                dcMethod: 'SOURCE_SAVE_DC',
                abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM
              },
              attackerCreatureTypeIds: [creatureTypeId('BEAST'), creatureTypeId('PLANT')],
              successImmunity: {
                duration: {
                  id: classRowId(D, 0x8c, 1),
                  durationKind: DURATION_KIND.HOUR,
                  amount: 24
                }
              }
            },
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            order: 1
          }
        ]
      }
    }
  ]
}
