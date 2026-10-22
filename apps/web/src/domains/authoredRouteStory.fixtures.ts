import type {
  AuthoredDraftDto,
  BackgroundResponseDto,
  ClassResponseDto,
  CreatureResponseDto,
  EquipmentResponseDto,
  FeatResponseDto,
  RaceResponseDto,
  SpellResponseDto,
  VehicleResponseDto
} from '@artificer-toolkit/schema/api/content'
import type {
  SystemListResponseDto,
  SystemResponseDto
} from '@artificer-toolkit/schema/api/systems'
import type { BackgroundAuthoredDto } from '@artificer-toolkit/schema/subjects/background'
import type { ClassAuthoredDto } from '@artificer-toolkit/schema/subjects/class'
import type { CreatureAuthoredDto } from '@artificer-toolkit/schema/subjects/creature'
import type { EquipmentAuthoredDto } from '@artificer-toolkit/schema/subjects/equipment'
import type { FeatAuthoredDto } from '@artificer-toolkit/schema/subjects/feat'
import type { RaceAuthoredDto } from '@artificer-toolkit/schema/subjects/race'
import type { SpellAuthoredDto } from '@artificer-toolkit/schema/subjects/spell'
import type { VehicleAuthoredDto } from '@artificer-toolkit/schema/subjects/vehicle'
import { SRD_SPEEDS } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type {
  BackgroundEditLoaderData,
  ClassEditLoaderData,
  CreatureEditLoaderData,
  EquipmentEditLoaderData,
  FeatEditLoaderData,
  RaceEditLoaderData,
  SpellEditLoaderData,
  VehicleEditLoaderData
} from '#app/routes/-routeLoaderData'
import { createAuthoredFormRouteLoaderData } from '#forms/layout/authoredFormRouteContext'
import type { AuthoredFormDomain } from '#forms/factories/authoredFormFactories.types'

export const seedStoryUserId = '00000000-0000-0000-0000-000000000000'
export const seedStorySystemId = '00000000-0000-0000-0000-000000000001'
const authoredStorySpeeds = SRD_SPEEDS.map((speed) => ({ ...speed }))
const authoredStoryWalkingSpeedId = authoredStorySpeeds.find((speed) => speed.code === 'WALK')!.id

export const authoredRouteStoryUser = {
  id: 'story-author',
  email: 'author@example.test'
}

export const authoredRouteStorySystems = [
  {
    id: seedStorySystemId,
    label: 'D&D 5e SRD',
    description: 'Seed-derived SRD system used for authoring route stories.',
    rulesetCode: 'dnd5e',
    rulesetVersion: '2014',
    userId: seedStoryUserId,
    rulesCatalogues: []
  }
] satisfies SystemListResponseDto

