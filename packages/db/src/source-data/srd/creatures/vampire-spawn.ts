import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const vampireSpawn: CreatureAuthored = {
  id: S.CREATURE_IDS.VAMPIRE_SPAWN,
  label: 'Vampire Spawn',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.UNDEAD,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 16,
    CONSTITUTION: 16,
    INTELLIGENCE: 11,
    WISDOM: 10,
    CHARISMA: 12,
    SPELLCASTING: 0
  },
  armorClass: 15,
  armorClassNote: 'natural armor',
  hitPoints: 82,
  hitDice: '11d8+33',
  speeds: [...S.walk(30), ...S.climb(30)],
  proficiencies: [
    S.grantedSkillProficiency(1668, 1, 'PERCEPTION', 'STEALTH')
  ],
  damageResistances: ['necrotic'],
  conditionImmunities: ['charmed', 'exhaustion'],
  senses: ['darkvision 60 ft.'],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_5,
  xp: 1800,
  features: [
    {
      id: S.featureId(1668, 1),
      label: 'Regeneration',
      description: 'Regeneration. The vampire spawn regains hit points at the start of its turn unless it is in sunlight or running water.',
      order: 1
    },
    {
      id: S.featureId(1668, 2),
      label: 'Spider Climb',
      description: 'Spider Climb. The vampire spawn can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.',
      order: 2
    },
    {
      id: S.featureId(1668, 3),
      label: 'Bite',
      description: 'Bite. Melee Weapon Attack: +6 to hit, reach 5 ft., one willing creature, or a creature that is grappled by the vampire spawn, incapacitated, or restrained. Hit: 7 (1d6 + 4) piercing damage plus 10 (3d6) necrotic damage. The target’s hit point maximum is reduced by an amount equal to the necrotic damage taken.',
      order: 3
    },
    {
      id: S.featureId(1668, 4),
      label: 'Claws',
      description: 'Claws. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 8 (2d4 + 4) slashing damage.',
      capabilities: [
        {
          id: S.actionId(1668, 1),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(1668, 2),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 5,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
            }
          },
          branches: [
            {
              id: S.actionId(1668, 3),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('SLASHING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '2d4+4'
            }
          ]
        }
      ],
      order: 4
    }
  ]
}
