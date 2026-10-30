import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
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
import { creatureTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const findFamiliar: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.FIND_FAMILIAR,
  label: 'Find Familiar',
  description:
    "<p>You gain the service of a familiar, a spirit that takes an animal form you choose: bat, cat, crab, frog (toad), hawk, lizard, octopus, owl, poisonous snake, fish (quipper), rat, raven, sea horse, spider, or weasel. Appearing in an unoccupied space within range, the familiar has the statistics of the chosen form, though it is a celestial, fey, or fiend (your choice) instead of a beast. Your familiar acts independently of you, but it always obeys your commands. In combat, it rolls its own initiative and acts on its own turn. A familiar can't attack, but it can take other actions as normal. When the familiar drops to 0 hit points, it disappears, leaving behind no physical form. It reappears after you cast this spell again While your familiar is within 100 feet of you, you can communicate with it telepathically. Additionally, as an action, you can see through your familiar's eyes and hear what it hears until the start of your next turn, gaining the benefits of any special senses that the familiar has. During this time, you are deaf and blind with regard to your own senses. As an action, you can temporarily dismiss your familiar. It disappears into a pocket dimension where it awaits your summons. Alternatively, you can dismiss it forever. As an action while it is temporarily dismissed, you can cause it to reappear in any unoccupied space within 30 feet of you. You can't have more than one familiar at a time. If you cast this spell while you already have a familiar, you instead cause it to adopt a new form. Choose one of the forms from the above list. Your familiar transforms into the chosen creature. Finally, when you cast a spell with a range of touch, your familiar can deliver the spell as if it had cast the spell. Your familiar must be within 100 feet of you, and it must use its reaction to deliver the spell when you cast it. If the spell requires an attack roll, you use your attack modifier for the roll.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.HOUR, amount: 1 },
  level: 1,
  classIds: [CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription:
    '10 gp worth of charcoal, incense, and herbs that must be consumed by fire in a brass brazier',
  magicSchoolId: schoolId('CONJURATION'),
  attributes: [SPELL_ATTRIBUTE.RITUAL],
  effects: [
    {
      id: spellChildId(SPELL_IDS.FIND_FAMILIAR, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.FIND_FAMILIAR, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 10,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.FIND_FAMILIAR, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.FIND_FAMILIAR, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.FIND_FAMILIAR, 0x212, 1),
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: MANIFEST_KIND.SUMMON,
                forms: [
                  {
                    id: spellChildId(SPELL_IDS.FIND_FAMILIAR, 0x214, 1),
                    order: 1,
                    label: 'Bat',
                    creatureId: CREATURE_IDS.BAT,
                    maxTargets: 1
                  },
                  {
                    id: spellChildId(SPELL_IDS.FIND_FAMILIAR, 0x214, 2),
                    order: 2,
                    label: 'Cat',
                    creatureId: CREATURE_IDS.CAT,
                    maxTargets: 1
                  },
                  {
                    id: spellChildId(SPELL_IDS.FIND_FAMILIAR, 0x214, 3),
                    order: 3,
                    label: 'Crab',
                    creatureId: CREATURE_IDS.CRAB,
                    maxTargets: 1
                  },
                  {
                    id: spellChildId(SPELL_IDS.FIND_FAMILIAR, 0x214, 4),
                    order: 4,
                    label: 'Frog (Toad)',
                    creatureId: CREATURE_IDS.FROG,
                    maxTargets: 1
                  },
                  {
                    id: spellChildId(SPELL_IDS.FIND_FAMILIAR, 0x214, 5),
                    order: 5,
                    label: 'Hawk',
                    creatureId: CREATURE_IDS.HAWK,
                    maxTargets: 1
                  },
                  {
                    id: spellChildId(SPELL_IDS.FIND_FAMILIAR, 0x214, 6),
                    order: 6,
                    label: 'Lizard',
                    creatureId: CREATURE_IDS.LIZARD,
                    maxTargets: 1
                  },
                  {
                    id: spellChildId(SPELL_IDS.FIND_FAMILIAR, 0x214, 7),
                    order: 7,
                    label: 'Octopus',
                    creatureId: CREATURE_IDS.OCTOPUS,
                    maxTargets: 1
                  },
                  {
                    id: spellChildId(SPELL_IDS.FIND_FAMILIAR, 0x214, 8),
                    order: 8,
                    label: 'Owl',
                    creatureId: CREATURE_IDS.OWL,
                    maxTargets: 1
                  },
                  {
                    id: spellChildId(SPELL_IDS.FIND_FAMILIAR, 0x214, 9),
                    order: 9,
                    label: 'Poisonous Snake',
                    creatureId: CREATURE_IDS.POISONOUS_SNAKE,
                    maxTargets: 1
                  },
                  {
                    id: spellChildId(SPELL_IDS.FIND_FAMILIAR, 0x214, 10),
                    order: 10,
                    label: 'Fish (Quipper)',
                    creatureId: CREATURE_IDS.QUIPPER,
                    maxTargets: 1
                  },
                  {
                    id: spellChildId(SPELL_IDS.FIND_FAMILIAR, 0x214, 11),
                    order: 11,
                    label: 'Rat',
                    creatureId: CREATURE_IDS.RAT,
                    maxTargets: 1
                  },
                  {
                    id: spellChildId(SPELL_IDS.FIND_FAMILIAR, 0x214, 12),
                    order: 12,
                    label: 'Raven',
                    creatureId: CREATURE_IDS.RAVEN,
                    maxTargets: 1
                  },
                  {
                    id: spellChildId(SPELL_IDS.FIND_FAMILIAR, 0x214, 13),
                    order: 13,
                    label: 'Sea Horse',
                    creatureId: CREATURE_IDS.SEA_HORSE,
                    maxTargets: 1
                  },
                  {
                    id: spellChildId(SPELL_IDS.FIND_FAMILIAR, 0x214, 14),
                    order: 14,
                    label: 'Spider',
                    creatureId: CREATURE_IDS.SPIDER,
                    maxTargets: 1
                  },
                  {
                    id: spellChildId(SPELL_IDS.FIND_FAMILIAR, 0x214, 15),
                    order: 15,
                    label: 'Weasel',
                    creatureId: CREATURE_IDS.WEASEL,
                    maxTargets: 1
                  }
                ],
                // The familiar is a celestial, fey, or fiend (the caster's choice) instead of a beast.
                creatureTypeIds: [
                  creatureTypeId('CELESTIAL'),
                  creatureTypeId('FEY'),
                  creatureTypeId('FIEND')
                ]
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
