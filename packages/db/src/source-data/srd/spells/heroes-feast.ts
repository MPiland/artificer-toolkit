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

export const heroesFeast: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.HEROES_FEAST,
  label: "Heroes' Feast",
  description:
    "You bring forth a great feast, including magnificent food and drink. The feast takes 1 hour to consume and disappears at the end of that time, and the beneficial effects don't set in until this hour is over. Up to twelve creatures can partake of the feast.",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.MINUTE, amount: 10 },
  level: 6,
  classIds: [CLASS_IDS.CLERIC, CLASS_IDS.DRUID],
  magicSchoolId: schoolId('CONJURATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.HEROES_FEAST, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.HEROES_FEAST, 0x211, 1),
          rangeKind: RANGE_KIND.SPECIAL
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
          maxTargets: 12,
          detail: 'Create a feast that up to twelve creatures can consume.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.HEROES_FEAST, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: "Heroes' Feast",
          description:
            'Creates a feast with delayed protective and restorative benefits that still exceed the current structured grant and healing model.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
