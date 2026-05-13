import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const giantOctopus: CreatureAuthored = {
  id: S.CREATURE_IDS.GIANT_OCTOPUS,
  label: 'Giant Octopus',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.LARGE,
  abilityScores: {
    STRENGTH: 17,
    DEXTERITY: 13,
    CONSTITUTION: 13,
    INTELLIGENCE: 4,
    WISDOM: 10,
    CHARISMA: 4,
    SPELLCASTING: 0
  },
  armorClass: 11,
  hitPoints: 52,
  hitDice: '8d10+8',
  speeds: [...S.walk(10), ...S.swim(60)],
  proficiencies: [S.grantedSkillProficiency(3505, 1, 'PERCEPTION', 'STEALTH')],
  senses: ['darkvision 60 ft.'],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_1,
  xp: 200,
  features: [
    {
      id: S.featureId(128, 1),
      label: 'Hold Breath',
      description: 'Hold Breath. While out of water, the octopus can hold its breath for 1 hour.',
      order: 1
    },
    {
      id: S.featureId(128, 2),
      label: 'Underwater Camouflage',
      description: 'Underwater Camouflage. The octopus has advantage on Dexterity (Stealth) checks made while underwater.',
      order: 2
    },
    {
      id: S.featureId(128, 3),
      label: 'Tentacles',
      description: 'Tentacles. Melee Weapon Attack: +5 to hit, reach 15 ft., one target. Hit: 10 (2d6 + 3) bludgeoning damage. The target is grappled (escape DC 16). Until this grapple ends, the target is restrained and the octopus cannot use tentacles on another target.',
      order: 3
    },
    {
      id: S.featureId(128, 4),
      label: 'Ink Cloud (Recharges after a Short or Long Rest)',
      description: 'Ink Cloud (Recharges after a Short or Long Rest). A 20-foot-radius cloud of ink extends all around the octopus if it is underwater. The area is heavily obscured for 1 minute, though a significant current can disperse the ink. After releasing the ink, the octopus can take the Dash action as a bonus action.',
      order: 4
    }
  ]
}

