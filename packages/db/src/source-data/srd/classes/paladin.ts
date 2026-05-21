import {
  ABILITY_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  CLASS_ATTRIBUTE,
  CLASS_CATEGORY,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PROFICIENCY_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  SPELLCASTING_ATTRIBUTE,
  VALUE_DOMAIN_CODE,
  type ClassAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS } from '../ids.js'
import { classSpellcastingDetails } from './spellcasting-details.js'
import {
  SRD_CURRENCIES,
  SRD_SKILLS,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from '../vocabulary.js'

function skillId(code: string): string {
  const entry = SRD_SKILLS.find((s) => s.code === code)
  if (!entry) throw new Error(`SRD skill vocabulary entry for ${code} required.`)
  return entry.id
}

const goldCurrencyId = SRD_CURRENCIES.find((c) => c.code === 'GP')?.id
if (!goldCurrencyId) throw new Error('SRD GP currency required.')

function classRowId(classIndex: number, group: number, entry: number): string {
  const xx = classIndex.toString(16).padStart(2, '0')
  const gg = group.toString(16).padStart(2, '0')
  const nn = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-c0${xx}-${gg}${nn}00000000`
}

const P = 7 // Paladin class index

// Paladin spell slot charge — half caster (starts L2), resets on long rest
const paladinSlotCharge = {
  id: classRowId(P, 1, 1),
  limitKind: 'FIXED_AMOUNT' as const,
  scalingKind: SCALING.PER_LEVEL,
  resetKind: 'LONG_REST' as const,
  levels: [
    { id: classRowId(P, 1, 2), level: 2, amount: 2 },
    { id: classRowId(P, 1, 3), level: 3, amount: 3 },
    { id: classRowId(P, 1, 4), level: 4, amount: 3 },
    { id: classRowId(P, 1, 5), level: 5, amount: 4 },
    { id: classRowId(P, 1, 6), level: 6, amount: 4 },
    { id: classRowId(P, 1, 7), level: 7, amount: 4 },
    { id: classRowId(P, 1, 8), level: 8, amount: 4 },
    { id: classRowId(P, 1, 9), level: 9, amount: 4 },
    { id: classRowId(P, 1, 10), level: 10, amount: 4 },
    { id: classRowId(P, 1, 11), level: 11, amount: 5 },
    { id: classRowId(P, 1, 12), level: 12, amount: 5 },
    { id: classRowId(P, 1, 13), level: 13, amount: 5 },
    { id: classRowId(P, 1, 14), level: 14, amount: 5 },
    { id: classRowId(P, 1, 15), level: 15, amount: 5 },
    { id: classRowId(P, 1, 16), level: 16, amount: 5 },
    { id: classRowId(P, 1, 17), level: 17, amount: 5 },
    { id: classRowId(P, 1, 18), level: 18, amount: 5 },
    { id: classRowId(P, 1, 19), level: 19, amount: 5 },
    { id: classRowId(P, 1, 20), level: 20, amount: 5 }
  ]
}

const paladinSpellLimits = [
  { classLevel: 2, slots: [{ spellLevel: 1, slotCount: 2 }] },
  { classLevel: 3, slots: [{ spellLevel: 1, slotCount: 3 }] },
  { classLevel: 4, slots: [{ spellLevel: 1, slotCount: 3 }] },
  { classLevel: 5, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 2 }] },
  { classLevel: 6, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 2 }] },
  { classLevel: 7, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }] },
  { classLevel: 8, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }] },
  { classLevel: 9, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 2 }] },
  { classLevel: 10, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 2 }] },
  { classLevel: 11, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }] },
  { classLevel: 12, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }] },
  { classLevel: 13, slots: [
    { spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 1 }
  ] },
  { classLevel: 14, slots: [
    { spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 1 }
  ] },
  { classLevel: 15, slots: [
    { spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 2 }
  ] },
  { classLevel: 16, slots: [
    { spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 2 }
  ] },
  { classLevel: 17, slots: [
    { spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 1 }
  ] },
  { classLevel: 18, slots: [
    { spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 1 }
  ] },
  { classLevel: 19, slots: [
    { spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }
  ] },
  { classLevel: 20, slots: [
    { spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }
  ] }
]

export const paladin: ClassAuthored = {
  id: CLASS_IDS.PALADIN,
  label: 'Paladin',
  category: CLASS_CATEGORY.BASE,
  attributes: [CLASS_ATTRIBUTE.SPELLCASTER],
  description: 'A holy warrior bound to a sacred oath.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,

  hitpoint: {
    ability: ABILITY_CODE.CONSTITUTION,
    dieConfig: 'd10'
  },

  startingGold: {
    multiplier: 10,
    currencyId: goldCurrencyId,
    dieConfig: '5d4'
  },

  multiclass: {
    id: classRowId(P, 99, 1),
    requirementGroups: {
      groups: [
        {
          id: classRowId(P, 99, 2),
          requirements: [
            { id: classRowId(P, 99, 3), ability: ABILITY_CODE.STRENGTH, min: 13 },
            { id: classRowId(P, 99, 4), ability: ABILITY_CODE.CHARISMA, min: 13 }
          ]
        }
      ]
    },
    proficiencies: [
      {
        id: classRowId(P, 99, 5),
        grantKind: GRANT_KIND.PROFICIENCY_GRANT,
        proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
        level: SCALING_AMOUNT_KIND.FULL,
        selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
        scalingKind: SCALING.NONE,
        authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
        properties: ['LIGHT', 'MEDIUM'],
        category: 'ARMOR',
        order: 0
      }
    ]
  },

  startingEquipment: {
    id: classRowId(P, 98, 1),
    sets: []
  },

  spellcasting: {
    ability: ABILITY_CODE.CHARISMA,
    maxSpellLevel: 5,
    attributes: [SPELLCASTING_ATTRIBUTE.PREPARES_SPELLS],
    details: classSpellcastingDetails(P, [
      {
        label: 'Spellcasting',
        description: '<p>By 2nd level, you have learned to draw on divine magic through meditation and prayer to cast spells as a cleric does.</p>'
      },
      {
        label: 'Preparing and Casting Spells',
        description: '<p>The Paladin table shows how many spell slots you have to cast your spells. To cast one of your paladin spells of 1st level or higher, you must expend a slot of the spell\'s level or higher. You regain all expended spell slots when you finish a long rest.</p><p>You prepare the list of paladin spells that are available for you to cast, choosing from the paladin spell list. When you do so, choose a number of paladin spells equal to your Charisma modifier + half your paladin level, rounded down (minimum of one spell). The spells must be of a level for which you have spell slots.</p><p>For example, if you are a 5th-level paladin, you have four 1st-level and two 2nd-level spell slots. With a Charisma of 14, your list of prepared spells can include four spells of 1st or 2nd level, in any combination. If you prepare the 1st-level spell <em>cure wounds</em>, you can cast it using a 1st-level or a 2nd-level slot. Casting the spell doesn\'t remove it from your list of prepared spells.</p><p>You can change your list of prepared spells when you finish a long rest. Preparing a new list of paladin spells requires time spent in prayer and meditation: at least 1 minute per spell level for each spell on your list.</p>'
      },
      {
        label: 'Spellcasting Ability',
        description: '<p>Charisma is your spellcasting ability for your paladin spells, since their power derives from the strength of your convictions. You use your Charisma whenever a spell refers to your spellcasting ability. In addition, you use your Charisma modifier when setting the saving throw DC for a paladin spell you cast and when making an attack roll with one.</p><p><strong>Spell save DC</strong> = 8 + your proficiency bonus + your Charisma modifier</p><p><strong>Spell attack modifier</strong> = your proficiency bonus + your Charisma modifier</p>'
      },
      {
        label: 'Spellcasting Focus',
        description: '<p>You can use a holy symbol as a spellcasting focus for your paladin spells.</p>'
      }
    ]),
    charges: paladinSlotCharge,
    spellLimits: paladinSpellLimits
  },

  proficiencies: [
    // All armor
    {
      id: classRowId(P, 2, 1),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      properties: ['LIGHT', 'MEDIUM', 'HEAVY'],
      category: 'ARMOR',
      order: 0
    },
    // Shields
    {
      id: classRowId(P, 2, 2),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.ALL,
      category: 'SHIELD',
      order: 1
    },
    // Simple weapons
    {
      id: classRowId(P, 2, 3),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      properties: ['SIMPLE'],
      category: 'WEAPON',
      order: 2
    },
    // Martial weapons
    {
      id: classRowId(P, 2, 4),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      properties: ['MARTIAL'],
      category: 'WEAPON',
      order: 3
    },
    // Saving throws: WIS, CHA
    {
      id: classRowId(P, 2, 5),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SAVE_ABILITY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      abilities: [ABILITY_CODE.WISDOM, ABILITY_CODE.CHARISMA],
      order: 4
    },
    // Skills: choose 2 from Athletics, Insight, Intimidation, Medicine, Persuasion, Religion
    {
      id: classRowId(P, 2, 6),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SKILL,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      scalingKind: SCALING.NONE,
      count: 2,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      skillIds: [
        skillId('ATHLETICS'),
        skillId('INSIGHT'),
        skillId('INTIMIDATION'),
        skillId('MEDICINE'),
        skillId('PERSUASION'),
        skillId('RELIGION')
      ],
      order: 5
    }
  ],

  features: [
    {
      id: classRowId(P, 3, 1),
      label: 'Divine Sense',
      description: 'The presence of strong evil registers on your senses like a noxious odor, and powerful good rings like heavenly music in your ears. As an action, you open your awareness to detect such forces.',
      availableAtLevel: 1,
      order: 0
    },
    {
      id: classRowId(P, 3, 2),
      label: 'Lay on Hands',
      description: 'Your blessed touch can heal wounds. You have a pool of healing power that replenishes when you take a long rest. With that pool, you can restore a total number of hit points equal to your paladin level × 5.',
      availableAtLevel: 1,
      order: 1
    },
    {
      id: classRowId(P, 3, 3),
      label: 'Fighting Style',
      description: 'At 2nd level, you adopt a style of fighting as your specialty. Choose one of the following options.',
      availableAtLevel: 2,
      order: 2,
      optionChoices: [{ level: 2, count: 1 }],
      options: [
        {
          id: classRowId(P, 4, 1),
          label: 'Defense',
          description: 'While you are wearing armor, you gain a +1 bonus to AC.',
          grants: {
            modifiers: [
              {
                id: classRowId(P, 4, 10),
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: VALUE_DOMAIN_CODE.ARMOR_CLASS,
                domain: {},
                modifierKind: MODIFIER_KIND.BONUS,
                scope: MODIFIER_SCOPE_KIND.SOURCE,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                payload: { valueKind: 'FIXED' as const, amount: 1 },
                order: 0
              }
            ]
          },
          order: 0
        },
        {
          id: classRowId(P, 4, 2),
          label: 'Dueling',
          description: 'When you are wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.',
          grants: {
            modifiers: [
              {
                id: classRowId(P, 4, 11),
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
                domain: { attackDomain: 'MELEE' as const },
                modifierKind: MODIFIER_KIND.BONUS,
                scope: MODIFIER_SCOPE_KIND.SOURCE,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                payload: { valueKind: 'FIXED' as const, amount: 2 },
                order: 0
              }
            ]
          },
          order: 1
        },
        {
          id: classRowId(P, 4, 3),
          label: 'Great Weapon Fighting',
          description: 'When you roll a 1 or 2 on a damage die for an attack you make with a melee weapon that you are wielding with two hands, you can reroll the die and must use the new roll.',
          order: 2
        },
        {
          id: classRowId(P, 4, 4),
          label: 'Protection',
          description: 'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll. You must be wielding a shield.',
          order: 3
        }
      ]
    },
    {
      id: classRowId(P, 3, 4),
      label: 'Spellcasting',
      description: 'By 2nd level, you have learned to draw on divine magic through meditation and prayer to cast spells as a cleric does.',
      availableAtLevel: 2,
      order: 3
    },
    {
      id: classRowId(P, 3, 5),
      label: 'Divine Smite',
      description: 'Starting at 2nd level, when you hit a creature with a melee weapon attack, you can expend one spell slot to deal radiant damage to the target, in addition to the weapon\'s damage.',
      availableAtLevel: 2,
      order: 4
    },
    {
      id: classRowId(P, 3, 6),
      label: 'Divine Health',
      description: 'By 3rd level, the divine magic flowing through you makes you immune to disease.',
      availableAtLevel: 3,
      order: 5
    },
    {
      id: classRowId(P, 3, 7),
      label: 'Sacred Oath',
      description: 'When you reach 3rd level, you swear the oath that binds you as a paladin forever.',
      availableAtLevel: 3,
      order: 6
    },
    {
      id: classRowId(P, 3, 8),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 4,
      order: 7
    },
    {
      id: classRowId(P, 3, 9),
      label: 'Extra Attack',
      description: 'Beginning at 5th level, you can attack twice, instead of once, whenever you take the Attack action on your turn.',
      availableAtLevel: 5,
      order: 8
    },
    {
      id: classRowId(P, 3, 10),
      label: 'Aura of Protection',
      description: 'Starting at 6th level, whenever you or a friendly creature within 10 feet of you must make a saving throw, the creature gains a bonus to the saving throw equal to your Charisma modifier (with a minimum bonus of +1).',
      availableAtLevel: 6,
      order: 9
    },
    {
      id: classRowId(P, 3, 11),
      label: 'Sacred Oath Feature',
      description: 'At 7th level, you gain a feature from your Sacred Oath.',
      availableAtLevel: 7,
      order: 10
    },
    {
      id: classRowId(P, 3, 12),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 8,
      order: 11
    },
    {
      id: classRowId(P, 3, 13),
      label: 'Aura of Courage',
      description: 'Starting at 10th level, you and friendly creatures within 10 feet of you can\'t be frightened while you are conscious.',
      availableAtLevel: 10,
      order: 12
    },
    {
      id: classRowId(P, 3, 14),
      label: 'Improved Divine Smite',
      description: 'By 11th level, you are so suffused with righteous might that all your melee weapon strikes carry divine power with them. Whenever you hit a creature with a melee weapon, the creature takes an extra 1d8 radiant damage.',
      availableAtLevel: 11,
      order: 13
    },
    {
      id: classRowId(P, 3, 15),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 12,
      order: 14
    },
    {
      id: classRowId(P, 3, 16),
      label: 'Cleansing Touch',
      description: 'Beginning at 14th level, you can use your action to end one spell on yourself or on one willing creature that you touch.',
      availableAtLevel: 14,
      order: 15
    },
    {
      id: classRowId(P, 3, 17),
      label: 'Sacred Oath Feature',
      description: 'At 15th level, you gain a feature from your Sacred Oath.',
      availableAtLevel: 15,
      order: 16
    },
    {
      id: classRowId(P, 3, 18),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 16,
      order: 17
    },
    {
      id: classRowId(P, 3, 19),
      label: 'Sacred Oath Feature',
      description: 'At 20th level, you gain a feature from your Sacred Oath.',
      availableAtLevel: 20,
      order: 18
    },
    {
      id: classRowId(P, 3, 20),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 19,
      order: 19
    }
  ]
}