export const authoredRouteStorySystem = {
  id: seedStorySystemId,
  label: 'D&D 5e SRD',
  description: 'Seed-derived SRD system used for authoring route stories.',
  rulesetCode: 'dnd5e',
  rulesetVersion: '2014',
  schemaVersion: 4,
  abilities: [
    { id: '00000000-0000-0000-0011-000100000000', code: 'STRENGTH', label: 'Strength' },
    { id: '00000000-0000-0000-0011-000200000000', code: 'DEXTERITY', label: 'Dexterity' },
    {
      id: '00000000-0000-0000-0011-000300000000',
      code: 'CONSTITUTION',
      label: 'Constitution'
    },
    {
      id: '00000000-0000-0000-0011-000400000000',
      code: 'INTELLIGENCE',
      label: 'Intelligence'
    },
    { id: '00000000-0000-0000-0011-000500000000', code: 'WISDOM', label: 'Wisdom' },
    { id: '00000000-0000-0000-0011-000600000000', code: 'CHARISMA', label: 'Charisma' }
  ],
  alignments: [],
  challengeRatings: [
    {
      id: '00000000-0000-0000-000e-000300000000',
      code: 'CR_1_4',
      label: '1/4',
      short: 'CR 1/4',
      description: '50 XP',
      xp: 50,
      proficiencyBonus: 2,
      rank: 2
    }
  ],
  conditionTypes: [
    {
      id: '00000000-0000-0000-0002-000b00000000',
      code: 'POISONED',
      label: 'Poisoned'
    }
  ],
  creatureTypes: [
    {
      id: '00000000-0000-0000-000f-000a00000000',
      code: 'HUMANOID',
      label: 'Humanoid'
    }
  ],
  currencies: [
    {
      id: '00000000-0000-0000-0003-000400000000',
      code: 'GP',
      label: 'Gold Piece',
      short: 'gp',
      baseValue: 100
    }
  ],
  damageTypes: [
    {
      id: '00000000-0000-0000-0004-000200000000',
      code: 'BLUDGEONING',
      label: 'Bludgeoning'
    },
    {
      id: '00000000-0000-0000-0004-000400000000',
      code: 'FIRE',
      label: 'Fire'
    },
    {
      id: '00000000-0000-0000-0004-000700000000',
      code: 'NECROTIC',
      label: 'Necrotic'
    },
    {
      id: '00000000-0000-0000-0004-000800000000',
      code: 'PIERCING',
      label: 'Piercing'
    },
    {
      id: '00000000-0000-0000-0004-000b00000000',
      code: 'RADIANT',
      label: 'Radiant'
    }
  ],
  heritages: [],
  languages: [],
  lifestyles: [],
  magicSchools: [
    {
      id: '00000000-0000-0000-0007-000500000000',
      code: 'EVOCATION',
      label: 'Evocation'
    }
  ],
  passives: [],
  rarities: [
    {
      id: '00000000-0000-0000-0009-000100000000',
      code: 'COMMON',
      label: 'Common'
    },
    {
      id: '00000000-0000-0000-0009-000500000000',
      code: 'LEGENDARY',
      label: 'Legendary'
    }
  ],
  senses: [{ id: '00000000-0000-0000-000a-000100000000', code: 'DARKVISION', label: 'Darkvision' }],
  skills: [],
  speeds: authoredStorySpeeds,
  terrains: [],
  userId: seedStoryUserId
} satisfies NonNullable<SystemResponseDto>

export const authoredCreateRouteLoaderData = createAuthoredFormRouteLoaderData({
  system: authoredRouteStorySystem,
  systems: authoredRouteStorySystems
})

const seedFireballEffects = [
  {
    id: '00000000-0000-4000-8000-000000000303',
    order: 1,
    invocation: {
      kind: 'ACTION',
      triggerCode: 'SAVING_THROW',
      savingThrow: {
        id: 'fireball-save',
        dcMethod: 'SOURCE_SAVE_DC',
        abilityDefinitionId: '00000000-0000-0000-0011-000200000000'
      },
      activation: {
        code: 'ACTION',
        amount: 1
      },
      range: {
        id: 'fireball-range',
        rangeKind: 'DISTANCE',
        amount: 150,
        unit: 'FEET'
      },
      targeting: {
        selectionKind: 'AREA_CONTENTS',
        dispositionKind: 'ANY'
      },
      shape: {
        id: 'fireball-shape',
        shapeKind: 'SPHERE',
        radius: {
          amount: 20,
          unit: 'FEET'
        }
      }
    },
    paths: [
      {
        id: 'fireball-save-fail',
        order: 1,
        pathCode: 'ON_SAVE_FAIL',
        groupType: 'SINGLE',
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: 'fireball-save-fail-result',
          resultKind: 'SINGLE',
          outcomes: [
            {
              id: 'fireball-save-fail-damage',
              effectKind: 'DAMAGE',
              damageTypeId: '00000000-0000-0000-0004-000400000000',
              valueKind: 'DICE',
              scalingKind: 'PER_LEVEL',
              scalingSource: 'SPELL_CAST_LEVEL',
              levels: [
                {
                  id: 'fireball-level-3',
                  level: 3,
                  order: 1,
                  diceConfig: '8d6'
                },
                {
                  id: 'fireball-level-4',
                  level: 4,
                  order: 2,
                  diceConfig: '9d6'
                }
              ]
            }
          ]
        }
      },
      {
        id: 'fireball-save-success',
        order: 2,
        pathCode: 'ON_SAVE_SUCCESS',
        groupType: 'SINGLE',
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: 'fireball-save-success-result',
          resultKind: 'SINGLE',
          outcomes: [
            {
              id: 'fireball-save-success-damage',
              effectKind: 'DAMAGE',
              damageTypeId: '00000000-0000-0000-0004-000400000000',
              amountKind: 'HALF',
              valueKind: 'DICE',
              scalingKind: 'PER_LEVEL',
              scalingSource: 'SPELL_CAST_LEVEL',
              levels: [
                {
                  id: 'fireball-success-level-3',
                  level: 3,
                  order: 1,
                  diceConfig: '8d6'
                }
              ]
            }
          ]
        }
      }
    ]
  }
] satisfies SpellAuthoredDto['effects']

