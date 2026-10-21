import { describe, expect, it } from 'vitest'

import { combatPerceptionCapabilityRegistry } from '../platformPolicyModules.js'
import { createSystemCapabilityRegistry } from '../systemCapabilityRegistry.js'
import { dnd5eCombatPerceptionCapabilityAdapter } from '../systems/dnd5e/combatPerception.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'

const input = {
  requirement: 'DETECT',
  environment: {
    sharedSurface: true,
    lineOfEffect: true,
    distance: 5,
    illumination: 'BRIGHT',
    obscurement: 'NONE',
    invisibleChannels: [],
    suppressedChannels: []
  },
  capabilities: [],
  observerContributions: [],
  subjectContributions: [],
  localAreaContributions: []
} as const

describe('combat-perception capability registry', () => {
  it('fails closed for a Game System that provides no perception policy', () => {
    expect(() =>
      combatPerceptionCapabilityRegistry
        .require('11111111-1111-4111-8111-111111111111')
        .resolveCombatPerceptionWithContributions(input)
    ).toThrow('The Game System does not provide combat-perception policy.')
  })

  it('rejects a duplicate adapter and a non-UUID System identity', () => {
    expect(() =>
      createSystemCapabilityRegistry('combat-perception', [
        dnd5eCombatPerceptionCapabilityAdapter,
        dnd5eCombatPerceptionCapabilityAdapter
      ])
    ).toThrow(`Duplicate combat-perception System adapter: ${DND5E_SYSTEM_ID}.`)
    expect(() =>
      createSystemCapabilityRegistry('combat-perception', [
        { ...dnd5eCombatPerceptionCapabilityAdapter, gameSystemId: 'dnd5e' }
      ])
    ).toThrow('must be a PostgreSQL UUID')
  })
})
