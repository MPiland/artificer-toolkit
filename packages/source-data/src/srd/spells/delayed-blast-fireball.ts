import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
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
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { SRD_MAGIC_SCHOOLS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
import { spellChildId } from './shared.js'
function schoolId(code: string): string {
  const entry = SRD_MAGIC_SCHOOLS.find((s) => s.code === code)
  if (!entry)
    throw new Error(`SRD magic school vocabulary entry for ${code} required for spell source data.`)
  return entry.id
}
export const delayedBlastFireball: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.DELAYED_BLAST_FIREBALL,
  label: 'Delayed Blast Fireball',
  description:
    "<p>A beam of yellow light flashes from your pointing finger, then condenses to linger at a chosen point within range as a glowing bead for the duration. When the spell ends, either because your concentration is broken or because you decide to end it, the bead blossoms with a low roar into an explosion of flame that spreads around corners. Each creature in a 20-foot-radius sphere centered on that point must make a Dexterity saving throw. A creature takes fire damage equal to the total accumulated damage on a failed save, or half as much damage on a successful one. The spell's base damage is 12d6. If at the end of your turn the bead has not yet detonated, the damage increases by 1d6. If the glowing bead is touched before the interval has expired, the creature touching it must make a Dexterity saving throw. On a failed save, the spell ends immediately, causing the bead to erupt in flame. On a successful save, the creature can throw the bead up to 40 feet. When it strikes a creature or a solid object, the spell ends, and the bead explodes. The fire damages objects in the area and ignites flammable objects that aren't being worn or carried. At Higher Levels. When you cast this spell using a spell slot of 8th level or higher, the base damage increases by 1d6 for each slot level above 7th.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 7,
  classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a tiny ball of bat guano and sulfur',
  magicSchoolId: schoolId('EVOCATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.DELAYED_BLAST_FIREBALL, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.DELAYED_BLAST_FIREBALL, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 150,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.DELAYED_BLAST_FIREBALL, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.DELAYED_BLAST_FIREBALL, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.DELAYED_BLAST_FIREBALL, 0x212, 1),
                effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                label: 'Detonate the Bead',
                reasonCode: 'GM_CHOICE' as const,
                instructions:
                  'When the spell ends, the bead explodes: each creature in a 20-foot-radius sphere centered on it makes a Dexterity saving throw, taking the accumulated fire damage on a failure, or half as much on a success. The damage starts at 12d6 (plus 1d6 for each slot level above 7th) and grows by 1d6 at the end of each of your turns before it detonates.'
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
