import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import {
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  DURATION_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  VALUE_DOMAIN_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SUBJECT,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const sanctuary: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.SANCTUARY,
  label: 'Sanctuary',
  description:
    "<p>You ward a creature within range against attack. Until the spell ends, any creature who targets the warded creature with an attack or a harmful spell must first make a Wisdom saving throw. On a failed save, the creature must choose a new target or lose the attack or spell. This spell doesn't protect the warded creature from area effects, such as the explosion of a fireball. If the warded creature makes an attack or casts a spell that affects an enemy creature, this spell ends.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 1,
  classIds: [CLASS_IDS.CLERIC],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a small silver mirror',
  magicSchoolId: schoolId('ABJURATION'),
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  effects: [
    {
      id: spellChildId(SPELL_IDS.SANCTUARY, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.BONUS_ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.SANCTUARY, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.WILLING
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.SANCTUARY, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.SANCTUARY, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.SANCTUARY, 0x213, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            // The ward ends when the warded creature attacks or casts a spell that affects an enemy.
            lifecycle: {
              endOnTriggers: [
                { event: 'ACTION_TRAIT' as const, trait: 'ATTACK_ROLL', against: 'ENEMY' as const },
                { event: 'ACTION_TRAIT' as const, trait: 'SPELL_CAST', against: 'ENEMY' as const }
              ]
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.SANCTUARY, 0x212, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {
                  modifiers: [
                    {
                      id: spellChildId(SPELL_IDS.SANCTUARY, 0x214, 1),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.INCOMING_ATTACK_GATE,
                      domain: {},
                      modifierKind: MODIFIER_KIND.ENABLE,
                      payload: {
                        savingThrow: {
                          id: spellChildId(SPELL_IDS.SANCTUARY, 0x215, 1),
                          dcMethod: 'SOURCE_SAVE_DC' as const,
                          abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM
                        }
                      },
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      order: 1
                    }
                  ]
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
