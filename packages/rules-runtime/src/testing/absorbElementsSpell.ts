import {
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  EFFECT_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE
} from '@artificer-toolkit/shared'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'
import { spellChildId } from '@artificer-toolkit/source-data/srd/spells/shared.js'
import { SRD_DAMAGE_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { testUuid } from './dnd5eSrdEncounter.js'

export const ABSORB_ELEMENTS_ID = testUuid(0xae0)
/** The extra damage of the spell's follow-up grant, in the one fixed amount a grant carries. */
export const ABSORB_ELEMENTS_MELEE_BONUS = 2

/**
 * A user-authored reaction in the shape of Absorb Elements (not SRD 5.1): when its caster takes damage
 * of one of the chosen types, it grants resistance to those types and, until the start of the caster's
 * next turn, extra damage on melee attacks. It is built from the same core options as the SRD
 * Shield, with nothing specific to the spell.
 */
export function absorbElementsSpell(
  damageTypeCodes: readonly [string, ...string[]]
): SpellAuthored {
  const damageTypeIds = damageTypeCodes.map((code) => {
    const type = SRD_DAMAGE_TYPES.find((candidate) => candidate.code === code)
    if (!type) throw new Error(`The SRD ${code} damage type is missing.`)
    return type.id
  })
  const grantShape = {
    grantKind: GRANT_KIND.MODIFIER_GRANT,
    scope: MODIFIER_SCOPE_KIND.GLOBAL,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED
  } as const
  const childId = (bucket: number, index: number) => spellChildId(ABSORB_ELEMENTS_ID, bucket, index)
  return {
    ...shield,
    id: ABSORB_ELEMENTS_ID,
    label: 'Absorb Elements',
    description:
      '<p>The spell captures some of the incoming energy. You have resistance to the triggering damage type until the start of your next turn, and your melee attacks deal extra damage until then.</p>',
    effects: [
      {
        id: childId(0x210, 1),
        order: 1,
        invocation: {
          kind: 'ACTION' as const,
          triggerCode: TRIGGER.ACTIVATED,
          activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
          reactionTrigger: { kind: 'DAMAGE_TAKEN' as const, damageTypeIds },
          range: { id: childId(0x211, 1), rangeKind: RANGE_KIND.SELF },
          targeting: { selectionKind: 'SELF' }
        },
        paths: [
          {
            id: childId(0x212, 1),
            order: 1,
            pathCode: PATH_CODE.ON_USE,
            groupType: PATH_GROUP_TYPE.SINGLE,
            originKind: 'SOURCE' as const,
            selectionKind: 'FIXED' as const,
            resultBlock: {
              id: `${childId(0x212, 1)}__result`,
              resultKind: 'SINGLE' as const,
              duration: {
                id: childId(0x213, 1),
                durationKind: 'ROUND' as const,
                amount: 1
              },
              lifecycle: { turnAnchor: { actor: 'SOURCE', boundary: 'START_OF_TURN' } },
              outcomes: [
                {
                  id: childId(0x212, 1),
                  effectKind: EFFECT_KIND.APPLY_GRANT,
                  grants: {
                    modifiers: [
                      ...damageTypeIds.map((damageTypeId, index) => ({
                        ...grantShape,
                        id: childId(0x214, index + 1),
                        valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE_RESISTANCE,
                        domain: {},
                        modifierKind: MODIFIER_KIND.ADD_OPTION,
                        payload: { damageTypeId },
                        order: index + 1
                      })),
                      {
                        ...grantShape,
                        id: childId(0x215, 1),
                        valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
                        domain: { attackDomain: 'MELEE' as const },
                        modifierKind: MODIFIER_KIND.BONUS,
                        payload: {
                          valueKind: 'FIXED' as const,
                          amount: ABSORB_ELEMENTS_MELEE_BONUS
                        },
                        order: damageTypeIds.length + 1
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
}
