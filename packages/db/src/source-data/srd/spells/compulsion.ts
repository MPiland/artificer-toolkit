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
  SPELL_ATTRIBUTE,
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

export const compulsion: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.COMPULSION,
  label: 'Compulsion',
  description:
    'Creatures of your choice that you can see within range and that can hear you must make a Wisdom saving throw. A target automatically succeeds on this saving throw if it can\'t be charmed.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 4,
  classIds: [CLASS_IDS.BARD],
  magicSchoolId: schoolId('ENCHANTMENT'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.COMPULSION, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.COMPULSION, 0x214, 1),
          savingThrowKind: 'SOURCE_SAVE_DC',
          ability: ABILITY_CODE.WISDOM
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.COMPULSION, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
          detail: 'Choose creatures you can see within range that can hear you.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.COMPULSION, 0x212, 1),
          branch: BRANCH.ON_SAVE_FAIL,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.COMPULSION, 0x213, 1),
            durationKind: DURATION_KIND.MINUTE,
            amount: 1
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Compelled',
          description:
            'Affected creatures move as the spell directs for the duration. This still needs a richer forced-movement and repeated-turn compulsion model.'
        },
        {
          id: spellChildId(SPELL_IDS.COMPULSION, 0x215, 1),
          branch: BRANCH.ON_SAVE_SUCCESS,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Unaffected',
          description: 'A creature that succeeds on the saving throw is unaffected by the compulsion.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
