import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const hydra: CreatureAuthored = {
  id: S.CREATURE_IDS.HYDRA,
  label: 'Hydra',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.HUGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 20,
    DEXTERITY: 12,
    CONSTITUTION: 20,
    INTELLIGENCE: 2,
    WISDOM: 10,
    CHARISMA: 7,
  },
  armorClass: 15,
  armorClassNote: 'natural armor',
  hitPoints: 172,
  hitDice: {
    count: 15,
    die: 12,
    modifier: 75,
  },
  speeds: [...S.walk(30), ...S.swim(30)],
  proficiencies: [
    S.grantedSkillProficiency(169, 1, 'PERCEPTION')
  ],
  senses: ['darkvision 60 ft.'],
  passivePerception: 16,
  challengeRatingId: S.CR.CR_8,
  xp: 3900,
  features: [
    {
      id: S.featureId(169, 1),
      label: 'Hold Breath',
      description: 'Hold Breath. The hydra can hold its breath for 1 hour.',
      order: 1
    },
    {
      id: S.featureId(169, 2),
      label: 'Multiple Heads',
      description: 'Multiple Heads. The hydra has five heads. While it has more than one head, the hydra has advantage on saving throws against being blinded, charmed, deafened, frightened, stunned, and knocked unconscious. Whenever the hydra takes 25 or more damage in a single turn, one of its heads dies. At the end of each of its turns, it regains 10 hit points for each head it lost since its last turn, provided it still has at least one head. If all its heads die, the hydra dies.',
      order: 2
    },
    {
      id: S.featureId(169, 3),
      label: 'Reactive Heads',
      description: 'Reactive Heads. For each head the hydra has beyond one, it gets an extra reaction that can be used only for opportunity attacks.',
      order: 3
    },
    {
      id: S.featureId(169, 4),
      label: 'Wakeful',
      description: 'Wakeful. While the hydra sleeps, at least one of its heads is awake.',
      order: 4
    },
    {
      id: S.featureId(169, 5),
      label: 'Multiattack',
      description: 'Multiattack. The hydra makes as many bite attacks as it has heads.',
      order: 5
    },
    {
      id: S.featureId(169, 6),
      label: 'Bite',
      description: 'Melee Weapon Attack: +8 to hit, reach 10 ft., one target. Hit: 10 (1d10 + 5) piercing damage.',
      order: 6
    }
  ]
}

