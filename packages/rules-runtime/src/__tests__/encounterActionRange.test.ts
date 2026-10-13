import { describe, expect, it } from 'vitest'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import type { CompiledActionTargetPolicy } from '@artificer-toolkit/schema/projections/characterMechanics'
import { glaive } from '@artificer-toolkit/source-data/srd/equipment/glaive.js'
import { longbow } from '@artificer-toolkit/source-data/srd/equipment/longbow.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'

import {
  encounterActionChoiceRange,
  encounterActionRange,
  encounterActionRangeLabel
} from '../encounterActionRange.js'
import { buildCompiledActionTargetPolicy } from '../encounterActionEntryPointCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'

type AuthoredEffect = Parameters<typeof compileEffect>[0]

/** The target policy an Encounter Action compiles from one authored SRD effect. */
function policyOf(effect: AuthoredEffect | undefined): CompiledActionTargetPolicy {
  if (!effect) throw new Error('Missing SRD effect.')
  return buildCompiledActionTargetPolicy(
    characterActionDescriptor(compileEffect({ ...effect, id: ACTION_EFFECT_ID }))
  )
}

const spellEffect = (label: string) =>
  srdSpells.find((spell) => spell.label === label)?.effects?.[0]
const feet = (amount: number) => ({ amount, unit: 'FEET' as const })

describe('encounter action range from SRD actions', () => {
  it.each([
    {
      name: 'a reach weapon (Glaive)',
      effect: glaive.effects?.[0],
      range: { kind: 'WITHIN', distance: feet(10) },
      label: '10 ft'
    },
    {
      name: 'a ranged weapon (Longbow)',
      effect: longbow.effects?.[0],
      range: { kind: 'RANGED', normal: feet(150), long: feet(600) },
      label: '150/600 ft'
    },
    {
      name: 'a Touch spell (Cure Wounds)',
      effect: spellEffect('Cure Wounds'),
      range: { kind: 'WITHIN', distance: feet(5) },
      label: '5 ft'
    },
    {
      name: 'a self spell (Shield)',
      effect: spellEffect('Shield'),
      range: { kind: 'SELF' },
      label: 'Self'
    },
    {
      name: 'a distance spell (Fireball)',
      effect: spellEffect('Fireball'),
      range: { kind: 'WITHIN', distance: feet(150) },
      label: '150 ft'
    }
  ] as const)('maps $name to its range and label', ({ effect, range, label }) => {
    const policy = policyOf(effect)
    expect(encounterActionRange(policy)).toEqual(range)
    expect(encounterActionChoiceRange(policy, 'Fallback')).toEqual({ range, rangeLabel: label })
  })

  it('maps an unlimited range, the 0 ft swarm space and a distance in other units', () => {
    const policy = (range: CompiledActionTargetPolicy['range']): CompiledActionTargetPolicy => ({
      range,
      targeting: null,
      shape: null,
      pathOverrides: []
    })
    expect(encounterActionRange(policy({ id: 'r', rangeKind: 'UNLIMITED' }))).toEqual({
      kind: 'UNLIMITED'
    })
    expect(
      encounterActionRange(policy({ id: 'r', rangeKind: 'DISTANCE', amount: 0, unit: 'FEET' }))
    ).toEqual({ kind: 'WITHIN', distance: feet(0) })
    expect(
      encounterActionRangeLabel({ kind: 'WITHIN', distance: { amount: 1.5, unit: 'MILES' } })
    ).toBe('1.5 mi')
    expect(encounterActionRangeLabel({ kind: 'UNLIMITED' })).toBe('Unlimited')
  })

  it('leaves the range off for a sight or special range and keeps the fallback label', () => {
    for (const rangeKind of ['SIGHT', 'SPECIAL'] as const) {
      const policy: CompiledActionTargetPolicy = {
        range: { id: 'r', rangeKind },
        targeting: null,
        shape: null,
        pathOverrides: []
      }
      expect(encounterActionRange(policy)).toBeNull()
      expect(encounterActionChoiceRange(policy, 'Sight')).toEqual({ rangeLabel: 'Sight' })
      expect(encounterActionChoiceRange(policy)).toEqual({})
    }
    expect(encounterActionChoiceRange(undefined, 'Touch')).toEqual({ rangeLabel: 'Touch' })
  })
})
