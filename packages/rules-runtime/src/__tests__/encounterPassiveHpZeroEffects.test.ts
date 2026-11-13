import { describe, expect, it } from 'vitest'

import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { discoverEncounterFeatureActions } from '../encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { discoverEncounterEventHooks } from '../events/encounterEventHooks.js'
import type { EncounterEvent } from '../events/encounterEventTable.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'

const discover = (label: string) =>
  discoverEncounterFeatureActions({
    spells: new Map(),
    actor: srdCreatureActor({ id: testUuid(0xd101), creature: srdByLabel(SRD.creatures, label) }),
    conditionDefinitionIds: [],
    abilityDefinitions: (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))
  })

/** The actions of `found` the event table raises for their holder on `event`. */
const raisedBy = (found: ReturnType<typeof discover>, event: EncounterEvent) =>
  discoverEncounterEventHooks({ raisedActions: found.raisedActions, events: [event] }).raisedActions

describe('passive effects that fire at 0 hit points (SPELLS-33.T6e1a)', () => {
  it('lists Balor Death Throes by its trigger, not as an action', () => {
    const found = discover('Balor')
    expect(found.unavailable.filter(({ label }) => label === 'Death Throes')).toEqual([])
    expect(raisedBy(found, { kind: 'DEFEATED' }).map(({ capability }) => capability.label)).toEqual(
      ['Death Throes']
    )
    expect(found.available.map(({ label }) => label)).not.toContain('Death Throes')
  })

  it('lists nothing for a creature without the trigger', () => {
    expect(raisedBy(discover('Goblin'), { kind: 'DEFEATED' })).toEqual([])
  })

  it('is not raised by the start of the holder’s turn (QUALITY-11.T1b)', () => {
    expect(raisedBy(discover('Balor'), { kind: 'TURN_STARTED' })).toEqual([])
  })
})

describe('passive effects that fire at the start of the holder’s turn (SPELLS-33.T4i1a)', () => {
  it.each(['Oni', 'Shield Guardian'])(
    'lists %s Regeneration by its trigger, not as an action',
    (label) => {
      const found = discover(label)
      expect(
        raisedBy(found, { kind: 'TURN_STARTED' }).map(({ capability }) => capability.label)
      ).toEqual(['Regeneration'])
      expect(raisedBy(found, { kind: 'DEFEATED' })).toEqual([])
      expect(found.available.map(({ label: name }) => name)).not.toContain('Regeneration')
      expect(found.unavailable.filter(({ label: name }) => name === 'Regeneration')).toEqual([])
    }
  )

  it('lists nothing for a creature without the trigger', () => {
    expect(raisedBy(discover('Goblin'), { kind: 'TURN_STARTED' })).toEqual([])
  })
})
