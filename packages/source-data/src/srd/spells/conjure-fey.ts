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
/** The SRD fey of challenge rating 6 or lower, then the beasts of that rating a fey spirit may take the form of: one is conjured. */
const feyForms = [
  [CREATURE_IDS.BLINK_DOG, 'Blink Dog', 1],
  [CREATURE_IDS.DRYAD, 'Dryad', 1],
  [CREATURE_IDS.GREEN_HAG, 'Green Hag', 1],
  [CREATURE_IDS.SATYR, 'Satyr', 1],
  [CREATURE_IDS.SEA_HAG, 'Sea Hag', 1],
  [CREATURE_IDS.SPRITE, 'Sprite', 1],
  [CREATURE_IDS.APE, 'Ape', 1],
  [CREATURE_IDS.AXE_BEAK, 'Axe Beak', 1],
  [CREATURE_IDS.BABOON, 'Baboon', 1],
  [CREATURE_IDS.BADGER, 'Badger', 1],
  [CREATURE_IDS.BAT, 'Bat', 1],
  [CREATURE_IDS.BLACK_BEAR, 'Black Bear', 1],
  [CREATURE_IDS.BLOOD_HAWK, 'Blood Hawk', 1],
  [CREATURE_IDS.BOAR, 'Boar', 1],
  [CREATURE_IDS.BROWN_BEAR, 'Brown Bear', 1],
  [CREATURE_IDS.CAMEL, 'Camel', 1],
  [CREATURE_IDS.CAT, 'Cat', 1],
  [CREATURE_IDS.CONSTRICTOR_SNAKE, 'Constrictor Snake', 1],
  [CREATURE_IDS.CRAB, 'Crab', 1],
  [CREATURE_IDS.CROCODILE, 'Crocodile', 1],
  [CREATURE_IDS.DEER, 'Deer', 1],
  [CREATURE_IDS.DIRE_WOLF, 'Dire Wolf', 1],
  [CREATURE_IDS.DRAFT_HORSE, 'Draft Horse', 1],
  [CREATURE_IDS.EAGLE, 'Eagle', 1],
  [CREATURE_IDS.ELEPHANT, 'Elephant', 1],
  [CREATURE_IDS.ELK, 'Elk', 1],
  [CREATURE_IDS.FLYING_SNAKE, 'Flying Snake', 1],
  [CREATURE_IDS.FROG, 'Frog', 1],
  [CREATURE_IDS.GIANT_BADGER, 'Giant Badger', 1],
  [CREATURE_IDS.GIANT_BAT, 'Giant Bat', 1],
  [CREATURE_IDS.GIANT_BOAR, 'Giant Boar', 1],
  [CREATURE_IDS.GIANT_CENTIPEDE, 'Giant Centipede', 1],
  [CREATURE_IDS.GIANT_CONSTRICTOR_SNAKE, 'Giant Constrictor Snake', 1],
  [CREATURE_IDS.GIANT_CRAB, 'Giant Crab', 1],
  [CREATURE_IDS.GIANT_CROCODILE, 'Giant Crocodile', 1],
  [CREATURE_IDS.GIANT_EAGLE, 'Giant Eagle', 1],
  [CREATURE_IDS.GIANT_ELK, 'Giant Elk', 1],
  [CREATURE_IDS.GIANT_FIRE_BEETLE, 'Giant Fire Beetle', 1],
  [CREATURE_IDS.GIANT_FROG, 'Giant Frog', 1],
  [CREATURE_IDS.GIANT_GOAT, 'Giant Goat', 1],
  [CREATURE_IDS.GIANT_HYENA, 'Giant Hyena', 1],
  [CREATURE_IDS.GIANT_LIZARD, 'Giant Lizard', 1],
  [CREATURE_IDS.GIANT_OCTOPUS, 'Giant Octopus', 1],
  [CREATURE_IDS.GIANT_OWL, 'Giant Owl', 1],
  [CREATURE_IDS.GIANT_POISONOUS_SNAKE, 'Giant Poisonous Snake', 1],
  [CREATURE_IDS.GIANT_RAT, 'Giant Rat', 1],
  [CREATURE_IDS.GIANT_SCORPION, 'Giant Scorpion', 1],
  [CREATURE_IDS.GIANT_SEA_HORSE, 'Giant Sea Horse', 1],
  [CREATURE_IDS.GIANT_SHARK, 'Giant Shark', 1],
  [CREATURE_IDS.GIANT_SPIDER, 'Giant Spider', 1],
  [CREATURE_IDS.GIANT_TOAD, 'Giant Toad', 1],
  [CREATURE_IDS.GIANT_VULTURE, 'Giant Vulture', 1],
  [CREATURE_IDS.GIANT_WASP, 'Giant Wasp', 1],
  [CREATURE_IDS.GIANT_WEASEL, 'Giant Weasel', 1],
  [CREATURE_IDS.GIANT_WOLF_SPIDER, 'Giant Wolf Spider', 1],
  [CREATURE_IDS.GOAT, 'Goat', 1],
  [CREATURE_IDS.HAWK, 'Hawk', 1],
  [CREATURE_IDS.HUNTER_SHARK, 'Hunter Shark', 1],
  [CREATURE_IDS.HYENA, 'Hyena', 1],
  [CREATURE_IDS.JACKAL, 'Jackal', 1],
  [CREATURE_IDS.KILLER_WHALE, 'Killer Whale', 1],
  [CREATURE_IDS.LION, 'Lion', 1],
  [CREATURE_IDS.LIZARD, 'Lizard', 1],
  [CREATURE_IDS.MAMMOTH, 'Mammoth', 1],
  [CREATURE_IDS.MASTIFF, 'Mastiff', 1],
  [CREATURE_IDS.MULE, 'Mule', 1],
  [CREATURE_IDS.OCTOPUS, 'Octopus', 1],
  [CREATURE_IDS.OWL, 'Owl', 1],
  [CREATURE_IDS.PANTHER, 'Panther', 1],
  [CREATURE_IDS.PLESIOSAURUS, 'Plesiosaurus', 1],
  [CREATURE_IDS.POISONOUS_SNAKE, 'Poisonous Snake', 1],
  [CREATURE_IDS.POLAR_BEAR, 'Polar Bear', 1],
  [CREATURE_IDS.PONY, 'Pony', 1],
  [CREATURE_IDS.QUIPPER, 'Quipper', 1],
  [CREATURE_IDS.RAT, 'Rat', 1],
  [CREATURE_IDS.RAVEN, 'Raven', 1],
  [CREATURE_IDS.REEF_SHARK, 'Reef Shark', 1],
  [CREATURE_IDS.RHINOCEROS, 'Rhinoceros', 1],
  [CREATURE_IDS.RIDING_HORSE, 'Riding Horse', 1],
  [CREATURE_IDS.SABER_TOOTHED_TIGER, 'Saber-Toothed Tiger', 1],
  [CREATURE_IDS.SCORPION, 'Scorpion', 1],
  [CREATURE_IDS.SEA_HORSE, 'Sea Horse', 1],
  [CREATURE_IDS.SPIDER, 'Spider', 1],
  [CREATURE_IDS.STIRGE, 'Stirge', 1],
  [CREATURE_IDS.SWARM_OF_BATS, 'Swarm of Bats', 1],
  [CREATURE_IDS.SWARM_OF_INSECTS, 'Swarm of Insects', 1],
  [CREATURE_IDS.SWARM_OF_POISONOUS_SNAKES, 'Swarm of Poisonous Snakes', 1],
  [CREATURE_IDS.SWARM_OF_QUIPPERS, 'Swarm of Quippers', 1],
  [CREATURE_IDS.SWARM_OF_RATS, 'Swarm of Rats', 1],
  [CREATURE_IDS.SWARM_OF_RAVENS, 'Swarm of Ravens', 1],
  [CREATURE_IDS.TIGER, 'Tiger', 1],
  [CREATURE_IDS.TRICERATOPS, 'Triceratops', 1],
  [CREATURE_IDS.VULTURE, 'Vulture', 1],
  [CREATURE_IDS.WARHORSE, 'Warhorse', 1],
  [CREATURE_IDS.WEASEL, 'Weasel', 1],
  [CREATURE_IDS.WOLF, 'Wolf', 1]
] as const
export const conjureFey: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.CONJURE_FEY,
  label: 'Conjure Fey',
  description:
    "<p>You summon a fey creature of challenge rating 6 or lower, or a fey spirit that takes the form of a beast of challenge rating 6 or lower. It appears in an unoccupied space that you can see within range. The fey creature disappears when it drops to 0 hit points or when the spell ends. The fey creature is friendly to you and your companions for the duration. Roll initiative for the creature, which has its own turns. It obeys any verbal commands that you issue to it (no action required by you), as long as they don't violate its alignment. If you don't issue any commands to the fey creature, it defends itself from hostile creatures but otherwise takes no actions. If your concentration is broken, the fey creature doesn't disappear. Instead, you lose control of the fey creature, it becomes hostile toward you and your companions, and it might attack. An uncontrolled fey creature can't be dismissed by you, and it disappears 1 hour after you summoned it. The GM has the fey creature's statistics. At Higher Levels. When you cast this spell using a spell slot of 7th level or higher, the challenge rating increases by 1 for each slot level above 6th.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.MINUTE, amount: 1 },
  level: 6,
  classIds: [CLASS_IDS.DRUID, CLASS_IDS.WARLOCK],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('CONJURATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.CONJURE_FEY, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.CONJURE_FEY, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 90,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.CONJURE_FEY, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.CONJURE_FEY, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.CONJURE_FEY, 0x213, 1),
              durationKind: DURATION_KIND.HOUR,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.CONJURE_FEY, 0x212, 1),
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: MANIFEST_KIND.SUMMON,
                // The creature has its own initiative and turns (D200) and is fey whatever form it
                // takes; when Concentration breaks it stays and turns hostile. Its 1-hour limit once
                // uncontrolled and the higher slots' challenge rating are GM rulings.
                turnTiming: 'OWN_INITIATIVE',
                turnsHostileOnRelease: true,
                forms: conjuredCreatureForms(SPELL_IDS.CONJURE_FEY, feyForms),
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