const seedAcolyteBackground = {
  kind: 'BACKGROUND',
  id: '00000000-0000-0000-0040-000100000000',
  label: 'Acolyte',
  description:
    '<p>You have spent your life in the service of a temple to a specific god or pantheon of gods.</p>',
  status: 'ACTIVE',
  proficiencies: [],
  features: [
    {
      id: '00000000-0000-0000-8040-010201000000',
      label: 'Shelter of the Faithful',
      description:
        '<p>As an acolyte, you command the respect of those who share your faith and can perform religious ceremonies.</p>',
      order: 0
    }
  ],
  details: [
    {
      id: '00000000-0000-0000-8040-010401000000',
      label: 'Personality Trait 1',
      description:
        "I idolize a particular hero of my faith, and constantly refer to that person's deeds and example.",
      order: 0
    }
  ],
  userId: seedStoryUserId,
  systemId: seedStorySystemId
} satisfies BackgroundAuthoredDto

const seedWizardClass = {
  id: '00000000-0000-0000-0010-000c00000000',
  label: 'Wizard',
  category: 'BASE',
  attributes: ['SPELLCASTER'],
  description: 'A scholarly magic-user capable of manipulating the structures of reality.',
  status: 'ACTIVE',
  details: [],
  proficiencies: [],
  features: [
    {
      id: '00000000-0000-0000-c00c-010100000000',
      label: 'Spellcasting',
      description:
        '<p>As a student of arcane magic, you have a spellbook containing spells that show the first glimmerings of your true power.</p>',
      order: 1
    }
  ],
  hitpoint: {
    ability: 'CONSTITUTION',
    dieConfig: 'd6'
  },
  startingGold: {
    multiplier: 10,
    currencyId: '00000000-0000-0000-0003-000400000000',
    dieConfig: '4d4'
  },
  startingEquipment: {
    id: '00000000-0000-0000-c00c-620100000000',
    sets: []
  },
  multiclass: {
    id: '00000000-0000-0000-c00c-630100000000',
    requirementGroups: { groups: [] },
    proficiencies: []
  },
  userId: seedStoryUserId,
  systemId: seedStorySystemId
} satisfies ClassAuthoredDto

const seedAcolyteCreature = {
  id: '00000000-0000-0000-0070-000200000000',
  label: 'Acolyte',
  details: [],
  senses: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  userId: seedStoryUserId,
  systemId: seedStorySystemId,
  status: 'ACTIVE',
  category: 'NPC',
  creatureTypeId: '00000000-0000-0000-000f-000a00000000',
  size: 'MEDIUM',
  tags: ['any race'],
  abilityScores: {
    STRENGTH: 10,
    DEXTERITY: 10,
    CONSTITUTION: 10,
    INTELLIGENCE: 10,
    WISDOM: 14,
    CHARISMA: 11
  },
  naturalArmorBonus: 0,
  hitPoints: 9,
  hitDice: { count: 2, die: 8, modifier: 0 },
  speeds: [
    {
      speedId: authoredStoryWalkingSpeedId,
      amount: 30,
      unit: 'FEET'
    }
  ],
  proficiencies: [],
  passivePerception: 12,
  challengeRatingId: '00000000-0000-0000-000e-000300000000',
  xp: 50,
  features: [
    {
      id: '00000000-0000-0000-0070-000200010000',
      label: 'Spellcasting',
      description: 'The acolyte is a 1st-level spellcaster. Its spellcasting ability is Wisdom.',
      order: 1
    }
  ]
} satisfies CreatureAuthoredDto

