import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const octopus: CreatureAuthored = {
  id: S.CREATURE_IDS.OCTOPUS,
  label: 'Octopus',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.SMALL,
  abilityScores: {
    STRENGTH: 4,
    DEXTERITY: 15,
    CONSTITUTION: 11,
    INTELLIGENCE: 3,
    WISDOM: 10,
    CHARISMA: 4,
    SPELLCASTING: 0
  },
  armorClass: 12,
  hitPoints: 3,
  hitDice: '1d6',
  speeds: [...S.walk(5), ...S.swim(30)],
  proficiencies: [S.grantedSkillProficiency(7953, 1, 'PERCEPTION', 'STEALTH')],
  senses: ['darkvision 30 ft.'],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_0,
  xp: 10,
  features: [
    {
      id: S.featureId(7953, 1),
      label: 'Hold Breath',
      description: 'Hold Breath. While out of water, the octopus can hold its breath for 30 minutes.',
      order: 1
    },
    {
      id: S.featureId(7953, 2),
      label: 'Underwater Camouflage',
      description: 'Underwater Camouflage. The octopus has advantage on Dexterity (Stealth) checks made while underwater.',
      order: 2
    },
    {
      id: S.featureId(7953, 3),
      label: 'Tentacles',
      description: 'Tentacles. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 1 bludgeoning damage, and the target is grappled (escape DC 10).',
      order: 3
    },
    {
      id: S.featureId(7953, 4),
      label: 'Ink Cloud (Recharges after a Short or Long Rest)',
      description: 'Ink Cloud (Recharges after a Short or Long Rest). A 5-foot-radius cloud of ink extends all around the octopus if it is underwater. The area is heavily obscured for 1 minute, though a significant current can disperse the ink. After releasing the ink, the octopus can take the Dash action as a bonus action.',
      order: 4
    }
  ]
}

