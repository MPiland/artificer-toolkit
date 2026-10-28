import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const efreeti: CreatureAuthored = {
  id: S.CREATURE_IDS.EFREETI,
  label: 'Efreeti',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.ELEMENTAL,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  abilityScores: {
    STRENGTH: 22,
    DEXTERITY: 12,
    CONSTITUTION: 24,
    INTELLIGENCE: 16,
    WISDOM: 15,
    CHARISMA: 16
  },
  naturalArmorBonus: 6,
  hitPoints: 200,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 16,
    die: 10,
    modifier: 112
  },
  speeds: [...S.walk(40), ...S.fly(60)],
  proficiencies: [
    S.grantedSaveProficiency(95, 1, 'INTELLIGENCE', 'WISDOM', 'CHARISMA'),
    S.grantedLanguageProficiency(95, 2, 'IGNAN')
  ],
  damageImmunities: ['fire'],
  senses: [S.darkvision(120)],
  passivePerception: 12,
  challengeRatingId: S.CR.CR_11,
  xp: 7200,
  features: [
    {
      id: S.featureId(95, 1),
      label: 'Elemental Demise',
      description:
        'Elemental Demise. If the efreeti dies, its body disintegrates in a flash of fire and puff of smoke, leaving behind only equipment the efreeti was wearing or carrying.',
      order: 1
    },
    {
      id: S.featureId(95, 2),
      label: 'Innate Spellcasting',
      description:
        "Innate Spellcasting. The efreeti's innate spellcasting ability is Charisma (spell save DC 15, +7 to hit with spell attacks). It can innately cast the following spells, requiring no material components: At will: detect magic 3/day: enlarge/reduce, tongues 1/day each: conjure elemental (fire elemental only), gaseous form, invisibility, major image, plane shift, wall of fire",
      grants: {
        spells: [
          {
            id: S.actionId(95, 301),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.DETECT_MAGIC],
            attributes: [S.SPELL_GRANT_ATTRIBUTE.KNOWN, S.SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            spellSaveDc: 15,
            order: 0
          },
          {
            id: S.actionId(95, 302),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.ENLARGE_REDUCE, S.SPELL_IDS.TONGUES],
            attributes: [S.SPELL_GRANT_ATTRIBUTE.KNOWN, S.SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            spellSaveDc: 15,
            charges: {
              id: S.actionId(95, 402),
              limitKind: 'FIXED_AMOUNT',
              scalingKind: S.SCALING.NONE,
              resetKind: S.CHARGE_RESET_KIND.DAILY,
              amount: 3
            },
            order: 1
          },
          ...(
            [
              S.SPELL_IDS.CONJURE_ELEMENTAL,
              S.SPELL_IDS.GASEOUS_FORM,
              S.SPELL_IDS.INVISIBILITY,
              S.SPELL_IDS.MAJOR_IMAGE,
              S.SPELL_IDS.PLANE_SHIFT,
              S.SPELL_IDS.WALL_OF_FIRE
            ] as const
          ).map((spellId, index) => ({
            id: S.actionId(95, 303 + index),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [spellId],
            attributes: [S.SPELL_GRANT_ATTRIBUTE.KNOWN, S.SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            spellSaveDc: 15,
            charges: {
              id: S.actionId(95, 403 + index),
              limitKind: 'FIXED_AMOUNT' as const,
              scalingKind: S.SCALING.NONE,
              resetKind: S.CHARGE_RESET_KIND.DAILY,
              amount: 1
            },
            order: index + 2
          }))
        ]
      },
      order: 2
    },
    {
      id: S.featureId(95, 3),
      label: 'Multiattack',
      description:
        'Multiattack. The efreeti makes two scimitar attacks or uses its Hurl Flame twice.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(95, 4) }] }] },
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(95, 5) }] }] }
        ]
      },
      order: 3
    },
    {
      id: S.featureId(95, 4),
      label: 'Scimitar',
      description:
        'Scimitar. Melee Weapon Attack: +10 to hit, reach 5 ft., one target. Hit: 13 (2d6 + 6) slashing damage plus 7 (2d6) fire damage.',
      effects: [
        {
          id: S.actionId(95, 204),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(95, 1204),
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
              id: S.actionId(95, 205),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(95, 206),
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(95, 207),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6+6'
                  },
                  {
                    id: S.actionId(95, 208),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('FIRE'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6'
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
      id: S.featureId(95, 5),
      label: 'Hurl Flame',
      description:
        'Hurl Flame. Ranged Spell Attack: +7 to hit, range 120 ft., one target. Hit: 17 (5d6) fire damage.',
      effects: [
        {
          id: S.actionId(95, 209),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.RANGED_SPELL_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(95, 1205),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 120,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(95, 210),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(95, 211),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(95, 212),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('FIRE'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '5d6'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 5
    }
  ]
}