export const seedShortswordEquipment = {
  kind: 'EQUIPMENT',
  id: '00000000-0000-0000-0060-001600000000',
  label: 'Shortsword',
  description: 'A light, balanced blade made for close combat.',
  category: 'WEAPON',
  properties: ['FINESSE', 'LIGHT'],
  cost: {
    amount: 10,
    currencyId: '00000000-0000-0000-0003-000400000000'
  },
  weight: {
    amount: 2,
    unit: 'POUNDS'
  },
  rarityId: '00000000-0000-0000-0009-000100000000',
  status: 'ACTIVE',
  userId: seedStoryUserId,
  systemId: seedStorySystemId
} satisfies EquipmentAuthoredDto

export const seedShortswordPlusOneEquipment = {
  kind: 'EQUIPMENT',
  id: '00000000-0000-0000-0060-021600000000',
  label: 'Shortsword +1',
  description: 'You have a +1 bonus to attack and damage rolls made with this magic weapon.',
  category: 'VARIANT',
  parentEquipmentId: '00000000-0000-0000-0060-001600000000',
  properties: ['MAGIC'],
  modifiers: [
    createMeleeWeaponModifier({
      id: 'shortsword-plus-one-attack-modifier',
      order: 1,
      valueDomainCode: 'ATTACK_ROLL'
    }),
    createMeleeWeaponModifier({
      id: 'shortsword-plus-one-damage-modifier',
      order: 2,
      valueDomainCode: 'DAMAGE'
    })
  ],
  effects: [
    {
      id: '00000000-0000-4000-8000-000000000301',
      order: 1,
      grip: 'ONE_HANDED',
      invocation: {
        kind: 'ACTION',
        triggerCode: 'MELEE_WEAPON_ATTACK',
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'shortsword-plus-one-range',
          rangeKind: 'DISTANCE',
          amount: 5,
          unit: 'FEET'
        },
        targeting: {
          selectionKind: 'SINGLE_TARGET',
          dispositionKind: 'ANY'
        }
      },
      paths: [
        {
          id: 'shortsword-plus-one-hit-path',
          order: 1,
          pathCode: 'ON_HIT',
          groupType: 'SINGLE',
          originKind: 'SOURCE',
          selectionKind: 'FIXED',
          resultBlock: {
            id: 'shortsword-plus-one-hit-result',
            resultKind: 'SINGLE',
            outcomes: [
              {
                id: 'shortsword-plus-one-piercing-damage',
                effectKind: 'DAMAGE',
                damageTypeId: '00000000-0000-0000-0004-000800000000',
                valueKind: 'DICE',
                scalingKind: 'NONE',
                diceConfig: '1d6'
              }
            ]
          }
        }
      ]
    }
  ],
  rarityId: '00000000-0000-0000-0009-000100000000',
  status: 'ACTIVE',
  userId: seedStoryUserId,
  systemId: seedStorySystemId
} satisfies EquipmentAuthoredDto

function createMeleeWeaponModifier({
  id,
  order,
  valueDomainCode
}: {
  id: string
  order: number
  valueDomainCode: 'ATTACK_ROLL' | 'DAMAGE'
}) {
  return {
    id,
    order,
    grantKind: 'MODIFIER_GRANT' as const,
    selectionKind: 'GRANTED' as const,
    valueDomainCode,
    modifierKind: 'BONUS' as const,
    scope: 'SOURCE' as const,
    domain: { attackDomain: 'MELEE' as const },
    payload: {
      valueKind: 'FIXED' as const,
      amount: 1
    },
    restrictions: {
      id: `${id}-restrictions`,
      groups: [
        {
          id: `${id}-restriction-group`,
          order: 0,
          contexts: [
            {
              id: `${id}-character-context`,
              order: 0,
              subject: 'CHARACTER' as const,
              conditions: [
                {
                  id: `${id}-equipped-condition`,
                  order: 0,
                  kind: 'PREDICATE' as const,
                  constraint: 'INCLUDE' as const,
                  predicateCode: 'WHILE_SOURCE_EQUIPPED' as const
                }
              ]
            }
          ]
        }
      ]
    }
  }
}

