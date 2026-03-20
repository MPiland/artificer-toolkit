import {
  ACTIVATION_CODE,
  CASTING_TIME_UNIT_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  EFFECT_KIND,
  RANGE_KIND,
  SCALING,
  SCALING_SOURCE,
  TARGET_SELECTION_KIND,
  SUBJECT,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const shockingGrasp: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.SHOCKING_GRASP,
  label: 'Shocking Grasp',
  description:
    'Lightning springs from your hand to deliver a shock to a creature you try to touch. On a hit, the target takes lightning damage, and it cannot take reactions until the start of its next turn.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 0,
  classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('EVOCATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.SHOCKING_GRASP, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.SPELL_ATTACK,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.SHOCKING_GRASP, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Deliver the shock to one creature you can touch.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.SHOCKING_GRASP, 0x212, 1),
          branch: BRANCH.ON_HIT,
          groupType: BRANCH_GROUP_TYPE.SEQUENTIAL,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: damageTypeId('LIGHTNING'),
          valueKind: 'DICE',
          scalingKind: SCALING.PER_LEVEL,
          scalingSource: SCALING_SOURCE.CHARACTER_LEVEL,
          levels: [
            { id: spellChildId(SPELL_IDS.SHOCKING_GRASP, 0x212, 2), level: 1, order: 1, diceConfig: '1d8' },
            { id: spellChildId(SPELL_IDS.SHOCKING_GRASP, 0x212, 3), level: 5, order: 2, diceConfig: '2d8' },
            { id: spellChildId(SPELL_IDS.SHOCKING_GRASP, 0x212, 4), level: 11, order: 3, diceConfig: '3d8' },
            { id: spellChildId(SPELL_IDS.SHOCKING_GRASP, 0x212, 5), level: 17, order: 4, diceConfig: '4d8' }
          ]
        },
        {
          id: spellChildId(SPELL_IDS.SHOCKING_GRASP, 0x213, 1),
          branch: BRANCH.ON_HIT,
          groupType: BRANCH_GROUP_TYPE.SEQUENTIAL,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Rider',
          description:
            'On a hit, the target cannot take reactions until the start of its next turn.'
        },
        {
          id: spellChildId(SPELL_IDS.SHOCKING_GRASP, 0x214, 1),
          branch: BRANCH.ON_MISS,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Miss',
          description: 'On a miss, the shock has no effect.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
