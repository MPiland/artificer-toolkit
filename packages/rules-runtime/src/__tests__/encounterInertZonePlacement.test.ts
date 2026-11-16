import { describe, expect, it } from 'vitest'
import { compileSpellEffect } from '@artificer-toolkit/shared/compilers'

import { compileActionPlacement } from '../encounterActionEntryPointCompiler.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'

function placementOf(spellLabel: string) {
  const spell = srdByLabel(SRD.spells, spellLabel)
  const [effect] = spell.effects ?? []
  const action = characterActionDescriptor(
    compileSpellEffect(spell, { ...effect!, id: ACTION_EFFECT_ID }),
    spell.level,
    20
  )
  return compileActionPlacement(dnd5eCharacterRuleActionSystemAdapter, action)
}

describe('a zone that only marks its area (QUALITY-15.T3b)', () => {
  it('places the real SRD Darkness as a labeled sphere that triggers nobody and ends with its Concentration', () => {
    const placement = placementOf('Darkness')
    expect(placement?.kind).toBe('ZONE')
    expect(placement?.kind === 'ZONE' && placement.zonePlacement).toMatchObject({
      label: 'Darkness',
      shape: { shapeKind: 'SPHERE', radius: { amount: 15 } },
      triggerModes: [],
      entry: { initialRemaining: null },
      maintenance: expect.anything()
    })
  })

  it('places the real SRD Antimagic Field on its caster, which a source zone is centered on', () => {
    const placement = placementOf('Antimagic Field')
    expect(placement?.kind === 'ZONE' && placement.zonePlacement).toMatchObject({
      attachment: 'SOURCE'
    })
  })

  it('places the real SRD Silent Image as its 15-foot cube, ended by its Concentration (QUALITY-15.T3n)', () => {
    const placement = placementOf('Silent Image')
    expect(placement?.kind === 'ZONE' && placement.zonePlacement).toMatchObject({
      label: 'Silent Image',
      shape: { shapeKind: 'CUBE', edgeLength: { amount: 15 } },
      triggerModes: [],
      maintenance: expect.anything()
    })
  })

  it('refuses a real SRD zone that authors no shape, naming what is missing', () => {
    expect(() => placementOf('Forbiddance')).toThrow('A placed zone needs a label and a shape.')
  })
})

describe('a summon held by its Concentration (QUALITY-15.T3n)', () => {
  it('summons the real SRD Arcane Eye as an invisible, untouchable flier that ends with Concentration', () => {
    const placement = placementOf('Arcane Eye')
    expect(placement?.kind === 'SUMMON' && placement.summonPlacement).toMatchObject({
      label: 'Arcane Eye',
      statBlock: {
        speeds: [{ amount: 30 }],
        damageabilityKind: 'INVULNERABLE',
        visibilityKind: 'INVISIBLE',
        occupiesSpace: false
      },
      // 1 hour of 6-second turns.
      entry: { initialRemaining: 600, maintenance: expect.anything() }
    })
  })

  it('summons one of the real SRD celestials for Conjure Celestial, on its own initiative', () => {
    const placement = placementOf('Conjure Celestial')
    expect(placement?.kind === 'SUMMON' && placement.summonPlacement).toMatchObject({
      turnTiming: 'OWN_INITIATIVE',
      forms: [
        { label: 'Couatl', maxTargets: 1 },
        { label: 'Pegasus', maxTargets: 1 }
      ],
      entry: { initialRemaining: 600, maintenance: expect.anything() }
    })
  })
})
