import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const antipathySympathy: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.ANTIPATHY_SYMPATHY,
  label: 'Antipathy/Sympathy',
  description:
    "<p>This spell attracts or repels creatures of your choice. You target something within range, either a Huge or smaller object or creature or an area that is no larger than a 200-foot cube. Then specify a kind of intelligent creature, such as red dragons, goblins, or vampires. You invest the target with an aura that either attracts or repels the specified creatures for the duration. Choose antipathy or sympathy as the aura's effect. Antipathy. The enchantment causes creatures of the kind you designated to feel an intense urge to leave the area and avoid the target. When such a creature can see the target or comes within 60 feet of it, the creature must succeed on a Wisdom saving throw or become frightened. The creature remains frightened while it can see the target or is within 60 feet of it. While frightened by the target, the creature must use its movement to move to the nearest safe spot from which it can't see the target. If the creature moves more than 60 feet from the target and can't see it, the creature is no longer frightened, but the creature becomes frightened again if it regains sight of the target or moves within 60 feet of it. Sympathy. The enchantment causes the specified creatures to feel an intense urge to approach the target while within 60 feet of it or able to see it.</p><p>When such a creature can see the target or comes within 60 feet of it, the creature must succeed on a Wisdom saving throw or use its movement on each of its turns to enter the area or move within reach of the target. When the creature has done so, it can't willingly move away from the target. If the target damages or otherwise harms an affected creature, the affected creature can make a Wisdom saving throw to end the effect, as described below. Ending the Effect. If an affected creature ends its turn while not within 60 feet of the target or able to see it, the creature makes a Wisdom saving throw. On a successful save, the creature is no longer affected by the target and recognizes the feeling of repugnance or attraction as magical. In addition, a creature affected by the spell is allowed another Wisdom saving throw every 24 hours while the spell persists. A creature that successfully saves against this effect is immune to it for 1 minute, after which time it can be affected again.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 8,
  classIds: [CLASS_IDS.DRUID, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription:
    'either a lump of alum soaked in vinegar for the antipathy effect or a drop of honey for the sympathy effect',
  magicSchoolId: schoolId('ENCHANTMENT'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.ANTIPATHY_SYMPATHY, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.ANTIPATHY_SYMPATHY, 0x211, 1),
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
          id: spellChildId(SPELL_IDS.ANTIPATHY_SYMPATHY, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.CHOICE,
          originKind: 'SOURCE' as const,
          selectionKind: 'CHOICE' as const,
          // The designated creature kind, the 60-foot or sight trigger and the compelled movement have no
          // engine piece, so each aura is the GM's to rule from the description (D187a).
          options: [
            {
              label: 'Antipathy',
              instructions:
                'Creatures of the designated kind that see the target or come within 60 feet of it make a Wisdom saving throw or are frightened, and must move away until they are more than 60 feet away and cannot see it.'
            },
            {
              label: 'Sympathy',
              instructions:
                'Creatures of the designated kind that see the target or come within 60 feet of it make a Wisdom saving throw or must use their movement to approach it, and cannot willingly move away from it.'
            }
          ].map(({ label, instructions }, index) => ({
            id: spellChildId(SPELL_IDS.ANTIPATHY_SYMPATHY, 0x215, index + 1),
            order: index + 1,
            label,
            description: instructions,
            resultBlock: {
              id: spellChildId(SPELL_IDS.ANTIPATHY_SYMPATHY, 0x216, index + 1) + '__result',
              resultKind: 'SINGLE' as const,
              duration: {
                id: spellChildId(SPELL_IDS.ANTIPATHY_SYMPATHY, 0x217, index + 1),
                durationKind: DURATION_KIND.DAY,
                amount: 10
              },
              outcomes: [
                {
                  id: spellChildId(SPELL_IDS.ANTIPATHY_SYMPATHY, 0x216, index + 1),
                  effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                  label,
                  reasonCode: 'GM_CHOICE' as const,
                  instructions: `${instructions} An affected creature that ends its turn more than 60 feet from the target and unable to see it repeats the save, ending the effect on a success; it also repeats it every 24 hours. A creature that succeeds is immune for 1 minute.`
                }
              ]
            }
          }))
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
