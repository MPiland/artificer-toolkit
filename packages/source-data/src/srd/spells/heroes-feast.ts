import {
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  DURATION_KIND,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  VALUE_DOMAIN_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  type SpellAuthored,
  SPELL_COMPONENT
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
import { ABILITY_CODE } from '../vocabulary.js'
export const heroesFeast: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.HEROES_FEAST,
  label: "Heroes' Feast",
  description:
    "<p>You bring forth a great feast, including magnificent food and drink. The feast takes 1 hour to consume and disappears at the end of that time, and the beneficial effects don't set in until this hour is over. Up to twelve other creatures can partake of the feast. A creature that partakes of the feast gains several benefits. The creature is cured of all diseases and poison, becomes immune to poison and being frightened, and makes all Wisdom saving throws with advantage. Its hit point maximum also increases by 2d10, and it gains the same number of hit points. These benefits last for 24 hours.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.MINUTE, amount: 10 },
  level: 6,
  classIds: [CLASS_IDS.CLERIC, CLASS_IDS.DRUID],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a gem---encrusted bowl worth at least 1,000 gp, which the spell consumes',
  magicSchoolId: schoolId('CONJURATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.HEROES_FEAST, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.HEROES_FEAST, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY,
          maxTargets: 12
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.HEROES_FEAST, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          // The disease and poison cure, the hour-long meal and the shared 2d10 hit point maximum and
          // healing are a GM ruling (D181, D187a): ending effects on a list of chosen creatures is refused.
          resultBlock: {
            id: spellChildId(SPELL_IDS.HEROES_FEAST, 0x212, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.HEROES_FEAST, 0x213, 1),
              durationKind: DURATION_KIND.HOUR,
              amount: 24
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.HEROES_FEAST, 0x212, 1),
                effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                label: "Heroes' Feast",
                reasonCode: 'GM_CHOICE' as const,
                instructions:
                  'Each creature that partakes is cured of all diseases and poison: end any poisoned condition it has. Its hit point maximum increases by 2d10 for 24 hours, and it gains the same number of hit points. The benefits set in once the hour-long feast is over.'
              },
              {
                id: spellChildId(SPELL_IDS.HEROES_FEAST, 0x214, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {
                  modifiers: [
                    {
                      id: spellChildId(SPELL_IDS.HEROES_FEAST, 0x215, 1),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE_IMMUNITY,
                      domain: {},
                      modifierKind: MODIFIER_KIND.ADD_OPTION,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { damageTypeId: damageTypeId('POISON') },
                      order: 1
                    },
                    ...(['POISONED', 'FRIGHTENED'] as const).map((code, index) => ({
                      id: spellChildId(SPELL_IDS.HEROES_FEAST, 0x215, index + 2),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.CONDITION_IMMUNITY,
                      domain: {},
                      modifierKind: MODIFIER_KIND.ADD_OPTION,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { conditionTypeId: conditionTypeId(code) },
                      order: index + 2
                    })),
                    {
                      id: spellChildId(SPELL_IDS.HEROES_FEAST, 0x215, 4),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
                      domain: { ability: ABILITY_CODE.WISDOM },
                      modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
                      payload: { influence: 'ADVANTAGE' },
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      order: 4
                    }
                  ]
                }
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