export const seedAstralTearAwakenedEquipment = {
  kind: 'EQUIPMENT',
  id: '00000000-0000-0000-0060-0a5700000000',
  label: 'The Astral Tear Awakened',
  description:
    'This mighty blade belongs to the Astral Champion of Vedur. While attuned to it, its wielder can call it to hand from a special demiplane.',
  category: 'WEAPON',
  attributes: ['LIMITED_USE'],
  properties: ['FINESSE', 'LIGHT', 'VEX'],
  cost: {
    amount: 2000,
    currencyId: '00000000-0000-0000-0003-000400000000'
  },
  weight: {
    amount: 2,
    unit: 'POUNDS'
  },
  effects: [
    {
      id: '00000000-0000-4000-8000-000000000302',
      order: 1,
      grip: 'ONE_HANDED',
      invocation: {
        kind: 'ACTION',
        triggerCode: 'MELEE_WEAPON_ATTACK',
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'astral-tear-melee-range',
          rangeKind: 'DISTANCE',
          amount: 5,
          unit: 'FEET'
        },
        targeting: {
          selectionKind: 'SINGLE_TARGET',
          dispositionKind: 'ANY'
        }
      },
      paths: [
        {
          id: 'astral-tear-hit-path',
          order: 1,
          pathCode: 'ON_HIT',
          groupType: 'CHOICE',
          originKind: 'SOURCE',
          selectionKind: 'CHOICE',
          options: [
            {
              id: 'astral-tear-radiant-option',
              order: 1,
              label: 'Radiant',
              description: 'The Astral Tear deals radiant damage.',
              resultBlock: {
                id: 'astral-tear-radiant-result',
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: 'astral-tear-radiant-damage',
                    effectKind: 'DAMAGE',
                    damageTypeId: '00000000-0000-0000-0004-000b00000000',
                    valueKind: 'DICE',
                    scalingKind: 'NONE',
                    diceConfig: '1d6'
                  }
                ]
              }
            },
            {
              id: 'astral-tear-necrotic-option',
              order: 2,
              label: 'Necrotic',
              description: 'The Astral Tear deals necrotic damage.',
              resultBlock: {
                id: 'astral-tear-necrotic-result',
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: 'astral-tear-necrotic-damage',
                    effectKind: 'DAMAGE',
                    damageTypeId: '00000000-0000-0000-0004-000700000000',
                    valueKind: 'DICE',
                    scalingKind: 'NONE',
                    diceConfig: '1d6'
                  }
                ]
              }
            }
          ]
        }
      ]
    }
  ],
  charges: {
    id: 'astral-tear-charges',
    resetKind: 'DAWN',
    limitKind: 'FIXED_AMOUNT',
    scalingKind: 'NONE',
    amount: 3
  },
  modifiers: [
    createMeleeWeaponModifier({
      id: 'astral-tear-attack-modifier',
      order: 1,
      valueDomainCode: 'ATTACK_ROLL'
    }),
    createMeleeWeaponModifier({
      id: 'astral-tear-damage-modifier',
      order: 2,
      valueDomainCode: 'DAMAGE'
    })
  ],
  features: [
    {
      id: 'astral-tear-warping-strike',
      label: 'Warping Strike',
      description:
        'While holding the sword, you can expend 1 of its charges as part of making an attack with it. You can teleport to an unoccupied space you can see within 30 feet either before or after the attack. On a hit, the target also takes 4d6 force damage.',
      attributes: ['LIMITED_USE'],
      charges: {
        id: 'astral-tear-warping-strike-charges',
        limitKind: 'SOURCE_CHARGES',
        scalingKind: 'NONE',
        cost: 1
      },
      section: 'OTHER',
      order: 1
    },
    {
      id: 'astral-tear-spells',
      label: 'Spells',
      description:
        'While holding the sword, you can use an action to expend 1 of its charges to cast a 2nd-level or lower spell without expending a spell slot.',
      attributes: ['LIMITED_USE'],
      charges: {
        id: 'astral-tear-spells-charges',
        limitKind: 'SOURCE_CHARGES',
        scalingKind: 'NONE',
        cost: 1
      },
      section: 'ACTION',
      order: 2
    }
  ],
  requiresAttunement: true,
  rarityId: '00000000-0000-0000-0009-000500000000',
  status: 'ACTIVE',
  userId: seedStoryUserId,
  systemId: seedStorySystemId
} satisfies EquipmentAuthoredDto

