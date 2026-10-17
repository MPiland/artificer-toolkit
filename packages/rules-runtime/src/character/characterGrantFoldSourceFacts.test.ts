import { describe, expect, it } from 'vitest'
import type { CompiledModifierGrant } from '@artificer-toolkit/shared/compilers'
import type { ModifierKind, ValueDomainCode } from '@artificer-toolkit/shared/core'

import { buildCharacterGrantFoldModifierFacts } from './characterGrantFoldSourceFacts.js'

const strengthDamage: CompiledModifierGrant = {
  id: 'strength-damage',
  order: 1,
  grantKind: 'MODIFIER_GRANT',
  selectionKind: 'GRANTED',
  valueDomainCode: 'DAMAGE',
  modifierKind: 'ABILITY_MODIFIER_BONUS',
  scope: 'SOURCE',
  domain: { attackDomain: 'MELEE' },
  payload: { ability: 'STRENGTH' },
  restrictions: {
    id: 'strength-damage-restriction',
    groups: [
      {
        id: 'strength-damage-group',
        order: 0,
        contexts: [
          {
            id: 'strength-damage-spells',
            order: 0,
            subject: 'SPELL',
            authoringModeKind: 'SELECTED',
            spellIds: ['shillelagh']
          }
        ]
      }
    ]
  }
}

function retarget(
  grant: CompiledModifierGrant,
  valueDomainCode: ValueDomainCode,
  modifierKind: ModifierKind
): CompiledModifierGrant {
  return { ...grant, id: `${grant.id}-${valueDomainCode}`, valueDomainCode, modifierKind }
}

describe('character grant fold modifier facts', () => {
  it('folds flat compiled modifier grants by their independent domain and kind', () => {
    const facts = buildCharacterGrantFoldModifierFacts([
      strengthDamage,
      retarget(strengthDamage, 'ATTACK_ROLL', 'ABILITY_MODIFIER_BONUS')
    ])

    expect(facts).toMatchObject([
      {
        grantId: 'strength-damage',
        valueDomainCode: 'DAMAGE',
        modifierKind: 'ABILITY_MODIFIER_BONUS',
        domain: { attackDomain: 'MELEE' },
        scopeSpellIds: ['shillelagh']
      },
      {
        grantId: 'strength-damage-ATTACK_ROLL',
        valueDomainCode: 'ATTACK_ROLL',
        modifierKind: 'ABILITY_MODIFIER_BONUS',
        domain: { attackDomain: 'MELEE' },
        scopeSpellIds: ['shillelagh']
      }
    ])
  })
})
