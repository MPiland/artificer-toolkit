import { describe, expect, it } from 'vitest'

import { encounterHeldActorIds } from '../encounterRelationshipActionFacts.js'
import { escapeGrappleEffectDefinition } from '../testing/escapeGrappleEffectFixture.js'

const ENCOUNTER = '00000000-0000-4000-8000-000000000001'

const hold = (grapplerId: string) => ({
  id: `hold-by-${grapplerId}`,
  definition: escapeGrappleEffectDefinition({
    encounterId: ENCOUNTER,
    grapplerId,
    conditionIds: []
  })
})

describe('the creatures a source holds (heldBySource targeting, ATTACK-7.2)', () => {
  it('lists the actors holding an effect the source applied, and no other', () => {
    const held = encounterHeldActorIds(
      new Map([
        ['held-by-mound', [hold('mound')]],
        ['held-by-other', [hold('other')]],
        ['free', []]
      ]),
      'mound'
    )
    expect([...held]).toEqual(['held-by-mound'])
  })
})
