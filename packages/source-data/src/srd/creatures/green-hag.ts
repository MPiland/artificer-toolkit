import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
import { indefiniteInvisibilityEffect } from './indefiniteInvisibility.js'

export const greenHag: CreatureAuthored = {
  id: S.CREATURE_IDS.GREEN_HAG,
  label: 'Green Hag',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FEY,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000800000000',
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 12,
    CONSTITUTION: 16,
    INTELLIGENCE: 13,
    WISDOM: 14,
    CHARISMA: 14
  },
  naturalArmorBonus: 6,
  hitPoints: 82,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 11,
    die: 8,
    modifier: 33
  },
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedSkillProficiency(4388, 1, 'ARCANA', 'DECEPTION', 'PERCEPTION', 'STEALTH'),
    S.grantedLanguageProficiency(4388, 2, 'COMMON', 'DRACONIC', 'SYLVAN')
  ],
  senses: [S.darkvision(60)],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_3,
  xp: 700,
  features: [
    {
      id: S.featureId(151, 1),
      label: 'Amphibious',
      description: 'Amphibious. The hag can breathe air and water.',
      order: 1
    },
    {
      id: S.featureId(151, 2),
      label: 'Innate Spellcasting',
      description:
        "Innate Spellcasting. The hag's innate spellcasting ability is Charisma (spell save DC 12). She can innately cast the following spells, requiring no material components: At will: dancing lights, minor illusion, vicious mockery",
      grants: {
        spells: [
          {
            id: S.actionId(151, 301),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [
              S.SPELL_IDS.DANCING_LIGHTS,
              S.SPELL_IDS.MINOR_ILLUSION,
              S.SPELL_IDS.VICIOUS_MOCKERY
            ],
            attributes: [S.SPELL_GRANT_ATTRIBUTE.KNOWN, S.SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            spellSaveDc: 12,
            order: 0
          }
        ]
      },
      order: 2
    },
    {
      id: S.featureId(151, 3),
      label: 'Mimicry',
      description:
        'Mimicry. The hag can mimic animal sounds and humanoid voices. A creature that hears the sounds can tell they are imitations with a successful DC 14 Wisdom (Insight) check.',
      order: 3
    },
    {
      id: S.featureId(151, 4),
      label: 'Claws',
      description:
        'Claws. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 13 (2d8 + 4) slashing damage.',
      effects: [
        {
          id: S.actionId(151, 204),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(151, 1204),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 5,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(151, 205),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(151, 206),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(151, 207),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d8+4'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 4
    },
    {
      id: S.featureId(151, 5),
      label: 'Illusory Appearance',
      description:
        'Illusory Appearance. The hag covers herself and anything she is wearing or carrying with a magical illusion that makes her look like another creature of her general size and humanoid shape. The illusion ends if the hag takes a bonus action to end it or if she dies. The changes wrought by this effect fail to hold up to physical inspection. For example, the hag could appear to have smooth skin, but someone touching her would feel her rough flesh. Otherwise, a creature must take an action to visually inspect the illusion and succeed on a DC 20 Intelligence (Investigation) check to discern that the hag is disguised.',
      order: 5
    },
    {
      id: S.featureId(151, 6),
      label: 'Invisible Passage',
      description:
        'Invisible Passage. The hag magically turns invisible until she attacks or casts a spell, or until her concentration ends (as if concentrating on a spell). While invisible, she leaves no physical evidence of her passage, so she can be tracked only by magic. Any equipment she wears or carries is invisible with her.',
      effects: [
        indefiniteInvisibilityEffect({
          effectId: S.actionId(151, 209),
          rangeId: S.actionId(151, 1206),
          pathId: S.actionId(151, 210),
          endOnEvents: ['ON_ATTACK_ROLL', 'ON_CAST_SPELL']
        })
      ],
      order: 6
    }
  ]
}
