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
  SPELL_GRANT_ATTRIBUTE,
  VALUE_DOMAIN_CODE,
  type ClassAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SUBCLASS_IDS, SPELL_IDS } from '../ids.js'
import { srdSpells } from '../spells/index.js'
import {
  SRD_CURRENCIES,
  SRD_SKILLS,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from '../vocabulary.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function skillId(code: string): string {
  const entry = SRD_SKILLS.find((s) => s.code === code)
  if (!entry) throw new Error(`SRD skill vocabulary entry for ${code} required for class source data.`)
  return entry.id
}

const goldCurrencyId = SRD_CURRENCIES.find((c) => c.code === 'GP')?.id
if (!goldCurrencyId) throw new Error('SRD GP currency vocabulary entry required for class source data.')

const allCantripIds = srdSpells
  .filter((spell) => spell.level === 0)
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

// ─── Warlock (index 11) ───────────────────────────────────────────────────────

const W = 11 // warlock class index for ID generation

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
    { id: classRowId(W, 1, 6), level: 5, amount: 3 },
    { id: classRowId(W, 1, 7), level: 6, amount: 3 },
    { id: classRowId(W, 1, 8), level: 7, amount: 4 },
    { id: classRowId(W, 1, 9), level: 8, amount: 4 },
    { id: classRowId(W, 1, 10), level: 9, amount: 4 },
    { id: classRowId(W, 1, 11), level: 10, amount: 4 },
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
  { classLevel: 1, slots: [{ spellLevel: 1, slotCount: 1 }], learnedSpellsLimit: 2, cantripsLimit: 2 },
  { classLevel: 2, slots: [{ spellLevel: 1, slotCount: 2 }], learnedSpellsLimit: 3, cantripsLimit: 2 },
  { classLevel: 3, slots: [{ spellLevel: 2, slotCount: 2 }], learnedSpellsLimit: 4, cantripsLimit: 2 },
  { classLevel: 4, slots: [{ spellLevel: 2, slotCount: 2 }], learnedSpellsLimit: 5, cantripsLimit: 3 },
  { classLevel: 5, slots: [{ spellLevel: 3, slotCount: 3 }], learnedSpellsLimit: 6, cantripsLimit: 3 },
  { classLevel: 6, slots: [{ spellLevel: 3, slotCount: 3 }], learnedSpellsLimit: 7, cantripsLimit: 3 },
  { classLevel: 7, slots: [{ spellLevel: 4, slotCount: 4 }], learnedSpellsLimit: 8, cantripsLimit: 3 },
  { classLevel: 8, slots: [{ spellLevel: 4, slotCount: 4 }], learnedSpellsLimit: 9, cantripsLimit: 3 },
  { classLevel: 9, slots: [{ spellLevel: 5, slotCount: 4 }], learnedSpellsLimit: 10, cantripsLimit: 3 },
  { classLevel: 10, slots: [{ spellLevel: 5, slotCount: 4 }], learnedSpellsLimit: 10, cantripsLimit: 4 },
  { classLevel: 11, slots: [{ spellLevel: 5, slotCount: 3 }], learnedSpellsLimit: 11, cantripsLimit: 4 },
  { classLevel: 12, slots: [{ spellLevel: 5, slotCount: 3 }], learnedSpellsLimit: 11, cantripsLimit: 4 },
  { classLevel: 13, slots: [{ spellLevel: 5, slotCount: 3 }], learnedSpellsLimit: 12, cantripsLimit: 4 },
  { classLevel: 14, slots: [{ spellLevel: 5, slotCount: 3 }], learnedSpellsLimit: 12, cantripsLimit: 4 },
  { classLevel: 15, slots: [{ spellLevel: 5, slotCount: 3 }], learnedSpellsLimit: 13, cantripsLimit: 4 },
  { classLevel: 16, slots: [{ spellLevel: 5, slotCount: 3 }], learnedSpellsLimit: 13, cantripsLimit: 4 },
  { classLevel: 17, slots: [{ spellLevel: 5, slotCount: 4 }], learnedSpellsLimit: 14, cantripsLimit: 4 },
  { classLevel: 18, slots: [{ spellLevel: 5, slotCount: 4 }], learnedSpellsLimit: 14, cantripsLimit: 4 },
  { classLevel: 19, slots: [{ spellLevel: 5, slotCount: 4 }], learnedSpellsLimit: 15, cantripsLimit: 4 },
  { classLevel: 20, slots: [{ spellLevel: 5, slotCount: 4 }], learnedSpellsLimit: 15, cantripsLimit: 4 }
]

