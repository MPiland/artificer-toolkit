import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'
export const lich: CreatureAuthored = {
  id: S.CREATURE_IDS.LICH,
  label: 'Lich',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.UNDEAD,
  size: S.SIZE_CODE.MEDIUM,
  abilityScores: {
    STRENGTH: 11,
    DEXTERITY: 16,
    CONSTITUTION: 16,
    INTELLIGENCE: 20,
    WISDOM: 14,
    CHARISMA: 16
  },
  naturalArmorBonus: 4,
  hitPoints: 135,
  details: [],
  damageVulnerabilities: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 18,
    die: 8,
    modifier: 54
  },
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedSaveProficiency(2794, 1, 'CONSTITUTION', 'INTELLIGENCE', 'WISDOM'),
    S.grantedSkillProficiency(2794, 2, 'ARCANA', 'HISTORY', 'INSIGHT', 'PERCEPTION'),
    S.grantedLanguageProficiency(2794, 3, 'COMMON')
  ],
  damageResistances: ['cold', 'lightning', 'necrotic'],
  damageImmunities: ['poison', 'bludgeoning, piercing, and slashing from nonmagical attacks'],
  conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'poisoned'],
  senses: [S.truesight(120)],
  passivePerception: 19,
  challengeRatingId: S.CR.CR_21,
  xp: 33000,
  features: [
    {
      id: S.featureId(183, 1),
      ruleDefinitionIds: [S.DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID],
      label: 'Legendary Resistance (3/Day)',
      description:
        'Legendary Resistance (3/Day). If the lich fails a saving throw, it can choose to succeed instead.',
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.legendaryActionId(2794, 20),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.MANUAL,
        amount: 3
      },
      order: 1
    },
    {
      id: S.featureId(183, 2),
      label: 'Rejuvenation',
      description:
        'Rejuvenation. If it has a phylactery, a destroyed lich gains a new body in 1d10 days, regaining all its hit points and becoming active again.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(183, 502),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(183, 602), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_LICH_REJUVENATION
        })
      ],
      order: 2
    },
    {
      id: S.featureId(183, 3),
      label: 'Spellcasting',
      description:
        'Spellcasting. The lich is an 18th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 20, +12 to hit with spell attacks). The lich has the following wizard spells prepared: Cantrips (at will): mage hand, prestidigitation, ray of frost 1st level (4 slots): detect magic, magic missile, shield, thunderwave 2nd level (3 slots): acid arrow, detect thoughts, invisibility, mirror image 3rd level (3 slots): animate dead, counterspell, dispel magic, fireball 4th level (3 slots): blight, dimension door 5th level (3 slots): cloudkill, scrying 6th level (1 slot): disintegrate, globe of invulnerability 7th level (1 slot): finger of death, plane shift 8th level (1 slot): dominate monster, power word stun 9th level (1 slot): power word kill',
      grants: S.slottedSpellcastingGrants(
        183,
        S.ABILITY_CODE.INTELLIGENCE,
        [S.SPELL_IDS.MAGE_HAND, S.SPELL_IDS.PRESTIDIGITATION, S.SPELL_IDS.RAY_OF_FROST],
        [
          {
            level: 1,
            slots: 4,
            spellIds: [
              S.SPELL_IDS.DETECT_MAGIC,
              S.SPELL_IDS.MAGIC_MISSILE,
              S.SPELL_IDS.SHIELD,
              S.SPELL_IDS.THUNDERWAVE
            ]
          },
          {
            level: 2,
            slots: 3,
            spellIds: [
              S.SPELL_IDS.ACID_ARROW,
              S.SPELL_IDS.DETECT_THOUGHTS,
              S.SPELL_IDS.INVISIBILITY,
              S.SPELL_IDS.MIRROR_IMAGE
            ]
          },
          {
            level: 3,
            slots: 3,
            spellIds: [
              S.SPELL_IDS.ANIMATE_DEAD,
              S.SPELL_IDS.COUNTERSPELL,
              S.SPELL_IDS.DISPEL_MAGIC,
              S.SPELL_IDS.FIREBALL
            ]
          },
          { level: 4, slots: 3, spellIds: [S.SPELL_IDS.BLIGHT, S.SPELL_IDS.DIMENSION_DOOR] },
          { level: 5, slots: 3, spellIds: [S.SPELL_IDS.CLOUDKILL, S.SPELL_IDS.SCRYING] },
          {
            level: 6,
            slots: 1,
            spellIds: [S.SPELL_IDS.DISINTEGRATE, S.SPELL_IDS.GLOBE_OF_INVULNERABILITY]
          },
          { level: 7, slots: 1, spellIds: [S.SPELL_IDS.FINGER_OF_DEATH, S.SPELL_IDS.PLANE_SHIFT] },
          {
            level: 8,
            slots: 1,
            spellIds: [S.SPELL_IDS.DOMINATE_MONSTER, S.SPELL_IDS.POWER_WORD_STUN]
          },
          { level: 9, slots: 1, spellIds: [S.SPELL_IDS.POWER_WORD_KILL] }
        ]
      ),
      order: 3
    },
    {
      id: S.featureId(183, 4),
      label: 'Turn Resistance',
      description:
        'Turn Resistance. The lich has advantage on saving throws against any effect that turns undead.',
      order: 4
    },
    {
      id: S.featureId(183, 5),
      label: 'Paralyzing Touch',
      description:
        'Paralyzing Touch. Melee Spell Attack: +12 to hit, reach 5 ft., one creature. Hit: 10 (3d6) cold damage. The target must succeed on a DC 18 Constitution saving throw or be paralyzed for 1 minute. The target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.',
      effects: [
        {
          id: S.actionId(2794, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_SPELL_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(2794, 2),
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
              id: S.actionId(2794, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(2794, 903),
                resultKind: 'SEQUENCE' as const,
                duration: {
                  id: S.actionId(2794, 904),
                  durationKind: DURATION_KIND.MINUTE,
                  amount: 1
                },
                outcomes: [
                  {
                    id: S.actionId(2794, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('COLD'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d6'
                  },
                  S.conditionSave({
                    id: S.actionId(2794, 4),
                    savingThrowId: S.actionId(2794, 901),
                    ability: 'CONSTITUTION',
                    dc: 18,
                    conditionOutcomeId: S.actionId(2794, 902),
                    conditionId: conditionTypeId('PARALYZED'),
                    repeatsAtTurnEnd: true
                  })
                ]
              }
            }
          ]
        }
      ],
      order: 5
    },
    {
      id: S.featureId(183, 6),
      options: [
        {
          id: '00000000-0005-00c9-0070-00b700000000',
          label: 'Cantrip',
          description: 'The lich casts a cantrip.',
          order: 1,
          effects: [
            {
              id: '00000000-0005-01f5-0070-00b700000000',
              order: 1,
              invocation: {
                kind: 'ACTION',
                triggerCode: 'ACTIVATED',
                activation: { code: 'ACTION', amount: 1 },
                range: { id: '00000000-0005-0259-0070-00b700000000', rangeKind: 'SPECIAL' },
                resourceUse: { chargeId: S.legendaryActionId(2794, 21), cost: 1 }
              },
              grantedSpellCast: { spellKind: 'CANTRIP' },
              paths: []
            }
          ]
        },
        {
          id: '00000000-0005-00ca-0070-00b700000000',
          label: 'Paralyzing Touch (Costs 2 Actions)',
          description: 'The lich uses its Paralyzing Touch.',
          order: 2,
          actionReference: { featureId: S.featureId(183, 5), chargeCost: 2 }
        },
        {
          id: '00000000-0005-00cb-0070-00b700000000',
          label: 'Frightening Gaze (Costs 2 Actions)',
          description:
            "The lich fixes its gaze on one creature it can see within 10 feet of it. The target must succeed on a DC 18 Wisdom saving throw against this magic or become frightened for 1 minute. The frightened target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. If a target's saving throw is successful or the effect ends for it, the target is immune to the lich's gaze for the next 24 hours.",
          order: 3
        },
        {
          id: '00000000-0005-00cc-0070-00b700000000',
          label: 'Disrupt Life (Costs 3 Actions)',
          description:
            'Each non-undead creature within 20 feet of the lich must make a DC 18 Constitution saving throw against this magic, taking 21 (6d6) necrotic damage on a failed save, or half as much damage on a successful one.',
          order: 4
        }
      ],
      ruleDefinitionIds: [S.DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID],
      label: 'Legendary Actions',
      section: 'LEGENDARY_ACTION',
      description:
        "The lich can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The lich regains spent legendary actions at the start of its turn.",
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.legendaryActionId(2794, 21),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.MANUAL,
        amount: 3
      },
      order: 6
    }
  ]
}
