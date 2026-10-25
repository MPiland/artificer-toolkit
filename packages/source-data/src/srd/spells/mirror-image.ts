import {
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  VALUE_DOMAIN_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
import { SRD_BLINDSIGHT_SENSE_ID, SRD_TRUESIGHT_SENSE_ID, ABILITY_CODE } from '../vocabulary.js'
export const mirrorImage: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.MIRROR_IMAGE,
  label: 'Mirror Image',
  description:
    "<p>Three illusory duplicates of yourself appear in your space. Until the spell ends, the duplicates move with you and mimic your actions, shifting position so it's impossible to track which image is real. You can use your action to dismiss the illusory duplicates. Each time a creature targets you with an attack during the spell's duration, roll a d20 to determine whether the attack instead targets one of your duplicates. If you have three duplicates, you must roll a 6 or higher to change the attack's target to a duplicate. With two duplicates, you must roll an 8 or higher. With one duplicate, you must roll an 11 or higher. A duplicate's AC equals 10 + your Dexterity modifier. If an attack hits a duplicate, the duplicate is destroyed. A duplicate can be destroyed only by an attack that hits it. It ignores all other damage and effects. The spell ends when all three duplicates are destroyed. A creature is unaffected by this spell if it can't see, if it relies on senses other than sight, such as blindsight, or if it can perceive illusions as false, as with truesight.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('ILLUSION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.MIRROR_IMAGE, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.MIRROR_IMAGE, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SELF
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.MIRROR_IMAGE, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.MIRROR_IMAGE, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.MIRROR_IMAGE, 0x213, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            // Three duplicates: each destroyed one spends a use, and the spell ends with the last.
            // The caster can dismiss them with an Action.
            lifecycle: {
              uses: 3,
              holderEnd: { activation: ACTIVATION_CODE.ACTION }
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.MIRROR_IMAGE, 0x212, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {
                  modifiers: [
                    {
                      id: spellChildId(SPELL_IDS.MIRROR_IMAGE, 0x214, 1),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_DECOYS,
                      domain: {},
                      modifierKind: MODIFIER_KIND.ENABLE,
                      payload: {
                        armorClass: { amount: 10, abilities: [ABILITY_CODE.DEXTERITY] },
                        thresholds: [
                          { remaining: 3, minimumRoll: 6 },
                          { remaining: 2, minimumRoll: 8 },
                          { remaining: 1, minimumRoll: 11 }
                        ].map((threshold, index) => ({
                          id: spellChildId(SPELL_IDS.MIRROR_IMAGE, 0x215, index + 1),
                          ...threshold
                        })),
                        exemptAttackerSenseDefinitionIds: [
                          SRD_BLINDSIGHT_SENSE_ID,
                          SRD_TRUESIGHT_SENSE_ID
                        ]
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
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