export const warlock: ClassAuthored = {
  id: CLASS_IDS.WARLOCK,
  label: 'Warlock',
  category: CLASS_CATEGORY.BASE,
  description: 'A wielder of magic that is derived from a bargain with an extraplanar entity. Warlocks are defined by a pact with an otherworldly being.',
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
        proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
        level: SCALING_AMOUNT_KIND.FULL,
        selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
        scalingKind: SCALING.NONE,
        authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
        equipmentIds: [],
        order: 0
      }
    ]
  },

  // ── Starting equipment (simplified — full starting equipment uses StartingEquipmentAuthored) ──
  startingEquipment: {
    id: classRowId(W, 98, 1),
    sets: []
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
    ability: ABILITY_CODE.CHARISMA,
    maxSpellLevel: 5,
    magicName: 'Pact Magic',
    attributes: [SPELLCASTING_ATTRIBUTE.LIMIT_KNOWN_SPELL_AMOUNT],
    charges: pactMagicCharge,
    spellLimits: warlockSpellLimits
  },

  // ── Class features (L1–20) ────────────────────────────────────────────────────
  features: [
    // L1 — Otherworldly Patron
    {
      id: classRowId(W, 3, 1),
      label: 'Otherworldly Patron',
      description: 'At 1st level, you have struck a bargain with an otherworldly being of your choice. Your choice grants you features at 1st level and again at 6th, 10th, and 14th level.',
      availableAtLevel: 1,
      order: 0
    },
    // L1 — Pact Magic
    {
      id: classRowId(W, 3, 2),
      label: 'Pact Magic',
      description: 'Your arcane research and the magic bestowed on you by your patron have given you facility with spells. You regain all expended spell slots when you finish a short or long rest.',
      availableAtLevel: 1,
      order: 1
    },
    // L2 — Eldritch Invocations
    {
      id: classRowId(W, 3, 3),
      label: 'Eldritch Invocations',
      description: 'In your study of occult lore, you have unearthed eldritch invocations, fragments of forbidden knowledge that imbue you with an abiding magical ability.',
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
          description: 'When you cast Eldritch Blast, add your Charisma modifier to the damage it deals on a hit.',
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
                modifierKind: MODIFIER_KIND.BONUS,
                scope: MODIFIER_SCOPE_KIND.SOURCE,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                payload: { valueKind: 'ABILITY_MODIFIER' as const, ability: ABILITY_CODE.CHARISMA },
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
          description: 'You can cast Mage Armor on yourself at will, without expending a spell slot or material components.',
          grants: {
            spells: [
              {
                id: classRowId(W, 3, 7),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.MAGE_ARMOR],
                order: 0
              }
            ]
          },
          order: 1
        },
        {
          id: classRowId(W, 3, 8),
          label: 'Devil\'s Sight',
          description: 'You can see normally in darkness, both magical and nonmagical, to a distance of 120 feet.',
          order: 2
        },
        {
          id: classRowId(W, 3, 9),
          label: 'Eldritch Sight',
          description: 'You can cast Detect Magic at will, without expending a spell slot.',
          grants: {
            spells: [
              {
                id: classRowId(W, 3, 10),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.DETECT_MAGIC],
                order: 0
              }
            ]
          },
          order: 3
        },
        {
          id: classRowId(W, 3, 11),
          label: 'Fiendish Vigor',
          description: 'You can cast False Life on yourself at will as a 1st-level spell, without expending a spell slot or material components.',
          grants: {
            spells: [
              {
                id: classRowId(W, 3, 12),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.FALSE_LIFE],
                order: 0
              }
            ]
          },
          order: 4
        },
        {
          id: classRowId(W, 3, 13),
          label: 'Mask of Many Faces',
          description: 'You can cast Disguise Self at will, without expending a spell slot.',
          grants: {
            spells: [
              {
                id: classRowId(W, 3, 14),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.DISGUISE_SELF],
                order: 0
              }
            ]
          },
          order: 5
        },
        {
          id: classRowId(W, 3, 15),
          label: 'Misty Visions',
          description: 'You can cast Silent Image at will, without expending a spell slot or material components.',
          grants: {
            spells: [
              {
                id: classRowId(W, 3, 16),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.SILENT_IMAGE],
                order: 0
              }
            ]
          },
          order: 6
        },
        {
          id: classRowId(W, 3, 17),
          label: 'Repelling Blast',
          description: 'When you hit a creature with Eldritch Blast, you can push the creature up to 10 feet away from you in a straight line.',
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
          order: 7
        },
        {
          id: classRowId(W, 3, 19),
          label: 'Thief of Five Fates',
          description: 'You can cast Bane once using a warlock spell slot. You can\'t do so again until you finish a long rest.',
          grants: {
            spells: [
              {
                id: classRowId(W, 3, 20),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.BANE],
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
          description: 'You can now inscribe magical rituals in your Book of Shadows. On your adventures, you can add other ritual spells to your Book of Shadows.',
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
          description: 'You can cast Hold Monster at will—targeting a celestial, fiend, or elemental—without expending a spell slot or material components. You must finish a long rest before you can use this invocation on the same creature again.',
          grants: {
            spells: [
              {
                id: classRowId(W, 5, 5),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.HOLD_MONSTER],
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
          description: 'You can cast Confusion once using a warlock spell slot. You can\'t do so again until you finish a long rest.',
          grants: {
            spells: [
              {
                id: classRowId(W, 5, 7),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.CONFUSION],
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
          description: 'When you cast Eldritch Blast, its range is 300 feet.',
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
          description: 'You can use your action to touch a willing humanoid and perceive through its senses until the start of your next turn.',
          // No requirements. Action-based ability — description-only.
          order: 15
        },
        {
          id: classRowId(W, 5, 11),
          label: 'Lifedrinker',
          description: 'When you hit a creature with your pact weapon, the creature takes extra necrotic damage equal to your Charisma modifier (minimum 1).',
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
          order: 16
        },
        {
          id: classRowId(W, 5, 12),
          label: 'Master of Myriad Forms',
          description: 'You can cast Alter Self at will, without expending a spell slot.',
          grants: {
            spells: [
              {
                id: classRowId(W, 5, 13),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.ALTER_SELF],
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
          description: 'You can cast Conjure Elemental once using a warlock spell slot. You can\'t do so again until you finish a long rest.',
          grants: {
            spells: [
              {
                id: classRowId(W, 5, 15),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.CONJURE_ELEMENTAL],
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
          description: 'You can cast Slow once using a warlock spell slot. You can\'t do so again until you finish a long rest.',
          grants: {
            spells: [
              {
                id: classRowId(W, 5, 17),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.SLOW],
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
          description: 'When you are in an area of dim light or darkness, you can use your action to become invisible until you move or take an action or a reaction.',
          // Action-based ability — description-only.
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
                        min: 5
                      }
                    ]
                  }
                ]
              }
            ]
          },
          order: 20
        },
        {
          id: classRowId(W, 5, 19),
          label: 'Otherworldly Leap',
          description: 'You can cast Jump on yourself at will, without expending a spell slot or material components.',
          grants: {
            spells: [
              {
                id: classRowId(W, 5, 20),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.JUMP],
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
          description: 'You can cast Polymorph once using a warlock spell slot. You can\'t do so again until you finish a long rest.',
          grants: {
            spells: [
              {
                id: classRowId(W, 5, 22),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.POLYMORPH],
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
          description: 'You can cast Bestow Curse once using a warlock spell slot. You can\'t do so again until you finish a long rest.',
          grants: {
            spells: [
              {
                id: classRowId(W, 5, 24),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.BESTOW_CURSE],
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
          description: 'You can attack with your pact weapon twice, instead of once, when you take the Attack action on your turn.',
          // Extra attack not representable as a standard modifier grant — description-only.
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
          order: 24
        },
        {
          id: classRowId(W, 5, 26),
          label: 'Visions of Distant Realms',
          description: 'You can cast Arcane Eye at will, without expending a spell slot.',
          grants: {
            spells: [
              {
                id: classRowId(W, 5, 27),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.ARCANE_EYE],
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
          description: 'You can communicate telepathically with your familiar and perceive through your familiar\'s senses as long as you are on the same plane of existence.',
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
          order: 26
        },
        {
          id: classRowId(W, 5, 29),
          label: 'Whispers of the Grave',
          description: 'You can cast Speak with Dead at will, without expending a spell slot.',
          grants: {
            spells: [
              {
                id: classRowId(W, 5, 30),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: [SPELL_IDS.SPEAK_WITH_DEAD],
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
          description: 'You can see the true form of any shapechanger or creature concealed by illusion or transmutation magic while the creature is within 30 feet of you and within line of sight.',
          // Passive sense — description-only.
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
      description: 'At 3rd level, your otherworldly patron bestows a gift upon you for your loyal service.',
      availableAtLevel: 3,
      order: 3,
      optionChoices: [{ level: 3, count: 1 }],
      options: [
        {
          id: classRowId(W, 3, 22),
          label: 'Pact of the Chain',
          description: 'You learn the Find Familiar spell and can cast it as a ritual. The spell doesn\'t count against your number of spells known.',
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
          order: 0
        },
        {
          id: classRowId(W, 3, 24),
          label: 'Pact of the Blade',
          description: 'You can use your action to create a pact weapon in your empty hand.',
          order: 1
        },
        {
          id: classRowId(W, 3, 25),
          label: 'Pact of the Tome',
          description: 'Your patron gives you a grimoire called a Book of Shadows. When you gain this feature, choose three cantrips from any class\'s spell list.',
          grants: {
            spells: [
              {
                id: classRowId(W, 3, 55),
                grantKind: GRANT_KIND.SPELL_GRANT,
                selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                count: 3,
                scalingKind: SCALING.NONE,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: allCantripIds,
                attributes: [SPELL_GRANT_ATTRIBUTE.KNOWN],
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
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 4,
      order: 4
    },
    // L5 — (no new feature — spell slot upgrade covered by spellLimits)
    // L6 — Otherworldly Patron Feature
    {
      id: classRowId(W, 3, 27),
      label: 'Otherworldly Patron Feature (6th)',
      description: 'Your patron grants you an additional feature at 6th level.',
      availableAtLevel: 6,
      order: 5
    },
    // L7 — (no new feature)
    // L8 — Ability Score Improvement
    {
      id: classRowId(W, 3, 28),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 8,
      order: 6
    },
    // L9 — (no new feature)
    // L10 — Otherworldly Patron Feature + Mystic Arcanum (6th level)
    {
      id: classRowId(W, 3, 29),
      label: 'Otherworldly Patron Feature (10th)',
      description: 'Your patron grants you an additional feature at 10th level.',
      availableAtLevel: 10,
      order: 7
    },
    {
      id: classRowId(W, 3, 30),
      label: 'Mystic Arcanum (6th Level)',
      description: 'Your patron bestows upon you a magical secret called an arcanum. Choose one 6th-level spell from the warlock spell list as this arcanum.',
      availableAtLevel: 11,
      order: 8
    },
    {
      id: classRowId(W, 3, 31),
      label: 'Mystic Arcanum (7th Level)',
      description: 'Choose one 7th-level spell from the warlock spell list as this arcanum.',
      availableAtLevel: 13,
      order: 9
    },
    {
      id: classRowId(W, 3, 32),
      label: 'Otherworldly Patron Feature (14th)',
      description: 'Your patron grants you an additional feature at 14th level.',
      availableAtLevel: 14,
      order: 10
    },
    {
      id: classRowId(W, 3, 33),
      label: 'Mystic Arcanum (8th Level)',
      description: 'Choose one 8th-level spell from the warlock spell list as this arcanum.',
      availableAtLevel: 15,
      order: 11
    },
    // L16 — Ability Score Improvement
    {
      id: classRowId(W, 3, 34),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 16,
      order: 12
    },
    {
      id: classRowId(W, 3, 35),
      label: 'Mystic Arcanum (9th Level)',
      description: 'Choose one 9th-level spell from the warlock spell list as this arcanum.',
      availableAtLevel: 17,
      order: 13
    },
    // L19 — Ability Score Improvement
    {
      id: classRowId(W, 3, 36),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 19,
      order: 14
    },
    // L20 — Eldritch Master
    {
      id: classRowId(W, 3, 37),
      label: 'Eldritch Master',
      description: 'At 20th level, you can draw on your inner reserve of mystical power while entreating your patron to regain expended spell slots. You can spend 1 minute entreating your patron for aid to regain all your expended spell slots from your Pact Magic feature. Once you regain spell slots with this feature, you must finish a long rest before you can do so again.',
      availableAtLevel: 20,
      order: 15
    }
  ]
}

// ─── Warlock Subclasses ───────────────────────────────────────────────────────
