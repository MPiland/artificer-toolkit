import {
  ACTIVATION_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  DAMAGE_BONUS_KIND,
  DAMAGE_DEFENSE_BYPASS_CODE,
  DAMAGE_VALUE_KIND,
  DURATION_KIND,
  EFFECT_KIND,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  SCALING,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  type EffectAuthored
} from '@artificer-toolkit/shared'
import { damageTypeId } from '../spells/shared.js'
import { ABILITY_CODE } from '../vocabulary.js'

/** The id of one authored row of the owning Feature, by its group. */
type RowId = (group: number) => string
/** Pact of the Blade's action: binds a held melee weapon, which Lifedrinker's damage names. */
export function pactOfTheBladeEffect(rowId: RowId): EffectAuthored {
  return {
    id: rowId(0x60),
    order: 1,
    invocation: {
      kind: 'ACTION',
      triggerCode: TRIGGER.ACTIVATED,
      activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
      range: { id: rowId(0x69), rangeKind: RANGE_KIND.SELF },
      targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
    },
    paths: [
      {
        id: rowId(0x80),
        order: 1,
        pathCode: PATH_CODE.ON_USE,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        chosenItem: {
          category: EQUIPMENT_CATEGORY_CODE.WEAPON,
          requiredProperties: [EQUIPMENT_PROPERTY_CODE.MELEE]
        },
        resultBlock: {
          id: `${rowId(0x81)}__result`,
          resultKind: 'SEQUENCE',
          duration: { id: rowId(0x83), durationKind: DURATION_KIND.UNTIL_DISPELLED },
          lifecycle: { endOnEvents: ['ON_CHOSEN_ITEM_RELEASED'] },
          outcomes: [
            {
              id: rowId(0x82),
              effectKind: EFFECT_KIND.END_EFFECTS,
              scope: 'ALL',
              selectors: [{ kind: 'SAME_EFFECT' }]
            },
            {
              id: rowId(0x84),
              effectKind: EFFECT_KIND.APPLY_GRANT,
              bindsChosenItem: true,
              grants: {
                modifiers: [
                  {
                    id: rowId(0x85),
                    grantKind: GRANT_KIND.MODIFIER_GRANT,
                    valueDomainCode: VALUE_DOMAIN_CODE.WEAPON_PROFICIENCY,
                    domain: {},
                    modifierKind: MODIFIER_KIND.ENABLE,
                    scope: MODIFIER_SCOPE_KIND.SOURCE,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    order: 1
                  },
                  {
                    id: rowId(0x86),
                    grantKind: GRANT_KIND.MODIFIER_GRANT,
                    valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_TRAIT,
                    domain: { trait: DAMAGE_DEFENSE_BYPASS_CODE.MAGICAL },
                    modifierKind: MODIFIER_KIND.ENABLE,
                    scope: MODIFIER_SCOPE_KIND.SOURCE,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    order: 2
                  }
                ]
              }
            }
          ]
        }
      }
    ]
  }
}

/** Lifedrinker's extra necrotic damage on a hit with the weapon the named pact Effect binds. */
export function lifedrinkerEffect(
  rowId: RowId,
  pactEffectId: string,
  triggerCode: typeof TRIGGER.MELEE_WEAPON_ATTACK | typeof TRIGGER.RANGED_WEAPON_ATTACK
): EffectAuthored {
  return {
    id: rowId(0x60),
    order: 1,
    invocation: {
      kind: 'PASSIVE',
      triggerCode,
      range: { id: rowId(0x69), rangeKind: RANGE_KIND.SPECIAL },
      targeting: {
        selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
        dispositionKind: TARGET_DISPOSITION_KIND.HOSTILE
      }
    },
    paths: [
      {
        id: rowId(0x80),
        order: 1,
        pathCode: PATH_CODE.ON_HIT,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        restrictions: {
          id: rowId(0x83),
          groups: [
            {
              id: rowId(0x84),
              order: 0,
              contexts: [
                {
                  id: rowId(0x85),
                  order: 0,
                  subject: 'EQUIPMENT',
                  authoringModeKind: AUTHORING_MODE_KIND.ALL,
                  conditions: [
                    {
                      id: rowId(0x86),
                      order: 0,
                      kind: 'PREDICATE',
                      constraint: 'INCLUDE',
                      predicateCode: 'BOUND_BY_EFFECT',
                      effectIds: [pactEffectId]
                    }
                  ]
                }
              ]
            }
          ]
        },
        resultBlock: {
          id: `${rowId(0x81)}__result`,
          resultKind: 'SINGLE',
          outcomes: [
            {
              id: rowId(0x82),
              effectKind: EFFECT_KIND.DAMAGE,
              damageTypeId: damageTypeId('NECROTIC'),
              valueKind: DAMAGE_VALUE_KIND.FIXED,
              scalingKind: SCALING.NONE,
              amount: 0,
              bonuses: [
                {
                  id: rowId(0x87),
                  bonusKind: DAMAGE_BONUS_KIND.ABILITY_BONUS,
                  ability: ABILITY_CODE.CHARISMA,
                  min: 1,
                  order: 1
                }
              ]
            }
          ]
        }
      }
    ]
  }
}
