import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MANIFEST_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, CREATURE_IDS, SPELL_IDS } from '../ids.js'
import { conjuredCreatureForms } from './conjuredCreatureForms.js'
import { creatureTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
const animalForms = [
  [CREATURE_IDS.APE, 'Ape', 4],
  [CREATURE_IDS.AXE_BEAK, 'Axe Beak', 8],
  [CREATURE_IDS.BABOON, 'Baboon', 8],
  [CREATURE_IDS.BADGER, 'Badger', 8],
  [CREATURE_IDS.BAT, 'Bat', 8],
  [CREATURE_IDS.BLACK_BEAR, 'Black Bear', 4],
  [CREATURE_IDS.BLOOD_HAWK, 'Blood Hawk', 8],
  [CREATURE_IDS.BOAR, 'Boar', 8],
  [CREATURE_IDS.BROWN_BEAR, 'Brown Bear', 2],
  [CREATURE_IDS.CAMEL, 'Camel', 8],
  [CREATURE_IDS.CAT, 'Cat', 8],
  [CREATURE_IDS.CONSTRICTOR_SNAKE, 'Constrictor Snake', 8],
  [CREATURE_IDS.CRAB, 'Crab', 8],
  [CREATURE_IDS.CROCODILE, 'Crocodile', 4],
  [CREATURE_IDS.DEER, 'Deer', 8],
  [CREATURE_IDS.DIRE_WOLF, 'Dire Wolf', 2],
  [CREATURE_IDS.DRAFT_HORSE, 'Draft Horse', 8],
  [CREATURE_IDS.EAGLE, 'Eagle', 8],
  [CREATURE_IDS.ELK, 'Elk', 8],
  [CREATURE_IDS.FLYING_SNAKE, 'Flying Snake', 8],
  [CREATURE_IDS.FROG, 'Frog', 8],
  [CREATURE_IDS.GIANT_BADGER, 'Giant Badger', 8],
  [CREATURE_IDS.GIANT_BAT, 'Giant Bat', 8],
  [CREATURE_IDS.GIANT_BOAR, 'Giant Boar', 1],
  [CREATURE_IDS.GIANT_CENTIPEDE, 'Giant Centipede', 8],
  [CREATURE_IDS.GIANT_CONSTRICTOR_SNAKE, 'Giant Constrictor Snake', 1],
  [CREATURE_IDS.GIANT_CRAB, 'Giant Crab', 8],
  [CREATURE_IDS.GIANT_EAGLE, 'Giant Eagle', 2],
  [CREATURE_IDS.GIANT_ELK, 'Giant Elk', 1],
  [CREATURE_IDS.GIANT_FIRE_BEETLE, 'Giant Fire Beetle', 8],
  [CREATURE_IDS.GIANT_FROG, 'Giant Frog', 8],
  [CREATURE_IDS.GIANT_GOAT, 'Giant Goat', 4],
  [CREATURE_IDS.GIANT_HYENA, 'Giant Hyena', 2],
  [CREATURE_IDS.GIANT_LIZARD, 'Giant Lizard', 8],
  [CREATURE_IDS.GIANT_OCTOPUS, 'Giant Octopus', 2],
  [CREATURE_IDS.GIANT_OWL, 'Giant Owl', 8],
  [CREATURE_IDS.GIANT_POISONOUS_SNAKE, 'Giant Poisonous Snake', 8],
  [CREATURE_IDS.GIANT_RAT, 'Giant Rat', 8],
  [CREATURE_IDS.GIANT_SEA_HORSE, 'Giant Sea Horse', 4],
  [CREATURE_IDS.GIANT_SPIDER, 'Giant Spider', 2],
  [CREATURE_IDS.GIANT_TOAD, 'Giant Toad', 2],
  [CREATURE_IDS.GIANT_VULTURE, 'Giant Vulture', 2],
  [CREATURE_IDS.GIANT_WASP, 'Giant Wasp', 4],
  [CREATURE_IDS.GIANT_WEASEL, 'Giant Weasel', 8],
  [CREATURE_IDS.GIANT_WOLF_SPIDER, 'Giant Wolf Spider', 8],
  [CREATURE_IDS.GOAT, 'Goat', 8],
  [CREATURE_IDS.HAWK, 'Hawk', 8],
  [CREATURE_IDS.HUNTER_SHARK, 'Hunter Shark', 1],
  [CREATURE_IDS.HYENA, 'Hyena', 8],
  [CREATURE_IDS.JACKAL, 'Jackal', 8],
  [CREATURE_IDS.LION, 'Lion', 2],
  [CREATURE_IDS.LIZARD, 'Lizard', 8],
  [CREATURE_IDS.MASTIFF, 'Mastiff', 8],
  [CREATURE_IDS.MULE, 'Mule', 8],
  [CREATURE_IDS.OCTOPUS, 'Octopus', 8],
  [CREATURE_IDS.OWL, 'Owl', 8],
  [CREATURE_IDS.PANTHER, 'Panther', 8],
  [CREATURE_IDS.PLESIOSAURUS, 'Plesiosaurus', 1],
  [CREATURE_IDS.POISONOUS_SNAKE, 'Poisonous Snake', 8],
  [CREATURE_IDS.POLAR_BEAR, 'Polar Bear', 1],
  [CREATURE_IDS.PONY, 'Pony', 8],
  [CREATURE_IDS.QUIPPER, 'Quipper', 8],
  [CREATURE_IDS.RAT, 'Rat', 8],
  [CREATURE_IDS.RAVEN, 'Raven', 8],
  [CREATURE_IDS.REEF_SHARK, 'Reef Shark', 4],
  [CREATURE_IDS.RHINOCEROS, 'Rhinoceros', 1],
  [CREATURE_IDS.RIDING_HORSE, 'Riding Horse', 8],
  [CREATURE_IDS.SABER_TOOTHED_TIGER, 'Saber-Toothed Tiger', 1],
  [CREATURE_IDS.SCORPION, 'Scorpion', 8],
  [CREATURE_IDS.SEA_HORSE, 'Sea Horse', 8],
  [CREATURE_IDS.SPIDER, 'Spider', 8],
  [CREATURE_IDS.STIRGE, 'Stirge', 8],
  [CREATURE_IDS.SWARM_OF_BATS, 'Swarm of Bats', 8],
  [CREATURE_IDS.SWARM_OF_INSECTS, 'Swarm of Insects', 4],
  [CREATURE_IDS.SWARM_OF_POISONOUS_SNAKES, 'Swarm of Poisonous Snakes', 1],
  [CREATURE_IDS.SWARM_OF_QUIPPERS, 'Swarm of Quippers', 2],
  [CREATURE_IDS.SWARM_OF_RATS, 'Swarm of Rats', 8],
  [CREATURE_IDS.SWARM_OF_RAVENS, 'Swarm of Ravens', 8],
  [CREATURE_IDS.TIGER, 'Tiger', 2],
  [CREATURE_IDS.VULTURE, 'Vulture', 8],
  [CREATURE_IDS.WARHORSE, 'Warhorse', 4],
  [CREATURE_IDS.WEASEL, 'Weasel', 8],
  [CREATURE_IDS.WOLF, 'Wolf', 8]
] as const
export const conjureAnimals: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.CONJURE_ANIMALS,
  label: 'Conjure Animals',
  description:
    "<p>You summon fey spirits that take the form of beasts and appear in unoccupied spaces that you can see within range. Choose one of the following options for what appears: * One beast of challenge rating 2 or lower * Two beasts of challenge rating 1 or lower * Four beasts of challenge rating 1/2 or lower * Eight beasts of challenge rating 1/4 or lower Each beast is also considered fey, and it disappears when it drops to 0 hit points or when the spell ends. The summoned creatures are friendly to you and your companions. Roll initiative for the summoned creatures as a group, which has its own turns. They obey any verbal commands that you issue to them (no action required by you). If you don't issue any commands to them, they defend themselves from hostile creatures, but otherwise take no actions. The GM has the creatures' statistics. At Higher Levels. When you cast this spell using certain higher-level spell slots, you choose one of the summoning options above, and more creatures appear: twice as many with a 5th-level slot, three times as many with a 7th-level slot, and four times as many with a 9th-level slot.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 3,
  classIds: [CLASS_IDS.DRUID, CLASS_IDS.RANGER],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('CONJURATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.CONJURE_ANIMALS, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.CONJURE_ANIMALS, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 60,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.CONJURE_ANIMALS, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.CONJURE_ANIMALS, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.CONJURE_ANIMALS, 0x213, 1),
              durationKind: DURATION_KIND.HOUR,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.CONJURE_ANIMALS, 0x212, 1),
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: MANIFEST_KIND.SUMMON,
                // The group acts on one shared turn of its own (D200).
                turnTiming: 'OWN_INITIATIVE',
                forms: conjuredCreatureForms(SPELL_IDS.CONJURE_ANIMALS, animalForms),
                // Each beast is also considered fey.
                creatureTypeIds: [creatureTypeId('FEY')]
              }
            ]
          }
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
