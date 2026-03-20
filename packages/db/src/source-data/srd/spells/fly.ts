import {
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  RANGE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  MODIFIER_VALUE_SOURCE_CODE,
  VALUE_DOMAIN_CODE,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { SRD_SPEEDS } from '../vocabulary.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

const flySpeedId = SRD_SPEEDS.find((speed) => speed.code === 'FLY')?.id
if (!flySpeedId) {
  throw new Error('SRD FLY speed vocabulary entry is required for spell source data.')
}

export const fly: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.FLY,
  label: 'Fly',
  description:
    'You touch a willing creature. The target gains a flying speed of 60 feet for the duration and falls when the spell ends if it is still aloft and cannot prevent the fall.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  range: {
    id: spellChildId(SPELL_IDS.FLY, 0x201, 1),
    rangeKind: RANGE_KIND.TOUCH
  },
  duration: {
    id: spellChildId(SPELL_IDS.FLY, 0x202, 1),
    durationKind: DURATION_KIND.MINUTE,
    amount: 10
  },
  level: 3,
  classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('TRANSMUTATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  atHigherLevels:
    'When you cast this spell using a spell slot of 4th level or higher, you can target one additional creature for each slot level above 3rd.',
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.FLY, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.FLY, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.WILLING,
          detail: 'Touch one willing creature.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.FLY, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.FLY, 0x213, 1),
            durationKind: DURATION_KIND.MINUTE,
            amount: 10
          },
          effectKind: EFFECT_KIND.APPLY_GRANT,
          grants: {
            modifiers: [
              {
                id: spellChildId(SPELL_IDS.FLY, 0x214, 1),
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: VALUE_DOMAIN_CODE.SPEED,
                domain: { speedId: flySpeedId },
                modifierKind: MODIFIER_KIND.SET_VALUE,
                scope: MODIFIER_SCOPE_KIND.GLOBAL,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                payload: {
                  valueKind: MODIFIER_VALUE_SOURCE_CODE.FIXED,
                  amount: 60
                },
                order: 1
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
