import {
  ACTIVATION_CODE,
  ABILITY_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_DUPLICATE_POLICY,
  AUTHORING_SELECTION_KIND,
  CLASS_ATTRIBUTE,
  CLASS_CATEGORY,
  CLOSED_RULE_KIND,
  EFFECT_KIND,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  FEATURE_ATTRIBUTE,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  PROFICIENCY_KIND,
  RANGE_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  SPELLCASTING_ATTRIBUTE,
  SPELL_ATTRIBUTE,
  SPELL_GRANT_ATTRIBUTE,
  STARTING_EQUIPMENT_KIND,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  type ActivationCode,
  type ClassAuthored,
  type ClosedRuleKind,
  type EffectAuthored
} from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { srdSpells } from '../spells/index.js'
import { creatureTypeId } from '../spells/shared.js'
import {
  SRD_CURRENCIES,
  SRD_DEVILS_SIGHT_SENSE_ID,
  SRD_SKILLS,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from '../vocabulary.js'
import { classSpellcastingDetails } from './spellcasting-details.js'
import {
  abilityScoreImprovementOptions,
  attacksPerAttackActionGrant,
  closedRuleEffect,
  selfActionEffect
} from './mechanics.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function skillId(code: string): string {
  const entry = SRD_SKILLS.find((s) => s.code === code)
  if (!entry)
    throw new Error(`SRD skill vocabulary entry for ${code} required for class source data.`)
  return entry.id
}

const goldCurrencyId = SRD_CURRENCIES.find((c) => c.code === 'GP')?.id
if (!goldCurrencyId)
  throw new Error('SRD GP currency vocabulary entry required for class source data.')

const allCantripIds = srdSpells.filter((spell) => spell.level === 0).map((spell) => spell.id)
const allFirstLevelRitualSpellIds = srdSpells
  .filter((spell) => spell.level === 1 && spell.attributes?.includes(SPELL_ATTRIBUTE.RITUAL))
  .map((spell) => spell.id)

