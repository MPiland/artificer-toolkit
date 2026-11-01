import { compileEffect, type CompiledModifierGrant } from '@artificer-toolkit/shared/compilers'
import { describe, expect, it } from 'vitest'

import { collectOnHitRiders } from '../character/characterOnHitRiders.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import { unconditionalSneakAttack } from '../testing/unconditionalSneakAttack.js'

const GRANTING_EFFECT_ID = testUuid(0xb01)
const rider = compileEffect(unconditionalSneakAttack(testUuid(0xb02)).effects![0]!)

const optionModifier = (optionEffectId: string, label: string): CompiledModifierGrant => ({
  id: testUuid(0xb03),
  order: 1,
  grantKind: 'MODIFIER_GRANT',
  selectionKind: 'GRANTED',
  valueDomainCode: 'GRANTED_ACTION_OPTION',
  domain: { grantedByEffectId: GRANTING_EFFECT_ID },
  modifierKind: 'ADD_OPTION',
  scope: 'SOURCE',
  payload: { optionEffectId, label }
})

describe('an Effect a GRANTED_ACTION_OPTION modifier names', () => {
  it('is a free optional rider of the granted action alone, under the modifier’s label', () => {
    const [named] = collectOnHitRiders([rider], 'owner', 'Feature', [
      optionModifier(rider.id, 'Knock prone')
    ])

    expect(named).toMatchObject({
      riderId: rider.id,
      label: 'Knock prone',
      optionalOnHit: { kind: 'FREE' },
      grantedByEffectId: GRANTING_EFFECT_ID
    })
  })

  it('leaves an Effect no modifier names an ordinary rider of every attack', () => {
    const [ordinary] = collectOnHitRiders([rider], 'owner', 'Feature', [
      optionModifier(testUuid(0xb04), 'Knock prone')
    ])

    expect(ordinary).toMatchObject({ riderId: rider.id, label: 'Feature' })
    expect(ordinary).not.toHaveProperty('optionalOnHit')
    expect(ordinary).not.toHaveProperty('grantedByEffectId')
  })
})
