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
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  VALUE_DOMAIN_CODE,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { sourceTraitRestriction } from '../classes/mechanics.js'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { conditionTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const freedomOfMovement: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.FREEDOM_OF_MOVEMENT,
  label: 'Freedom of Movement',
  description:
    "<p>You touch a willing creature. For the duration, the target's movement is unaffected by difficult terrain, and spells and other magical effects can neither reduce the target's speed nor cause the target to be paralyzed or restrained. The target can also spend 5 feet of movement to automatically escape from nonmagical restraints, such as manacles or a creature that has it grappled. Finally, being underwater imposes no penalties on the target's movement or attacks.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 4,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC, CLASS_IDS.DRUID, CLASS_IDS.RANGER],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a leather strap, bound around the arm or a similar appendage',
  magicSchoolId: schoolId('ABJURATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.FREEDOM_OF_MOVEMENT, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.FREEDOM_OF_MOVEMENT, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.WILLING
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.FREEDOM_OF_MOVEMENT, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.FREEDOM_OF_MOVEMENT, 0x212, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.FREEDOM_OF_MOVEMENT, 0x213, 1),
              durationKind: DURATION_KIND.HOUR,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.FREEDOM_OF_MOVEMENT, 0x212, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {
                  // Spells and other magical effects cannot paralyze or restrain the target.
                  modifiers: (['PARALYZED', 'RESTRAINED'] as const).map((code, index) => ({
                    id: spellChildId(SPELL_IDS.FREEDOM_OF_MOVEMENT, 0x214, index + 1),
                    grantKind: GRANT_KIND.MODIFIER_GRANT,
                    valueDomainCode: VALUE_DOMAIN_CODE.CONDITION_IMMUNITY,
                    domain: {},
                    modifierKind: MODIFIER_KIND.ADD_OPTION,
                    scope: MODIFIER_SCOPE_KIND.GLOBAL,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    payload: { conditionTypeId: conditionTypeId(code) },
                    restrictions: sourceTraitRestriction(
                      (entry) =>
                        spellChildId(
                          SPELL_IDS.FREEDOM_OF_MOVEMENT,
                          0x220 + index * 0x10,
                          entry + 1
                        ),
                      'INCLUDE',
                      ['MAGICAL']
                    ),
                    order: index + 1
                  }))
                }
              },
              {
                id: spellChildId(SPELL_IDS.FREEDOM_OF_MOVEMENT, 0x215, 1),
                effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                label: 'Freedom of Movement',
                reasonCode: 'GM_CHOICE' as const,
                instructions:
                  "For the duration, the target's movement is unaffected by difficult terrain, and spells and other magical effects can't reduce the target's speed. The target can spend 5 feet of movement to automatically escape from nonmagical restraints, such as manacles or a creature that has it grappled. Being underwater imposes no penalties on the target's movement or attacks."
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