const seedGrapplerFeat = {
  id: '00000000-0000-0000-0050-000b00000000',
  label: 'Grappler',
  description:
    "You've developed the skills necessary to hold your own in close-quarters grappling. Prerequisite: Strength 13 or higher.",
  details: [],
  features: [
    {
      id: '00000000-0000-0000-0050-110100000000',
      label: 'Advantage on Grappled Target',
      description: 'You have advantage on attack rolls against a creature you are grappling.',
      order: 0
    },
    {
      id: '00000000-0000-0000-0050-110200000000',
      label: 'Pin',
      description: 'You can use your action to try to pin a creature grappled by you.',
      order: 1
    }
  ],
  status: 'ACTIVE',
  effects: [],
  userId: seedStoryUserId,
  systemId: seedStorySystemId
} satisfies FeatAuthoredDto

export const seedDragonbornRace = {
  id: '00000000-0000-0000-0030-000500000000',
  label: 'Dragonborn',
  quote: 'Proud dragonkin shaped by clan and ancestry.',
  description:
    '<p>Dragonborn look very much like dragons standing erect in humanoid form, though they lack wings or a tail.</p>',
  status: 'ACTIVE',
  category: 'BASE',
  selectionMode: 'DIRECT',
  heritageIds: [],
  ancestry: {
    id: 'dragonborn-draconic-ancestry',
    label: 'Draconic Ancestry',
    description: 'Choose one type of dragon as your ancestor.',
    options: [
      {
        id: 'dragonborn-red-ancestry',
        label: 'Red Dragon',
        description: 'Your draconic ancestry is tied to fire.',
        order: 1,
        features: [
          {
            id: 'dragonborn-red-breath-weapon',
            label: 'Breath Weapon',
            description: 'Exhale destructive fire in a 15-foot cone.',
            order: 1
          }
        ]
      }
    ]
  },
  size: 'MEDIUM',
  speeds: [
    {
      speedId: authoredStoryWalkingSpeedId,
      amount: 30,
      unit: 'FEET'
    }
  ],
  details: [
    {
      id: 'dragonborn-detail-size',
      label: 'Size',
      description: 'Dragonborn are taller and heavier than humans, standing well over 6 feet tall.',
      order: 3
    }
  ],
  features: [
    {
      id: 'dragonborn-feature-ability-score',
      label: 'Ability Score Increase',
      description: 'Your Strength score increases by 2, and your Charisma score increases by 1.',
      order: 1
    }
  ],
  userId: seedStoryUserId,
  systemId: seedStorySystemId
} satisfies RaceAuthoredDto

export const seedFireballSpell = {
  kind: 'SPELL',
  id: '00000000-0000-0000-0020-007c00000000',
  label: 'Fireball',
  description:
    '<p>A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame.</p>',
  castingTime: {
    unit: 'ROUND',
    amount: 1
  },
  level: 3,
  classIds: ['00000000-0000-0000-0010-000a00000000', '00000000-0000-0000-0010-000c00000000'],
  components: ['VERBAL', 'SOMATIC', 'MATERIAL'],
  materialDescription: 'a tiny ball of bat guano and sulfur',
  magicSchoolId: '00000000-0000-0000-0007-000500000000',
  effects: seedFireballEffects,
  status: 'ACTIVE',
  userId: seedStoryUserId,
  systemId: seedStorySystemId
} satisfies SpellAuthoredDto

const seedSailingShipVehicle = {
  id: '00000000-0000-0000-0080-000500000000',
  label: 'Sailing Ship',
  description:
    'A large ocean-going vessel powered by wind, suitable for long voyages and heavy cargo.',
  status: 'ACTIVE',
  userId: seedStoryUserId,
  systemId: seedStorySystemId,
  category: 'WATER',
  armorClass: 15,
  hitPoints: 300,
  speed: 2,
  speedNote: '2 mph',
  crewMin: 20,
  crewMax: 20,
  passengerCapacity: 20,
  cargoCapacity: '100 tons',
  cost: {
    amount: 10000,
    currencyId: '00000000-0000-0000-0003-000400000000'
  },
  properties: []
} satisfies VehicleAuthoredDto

