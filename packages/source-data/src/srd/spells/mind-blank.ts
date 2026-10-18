import {
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  VALUE_DOMAIN_CODE,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import {
  conditionTypeId,
  damageTypeId,
  schoolId,
  spellChildId,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from './shared.js'
export const mindBlank: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.MIND_BLANK,
  label: 'Mind Blank',
  description:
    "<p>Until the spell ends, one willing creature you touch is immune to psychic damage, any effect that would sense its emotions or read its thoughts, divination spells, and the charmed condition. The spell even foils wish spells and spells or effects of similar power used to affect the target's mind or to gain information about the target.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 8,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('ABJURATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.MIND_BLANK, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.MIND_BLANK, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.MIND_BLANK, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.MIND_BLANK, 0x212, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.MIND_BLANK, 0x213, 1),
              durationKind: DURATION_KIND.HOUR,
              amount: 24
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.MIND_BLANK, 0x212, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {
                  modifiers: [
                    {
                      id: spellChildId(SPELL_IDS.MIND_BLANK, 0x214, 1),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE_IMMUNITY,
                      domain: {},
                      modifierKind: MODIFIER_KIND.ADD_OPTION,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { damageTypeId: damageTypeId('PSYCHIC') },
                      order: 1
                    },
                    {
                      id: spellChildId(SPELL_IDS.MIND_BLANK, 0x214, 2),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.CONDITION_IMMUNITY,
                      domain: {},
                      modifierKind: MODIFIER_KIND.ADD_OPTION,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { conditionTypeId: conditionTypeId('CHARMED') },
                      order: 2
                    }
                  ]
                }
              },
              {
                id: spellChildId(SPELL_IDS.MIND_BLANK, 0x215, 1),
                effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                label: 'Mind Blank',
                reasonCode: 'GM_CHOICE' as const,
                instructions:
                  "Until the spell ends, one willing creature you touch is immune to psychic damage, any effect that would sense its emotions or read its thoughts, divination spells, and the charmed condition. The spell even foils wish spells and spells or effects of similar power used to affect the target's mind or to gain information about the target."
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
