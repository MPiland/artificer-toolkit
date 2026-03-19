import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const clone: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.CLONE,
  label: 'Clone',
  description:
    'This spell grows an inert duplicate of a living creature as a safeguard against death. This clone forms inside a sealed vessel and grows to full size and maturity after 120 days.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.HOUR, amount: 1 },
  level: 8,
  classIds: [CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('NECROMANCY'),
  materialDescription:
    'a diamond worth at least 1,000 gp and at least 1 cubic inch of flesh of the creature to be cloned, and a vessel worth at least 2,000 gp',
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.CLONE, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.CLONE, 0x211, 1),
          rangeKind: RANGE_KIND.SPECIAL
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Prepare a clone for one living creature using the vessel and material components required by the spell.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.CLONE, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Clone',
          description:
            'Creates and matures a replacement body under the spell’s full vessel, maturity, and soul-transfer rules.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
