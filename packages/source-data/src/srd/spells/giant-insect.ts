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
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, CREATURE_IDS, SPELL_IDS } from '../ids.js'
import { SRD_MAGIC_SCHOOLS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
import { spellChildId } from './shared.js'
function schoolId(code: string): string {
  const entry = SRD_MAGIC_SCHOOLS.find((s) => s.code === code)
  if (!entry)
    throw new Error(`SRD magic school vocabulary entry for ${code} required for spell source data.`)
  return entry.id
}
export const giantInsect: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.GIANT_INSECT,
  label: 'Giant Insect',
  description:
    '<p>You transform up to ten centipedes, three spiders, five wasps, or one scorpion within range into giant versions of their natural forms for the duration. A centipede becomes a giant centipede, a spider becomes a giant spider, a wasp becomes a giant wasp, and a scorpion becomes a giant scorpion. Each creature obeys your verbal commands, and in combat, they act on your turn each round. The GM has the statistics for these creatures and resolves their actions and movement. A creature remains in its giant size for the duration, until it drops to 0 hit points, or until you use an action to dismiss the effect on it. The GM might allow you to choose different targets. For example, if you transform a bee, its giant version might have the same statistics as a giant wasp.</p>',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 4,
  classIds: [CLASS_IDS.DRUID],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('TRANSMUTATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.GIANT_INSECT, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.GIANT_INSECT, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY,
          maxTargets: 10
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.GIANT_INSECT, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.GIANT_INSECT, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.GIANT_INSECT, 0x213, 1),
              durationKind: DURATION_KIND.HOUR,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.GIANT_INSECT, 0x212, 1),
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: MANIFEST_KIND.CREATURE,
                excessDamageCarriesOver: false,
                forms: [
                  {
                    id: spellChildId(SPELL_IDS.GIANT_INSECT, 0x214, 1),
                    order: 1,
                    label: 'Centipedes',
                    creatureId: CREATURE_IDS.GIANT_CENTIPEDE,
                    maxTargets: 10
                  },
                  {
                    id: spellChildId(SPELL_IDS.GIANT_INSECT, 0x214, 2),
                    order: 2,
                    label: 'Spiders',
                    creatureId: CREATURE_IDS.GIANT_SPIDER,
                    maxTargets: 3
                  },
                  {
                    id: spellChildId(SPELL_IDS.GIANT_INSECT, 0x214, 3),
                    order: 3,
                    label: 'Wasps',
                    creatureId: CREATURE_IDS.GIANT_WASP,
                    maxTargets: 5
                  },
                  {
                    id: spellChildId(SPELL_IDS.GIANT_INSECT, 0x214, 4),
                    order: 4,
                    label: 'Scorpion',
                    creatureId: CREATURE_IDS.GIANT_SCORPION,
                    maxTargets: 1
                  }
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
