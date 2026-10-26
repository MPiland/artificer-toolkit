import {
  SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS,
  ABILITY_CODE
} from '../vocabulary.js'
import {
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SHAPE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  VALUE_DOMAIN_CODE,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const slow: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.SLOW,
  label: 'Slow',
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  description:
    "<p>You alter time around up to six creatures of your choice in a 40-foot cube within range. Each target must succeed on a Wisdom saving throw or be affected by this spell for the duration. An affected target's speed is halved, it takes a -2 penalty to AC and Dexterity saving throws, and it can't use reactions. On its turn, it can use either an action or a bonus action, not both. Regardless of the creature's abilities or magic items, it can't make more than one melee or ranged attack during its turn. If the creature attempts to cast a spell with a casting time of 1 action, roll a d20. On an 11 or higher, the spell doesn't take effect until the creature's next turn, and the creature must use its action on that turn to complete the spell. If it can't, the spell is wasted. A creature affected by this spell makes another Wisdom saving throw at the end of its turn. On a successful save, the effect ends for it.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 3,
  classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a drop of molasses',
  magicSchoolId: schoolId('TRANSMUTATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.SLOW, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.SLOW, 0x211, 1),
          dcMethod: 'SOURCE_SAVE_DC',
          abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.SLOW, 0x212, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 120,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        shape: {
          id: spellChildId(SPELL_IDS.SLOW, 0x213, 1),
          shapeKind: SHAPE_KIND.CUBE,
          edgeLength: {
            amount: 40,
            unit: MEASUREMENT_UNIT_CODE.FEET
          }
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.SLOW, 0x214, 1),
          order: 1,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            // A repeat-save result block is an Encounter active effect, so it carries its own UUID.
            id: spellChildId(SPELL_IDS.SLOW, 0x219, 1),
            resultKind: 'SEQUENCE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.SLOW, 0x215, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.SLOW, 0x214, 1),
                // The delayed 1-action spell (the d20 roll) stays with the description.
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {
                  modifiers: [
                    {
                      id: spellChildId(SPELL_IDS.SLOW, 0x216, 1),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.SPEED,
                      domain: {},
                      modifierKind: MODIFIER_KIND.MULTIPLY,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { numerator: 1, denominator: 2 },
                      order: 1
                    },
                    {
                      id: spellChildId(SPELL_IDS.SLOW, 0x216, 2),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ARMOR_CLASS,
                      domain: {},
                      modifierKind: MODIFIER_KIND.PENALTY,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { valueKind: 'FIXED', amount: 2 },
                      order: 2
                    },
                    {
                      id: spellChildId(SPELL_IDS.SLOW, 0x216, 3),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
                      domain: { ability: ABILITY_CODE.DEXTERITY },
                      modifierKind: MODIFIER_KIND.PENALTY,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { valueKind: 'FIXED', amount: 2 },
                      order: 3
                    },
                    {
                      id: spellChildId(SPELL_IDS.SLOW, 0x216, 4),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.REACTION_COUNT,
                      domain: {},
                      modifierKind: MODIFIER_KIND.SET_VALUE,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { amount: 0 },
                      order: 4
                    },
                    {
                      id: spellChildId(SPELL_IDS.SLOW, 0x216, 5),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ACTION_BONUS_ACTION_EXCLUSIVITY,
                      domain: {},
                      modifierKind: MODIFIER_KIND.ENABLE,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      order: 5
                    },
                    {
                      id: spellChildId(SPELL_IDS.SLOW, 0x216, 6),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ATTACKS_PER_ATTACK_ACTION,
                      domain: {},
                      modifierKind: MODIFIER_KIND.CAP_VALUE,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { amount: 1 },
                      order: 6
                    }
                  ]
                }
              },
              {
                id: spellChildId(SPELL_IDS.SLOW, 0x217, 1),
                effectKind: EFFECT_KIND.FOLLOW_UP_SAVE,
                timing: 'TARGET_TURN_END' as const,
                savingThrow: {
                  id: spellChildId(SPELL_IDS.SLOW, 0x218, 1),
                  dcMethod: 'SOURCE_SAVE_DC' as const,
                  abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM
                },
                attempts: { kind: 'ONCE' as const, repeatOnFailure: true },
                onSuccess: { kind: 'END' as const },
                onFailure: { kind: 'CONTINUE' as const }
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
