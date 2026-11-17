import { describe, expect, it } from 'vitest'
import { compileSpellEffect } from '@artificer-toolkit/shared/compilers'
import { flamingSphere } from '@artificer-toolkit/source-data/srd/spells/flaming-sphere.js'
import { moonbeam } from '@artificer-toolkit/source-data/srd/spells/moonbeam.js'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { compileActionPlacement } from '../encounterActionEntryPointCompiler.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'

/** The zone a spell's cast places, compiled from the SRD spell as authored. */
function zonePlacementOf(spell: Pick<SpellAuthored, 'label' | 'attributes' | 'effects'>) {
  const [effect] = spell.effects ?? []
  if (!effect) throw new Error(`${spell.label} authors no Effect.`)
  const placement = compileActionPlacement(
    dnd5eCharacterRuleActionSystemAdapter,
    characterActionDescriptor(
      compileSpellEffect(
        { attributes: spell.attributes, effects: spell.effects ?? [] },
        { ...effect, id: ACTION_EFFECT_ID }
      ),
      2,
      20
    )
  )
  if (placement?.kind !== 'ZONE' || 'options' in placement.zonePlacement)
    throw new Error(`${spell.label} places no single zone.`)
  return placement.zonePlacement
}

describe('a zone its source moves (QUALITY-15.T3y8)', () => {
  it.each([
    { spell: flamingSphere, activation: 'BONUS_ACTION', amount: 30 },
    { spell: moonbeam, activation: 'ACTION', amount: 60 }
  ])(
    'compiles $spell.label with its authored move, held by Concentration',
    ({ spell, activation, amount }) => {
      const zone = zonePlacementOf(spell)
      expect(zone.maintenance).not.toBeNull()
      expect(zone.move).toEqual({ activation, maxDistance: { amount, unit: 'FEET' } })
    }
  )

  it('refuses a move on a zone its source does not maintain', () => {
    expect(() => zonePlacementOf({ ...flamingSphere, attributes: [] })).toThrow(
      'Only a zone its source maintains is moved by its source.'
    )
  })
})
