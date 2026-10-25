import {
  ACTIVATION_CODE,
  ATTACK_DOMAIN_CODE,
  AUTHORING_SELECTION_KIND,
  CASTING_TIME_UNIT_CODE,
  DAMAGE_DIE_RECIPIENT,
  DURATION_KIND,
  EFFECT_KIND,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  ROLLED_DIE_SIGN,
  SPELL_ATTRIBUTE,
  SPELL_COMPONENT,
  SUBJECT,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { SRD_MAGIC_SCHOOLS, SRD_SYSTEM_ID, SRD_USER_ID, ABILITY_CODE } from '../vocabulary.js'
import { spellChildId } from './shared.js'
function schoolId(code: string): string {
  const entry = SRD_MAGIC_SCHOOLS.find((s) => s.code === code)
  if (!entry) {
    throw new Error(`SRD magic school vocabulary entry for ${code} required for spell source data.`)
  }
  return entry.id
}
const grant = {
  grantKind: GRANT_KIND.MODIFIER_GRANT,
  scope: MODIFIER_SCOPE_KIND.GLOBAL,
  selectionKind: AUTHORING_SELECTION_KIND.GRANTED
} as const
// The size change itself stays with the reader; the floor of Reduce's damage is the System's 0.
const sizeChanges = [
  {
    label: 'Enlarge',
    description:
      'The target grows one size category, has advantage on Strength checks and Strength saving throws, and its weapon attacks deal 1d4 extra damage.',
    sign: ROLLED_DIE_SIGN.ADD,
    influence: 'ADVANTAGE'
  },
  {
    label: 'Reduce',
    description:
      'The target shrinks one size category, has disadvantage on Strength checks and Strength saving throws, and its weapon attacks deal 1d4 less damage.',
    sign: ROLLED_DIE_SIGN.SUBTRACT,
    influence: 'DISADVANTAGE'
  }
] as const
export const enlargeReduce: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.ENLARGE_REDUCE,
  label: 'Enlarge/Reduce',
  description:
    "<p>You cause a creature or an object you can see within range to grow larger or smaller for the duration. Choose either a creature or an object that is neither worn nor carried. If the target is unwilling, it can make a Constitution saving throw. On a success, the spell has no effect. If the target is a creature, everything it is wearing and carrying changes size with it. Any item dropped by an affected creature returns to normal size at once. Enlarge. The target's size doubles in all dimensions, and its weight is multiplied by eight. This growth increases its size by one category- from Medium to Large, for example. If there isn't enough room for the target to double its size, the creature or object attains the maximum possible size in the space available. Until the spell ends, the target also has advantage on Strength checks and Strength saving throws. The target's weapons also grow to match its new size. While these weapons are enlarged, the target's attacks with them deal 1d4 extra damage. Reduce. The target's size is halved in all dimensions, and its weight is reduced to one-eighth of normal. This reduction decreases its size by one category-from Medium to Small, for example. Until the spell ends, the target also has disadvantage on Strength checks and Strength saving throws. The target's weapons also shrink to match its new size. While these weapons are reduced, the target's attacks with them deal 1d4 less damage (this can't reduce the damage below 1).</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a pinch of powdered iron',
  magicSchoolId: schoolId('TRANSMUTATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.ENLARGE_REDUCE, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.ENLARGE_REDUCE, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.ENLARGE_REDUCE, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.CHOICE,
          originKind: 'SOURCE' as const,
          selectionKind: 'CHOICE' as const,
          options: sizeChanges.map((change, index) => ({
            id: spellChildId(SPELL_IDS.ENLARGE_REDUCE, 0x220, index + 1),
            order: index + 1,
            label: change.label,
            description: change.description,
            resultBlock: {
              id: spellChildId(SPELL_IDS.ENLARGE_REDUCE, 0x221, index + 1),
              resultKind: 'SINGLE' as const,
              duration: {
                id: spellChildId(SPELL_IDS.ENLARGE_REDUCE, 0x222, index + 1),
                durationKind: DURATION_KIND.MINUTE,
                amount: 1
              },
              outcomes: [
                {
                  id: spellChildId(SPELL_IDS.ENLARGE_REDUCE, 0x223, index + 1),
                  effectKind: EFFECT_KIND.APPLY_GRANT,
                  grants: {
                    modifiers: [
                      ...[ATTACK_DOMAIN_CODE.MELEE, ATTACK_DOMAIN_CODE.RANGED].map(
                        (attackDomain) => ({
                          ...grant,
                          valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
                          domain: { attackDomain },
                          modifierKind: MODIFIER_KIND.ADD_BONUS_DIE,
                          payload: {
                            count: 1,
                            faces: 4 as const,
                            sign: change.sign,
                            recipient: DAMAGE_DIE_RECIPIENT.HOLDER_DEALS,
                            damageTypeSource: 'ATTACK' as const
                          }
                        })
                      ),
                      {
                        ...grant,
                        valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_CHECK,
                        domain: { ability: ABILITY_CODE.STRENGTH },
                        modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
                        payload: { influence: change.influence }
                      },
                      {
                        ...grant,
                        valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
                        domain: { ability: ABILITY_CODE.STRENGTH },
                        modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
                        payload: { influence: change.influence }
                      }
                    ].map((modifier, grantIndex) => ({
                      id: spellChildId(SPELL_IDS.ENLARGE_REDUCE, 0x224 + index, grantIndex + 1),
                      ...modifier,
                      order: grantIndex + 1
                    }))
                  }
                }
              ]
            }
          }))
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