// ID helpers: class rows use domain c0XX where XX = class index (01–0c)
// Format: 00000000-0000-0000-c0XX-GGNN00000000
// GG = group, NN = entry
function classRowId(classIndex: number, group: number, entry: number): string {
  const xx = classIndex.toString(16).padStart(2, '0')
  const gg = group.toString(16).padStart(2, '0')
  const nn = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-c0${xx}-${gg}${nn}00000000`
}

function equipmentId(index: number): string {
  const hex = index.toString(16).padStart(4, '0')
  return `00000000-0000-0000-0060-${hex}00000000`
}

// ─── Warlock (index 11) ───────────────────────────────────────────────────────

const W = 11 // warlock class index for ID generation

const abilityScoreImprovementDescription =
  "When you reach 4th level, and again at 8th, 12th, 16th, and 19th level, you can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1. As normal, you can't increase an ability score above 20 using this feature."

function selfClassRuleEffect(
  entry: number,
  ruleKind: ClosedRuleKind,
  activationCode?: Exclude<ActivationCode, 'FREE'>
): EffectAuthored {
  const range = { id: classRowId(W, 0x69, entry), rangeKind: RANGE_KIND.SELF } as const
  return closedRuleEffect({
    id: classRowId(W, 0x60, entry),
    ruleKind,
    invocation: activationCode
      ? {
          kind: 'ACTION',
          triggerCode: TRIGGER.ACTIVATED,
          activation: { code: activationCode, amount: 1 },
          range,
          targeting: { selectionKind: 'SELF' }
        }
      : {
          kind: 'PASSIVE',
          triggerCode: TRIGGER.ACTIVATED,
          range,
          targeting: { selectionKind: 'SELF' }
        }
  })
}

function warlockSpellIdsAtLevel(level: number): string[] {
  return srdSpells
    .filter((spell) => spell.level === level && spell.classIds.includes(CLASS_IDS.WARLOCK))
    .map((spell) => spell.id)
}

// Pact Magic charge (Warlock spell slots) — resets on short OR long rest
const pactMagicCharge = {
  id: classRowId(W, 1, 1),
  limitKind: 'FIXED_AMOUNT' as const,
  scalingKind: SCALING.PER_LEVEL,
  resetKind: 'SHORT_REST' as const,
  levels: [
    // classLevel → slot count
    { id: classRowId(W, 1, 2), level: 1, amount: 1 },
    { id: classRowId(W, 1, 3), level: 2, amount: 2 },
    { id: classRowId(W, 1, 4), level: 3, amount: 2 },
    { id: classRowId(W, 1, 5), level: 4, amount: 2 },
    { id: classRowId(W, 1, 6), level: 5, amount: 2 },
    { id: classRowId(W, 1, 7), level: 6, amount: 2 },
    { id: classRowId(W, 1, 8), level: 7, amount: 2 },
    { id: classRowId(W, 1, 9), level: 8, amount: 2 },
    { id: classRowId(W, 1, 10), level: 9, amount: 2 },
    { id: classRowId(W, 1, 11), level: 10, amount: 2 },
    { id: classRowId(W, 1, 12), level: 11, amount: 3 },
    { id: classRowId(W, 1, 13), level: 12, amount: 3 },
    { id: classRowId(W, 1, 14), level: 13, amount: 3 },
    { id: classRowId(W, 1, 15), level: 14, amount: 3 },
    { id: classRowId(W, 1, 16), level: 15, amount: 3 },
    { id: classRowId(W, 1, 17), level: 16, amount: 3 },
    { id: classRowId(W, 1, 18), level: 17, amount: 4 },
    { id: classRowId(W, 1, 19), level: 18, amount: 4 },
    { id: classRowId(W, 1, 20), level: 19, amount: 4 },
    { id: classRowId(W, 1, 21), level: 20, amount: 4 }
  ]
}

// Warlock Pact Magic spell level progression per class level
const warlockSpellLimits = [
  {
    classLevel: 1,
    slots: [{ spellLevel: 1, slotCount: 1 }],
    learnedSpellsLimit: 2,
    cantripsLimit: 2
  },
  {
    classLevel: 2,
    slots: [{ spellLevel: 1, slotCount: 2 }],
    learnedSpellsLimit: 3,
    cantripsLimit: 2
  },
  {
    classLevel: 3,
    slots: [{ spellLevel: 2, slotCount: 2 }],
    learnedSpellsLimit: 4,
    cantripsLimit: 2
  },
  {
    classLevel: 4,
    slots: [{ spellLevel: 2, slotCount: 2 }],
    learnedSpellsLimit: 5,
    cantripsLimit: 3
  },
  {
    classLevel: 5,
    slots: [{ spellLevel: 3, slotCount: 2 }],
    learnedSpellsLimit: 6,
    cantripsLimit: 3
  },
  {
    classLevel: 6,
    slots: [{ spellLevel: 3, slotCount: 2 }],
    learnedSpellsLimit: 7,
    cantripsLimit: 3
  },
  {
    classLevel: 7,
    slots: [{ spellLevel: 4, slotCount: 2 }],
    learnedSpellsLimit: 8,
    cantripsLimit: 3
  },
  {
    classLevel: 8,
    slots: [{ spellLevel: 4, slotCount: 2 }],
    learnedSpellsLimit: 9,
    cantripsLimit: 3
  },
  {
    classLevel: 9,
    slots: [{ spellLevel: 5, slotCount: 2 }],
    learnedSpellsLimit: 10,
    cantripsLimit: 3
  },
  {
    classLevel: 10,
    slots: [{ spellLevel: 5, slotCount: 2 }],
    learnedSpellsLimit: 10,
    cantripsLimit: 4
  },
  {
    classLevel: 11,
    slots: [{ spellLevel: 5, slotCount: 3 }],
    learnedSpellsLimit: 11,
    cantripsLimit: 4
  },
  {
    classLevel: 12,
    slots: [{ spellLevel: 5, slotCount: 3 }],
    learnedSpellsLimit: 11,
    cantripsLimit: 4
  },
  {
    classLevel: 13,
    slots: [{ spellLevel: 5, slotCount: 3 }],
    learnedSpellsLimit: 12,
    cantripsLimit: 4
  },
  {
    classLevel: 14,
    slots: [{ spellLevel: 5, slotCount: 3 }],
    learnedSpellsLimit: 12,
    cantripsLimit: 4
  },
  {
    classLevel: 15,
    slots: [{ spellLevel: 5, slotCount: 3 }],
    learnedSpellsLimit: 13,
    cantripsLimit: 4
  },
  {
    classLevel: 16,
    slots: [{ spellLevel: 5, slotCount: 3 }],
    learnedSpellsLimit: 13,
    cantripsLimit: 4
  },
  {
    classLevel: 17,
    slots: [{ spellLevel: 5, slotCount: 4 }],
    learnedSpellsLimit: 14,
    cantripsLimit: 4
  },
  {
    classLevel: 18,
    slots: [{ spellLevel: 5, slotCount: 4 }],
    learnedSpellsLimit: 14,
    cantripsLimit: 4
  },
  {
    classLevel: 19,
    slots: [{ spellLevel: 5, slotCount: 4 }],
    learnedSpellsLimit: 15,
    cantripsLimit: 4
  },
  {
    classLevel: 20,
    slots: [{ spellLevel: 5, slotCount: 4 }],
    learnedSpellsLimit: 15,
    cantripsLimit: 4
  }
]

export const warlock: ClassAuthored = {
  id: CLASS_IDS.WARLOCK,
  label: 'Warlock',
  category: CLASS_CATEGORY.BASE,
  subclassSelectionLevel: 1,
  attributes: [CLASS_ATTRIBUTE.SPELLCASTER],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,

  hitpoint: {
    ability: ABILITY_CODE.CONSTITUTION,
    dieConfig: 'd8'
  },

  startingGold: {
    multiplier: 10,
    currencyId: goldCurrencyId,
    dieConfig: '4d4'
  },

  multiclass: {
    id: classRowId(W, 99, 1),
    requirementGroups: {
      groups: [
        {
          id: classRowId(W, 99, 2),
          requirements: [{ id: classRowId(W, 99, 3), ability: ABILITY_CODE.CHARISMA, min: 13 }]
        }
      ]
    },
    proficiencies: [
      {
        id: classRowId(W, 99, 4),
        grantKind: GRANT_KIND.PROFICIENCY_GRANT,
        proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
        level: SCALING_AMOUNT_KIND.FULL,
        selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
        scalingKind: SCALING.NONE,
        authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
        properties: ['LIGHT'],
        category: 'ARMOR',
        order: 0
      },
      {
        id: classRowId(W, 99, 5),
        grantKind: GRANT_KIND.PROFICIENCY_GRANT,
        proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
        level: SCALING_AMOUNT_KIND.FULL,
        selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
        scalingKind: SCALING.NONE,
        authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
        properties: ['SIMPLE'],
        category: 'WEAPON',
        order: 1
      }
    ]
  },

  startingEquipment: {
    id: classRowId(W, 98, 1),
    sets: [
      {
        id: classRowId(W, 98, 2),
        order: 0,
        groups: [
          {
            id: classRowId(W, 98, 3),
            order: 0,
            options: [
              {
                id: classRowId(W, 98, 4),
                order: 0,
                items: [
                  {
                    id: classRowId(W, 98, 5),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(11)],
                    quantity: 1
                  },
                  {
                    id: classRowId(W, 98, 6),
                    order: 1,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(101)],
                    quantity: 20
                  }
                ]
              },
              {
                id: classRowId(W, 98, 7),
                order: 1,
                items: [
                  {
                    id: classRowId(W, 98, 8),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                    authoringModeKind: AUTHORING_MODE_KIND.ALL,
                    category: EQUIPMENT_CATEGORY_CODE.WEAPON,
                    properties: [EQUIPMENT_PROPERTY_CODE.SIMPLE],
                    count: 1
                  }
                ]
              }
            ]
          },
          {
            id: classRowId(W, 98, 9),
            order: 1,
            options: [
              {
                id: classRowId(W, 98, 10),
                order: 0,
                items: [
                  {
                    id: classRowId(W, 98, 11),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(135)],
                    quantity: 1
                  }
                ]
              },
              {
                id: classRowId(W, 98, 12),
                order: 1,
                items: [
                  {
                    id: classRowId(W, 98, 13),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [87, 88, 89, 90, 91].map(equipmentId),
                    count: 1
                  }
                ]
              }
            ]
          },
          {
            id: classRowId(W, 98, 14),
            order: 2,
            options: [
              {
                id: classRowId(W, 98, 15),
                order: 0,
                items: [
                  {
                    id: classRowId(W, 98, 16),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(188)],
                    quantity: 1
                  }
                ]
              },
              {
                id: classRowId(W, 98, 17),
                order: 1,
                items: [
                  {
                    id: classRowId(W, 98, 18),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(184)],
                    quantity: 1
                  }
                ]
              }
            ]
          },
          {
            id: classRowId(W, 98, 19),
            order: 3,
            options: [
              {
                id: classRowId(W, 98, 20),
                order: 0,
                items: [
                  {
                    id: classRowId(W, 98, 21),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(39)],
                    quantity: 1
                  },
                  {
                    id: classRowId(W, 98, 22),
                    order: 1,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                    authoringModeKind: AUTHORING_MODE_KIND.ALL,
                    category: EQUIPMENT_CATEGORY_CODE.WEAPON,
                    properties: [EQUIPMENT_PROPERTY_CODE.SIMPLE],
                    count: 1
                  },
                  {
                    id: classRowId(W, 98, 23),
                    order: 2,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(2)],
                    quantity: 2
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },

  // ── Class proficiencies ───────────────────────────────────────────────────────
  proficiencies: [
    // Light armor
    {
      id: classRowId(W, 2, 1),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      properties: ['LIGHT'],
      category: 'ARMOR',
      order: 0
    },
    // Simple weapons
    {
      id: classRowId(W, 2, 2),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      properties: ['SIMPLE'],
      category: 'WEAPON',
      order: 1
    },
    // Saving throws: WIS, CHA
    {
      id: classRowId(W, 2, 3),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SAVE_ABILITY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      abilities: [ABILITY_CODE.WISDOM, ABILITY_CODE.CHARISMA],
      order: 2
    },
    // Skills: choose 2 from Arcana, Deception, History, Intimidation, Investigation, Nature, Religion
    {
      id: classRowId(W, 2, 4),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SKILL,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      scalingKind: SCALING.NONE,
      count: 2,
      selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      skillIds: [
        skillId('ARCANA'),
        skillId('DECEPTION'),
        skillId('HISTORY'),
        skillId('INTIMIDATION'),
        skillId('INVESTIGATION'),
        skillId('NATURE'),
        skillId('RELIGION')
      ],
      order: 3
    }
  ],

  // ── Spellcasting ─────────────────────────────────────────────────────────────
  spellcasting: {
    availableAtLevel: 1,
    order: 0,
    ability: ABILITY_CODE.CHARISMA,
    maxSpellLevel: 5,
    magicName: 'Pact Magic',
    attributes: [SPELLCASTING_ATTRIBUTE.LIMIT_KNOWN_SPELL_AMOUNT],
    details: classSpellcastingDetails(W, [
      {
        label: 'Pact Magic',
        description:
          '<p>Your arcane research and the magic bestowed on you by your patron have given you facility with spells.</p>'
      },
      {
        label: 'Cantrips',
        description:
          '<p>You know two cantrips of your choice from the warlock spell list. You learn additional warlock cantrips of your choice at higher levels, as shown in the Cantrips Known column of the Warlock table.</p>'
      },
      {
        label: 'Spell Slots',
        description:
          '<p>The Warlock table shows how many spell slots you have. The table also shows what the level of those slots is; all of your spell slots are the same level. To cast one of your warlock spells of 1st level or higher, you must expend a spell slot. You regain all expended spell slots when you finish a short or long rest.</p><p>For example, when you are 5th level, you have two 3rd-level spell slots. To cast the 1st-level spell <em>thunderwave</em>, you must spend one of those slots, and you cast it as a 3rd-level spell.</p>'
      },
      {
        label: 'Spells Known of 1st Level and Higher',
        description:
          "<p>At 1st level, you know two 1st-level spells of your choice from the warlock spell list.</p><p>The Spells Known column of the Warlock table shows when you learn more warlock spells of your choice of 1st level and higher. A spell you choose must be of a level no higher than what's shown in the table's Slot Level column for your level. When you reach 6th level, for example, you learn a new warlock spell, which can be 1st, 2nd, or 3rd level.</p><p>Additionally, when you gain a level in this class, you can choose one of the warlock spells you know and replace it with another spell from the warlock spell list, which also must be of a level for which you have spell slots.</p>"
      },
      {
        label: 'Spellcasting Ability',
        description:
          '<p>Charisma is your spellcasting ability for your warlock spells, so you use your Charisma whenever a spell refers to your spellcasting ability. In addition, you use your Charisma modifier when setting the saving throw DC for a warlock spell you cast and when making an attack roll with one.</p><p><strong>Spell save DC</strong> = 8 + your proficiency bonus + your Charisma modifier</p><p><strong>Spell attack modifier</strong> = your proficiency bonus + your Charisma modifier</p>'
      },
      {
        label: 'Spellcasting Focus',
        description:
          '<p>You can use an arcane focus as a spellcasting focus for your warlock spells.</p>'
      }
    ]),
    charges: pactMagicCharge,
    spellLimits: warlockSpellLimits
  },

  // ── Class features (L1–20) ────────────────────────────────────────────────────
  features: [
    // L1 — Otherworldly Patron
    {
      id: classRowId(W, 3, 1),
      label: 'Otherworldly Patron',
      description:
        'At 1st level, you have struck a bargain with an otherworldly being of your choice: the Archfey, the Fiend, or the Great Old One, each of which is detailed at the end of the class description. Your choice grants you features at 1st level and again at 6th, 10th, and 14th level.',
      attributes: [FEATURE_ATTRIBUTE.SUBCLASS_SELECTION],
      availableAtLevel: 1,
      order: 0
    },
    // L1 — Pact Magic
    {
      id: classRowId(W, 3, 2),
      label: 'Pact Magic',
      description:
        'Your arcane research and the magic bestowed on you by your patron have given you facility with spells.',
      availableAtLevel: 1,
      order: 1
    },
    // L2 — Eldritch Invocations
    {
      id: classRowId(W, 3, 3),
      label: 'Eldritch Invocations',
      description:
        'In your study of occult lore, you have unearthed eldritch invocations, fragments of forbidden knowledge that imbue you with an abiding magical ability.\n\nAt 2nd level, you gain two eldritch invocations of your choice. Your invocation options are detailed at the end of the class description. When you gain certain warlock levels, you gain additional invocations of your choice, as shown in the Invocations Known column of the Warlock table.\n\nAdditionally, when you gain a level in this class, you can choose one of the invocations you know and replace it with another invocation that you could learn at that level.',
      availableAtLevel: 2,
      order: 2,
      optionChoices: [
        { level: 2, count: 2 },
        { level: 5, count: 1 },
        { level: 7, count: 1 },
        { level: 9, count: 1 },
        { level: 12, count: 1 },
        { level: 15, count: 1 },
        { level: 18, count: 1 }
      ],
      options: [
        {
          id: classRowId(W, 3, 4),
          label: 'Agonizing Blast',
          description:
            'When you cast eldritch blast, add your Charisma modifier to the damage it deals on a hit.',
          // Requires Eldritch Blast cantrip (CHARACTER context, SPELL_OBTAINED predicate)
          restrictions: {
            id: classRowId(W, 4, 1),
            groups: [
              {
                id: classRowId(W, 4, 2),
                order: 0,
                contexts: [
                  {
                    id: classRowId(W, 4, 3),
                    order: 0,
                    subject: 'CHARACTER' as const,
                    conditions: [
                      {
                        id: classRowId(W, 4, 4),
                        order: 0,
                        kind: 'PREDICATE' as const,
                        constraint: 'INCLUDE' as const,
                        predicateCode: 'SPELL_OBTAINED' as const,
                        spellIds: [SPELL_IDS.ELDRITCH_BLAST]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          grants: {
            modifiers: [
              {
                id: classRowId(W, 3, 5),
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
                domain: { attackDomain: 'SPELL' as const },
                modifierKind: MODIFIER_KIND.ABILITY_MODIFIER_BONUS,
                scope: MODIFIER_SCOPE_KIND.GLOBAL,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                payload: { ability: ABILITY_CODE.CHARISMA },
                order: 0,
                // Scope this modifier to Eldritch Blast only — without this restriction
                // the CHA bonus would apply to all spell attacks on the character sheet.
                restrictions: {
                  id: classRowId(W, 4, 5),
                  groups: [
                    {
                      id: classRowId(W, 4, 6),
                      order: 0,
                      contexts: [
                        {
                          id: classRowId(W, 4, 7),
                          order: 0,
                          subject: 'SPELL' as const,
                          authoringModeKind: 'SELECTED' as const,
                          spellIds: [SPELL_IDS.ELDRITCH_BLAST]
                          // conditions omitted — subject selection is the complete restriction
                        }
                      ]
                    }
                  ]
                }
              }
            ]
          },
          order: 0
        },
        {
          id: classRowId(W, 3, 6),
          label: 'Armor of Shadows',
          description:
            'You can cast mage armor on yourself at will, without expending a spell slot or material components.',
          grants: {
            spells: [
              {
                id: classRowId(W, 3, 7),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.MAGE_ARMOR],
                attributes: [SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL, SPELL_GRANT_ATTRIBUTE.SELF_ONLY],
                order: 0
              }
            ]
          },
          order: 1
        },
        {
          id: classRowId(W, 3, 8),
          label: "Devil's Sight",
          description:
            'You can see normally in darkness, both magical and nonmagical, to a distance of 120 feet.',
          grants: {
            senses: [
              {
                id: classRowId(W, 0x50, 1),
                grantKind: GRANT_KIND.SENSE_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                senseIds: [SRD_DEVILS_SIGHT_SENSE_ID],
                range: {
                  id: classRowId(W, 0x50, 2),
                  rangeKind: RANGE_KIND.DISTANCE,
                  amount: 120,
                  unit: MEASUREMENT_UNIT_CODE.FEET
                },
                order: 0
              }
            ]
          },
          order: 2
        },
        {
          id: classRowId(W, 3, 9),
          label: 'Eldritch Sight',
          description: 'You can cast detect magic at will, without expending a spell slot.',
          grants: {
            spells: [
              {
                id: classRowId(W, 3, 10),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.DETECT_MAGIC],
                attributes: [SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
                order: 0
              }
            ]
          },
          order: 3
        },
        {
          id: classRowId(W, 3, 11),
          label: 'Fiendish Vigor',
          description:
            'You can cast false life on yourself at will as a 1st-level spell, without expending a spell slot or material components.',
          grants: {
            spells: [
              {
                id: classRowId(W, 3, 12),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.FALSE_LIFE],
                attributes: [
                  SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL,
                  SPELL_GRANT_ATTRIBUTE.CAST_AT_LEVEL,
                  SPELL_GRANT_ATTRIBUTE.SELF_ONLY
                ],
                castAtLevel: 1,
                order: 0
              }
            ]
          },
          order: 4
        },
        {
          id: classRowId(W, 3, 13),
          label: 'Mask of Many Faces',
          description: 'You can cast disguise self at will, without expending a spell slot.',
          grants: {
            spells: [
              {
                id: classRowId(W, 3, 14),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.DISGUISE_SELF],
                attributes: [SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
                order: 0
              }
            ]
          },
          order: 5
        },
        {
          id: classRowId(W, 3, 15),
          label: 'Misty Visions',
          description:
            'You can cast silent image at will, without expending a spell slot or material components.',
          grants: {
            spells: [
              {
                id: classRowId(W, 3, 16),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.SILENT_IMAGE],
                attributes: [SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
                order: 0
              }
            ]
          },
          order: 6
        },
        {
          id: classRowId(W, 3, 17),
          label: 'Repelling Blast',
          description:
            'When you hit a creature with eldritch blast, you can push the creature up to 10 feet away from you in a straight line.',
          // Requires Eldritch Blast. Push effect is a combat action modifier not representable as a grant.
          restrictions: {
            id: classRowId(W, 4, 9),
            groups: [
              {
                id: classRowId(W, 4, 10),
                order: 0,
                contexts: [
                  {
                    id: classRowId(W, 4, 11),
                    order: 0,
                    subject: 'CHARACTER' as const,
                    conditions: [
                      {
                        id: classRowId(W, 4, 12),
                        order: 0,
                        kind: 'PREDICATE' as const,
                        constraint: 'INCLUDE' as const,
                        predicateCode: 'SPELL_OBTAINED' as const,
                        spellIds: [SPELL_IDS.ELDRITCH_BLAST]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          effects: [
            closedRuleEffect({
              id: classRowId(W, 0x60, 5),
              ruleKind: CLOSED_RULE_KIND.CLASS_WARLOCK_REPELLING_BLAST,
              pathCode: PATH_CODE.ON_HIT,
              invocation: {
                kind: 'PASSIVE',
                triggerCode: TRIGGER.RANGED_SPELL_ATTACK,
                range: { id: classRowId(W, 0x69, 5), rangeKind: RANGE_KIND.SPECIAL },
                targeting: {
                  selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                  dispositionKind: TARGET_DISPOSITION_KIND.HOSTILE
                }
              }
            })
          ],
          order: 7
        },
        {
          id: classRowId(W, 3, 19),
          label: 'Thief of Five Fates',
          description:
            "You can cast bane once using a warlock spell slot. You can't do so again until you finish a long rest.",
          grants: {
            spells: [
              {
                id: classRowId(W, 3, 20),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.BANE],
                attributes: [SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
                slotCost: { poolCode: 'PACT' },
                charges: {
                  id: classRowId(W, 0x51, 1),
                  limitKind: 'FIXED_AMOUNT',
                  scalingKind: SCALING.NONE,
                  resetKind: 'LONG_REST',
                  amount: 1
                },
                order: 0
              }
            ]
          },
          order: 8
        },
        // ── Additional SRD 5.1 Eldritch Invocations ──────────────────────────────
        // IDs: options use classRowId(W, 5, N), restriction nodes use classRowId(W, 6, N)
        {
          id: classRowId(W, 5, 1),
          label: 'Beguiling Influence',
          description: 'You gain proficiency in the Deception and Persuasion skills.',
          grants: {
            proficiencies: [
              {
                id: classRowId(W, 5, 2),
                grantKind: GRANT_KIND.PROFICIENCY_GRANT,
                proficiencyKind: PROFICIENCY_KIND.SKILL,
                level: SCALING_AMOUNT_KIND.FULL,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                skillIds: [skillId('DECEPTION'), skillId('PERSUASION')],
                order: 0
              }
            ]
          },
          order: 9
        },
        {
          id: classRowId(W, 5, 3),
          label: 'Book of Ancient Secrets',
          description:
            "You can now inscribe magical rituals in your Book of Shadows. Choose two 1st-level spells that have the ritual tag from any class's spell list (the two needn't be from the same list). The spells appear in the book and don't count against the number of spells you know. With your Book of Shadows in hand, you can cast the chosen spells as rituals. You can't cast the spells except as rituals, unless you've learned them by some other means. You can also cast a warlock spell you know as a ritual if it has the ritual tag.\n\nOn your adventures, you can add other ritual spells to your Book of Shadows. When you find such a spell, you can add it to the book if the spell's level is equal to or less than half your warlock level (rounded up) and if you can spare the time to transcribe the spell. For each level of the spell, the transcription process takes 2 hours and costs 50 gp for the rare inks needed to inscribe it.",
          grants: {
            spells: [
              {
                id: classRowId(W, 0x52, 1),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                count: 2,
                selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: allFirstLevelRitualSpellIds,
                attributes: [SPELL_GRANT_ATTRIBUTE.RITUAL],
                order: 0
              }
            ]
          },
          // Requires Pact of the Tome (classRowId(W, 3, 25))
          restrictions: {
            id: classRowId(W, 6, 1),
            groups: [
              {
                id: classRowId(W, 6, 2),
                order: 0,
                contexts: [
                  {
                    id: classRowId(W, 6, 3),
                    order: 0,
                    subject: 'CHARACTER' as const,
                    conditions: [
                      {
                        id: classRowId(W, 6, 4),
                        order: 0,
                        kind: 'PREDICATE' as const,
                        constraint: 'INCLUDE' as const,
                        predicateCode: 'OPTION_OBTAINED' as const,
                        optionIds: [classRowId(W, 3, 25)]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          order: 10
        },
        {
          id: classRowId(W, 5, 4),
          label: 'Chains of Carceri',
          description:
            'You can cast hold monster at will—targeting a celestial, fiend, or elemental—without expending a spell slot or material components. You must finish a long rest before you can use this invocation on the same creature again.',
          grants: {
            spells: [
              {
                id: classRowId(W, 5, 5),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.HOLD_MONSTER],
                attributes: [SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
                allowedCreatureTypeIds: [
                  creatureTypeId('CELESTIAL'),
                  creatureTypeId('FIEND'),
                  creatureTypeId('ELEMENTAL')
                ],
                perTargetLockout: { until: 'SOURCE_LONG_REST' },
                order: 0
              }
            ]
          },
          // Requires warlock level 15 + Pact of the Chain (classRowId(W, 3, 22))
          restrictions: {
            id: classRowId(W, 6, 5),
            groups: [
              {
                id: classRowId(W, 6, 6),
                order: 0,
                contexts: [
                  {
                    id: classRowId(W, 6, 7),
                    order: 0,
                    subject: 'CHARACTER' as const,
                    conditions: [
                      {
                        id: classRowId(W, 6, 8),
                        order: 0,
                        kind: 'PREDICATE' as const,
                        constraint: 'INCLUDE' as const,
                        predicateCode: 'CLASS_LEVEL' as const,
                        classIds: [CLASS_IDS.WARLOCK],
                        min: 15
                      },
                      {
                        id: classRowId(W, 6, 9),
                        order: 1,
                        kind: 'PREDICATE' as const,
                        constraint: 'INCLUDE' as const,
                        predicateCode: 'OPTION_OBTAINED' as const,
                        optionIds: [classRowId(W, 3, 22)]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          order: 11
        },
        {
          id: classRowId(W, 5, 6),
          label: 'Dreadful Word',
          description:
            "You can cast confusion once using a warlock spell slot. You can't do so again until you finish a long rest.",
          grants: {
            spells: [
              {
                id: classRowId(W, 5, 7),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.CONFUSION],
                attributes: [SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
                slotCost: { poolCode: 'PACT' },
                charges: {
                  id: classRowId(W, 0x51, 2),
                  limitKind: 'FIXED_AMOUNT',
                  scalingKind: SCALING.NONE,
                  resetKind: 'LONG_REST',
                  amount: 1
                },
                order: 0
              }
            ]
          },
          // Requires warlock level 7
          restrictions: {
            id: classRowId(W, 6, 10),
            groups: [
              {
                id: classRowId(W, 6, 11),
                order: 0,
                contexts: [
                  {
                    id: classRowId(W, 6, 12),
                    order: 0,
                    subject: 'CHARACTER' as const,
                    conditions: [
                      {
                        id: classRowId(W, 6, 13),
                        order: 0,
                        kind: 'PREDICATE' as const,
                        constraint: 'INCLUDE' as const,
                        predicateCode: 'CLASS_LEVEL' as const,
                        classIds: [CLASS_IDS.WARLOCK],
                        min: 7
                      }
                    ]
                  }
                ]
              }
            ]
          },
          order: 12
        },
        {
          id: classRowId(W, 5, 8),
          label: 'Eldritch Spear',
          description: 'When you cast eldritch blast, its range is 300 feet.',
          // Range change is not representable as a modifier grant — description-only.
          // Requires Eldritch Blast cantrip.
          restrictions: {
            id: classRowId(W, 6, 14),
            groups: [
              {
                id: classRowId(W, 6, 15),
                order: 0,
                contexts: [
                  {
                    id: classRowId(W, 6, 16),
                    order: 0,
                    subject: 'CHARACTER' as const,
                    conditions: [
                      {
                        id: classRowId(W, 6, 17),
                        order: 0,
                        kind: 'PREDICATE' as const,
                        constraint: 'INCLUDE' as const,
                        predicateCode: 'SPELL_OBTAINED' as const,
                        spellIds: [SPELL_IDS.ELDRITCH_BLAST]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          effects: [
            closedRuleEffect({
              id: classRowId(W, 0x60, 14),
              ruleKind: CLOSED_RULE_KIND.CLASS_WARLOCK_ELDRITCH_SPEAR,
              pathCode: PATH_CODE.ON_ATTACK,
              invocation: {
                kind: 'PASSIVE',
                triggerCode: TRIGGER.RANGED_SPELL_ATTACK,
                range: {
                  id: classRowId(W, 0x69, 14),
                  rangeKind: RANGE_KIND.DISTANCE,
                  amount: 300,
                  unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                  selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                  dispositionKind: TARGET_DISPOSITION_KIND.HOSTILE
                }
              }
            })
          ],
          order: 13
        },
        {
          id: classRowId(W, 5, 9),
          label: 'Eyes of the Rune Keeper',
          description: 'You can read all writing.',
          // No requirements. Passive ability — description-only.
          order: 14
        },
        {
          id: classRowId(W, 5, 10),
          label: 'Gaze of Two Minds',
          description:
            "You can use your action to touch a willing humanoid and perceive through its senses until the end of your next turn. As long as the creature is on the same plane of existence as you, you can use your action on subsequent turns to maintain this connection, extending the duration until the end of your next turn. While perceiving through the other creature's senses, you benefit from any special senses possessed by that creature, and you are blinded and deafened to your own surroundings.",
          // Perceiving through the touched humanoid stays description (D156); the action leaves
          // you blinded and deafened to your own surroundings until the end of your next turn.
          effects: [
            {
              id: classRowId(W, 0x60, 16),
              order: 1,
              invocation: {
                kind: 'ACTION',
                triggerCode: TRIGGER.ACTIVATED,
                activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
                range: { id: classRowId(W, 0x69, 16), rangeKind: RANGE_KIND.SELF },
                targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
              },
              paths: [
                {
                  id: classRowId(W, 0x80, 16),
                  order: 1,
                  pathCode: PATH_CODE.ON_USE,
                  groupType: PATH_GROUP_TYPE.SINGLE,
                  originKind: 'SOURCE',
                  selectionKind: 'FIXED',
                  resultBlock: {
                    id: classRowId(W, 0x81, 16),
                    resultKind: 'SINGLE',
                    duration: { id: classRowId(W, 0x83, 16), durationKind: 'ROUND', amount: 1 },
                    lifecycle: { turnAnchor: { actor: 'SOURCE', boundary: 'END_OF_TURN' } },
                    outcomes: (['BLINDED', 'DEAFENED'] as const).map((code, index) => ({
                      id: classRowId(W, 0x82, 16 + index),
                      effectKind: EFFECT_KIND.CONDITION,
                      conditionId: conditionTypeId(code)
                    }))
                  }
                }
              ]
            }
          ],
          order: 15
        },
        {
          id: classRowId(W, 5, 11),
          label: 'Lifedrinker',
          description:
            'When you hit a creature with your pact weapon, the creature takes extra necrotic damage equal to your Charisma modifier (minimum 1).',
          // Pact weapon damage is not a standard attack type we can scope as a modifier grant — description-only.
          // Requires warlock level 12 + Pact of the Blade (classRowId(W, 3, 24))
          restrictions: {
            id: classRowId(W, 6, 18),
            groups: [
              {
                id: classRowId(W, 6, 19),
                order: 0,
                contexts: [
                  {
                    id: classRowId(W, 6, 20),
                    order: 0,
                    subject: 'CHARACTER' as const,
                    conditions: [
                      {
                        id: classRowId(W, 6, 21),
                        order: 0,
                        kind: 'PREDICATE' as const,
                        constraint: 'INCLUDE' as const,
                        predicateCode: 'CLASS_LEVEL' as const,
                        classIds: [CLASS_IDS.WARLOCK],
                        min: 12
                      },
                      {
                        id: classRowId(W, 6, 22),
                        order: 1,
                        kind: 'PREDICATE' as const,
                        constraint: 'INCLUDE' as const,
                        predicateCode: 'OPTION_OBTAINED' as const,
                        optionIds: [classRowId(W, 3, 24)]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          effects: [
            closedRuleEffect({
              id: classRowId(W, 0x60, 17),
              ruleKind: CLOSED_RULE_KIND.CLASS_WARLOCK_LIFEDRINKER,
              pathCode: PATH_CODE.ON_HIT,
              invocation: {
                kind: 'PASSIVE',
                triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
                range: { id: classRowId(W, 0x69, 17), rangeKind: RANGE_KIND.SPECIAL },
                targeting: {
                  selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                  dispositionKind: TARGET_DISPOSITION_KIND.HOSTILE
                }
              }
            }),
            closedRuleEffect({
              id: classRowId(W, 0x60, 0x81),
              ruleKind: CLOSED_RULE_KIND.CLASS_WARLOCK_LIFEDRINKER,
              pathCode: PATH_CODE.ON_HIT,
              invocation: {
                kind: 'PASSIVE',
                triggerCode: TRIGGER.RANGED_WEAPON_ATTACK,
                range: { id: classRowId(W, 0x69, 0x81), rangeKind: RANGE_KIND.SPECIAL },
                targeting: {
                  selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                  dispositionKind: TARGET_DISPOSITION_KIND.HOSTILE
                }
              }
            })
          ],
          order: 16
        },
        {
          id: classRowId(W, 5, 12),
          label: 'Master of Myriad Forms',
          description: 'You can cast alter self at will, without expending a spell slot.',
          grants: {
            spells: [
              {
                id: classRowId(W, 5, 13),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.ALTER_SELF],
                attributes: [SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL, SPELL_GRANT_ATTRIBUTE.SELF_ONLY],
                order: 0
              }
            ]
          },
          // Requires warlock level 15
          restrictions: {
            id: classRowId(W, 6, 23),
            groups: [
              {
                id: classRowId(W, 6, 24),
                order: 0,
                contexts: [
                  {
                    id: classRowId(W, 6, 25),
                    order: 0,
                    subject: 'CHARACTER' as const,
                    conditions: [
                      {
                        id: classRowId(W, 6, 26),
                        order: 0,
                        kind: 'PREDICATE' as const,
                        constraint: 'INCLUDE' as const,
                        predicateCode: 'CLASS_LEVEL' as const,
                        classIds: [CLASS_IDS.WARLOCK],
                        min: 15
                      }
                    ]
                  }
                ]
              }
            ]
          },
          order: 17
        },
        {
          id: classRowId(W, 5, 14),
          label: 'Minions of Chaos',
          description:
            "You can cast conjure elemental once using a warlock spell slot. You can't do so again until you finish a long rest.",
          grants: {
            spells: [
              {
                id: classRowId(W, 5, 15),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.CONJURE_ELEMENTAL],
                attributes: [SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
                slotCost: { poolCode: 'PACT' },
                charges: {
                  id: classRowId(W, 0x51, 3),
                  limitKind: 'FIXED_AMOUNT',
                  scalingKind: SCALING.NONE,
                  resetKind: 'LONG_REST',
                  amount: 1
                },
                order: 0
              }
            ]
          },
          // Requires warlock level 9
          restrictions: {
            id: classRowId(W, 6, 27),
            groups: [
              {
                id: classRowId(W, 6, 28),
                order: 0,
                contexts: [
                  {
                    id: classRowId(W, 6, 29),
                    order: 0,
                    subject: 'CHARACTER' as const,
                    conditions: [
                      {
                        id: classRowId(W, 6, 30),
                        order: 0,
                        kind: 'PREDICATE' as const,
                        constraint: 'INCLUDE' as const,
                        predicateCode: 'CLASS_LEVEL' as const,
                        classIds: [CLASS_IDS.WARLOCK],
                        min: 9
                      }
                    ]
                  }
                ]
              }
            ]
          },
          order: 18
        },
        {
          id: classRowId(W, 5, 16),
          label: 'Mire the Mind',
          description:
            "You can cast slow once using a warlock spell slot. You can't do so again until you finish a long rest.",
          grants: {
            spells: [
              {
                id: classRowId(W, 5, 17),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.SLOW],
                attributes: [SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
                slotCost: { poolCode: 'PACT' },
                charges: {
                  id: classRowId(W, 0x51, 4),
                  limitKind: 'FIXED_AMOUNT',
                  scalingKind: SCALING.NONE,
                  resetKind: 'LONG_REST',
                  amount: 1
                },
                order: 0
              }
            ]
          },
          // Requires warlock level 5
          restrictions: {
            id: classRowId(W, 6, 31),
            groups: [
              {
                id: classRowId(W, 6, 32),
                order: 0,
                contexts: [
                  {
                    id: classRowId(W, 6, 33),
                    order: 0,
                    subject: 'CHARACTER' as const,
                    conditions: [
                      {
                        id: classRowId(W, 6, 34),
                        order: 0,
                        kind: 'PREDICATE' as const,
                        constraint: 'INCLUDE' as const,
                        predicateCode: 'CLASS_LEVEL' as const,
                        classIds: [CLASS_IDS.WARLOCK],
                        min: 5
                      }
                    ]
                  }
                ]
              }
            ]
          },
          order: 19
        },
        {
          id: classRowId(W, 5, 18),
          label: 'One with Shadows',
          description:
            'When you are in an area of dim light or darkness, you can use your action to become invisible until you move or take an action or a reaction. You activate it and the GM judges the dim light or darkness. A spell cast as a reaction ends it; other reactions do not yet.',
          // Requires warlock level 5
          restrictions: {
            id: classRowId(W, 6, 35),
            groups: [
              {
                id: classRowId(W, 6, 36),
                order: 0,
                contexts: [
                  {
                    id: classRowId(W, 6, 37),
                    order: 0,
                    subject: 'CHARACTER' as const,
                    conditions: [
                      {
                        id: classRowId(W, 6, 38),
                        order: 0,
                        kind: 'PREDICATE' as const,
                        constraint: 'INCLUDE' as const,
                        predicateCode: 'CLASS_LEVEL' as const,
                        classIds: [CLASS_IDS.WARLOCK],
                        min: 5
                      }
                    ]
                  }
                ]
              }
            ]
          },
          effects: [
            // The player activates it and the GM judges the dim light or darkness (SPELLS-31.T5n2 gates it).
            selfActionEffect({
              ids: {
                effect: classRowId(W, 0x60, 18),
                range: classRowId(W, 0x69, 18),
                path: classRowId(W, 0x80, 18),
                result: classRowId(W, 0x81, 18)
              },
              activation: ACTIVATION_CODE.ACTION,
              lifecycle: { endOnEvents: ['ON_MOVE', 'ON_TAKE_ACTION'] },
              outcome: {
                id: classRowId(W, 0x82, 18),
                effectKind: EFFECT_KIND.CONDITION,
                conditionId: conditionTypeId('INVISIBLE')
              }
            })
          ],
          order: 20
        },
        {
          id: classRowId(W, 5, 19),
          label: 'Otherworldly Leap',
          description:
            'You can cast jump on yourself at will, without expending a spell slot or material components.',
          grants: {
            spells: [
              {
                id: classRowId(W, 5, 20),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.JUMP],
                attributes: [SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL, SPELL_GRANT_ATTRIBUTE.SELF_ONLY],
                order: 0
              }
            ]
          },
          // Requires warlock level 9
          restrictions: {
            id: classRowId(W, 6, 39),
            groups: [
              {
                id: classRowId(W, 6, 40),
                order: 0,
                contexts: [
                  {
                    id: classRowId(W, 6, 41),
                    order: 0,
                    subject: 'CHARACTER' as const,
                    conditions: [
                      {
                        id: classRowId(W, 6, 42),
                        order: 0,
                        kind: 'PREDICATE' as const,
                        constraint: 'INCLUDE' as const,
                        predicateCode: 'CLASS_LEVEL' as const,
                        classIds: [CLASS_IDS.WARLOCK],
                        min: 9
                      }
                    ]
                  }
                ]
              }
            ]
          },
          order: 21
        },
        {
          id: classRowId(W, 5, 21),
          label: 'Sculptor of Flesh',
          description:
            "You can cast polymorph once using a warlock spell slot. You can't do so again until you finish a long rest.",
          grants: {
            spells: [
              {
                id: classRowId(W, 5, 22),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.POLYMORPH],
                attributes: [SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
                slotCost: { poolCode: 'PACT' },
                charges: {
                  id: classRowId(W, 0x51, 5),
                  limitKind: 'FIXED_AMOUNT',
                  scalingKind: SCALING.NONE,
                  resetKind: 'LONG_REST',
                  amount: 1
                },
                order: 0
              }
            ]
          },
          // Requires warlock level 7
          restrictions: {
            id: classRowId(W, 6, 43),
            groups: [
              {
                id: classRowId(W, 6, 44),
                order: 0,
                contexts: [
                  {
                    id: classRowId(W, 6, 45),
                    order: 0,
                    subject: 'CHARACTER' as const,
                    conditions: [
                      {
                        id: classRowId(W, 6, 46),
                        order: 0,
                        kind: 'PREDICATE' as const,
                        constraint: 'INCLUDE' as const,
                        predicateCode: 'CLASS_LEVEL' as const,
                        classIds: [CLASS_IDS.WARLOCK],
                        min: 7
                      }
                    ]
                  }
                ]
              }
            ]
          },
          order: 22
        },
        {
          id: classRowId(W, 5, 23),
          label: 'Sign of Ill Omen',
          description:
            "You can cast bestow curse once using a warlock spell slot. You can't do so again until you finish a long rest.",
          grants: {
            spells: [
              {
                id: classRowId(W, 5, 24),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.BESTOW_CURSE],
                attributes: [SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
                slotCost: { poolCode: 'PACT' },
                charges: {
                  id: classRowId(W, 0x51, 6),
                  limitKind: 'FIXED_AMOUNT',
                  scalingKind: SCALING.NONE,
                  resetKind: 'LONG_REST',
                  amount: 1
                },
                order: 0
              }
            ]
          },
          // Requires warlock level 5
          restrictions: {
            id: classRowId(W, 6, 47),
            groups: [
              {
                id: classRowId(W, 6, 48),
                order: 0,
                contexts: [
                  {
                    id: classRowId(W, 6, 49),
                    order: 0,
                    subject: 'CHARACTER' as const,
                    conditions: [
                      {
                        id: classRowId(W, 6, 50),
                        order: 0,
                        kind: 'PREDICATE' as const,
                        constraint: 'INCLUDE' as const,
                        predicateCode: 'CLASS_LEVEL' as const,
                        classIds: [CLASS_IDS.WARLOCK],
                        min: 5
                      }
                    ]
                  }
                ]
              }
            ]
          },
          order: 23
        },
        {
          id: classRowId(W, 5, 25),
          label: 'Thirsting Blade',
          description:
            'You can attack with your pact weapon twice, instead of once, whenever you take the Attack action on your turn.',
          // Requires warlock level 5 + Pact of the Blade (classRowId(W, 3, 24))
          restrictions: {
            id: classRowId(W, 6, 51),
            groups: [
              {
                id: classRowId(W, 6, 52),
                order: 0,
                contexts: [
                  {
                    id: classRowId(W, 6, 53),
                    order: 0,
                    subject: 'CHARACTER' as const,
                    conditions: [
                      {
                        id: classRowId(W, 6, 54),
                        order: 0,
                        kind: 'PREDICATE' as const,
                        constraint: 'INCLUDE' as const,
                        predicateCode: 'CLASS_LEVEL' as const,
                        classIds: [CLASS_IDS.WARLOCK],
                        min: 5
                      },
                      {
                        id: classRowId(W, 6, 55),
                        order: 1,
                        kind: 'PREDICATE' as const,
                        constraint: 'INCLUDE' as const,
                        predicateCode: 'OPTION_OBTAINED' as const,
                        optionIds: [classRowId(W, 3, 24)]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          grants: {
            modifiers: [attacksPerAttackActionGrant(classRowId(W, 0x6f, 1), 2)]
          },
          order: 24
        },
        {
          id: classRowId(W, 5, 26),
          label: 'Visions of Distant Realms',
          description: 'You can cast arcane eye at will, without expending a spell slot.',
          grants: {
            spells: [
              {
                id: classRowId(W, 5, 27),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.ARCANE_EYE],
                attributes: [SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
                order: 0
              }
            ]
          },
          // Requires warlock level 15
          restrictions: {
            id: classRowId(W, 6, 56),
            groups: [
              {
                id: classRowId(W, 6, 57),
                order: 0,
                contexts: [
                  {
                    id: classRowId(W, 6, 58),
                    order: 0,
                    subject: 'CHARACTER' as const,
                    conditions: [
                      {
                        id: classRowId(W, 6, 59),
                        order: 0,
                        kind: 'PREDICATE' as const,
                        constraint: 'INCLUDE' as const,
                        predicateCode: 'CLASS_LEVEL' as const,
                        classIds: [CLASS_IDS.WARLOCK],
                        min: 15
                      }
                    ]
                  }
                ]
              }
            ]
          },
          order: 25
        },
        {
          id: classRowId(W, 5, 28),
          label: 'Voice of the Chain Master',
          description:
            "You can communicate telepathically with your familiar and perceive through your familiar's senses as long as you are on the same plane of existence.\n\nAdditionally, while perceiving through your familiar's senses, you can also speak through your familiar in your own voice, even if your familiar is normally incapable of speech.",
          // Description-only — telepathic sense-sharing is not representable as a modifier.
          // Requires Pact of the Chain (classRowId(W, 3, 22))
          restrictions: {
            id: classRowId(W, 6, 60),
            groups: [
              {
                id: classRowId(W, 6, 61),
                order: 0,
                contexts: [
                  {
                    id: classRowId(W, 6, 62),
                    order: 0,
                    subject: 'CHARACTER' as const,
                    conditions: [
                      {
                        id: classRowId(W, 6, 63),
                        order: 0,
                        kind: 'PREDICATE' as const,
                        constraint: 'INCLUDE' as const,
                        predicateCode: 'OPTION_OBTAINED' as const,
                        optionIds: [classRowId(W, 3, 22)]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          effects: [selfClassRuleEffect(21, CLOSED_RULE_KIND.CLASS_WARLOCK_VOICE_OF_CHAIN_MASTER)],
          order: 26
        },
        {
          id: classRowId(W, 5, 29),
          label: 'Whispers of the Grave',
          description: 'You can cast speak with dead at will, without expending a spell slot.',
          grants: {
            spells: [
              {
                id: classRowId(W, 5, 30),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.SPEAK_WITH_DEAD],
                attributes: [SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
                order: 0
              }
            ]
          },
          // Requires warlock level 9
          restrictions: {
            id: classRowId(W, 6, 64),
            groups: [
              {
                id: classRowId(W, 6, 65),
                order: 0,
                contexts: [
                  {
                    id: classRowId(W, 6, 66),
                    order: 0,
                    subject: 'CHARACTER' as const,
                    conditions: [
                      {
                        id: classRowId(W, 6, 67),
                        order: 0,
                        kind: 'PREDICATE' as const,
                        constraint: 'INCLUDE' as const,
                        predicateCode: 'CLASS_LEVEL' as const,
                        classIds: [CLASS_IDS.WARLOCK],
                        min: 9
                      }
                    ]
                  }
                ]
              }
            ]
          },
          order: 27
        },
        {
          id: classRowId(W, 5, 31),
          label: 'Witch Sight',
          description:
            'You can see the true form of any shapechanger or creature concealed by illusion or transmutation magic while the creature is within 30 feet of you and within line of sight.',
          // Passive sense — description-only (GM ruling, D187a).
          // Requires warlock level 15
          restrictions: {
            id: classRowId(W, 6, 68),
            groups: [
              {
                id: classRowId(W, 6, 69),
                order: 0,
                contexts: [
                  {
                    id: classRowId(W, 6, 70),
                    order: 0,
                    subject: 'CHARACTER' as const,
                    conditions: [
                      {
                        id: classRowId(W, 6, 71),
                        order: 0,
                        kind: 'PREDICATE' as const,
                        constraint: 'INCLUDE' as const,
                        predicateCode: 'CLASS_LEVEL' as const,
                        classIds: [CLASS_IDS.WARLOCK],
                        min: 15
                      }
                    ]
                  }
                ]
              }
            ]
          },
          order: 28
        }
      ]
    },
    // L3 — Pact Boon
    {
      id: classRowId(W, 3, 21),
      label: 'Pact Boon',
      description:
        'At 3rd level, your otherworldly patron bestows a gift upon you for your loyal service. You gain one of the following features of your choice.',
      availableAtLevel: 3,
      order: 3,
      optionChoices: [{ level: 3, count: 1 }],
      options: [
        {
          id: classRowId(W, 3, 22),
          label: 'Pact of the Chain',
          description:
            "You learn the find familiar spell and can cast it as a ritual. The spell doesn't count against your number of spells known.\n\nWhen you cast the spell, you can choose one of the normal forms for your familiar or one of the following special forms: imp, pseudodragon, quasit, or sprite.\n\nAdditionally, when you take the Attack action, you can forgo one of your own attacks to allow your familiar to make one attack of its own with its reaction.",
          grants: {
            spells: [
              {
                id: classRowId(W, 3, 23),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.FIND_FAMILIAR],
                attributes: [SPELL_GRANT_ATTRIBUTE.KNOWN, SPELL_GRANT_ATTRIBUTE.RITUAL],
                order: 0
              }
            ]
          },
          effects: [selfClassRuleEffect(23, CLOSED_RULE_KIND.CLASS_WARLOCK_PACT_OF_CHAIN)],
          order: 0
        },
        {
          id: classRowId(W, 3, 24),
          label: 'Pact of the Blade',
          description:
            "You can use your action to create a pact weapon in your empty hand. You can choose the form that this melee weapon takes each time you create it. You are proficient with it while you wield it. This weapon counts as magical for the purpose of overcoming resistance and immunity to nonmagical attacks and damage.\n\nYour pact weapon disappears if it is more than 5 feet away from you for 1 minute or more. It also disappears if you use this feature again, if you dismiss the weapon (no action required), or if you die.\n\nYou can transform one magic weapon into your pact weapon by performing a special ritual while you hold the weapon. You perform the ritual over the course of 1 hour, which can be done during a short rest. You can then dismiss the weapon, shunting it into an extradimensional space, and it appears whenever you create your pact weapon thereafter. You can't affect an artifact or a sentient weapon in this way. The weapon ceases being your pact weapon if you die, if you perform the 1-hour ritual on a different weapon, or if you use a 1-hour ritual to break your bond to it. The weapon appears at your feet if it is in the extradimensional space when the bond breaks.",
          effects: [
            selfClassRuleEffect(
              24,
              CLOSED_RULE_KIND.CLASS_WARLOCK_PACT_OF_BLADE,
              ACTIVATION_CODE.ACTION
            )
          ],
          order: 1
        },
        {
          id: classRowId(W, 3, 25),
          label: 'Pact of the Tome',
          description:
            "Your patron gives you a grimoire called a Book of Shadows. When you gain this feature, choose three cantrips from any class's spell list (the three needn't be from the same list). While the book is on your person, you can cast those cantrips at will. They don't count against your number of cantrips known. If they don't appear on the warlock spell list, they are nonetheless warlock spells for you.\n\nIf you lose your Book of Shadows, you can perform a 1-hour ceremony to receive a replacement from your patron. This ceremony can be performed during a short or long rest, and it destroys the previous book. The book turns to ash when you die.",
          grants: {
            spells: [
              {
                id: classRowId(W, 3, 55),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                count: 3,
                selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: allCantripIds,
                attributes: [SPELL_GRANT_ATTRIBUTE.KNOWN, SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
                order: 0
              }
            ]
          },
          order: 2
        }
      ]
    },
    // L4 — Ability Score Improvement
    {
      id: classRowId(W, 3, 26),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 4,
      order: 4,
      optionChoices: [{ level: 4, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(W, 0x20, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(40, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    // L5 — (no new feature — spell slot upgrade covered by spellLimits)
    // L6 — Otherworldly Patron Feature
    {
      id: classRowId(W, 3, 27),
      label: 'Otherworldly Patron Feature (6th)',
      description:
        'At 1st level, you have struck a bargain with an otherworldly being of your choice: the Archfey, the Fiend, or the Great Old One, each of which is detailed at the end of the class description. Your choice grants you features at 1st level and again at 6th, 10th, and 14th level.',
      availableAtLevel: 6,
      order: 5
    },
    // L7 — (no new feature)
    // L8 — Ability Score Improvement
    {
      id: classRowId(W, 3, 28),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 8,
      order: 6,
      optionChoices: [{ level: 8, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(W, 0x21, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(41, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    // L9 — (no new feature)
    // L10 — Otherworldly Patron Feature + Mystic Arcanum (6th level)
    {
      id: classRowId(W, 3, 29),
      label: 'Otherworldly Patron Feature (10th)',
      description:
        'At 1st level, you have struck a bargain with an otherworldly being of your choice: the Archfey, the Fiend, or the Great Old One, each of which is detailed at the end of the class description. Your choice grants you features at 1st level and again at 6th, 10th, and 14th level.',
      availableAtLevel: 10,
      order: 7
    },
    {
      id: classRowId(W, 3, 30),
      label: 'Mystic Arcanum (6th Level)',
      description:
        'At 11th level, your patron bestows upon you a magical secret called an arcanum. Choose one 6th-level spell from the warlock spell list as this arcanum.\n\nYou can cast your arcanum spell once without expending a spell slot. You must finish a long rest before you can do so again.\n\nAt higher levels, you gain more warlock spells of your choice that can be cast in this way: one 7th-level spell at 13th level, one 8th-level spell at 15th level, and one 9th-level spell at 17th level. You regain all uses of your Mystic Arcanum when you finish a long rest.',
      grants: {
        spells: [
          {
            id: classRowId(W, 0x53, 1),
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            count: 1,
            selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            spellIds: warlockSpellIdsAtLevel(6),
            attributes: [SPELL_GRANT_ATTRIBUTE.LIMITED_USE, SPELL_GRANT_ATTRIBUTE.CAST_AT_LEVEL],
            castAtLevel: 6,
            charges: {
              id: classRowId(W, 0x53, 2),
              limitKind: 'FIXED_AMOUNT',
              scalingKind: SCALING.NONE,
              resetKind: 'LONG_REST',
              amount: 1
            },
            order: 0
          }
        ]
      },
      availableAtLevel: 11,
      order: 8
    },
    {
      id: classRowId(W, 3, 31),
      label: 'Mystic Arcanum (7th Level)',
      description:
        'At 11th level, your patron bestows upon you a magical secret called an arcanum. Choose one 6th-level spell from the warlock spell list as this arcanum.\n\nYou can cast your arcanum spell once without expending a spell slot. You must finish a long rest before you can do so again.\n\nAt higher levels, you gain more warlock spells of your choice that can be cast in this way: one 7th-level spell at 13th level, one 8th-level spell at 15th level, and one 9th-level spell at 17th level. You regain all uses of your Mystic Arcanum when you finish a long rest.',
      grants: {
        spells: [
          {
            id: classRowId(W, 0x53, 3),
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            count: 1,
            selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            spellIds: warlockSpellIdsAtLevel(7),
            attributes: [SPELL_GRANT_ATTRIBUTE.LIMITED_USE, SPELL_GRANT_ATTRIBUTE.CAST_AT_LEVEL],
            castAtLevel: 7,
            charges: {
              id: classRowId(W, 0x53, 4),
              limitKind: 'FIXED_AMOUNT',
              scalingKind: SCALING.NONE,
              resetKind: 'LONG_REST',
              amount: 1
            },
            order: 0
          }
        ]
      },
      availableAtLevel: 13,
      order: 9
    },
    {
      id: classRowId(W, 3, 38),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 12,
      order: 10,
      optionChoices: [{ level: 12, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(W, 0x22, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(42, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(W, 3, 32),
      label: 'Otherworldly Patron Feature (14th)',
      description:
        'At 1st level, you have struck a bargain with an otherworldly being of your choice: the Archfey, the Fiend, or the Great Old One, each of which is detailed at the end of the class description. Your choice grants you features at 1st level and again at 6th, 10th, and 14th level.',
      availableAtLevel: 14,
      order: 11
    },
    {
      id: classRowId(W, 3, 33),
      label: 'Mystic Arcanum (8th Level)',
      description:
        'At 11th level, your patron bestows upon you a magical secret called an arcanum. Choose one 6th-level spell from the warlock spell list as this arcanum.\n\nYou can cast your arcanum spell once without expending a spell slot. You must finish a long rest before you can do so again.\n\nAt higher levels, you gain more warlock spells of your choice that can be cast in this way: one 7th-level spell at 13th level, one 8th-level spell at 15th level, and one 9th-level spell at 17th level. You regain all uses of your Mystic Arcanum when you finish a long rest.',
      grants: {
        spells: [
          {
            id: classRowId(W, 0x53, 5),
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            count: 1,
            selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            spellIds: warlockSpellIdsAtLevel(8),
            attributes: [SPELL_GRANT_ATTRIBUTE.LIMITED_USE, SPELL_GRANT_ATTRIBUTE.CAST_AT_LEVEL],
            castAtLevel: 8,
            charges: {
              id: classRowId(W, 0x53, 6),
              limitKind: 'FIXED_AMOUNT',
              scalingKind: SCALING.NONE,
              resetKind: 'LONG_REST',
              amount: 1
            },
            order: 0
          }
        ]
      },
      availableAtLevel: 15,
      order: 12
    },
    // L16 — Ability Score Improvement
    {
      id: classRowId(W, 3, 34),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 16,
      order: 13,
      optionChoices: [{ level: 16, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(W, 0x23, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(43, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(W, 3, 35),
      label: 'Mystic Arcanum (9th Level)',
      description:
        'At 11th level, your patron bestows upon you a magical secret called an arcanum. Choose one 6th-level spell from the warlock spell list as this arcanum.\n\nYou can cast your arcanum spell once without expending a spell slot. You must finish a long rest before you can do so again.\n\nAt higher levels, you gain more warlock spells of your choice that can be cast in this way: one 7th-level spell at 13th level, one 8th-level spell at 15th level, and one 9th-level spell at 17th level. You regain all uses of your Mystic Arcanum when you finish a long rest.',
      grants: {
        spells: [
          {
            id: classRowId(W, 0x53, 7),
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            count: 1,
            selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            spellIds: warlockSpellIdsAtLevel(9),
            attributes: [SPELL_GRANT_ATTRIBUTE.LIMITED_USE, SPELL_GRANT_ATTRIBUTE.CAST_AT_LEVEL],
            castAtLevel: 9,
            charges: {
              id: classRowId(W, 0x53, 8),
              limitKind: 'FIXED_AMOUNT',
              scalingKind: SCALING.NONE,
              resetKind: 'LONG_REST',
              amount: 1
            },
            order: 0
          }
        ]
      },
      availableAtLevel: 17,
      order: 14
    },
    // L19 — Ability Score Improvement
    {
      id: classRowId(W, 3, 36),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 19,
      order: 15,
      optionChoices: [{ level: 19, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(W, 0x24, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(44, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    // L20 — Eldritch Master
    {
      id: classRowId(W, 3, 37),
      label: 'Eldritch Master',
      description:
        'At 20th level, you can draw on your inner reserve of mystical power while entreating your patron to regain expended spell slots. You can spend 1 minute entreating your patron for aid to regain all your expended spell slots from your Pact Magic feature. Once you regain spell slots with this feature, you must finish a long rest before you can do so again.',
      effects: [selfClassRuleEffect(37, CLOSED_RULE_KIND.CLASS_WARLOCK_ELDRITCH_MASTER)],
      availableAtLevel: 20,
      order: 16
    }
  ]
}

// ─── Warlock Subclasses ───────────────────────────────────────────────────────
