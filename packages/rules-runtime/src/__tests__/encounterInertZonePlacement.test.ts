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

function zoneOf(spellLabel: string) {
  const placement = placementOf(spellLabel)
  if (placement?.kind !== 'ZONE') throw new Error(`${spellLabel} places no zone.`)
  return placement.zonePlacement
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
})

describe('the zones the SRD sizes in prose (QUALITY-15.T3o)', () => {
  it.each([
    [
      'Wall of Force',
      {
        shapeKind: 'WALL',
        length: { amount: 100 },
        height: { amount: 10 },
        thickness: { amount: 0.25, unit: 'INCHES' }
      }
    ],
    [
      'Wall of Ice',
      {
        shapeKind: 'WALL',
        length: { amount: 100 },
        height: { amount: 10 },
        thickness: { amount: 1, unit: 'FEET' }
      }
    ],
    [
      'Wall of Stone',
      {
        shapeKind: 'WALL',
        length: { amount: 100 },
        height: { amount: 10 },
        thickness: { amount: 6, unit: 'INCHES' }
      }
    ],
    ['Gate', { shapeKind: 'CIRCLE', radius: { amount: 10 } }],
    [
      'Magnificent Mansion',
      { shapeKind: 'CYLINDER', radius: { amount: 2.5 }, height: { amount: 10 } }
    ],
    ['Forbiddance', { shapeKind: 'CYLINDER', radius: { amount: 112 }, height: { amount: 30 } }],
    ['Mirage Arcane', { shapeKind: 'CUBE', edgeLength: { amount: 1, unit: 'MILES' } }]
  ])('places the real SRD %s with the shape its text sizes', (label, shape) => {
    expect(zoneOf(label)).toMatchObject({ label: expect.any(String), shape, triggerModes: [] })
  })
})
