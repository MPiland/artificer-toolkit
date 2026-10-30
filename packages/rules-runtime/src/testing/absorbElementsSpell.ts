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

const ABSORB_ELEMENTS_ID = testUuid(0xae0)
/** The id of an SRD damage type, by code. */
export function srdDamageTypeId(code: string) {
  const type = SRD_DAMAGE_TYPES.find((candidate) => candidate.code === code)
  if (!type) throw new Error(`The SRD ${code} damage type is missing.`)
  return type.id
}

/** The extra melee damage the follow-up grant adds for each level of the slot the spell is cast with. */
const ABSORB_ELEMENTS_MELEE_BONUS_PER_LEVEL = 2

/**
 * A user-authored reaction in the shape of Absorb Elements (not SRD 5.1): when its caster takes damage
 * of one of the chosen types, it grants resistance to the damage type that triggered it and, until the
 * end of the caster's next turn, extra melee damage that grows with the slot it was cast with and is
 * used up by the caster's first attack roll. It is built from the same core options as the SRD
 * Shield, with nothing specific to the spell.
 */
export function absorbElementsSpell(
  damageTypeCodes: readonly [string, ...string[]]
): SpellAuthored {
  const damageTypeIds = damageTypeCodes.map(srdDamageTypeId)
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
      '<p>The spell captures some of the incoming energy. You have resistance to the triggering damage type until the end of your next turn, and your first melee attack until then deals extra damage for each level of the spell slot.</p>',
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
              lifecycle: {
                turnAnchor: { actor: 'SOURCE', boundary: 'END_OF_TURN' },
                endTriggers: [{ event: 'LIFECYCLE', timing: 'CONSUME', code: 'ON_ATTACK_ROLL' }]
              },
              outcomes: [
                {
                  id: childId(0x212, 1),
                  effectKind: EFFECT_KIND.APPLY_GRANT,
                  grants: {
                    modifiers: [
                      {
                        ...grantShape,
                        id: childId(0x214, 1),
                        valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE_RESISTANCE,
                        domain: {},
                        modifierKind: MODIFIER_KIND.ADD_OPTION,
                        payload: { damageTypeSource: 'TRIGGER' as const },
                        order: 1
                      },
                      {
                        ...grantShape,
                        id: childId(0x215, 1),
                        valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
                        domain: { attackDomain: 'MELEE' as const },
                        modifierKind: MODIFIER_KIND.BONUS,
                        payload: {
                          valueKind: 'SPELL_SLOT_LEVEL' as const,
                          multiplier: ABSORB_ELEMENTS_MELEE_BONUS_PER_LEVEL
                        },
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
    ]
  }
}
