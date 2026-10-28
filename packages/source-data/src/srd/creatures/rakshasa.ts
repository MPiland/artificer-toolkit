import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import * as S from './shared.js'

export const rakshasa: CreatureAuthored = {
  id: S.CREATURE_IDS.RAKSHASA,
  label: 'Rakshasa',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FIEND,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  abilityScores: {
    STRENGTH: 14,
    DEXTERITY: 17,
    CONSTITUTION: 18,
    INTELLIGENCE: 13,
    WISDOM: 16,
    CHARISMA: 20
  },
  naturalArmorBonus: 3,
  hitPoints: 110,
  details: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 13,
    die: 8,
    modifier: 52
  },
  speeds: [...S.walk(40)],
  proficiencies: [
    S.grantedSkillProficiency(230, 1, 'DECEPTION', 'INSIGHT'),
    S.grantedLanguageProficiency(230, 2, 'COMMON', 'INFERNAL')
  ],
  damageVulnerabilities: ['piercing from magic weapons wielded by good creatures'],
  damageImmunities: ['bludgeoning, piercing, and slashing from nonmagical attacks'],
  senses: [S.darkvision(60)],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_13,
  xp: 10000,
  features: [
    {
      id: S.featureId(230, 1),
      label: 'Limited Magic Immunity',
      description:
        "Limited Magic Immunity. The rakshasa can't be affected or detected by spells of 6th level or lower unless it wishes to be. It has advantage on saving throws against all other spells and magical effects.",
      order: 1
    },
    {
      id: S.featureId(230, 2),
      label: 'Innate Spellcasting',
      description:
        "Innate Spellcasting. The rakshasa's innate spellcasting ability is Charisma (spell save DC 18, +10 to hit with spell attacks). The rakshasa can innately cast the following spells, requiring no material components: At will: detect thoughts, disguise self, mage hand, minor illusion 3/day each: charm person, detect magic, invisibility, major image, suggestion 1/day each: dominate person, fly, plane shift, true seeing",
      grants: {
        spells: [
          {
            id: S.actionId(230, 701),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [
              S.SPELL_IDS.DETECT_THOUGHTS,
              S.SPELL_IDS.DISGUISE_SELF,
              S.SPELL_IDS.MAGE_HAND,
              S.SPELL_IDS.MINOR_ILLUSION
            ],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            spellSaveDc: 18,
            attributes: [S.SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
            order: 0
          },
          {
            id: S.actionId(230, 702),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [
              S.SPELL_IDS.CHARM_PERSON,
              S.SPELL_IDS.DETECT_MAGIC,
              S.SPELL_IDS.INVISIBILITY,
              S.SPELL_IDS.MAJOR_IMAGE,
              S.SPELL_IDS.SUGGESTION
            ],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            spellSaveDc: 18,
            attributes: [S.SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
            charges: {
              id: S.actionId(230, 703),
              limitKind: 'FIXED_AMOUNT',
              scalingKind: S.SCALING.NONE,
              resetKind: S.CHARGE_RESET_KIND.DAILY,
              amount: 3
            },
            order: 1
          },
          {
            id: S.actionId(230, 704),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [
              S.SPELL_IDS.DOMINATE_PERSON,
              S.SPELL_IDS.FLY,
              S.SPELL_IDS.PLANE_SHIFT,
              S.SPELL_IDS.TRUE_SEEING
            ],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            spellSaveDc: 18,
            attributes: [S.SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
            charges: {
              id: S.actionId(230, 705),
              limitKind: 'FIXED_AMOUNT',
              scalingKind: S.SCALING.NONE,
              resetKind: S.CHARGE_RESET_KIND.DAILY,
              amount: 1
            },
            order: 2
          }
        ]
      },
      order: 2
    },
    {
      id: S.featureId(230, 3),
      label: 'Multiattack',
      description: 'The rakshasa makes two claw attacks.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(230, 4) }] }] }
        ]
      },
      order: 3
    },
    {
      id: S.featureId(230, 4),
      label: 'Claw',
      description:
        "Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 9 (2d6 + 2) slashing damage, and the target is cursed if it is a creature. The magical curse takes effect whenever the target takes a short or long rest, filling the target's thoughts with horrible images and dreams. The cursed target gains no benefit from finishing a short or long rest. The curse lasts until it is lifted by a remove curse spell or similar magic.",
      effects: [
        {
          id: S.actionId(230, 503),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(230, 603),
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
              id: S.actionId(230, 803),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(230, 803) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(230, 930),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6',
                    bonuses: [
                      {
                        id: S.actionId(230, 980),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
                  },
                  {
                    id: S.actionId(230, 938),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Rakshasa Curse',
                    instructions:
                      "If the target is a creature, it is cursed. The magical curse takes effect whenever the target takes a short or long rest, filling the target's thoughts with horrible images and dreams. The cursed target gains no benefit from finishing a short or long rest. The curse lasts until it is lifted by a remove curse spell or similar magic.",
                    reasonCode: MANUAL_ADJUDICATION_REASON.NARRATIVE_JUDGMENT
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 4
    }
  ]
}
