import type { CompiledManifestComponent } from '@artificer-toolkit/shared/compilers'
import { describe, expect, it } from 'vitest'

import type { EncounterEvent, ZoneEventSubscription } from '../events/encounterEventTable.js'
import { discoverEncounterEventHooks } from '../events/encounterEventHooks.js'
import { dnd5eEventVocabularyCapabilityAdapter } from '../systems/dnd5e/eventVocabulary.js'

type InteractionKinds = NonNullable<CompiledManifestComponent['interactionKinds']>

const zone = (subscription: Partial<ZoneEventSubscription>): ZoneEventSubscription => ({
  triggerModes: [],
  ...subscription
})
const sets = (subscription: Partial<ZoneEventSubscription>, event: EncounterEvent) =>
  discoverEncounterEventHooks({ zones: [zone(subscription)], events: [event] }).zones.length === 1

describe('zone event hooks (RULES-2.T5d)', () => {
  it.each([
    ['entering', { triggerModes: ['ENTER'] }, { kind: 'ZONE_MOVEMENT', movement: 'ENTER' }, true],
    ['leaving', { triggerModes: ['EXIT'] }, { kind: 'ZONE_MOVEMENT', movement: 'EXIT' }, true],
    ['crossing', { triggerModes: ['CROSS'] }, { kind: 'ZONE_MOVEMENT', movement: 'CROSS' }, true],
    [
      'leaving a zone that acts on entering',
      { triggerModes: ['ENTER'] },
      { kind: 'ZONE_MOVEMENT', movement: 'EXIT' },
      false
    ],
    [
      'starting a turn inside',
      { turnTriggers: ['START_OF_TURN'] },
      { kind: 'ZONE_TURN', boundary: 'START_OF_TURN' },
      true
    ],
    [
      'ending a turn inside',
      { turnTriggers: ['END_OF_TURN'] },
      { kind: 'ZONE_TURN', boundary: 'END_OF_TURN' },
      true
    ],
    [
      'the source starting its turn',
      { turnTriggers: ['START_OF_SOURCE_TURN'] },
      { kind: 'ZONE_TURN', boundary: 'START_OF_SOURCE_TURN' },
      true
    ],
    [
      'ending a turn in a zone that acts at the start',
      { turnTriggers: ['START_OF_TURN'] },
      { kind: 'ZONE_TURN', boundary: 'END_OF_TURN' },
      false
    ],
    [
      'a turn boundary in a zone without turn triggers',
      { triggerModes: ['ENTER'] },
      { kind: 'ZONE_TURN', boundary: 'START_OF_TURN' },
      false
    ],
    [
      'a melee hit on a retaliating zone’s source',
      { retaliatesMeleeHits: true },
      { kind: 'ZONE_SOURCE_MELEE_HIT' },
      true
    ],
    [
      'a melee hit on a zone that does not retaliate',
      { triggerModes: ['ENTER'] },
      { kind: 'ZONE_SOURCE_MELEE_HIT' },
      false
    ],
    [
      'an event that is not a zone contact',
      { triggerModes: ['ENTER'] },
      { kind: 'IDLE_TURN' },
      false
    ]
  ] satisfies [string, Partial<ZoneEventSubscription>, EncounterEvent, boolean][])(
    '%s',
    (_name, subscription, event, expected) => {
      expect(sets(subscription, event)).toBe(expected)
    }
  )

  it('keeps the zones an event sets off in the order given', () => {
    const first = { ...zone({ triggerModes: ['ENTER'] }), id: 'first' }
    const skipped = { ...zone({ triggerModes: ['EXIT'] }), id: 'skipped' }
    const second = { ...zone({ triggerModes: ['ENTER', 'CROSS'] }), id: 'second' }
    expect(
      discoverEncounterEventHooks({
        zones: [first, skipped, second],
        events: [{ kind: 'ZONE_MOVEMENT', movement: 'ENTER' }]
      }).zones.map(({ id }) => id)
    ).toEqual(['first', 'second'])
  })
})

describe('the dnd5e zone subscription vocabulary', () => {
  const subscribe = (kinds: InteractionKinds) =>
    dnd5eEventVocabularyCapabilityAdapter.zoneSubscription(kinds)

  it.each([
    [['ENTER_SPACE'], { triggerModes: ['ENTER'] }],
    [['LEAVE_SPACE'], { triggerModes: ['EXIT'] }],
    [['MOVE_ACROSS'], { triggerModes: ['CROSS'] }],
    [['ENTER_OR_PASS_THROUGH'], { triggerModes: ['ENTER', 'CROSS'] }],
    [
      ['LEAVE_SPACE', 'END_TURN_IN_SPACE', 'ENTER_SPACE', 'START_TURN_IN_SPACE'],
      { triggerModes: ['ENTER', 'EXIT'], turnTriggers: ['START_OF_TURN', 'END_OF_TURN'] }
    ],
    [
      ['START_OF_SOURCE_TURN', 'MELEE_HIT_ON_SOURCE'],
      { triggerModes: [], turnTriggers: ['START_OF_SOURCE_TURN'], retaliatesMeleeHits: true }
    ]
  ] satisfies [InteractionKinds, ZoneEventSubscription][])(
    'subscribes %j to %j',
    (kinds, subscription) => {
      expect(subscribe(kinds)).toEqual(subscription)
    }
  )

  it('subscribes nothing for an interaction the System does not model', () => {
    expect(subscribe(['ENTER_SPACE', 'SOURCE_HIT'])).toBeNull()
  })
})
