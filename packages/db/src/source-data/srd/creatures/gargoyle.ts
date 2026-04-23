import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const gargoyle: CreatureAuthored = {
  id: S.CREATURE_IDS.GARGOYLE,
  label: 'Gargoyle',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.ELEMENTAL,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  abilityScores: {
    STRENGTH: 15,
    DEXTERITY: 11,
    CONSTITUTION: 16,
    INTELLIGENCE: 6,
    WISDOM: 11,
    CHARISMA: 7,
    SPELLCASTING: 0
  },
  armorClass: 15,
  armorClassNote: 'natural armor',
  hitPoints: 52,
  hitDice: '7d8+21',
  speeds: [...S.walk(30), ...S.fly(60)],
  proficiencies: [
    S.grantedLanguageProficiency(108, 1, 'TERRAN')
  ],
  damageResistances: ["bludgeoning, piercing, and slashing from nonmagical attacks that aren't adamantine"],
  damageImmunities: ['poison'],
  conditionImmunities: ['exhaustion', 'petrified', 'poisoned'],
  senses: ['darkvision 60 ft.'],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_2,
  xp: 450,
  features: [
    {
      id: S.featureId(108, 1),
      label: 'False Appearance',
      description: 'False Appearance. While the gargoyle remains motionless, it is indistinguishable from an inanimate statue.',
      order: 1
    },
    {
      id: S.featureId(108, 2),
      label: 'Multiattack',
      description: 'Multiattack. The gargoyle makes two attacks: one with its bite and one with its claws.',
      order: 2
    },
    {
      id: S.featureId(108, 3),
      label: 'Bite',
      description: 'Bite. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) piercing damage.',
      order: 3
    },
    {
      id: S.featureId(108, 4),
      label: 'Claws',
      description: 'Claws. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.',
      order: 4
    }
  ],
}

