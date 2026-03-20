import {
  ABILITY_CODE,
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SHAPE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { SRD_MAGIC_SCHOOLS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
import { spellChildId } from './shared.js'

function schoolId(code: string): string {
  const entry = SRD_MAGIC_SCHOOLS.find((s) => s.code === code)
  if (!entry) throw new Error(`SRD magic school vocabulary entry for ${code} required for spell source data.`)
  return entry.id
}

export const hypnoticPattern: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.HYPNOTIC_PATTERN,
  label: 'Hypnotic Pattern',
  description:
    'You create a twisting pattern of colors that weaves through the air inside a 30-foot cube within range. The pattern appears for a moment and vanishes. Each creature in the area who sees the pattern must make a Wisdom saving throw. On a failed save, the creature becomes charmed for the duration.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 3,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.SORCERER, CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('ILLUSION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.HYPNOTIC_PATTERN, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.HYPNOTIC_PATTERN, 0x214, 1),
          savingThrowKind: 'SOURCE_SAVE_DC',
          ability: ABILITY_CODE.WISDOM
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.HYPNOTIC_PATTERN, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 120,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        shape: {
          id: spellChildId(SPELL_IDS.HYPNOTIC_PATTERN, 0x212, 1),
          shapeKind: SHAPE_KIND.CUBE,
          edgeLength: {
            amount: 30,
            unit: MEASUREMENT_UNIT_CODE.FEET
          }
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          detail: 'Affect creatures in the 30-foot cube who can see the pattern.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.HYPNOTIC_PATTERN, 0x213, 1),
          branch: BRANCH.ON_SAVE_FAIL,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.HYPNOTIC_PATTERN, 0x215, 1),
            durationKind: DURATION_KIND.MINUTE,
            amount: 1
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Hypnotic Pattern',
          description:
            'Creatures that fail the saving throw are charmed and incapacitated with speed 0 for the duration until the spell is broken in the normal SRD ways. This still needs a richer incapacitation and break-condition model.'
        },
        {
          id: spellChildId(SPELL_IDS.HYPNOTIC_PATTERN, 0x216, 1),
          branch: BRANCH.ON_SAVE_SUCCESS,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Unaffected',
          description: 'A creature that succeeds on the saving throw is unaffected by the pattern.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
