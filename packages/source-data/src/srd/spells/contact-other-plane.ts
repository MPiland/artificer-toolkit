import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DAMAGE_VALUE_KIND,
  EFFECT_KIND,
  RANGE_KIND,
  SCALING,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { SRD_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import {
  conditionTypeId,
  damageTypeId,
  schoolId,
  spellChildId,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from './shared.js'
export const contactOtherPlane: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.CONTACT_OTHER_PLANE,
  label: 'Contact Other Plane',
  description:
    "<p>You mentally contact a demigod, the spirit of a long-dead sage, or some other mysterious entity from another plane. Contacting this extraplanar intelligence can strain or even break your mind. When you cast this spell, make a DC 15 Intelligence saving throw. On a failure, you take 6d6 psychic damage and are insane until you finish a long rest. While insane, you can't take actions, can't understand what other creatures say, can't read, and speak only in gibberish. A greater restoration spell cast on you ends this effect. On a successful save, you can ask the entity up to five questions. You must ask your questions before the spell ends. The GM answers each question with one word, such as &quot;yes,&quot; &quot;no,&quot; &quot;maybe,&quot; &quot;never,&quot; &quot;irrelevant,&quot; or &quot;unclear&quot; (if the entity doesn't know the answer to the question). If a one-word answer would be misleading, the GM might instead offer a short phrase as an answer.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 5,
  classIds: [CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL],
  magicSchoolId: schoolId('DIVINATION'),
  attributes: [SPELL_ATTRIBUTE.RITUAL],
  effects: [
    {
      id: spellChildId(SPELL_IDS.CONTACT_OTHER_PLANE, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.CONTACT_OTHER_PLANE, 0x214, 1),
          dcMethod: 'FIXED_DC',
          abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.INTELLIGENCE,
          baseDc: 15
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.CONTACT_OTHER_PLANE, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: 'SELF'
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.CONTACT_OTHER_PLANE, 0x215, 1),
          order: 1,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.CONTACT_OTHER_PLANE, 0x215, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            // Insane until a long rest: no actions (incapacitated). Not understanding, reading or
            // speaking stays with the description, and so do the answers to a made save: a GM ruling
            // cannot follow a saving throw.
            lifecycle: {
              endTriggers: [
                { event: 'LIFECYCLE' as const, timing: 'END' as const, code: 'ON_LONG_REST' }
              ]
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.CONTACT_OTHER_PLANE, 0x216, 1),
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: damageTypeId('PSYCHIC'),
                valueKind: DAMAGE_VALUE_KIND.DICE,
                scalingKind: SCALING.NONE,
                diceConfig: '6d6'
              },
              {
                id: spellChildId(SPELL_IDS.CONTACT_OTHER_PLANE, 0x217, 1),
                effectKind: EFFECT_KIND.CONDITION,
                conditionId: conditionTypeId('INCAPACITATED')
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