export const authoredRouteStoryRecords = {
  background: seedAcolyteBackground,
  class: seedWizardClass,
  creature: seedAcolyteCreature,
  equipment: seedShortswordPlusOneEquipment,
  feat: seedGrapplerFeat,
  race: seedDragonbornRace,
  spell: seedFireballSpell,
  vehicle: seedSailingShipVehicle
} satisfies AuthoredRouteStoryRecordMap

export const authoredRouteStoryResponses = {
  background: createResponse(seedAcolyteBackground, 'ownedActive'),
  class: createResponse(seedWizardClass, 'ownedActive'),
  creature: createResponse(seedAcolyteCreature, 'ownedActive'),
  equipment: createResponse(seedShortswordPlusOneEquipment, 'ownedActive'),
  feat: createResponse(seedGrapplerFeat, 'ownedActive'),
  race: createResponse(seedDragonbornRace, 'ownedActive'),
  spell: createResponse(seedFireballSpell, 'ownedActive'),
  vehicle: createResponse(seedSailingShipVehicle, 'ownedActive')
} satisfies AuthoredRouteStoryResponseMap

export const authoredRouteStoryEquipmentParentResponse = createResponse(
  seedShortswordEquipment,
  'masterLocked'
)

export const authoredRouteStoryMasterResponses = {
  background: createResponse(seedAcolyteBackground, 'masterLocked'),
  class: createResponse(seedWizardClass, 'masterLocked'),
  creature: createResponse(seedAcolyteCreature, 'masterLocked'),
  equipment: createResponse(seedShortswordPlusOneEquipment, 'masterLocked'),
  feat: createResponse(seedGrapplerFeat, 'masterLocked'),
  race: createResponse(seedDragonbornRace, 'masterLocked'),
  spell: createResponse(seedFireballSpell, 'masterLocked'),
  vehicle: createResponse(seedSailingShipVehicle, 'masterLocked')
} satisfies AuthoredRouteStoryResponseMap

export const authoredRouteStoryDrafts = {
  background: createDraft('background', seedAcolyteBackground),
  class: createDraft('class', seedWizardClass),
  creature: createDraft('creature', seedAcolyteCreature),
  equipment: createDraft('equipment', seedShortswordPlusOneEquipment),
  feat: createDraft('feat', seedGrapplerFeat),
  race: createDraft('race', seedDragonbornRace),
  spell: createDraft('spell', seedFireballSpell),
  vehicle: createDraft('vehicle', seedSailingShipVehicle)
} satisfies Record<AuthoredFormDomain, AuthoredDraftDto>

export const authoredEditRouteLoaderData = {
  background: createEditLoaderData('background', 'ownedActive'),
  class: createEditLoaderData('class', 'ownedActive'),
  creature: createEditLoaderData('creature', 'ownedActive'),
  equipment: createEditLoaderData('equipment', 'ownedActive'),
  feat: createEditLoaderData('feat', 'ownedActive'),
  race: createEditLoaderData('race', 'ownedActive'),
  spell: createEditLoaderData('spell', 'ownedActive'),
  vehicle: createEditLoaderData('vehicle', 'ownedActive')
} satisfies {
  background: BackgroundEditLoaderData
  class: ClassEditLoaderData
  creature: CreatureEditLoaderData
  equipment: EquipmentEditLoaderData
  feat: FeatEditLoaderData
  race: RaceEditLoaderData
  spell: SpellEditLoaderData
  vehicle: VehicleEditLoaderData
}

export const authoredRouteStoryParams = {
  background: {
    backgroundPublicId: 'acolyte',
    backgroundSlug: 'acolyte'
  },
  class: {
    classPublicId: 'wizard',
    classSlug: 'wizard'
  },
  creature: {
    creaturePublicId: 'acolyte',
    creatureSlug: 'acolyte'
  },
  equipment: {
    equipmentPublicId: 'longsword',
    equipmentSlug: 'longsword'
  },
  feat: {
    featPublicId: 'grappler',
    featSlug: 'grappler'
  },
  race: {
    racePublicId: 'dragonborn',
    raceSlug: 'dragonborn'
  },
  spell: {
    spellPublicId: 'fireball',
    spellSlug: 'fireball'
  },
  vehicle: {
    vehiclePublicId: 'sailing-ship',
    vehicleSlug: 'sailing-ship'
  }
} as const

