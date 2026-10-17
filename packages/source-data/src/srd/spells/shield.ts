import {
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  RANGE_KIND,
  SUBJECT,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  SPELL_COMPONENT,
  type ModifierGrantAuthored,
  type ReactionTriggerBindingAuthored,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

/**
 * One reaction that raises AC by 5 until the start of the caster's next turn, answering `reactionTrigger`
 * and also granting `extraModifiers`. Its ids run from `base` (0x210 and 0x220 are the two reactions).
 */
const shieldReaction = (
  base: number,
  order: number,
  reactionTrigger: ReactionTriggerBindingAuthored,
  extraModifiers: ModifierGrantAuthored[] = []
) => ({
  id: spellChildId(SPELL_IDS.SHIELD, base, 1),
  order,
  invocation: {
    kind: 'ACTION' as const,
    triggerCode: TRIGGER.ACTIVATED,
    activation: {
      code: ACTIVATION_CODE.REACTION,
      amount: 1
    },
    reactionTrigger,
    range: {
      id: spellChildId(SPELL_IDS.SHIELD, base + 1, 1),
      rangeKind: RANGE_KIND.SELF
    },
    targeting: {
      selectionKind: 'SELF' as const
    }
  },
  paths: [
    {
      id: spellChildId(SPELL_IDS.SHIELD, base + 2, 1),
      order: 1,
      pathCode: PATH_CODE.ON_USE,
      groupType: PATH_GROUP_TYPE.SINGLE,
      originKind: 'SOURCE' as const,
      selectionKind: 'FIXED' as const,
      resultBlock: {
        id: spellChildId(SPELL_IDS.SHIELD, base + 2, 1) + '__result',
        resultKind: 'SINGLE' as const,
        duration: {
          id: spellChildId(SPELL_IDS.SHIELD, base + 3, 1),
          durationKind: 'ROUND' as const,
          amount: 1
        },
        lifecycle: { turnAnchor: { actor: 'SOURCE' as const, boundary: 'START_OF_TURN' as const } },
        outcomes: [
          {
            id: spellChildId(SPELL_IDS.SHIELD, base + 2, 1),
            effectKind: EFFECT_KIND.APPLY_GRANT,
            grants: {
              modifiers: [
                {
                  id: spellChildId(SPELL_IDS.SHIELD, base + 4, 1),
                  grantKind: GRANT_KIND.MODIFIER_GRANT,
                  valueDomainCode: VALUE_DOMAIN_CODE.ARMOR_CLASS,
                  domain: {},
                  modifierKind: MODIFIER_KIND.BONUS,
                  scope: MODIFIER_SCOPE_KIND.GLOBAL,
                  selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                  payload: {
                    valueKind: 'FIXED' as const,
                    amount: 5
                  },
                  order: 1
                },
                ...extraModifiers
              ]
            }
          }
        ]
      }
    }
  ]
})

export const shield: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.SHIELD,
  label: 'Shield',
  description:
    '<p>An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC, including against the triggering attack, and you take no damage from magic missile.</p>',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 1,
  classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('ABJURATION'),
  effects: [
    shieldReaction(0x210, 1, { kind: 'ATTACKED_SELF' }),
    shieldReaction(
      0x220,
      2,
      { kind: 'TARGETED_SELF', sourceEffectIds: [SPELL_IDS.MAGIC_MISSILE] },
      [
        {
          id: spellChildId(SPELL_IDS.SHIELD, 0x225, 1),
          grantKind: GRANT_KIND.MODIFIER_GRANT,
          valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE_IMMUNITY,
          domain: {},
          modifierKind: MODIFIER_KIND.ADD_OPTION,
          scope: MODIFIER_SCOPE_KIND.GLOBAL,
          selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
          payload: {
            damageTypeId: damageTypeId('FORCE'),
            sourceEffectIds: [SPELL_IDS.MAGIC_MISSILE]
          },
          order: 2
        }
      ]
    )
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