export type AuthoredRouteStoryRecordMap = {
  background: BackgroundAuthoredDto
  class: ClassAuthoredDto
  creature: CreatureAuthoredDto
  equipment: EquipmentAuthoredDto
  feat: FeatAuthoredDto
  race: RaceAuthoredDto
  spell: SpellAuthoredDto
  vehicle: VehicleAuthoredDto
}

type AuthoredRouteStoryResponseMap = {
  background: NonNullable<BackgroundResponseDto>
  class: NonNullable<ClassResponseDto>
  creature: NonNullable<CreatureResponseDto>
  equipment: NonNullable<EquipmentResponseDto>
  feat: NonNullable<FeatResponseDto>
  race: NonNullable<RaceResponseDto>
  spell: NonNullable<SpellResponseDto>
  vehicle: NonNullable<VehicleResponseDto>
}

type AuthoredRouteStoryRecord = AuthoredRouteStoryRecordMap[AuthoredFormDomain]

export type AuthoredRouteStoryEditState = 'ownedActive' | 'ownedDraft' | 'masterLocked'

function createResponse<TRecord extends AuthoredRouteStoryRecord>(
  record: TRecord,
  state: Exclude<AuthoredRouteStoryEditState, 'ownedDraft'>
) {
  const isMaster = state === 'masterLocked'

  return {
    publicId: record.label.toLowerCase().replaceAll(' ', '-'),
    activeUpdatedAt: '2026-01-01T00:00:00.000Z',
    hasDraft: false,
    item: record,
    provenance: {
      kind: isMaster ? ('MASTER' as const) : ('OWNED' as const),
      ownerUserId: isMaster ? null : seedStoryUserId
    },
    permissions: {
      canView: true,
      canEdit: !isMaster,
      canCopy: true,
      canDelete: !isMaster
    }
  }
}

export function createEditLoaderData<TDomain extends AuthoredFormDomain>(
  domain: TDomain,
  state: AuthoredRouteStoryEditState,
  recordOverride?: AuthoredRouteStoryRecordMap[TDomain]
) {
  const response = recordOverride
    ? createResponse(recordOverride, state === 'masterLocked' ? 'masterLocked' : 'ownedActive')
    : state === 'masterLocked'
      ? authoredRouteStoryMasterResponses[domain]
      : authoredRouteStoryResponses[domain]
  const draft =
    state === 'ownedDraft'
      ? recordOverride
        ? createDraft(domain, recordOverride)
        : authoredRouteStoryDrafts[domain]
      : null
  const responseWithDraftState = state === 'ownedDraft' ? { ...response, hasDraft: true } : response
  const item = responseWithDraftState.item
  if (!item) throw new Error(`Missing ${domain} story record.`)
  const parentResponse =
    domain === 'equipment' && 'category' in item && item.category === 'VARIANT'
      ? authoredRouteStoryEquipmentParentResponse
      : undefined

  return createAuthoredFormRouteLoaderData({
    breadcrumbLabel: item.label,
    draft,
    ...(parentResponse ? { parentResponse } : {}),
    response: responseWithDraftState,
    subjectId: item.id,
    system: authoredRouteStorySystem
  })
}

function createDraft<TDomain extends AuthoredFormDomain>(
  domain: TDomain,
  record: AuthoredRouteStoryRecordMap[TDomain]
): AuthoredDraftDto {
  const publicId = record.label.toLowerCase().replaceAll(' ', '-')
  const category =
    'category' in record && typeof record.category === 'string' ? record.category : undefined
  const description = 'description' in record ? record.description : undefined
  const level = 'level' in record && typeof record.level === 'number' ? record.level : undefined
  const magicSchoolId = 'magicSchoolId' in record ? record.magicSchoolId : undefined

  return {
    subjectKind: domain.toUpperCase() as AuthoredDraftDto['subjectKind'],
    subjectId: record.id,
    publicId,
    userId: seedStoryUserId,
    systemId: seedStorySystemId,
    label: record.label,
    description,
    status: 'DRAFT',
    category,
    level,
    magicSchoolId,
    draftState: 'ACTIVE_WITH_DRAFT',
    baseActiveUpdatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-07-12T12:00:00.000Z',
    updatedAt: '2026-07-13T12:00:00.000Z',
    payload: {
      ...record,
      status: 'DRAFT'
    }
  }
}
