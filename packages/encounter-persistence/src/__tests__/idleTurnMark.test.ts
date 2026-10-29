import { creatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import {
  encounterActorIdleTurnMark,
  withEncounterActorIdleTurnMark
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { describe, expect, it } from 'vitest'

import { createActiveRuleEffectStore } from '../effectStore.js'
import { armIdleTurnActor, engageIdleTurnActor, idleTurnMarkChanges } from '../idleTurnMark.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import type { EncounterPersistenceTransaction } from '../ports.js'
import type { EncounterDocument } from '../store.js'

const ENCOUNTER_ID = '00000000-0000-4000-8000-0000000e0001'
const HOLDER_ID = '00000000-0000-4000-8000-0000000e0002'
const OTHER_ID = '00000000-0000-4000-8000-0000000e0003'
const GRANT_ID = '00000000-0000-4000-8000-0000000e0004'

const marked = (actor: ReturnType<typeof creatureActor>, mark: 'ARMED' | 'ENGAGED' | null) =>
  encounterRunActorStateSchema.parse({
    ...actor,
    resources: withEncounterActorIdleTurnMark(actor, mark)
  })

/** The stored grant a feature that ends on an idle turn leaves (SRD Rage), or one that does not. */
async function createdGrant(lifecycle: Parameters<typeof plannedModifierGrant>[0]['lifecycle']) {
  const memory = createMemoryEncounterStore()
  memory.load(
    'encounterRuns',
    [
      { _id: 'run', _creationTime: 1, id: ENCOUNTER_ID }
    ] as unknown as EncounterDocument<'encounterRuns'>[],
    { validate: false }
  )
  memory.load(
    'encounterRunActors',
    [
      { _id: 'actor', _creationTime: 2, encounterId: ENCOUNTER_ID, id: HOLDER_ID }
    ] as unknown as EncounterDocument<'encounterRunActors'>[],
    { validate: false }
  )
  const holder = creatureActor({ id: HOLDER_ID, snapshot: {} })
  return createActiveRuleEffectStore({
    db: memory.store
  } as unknown as EncounterPersistenceTransaction).create({
    id: GRANT_ID,
    owner: turnEffectOwner(holder, ENCOUNTER_ID),
    definition: plannedModifierGrant({
      encounterId: ENCOUNTER_ID,
      sourceActorId: OTHER_ID,
      holderActorId: HOLDER_ID,
      lifecycle,
      rounds: 10
    }).definition,
    lifecycle: { schemaVersion: 1, remainingTicks: 10 },
    occurredAt: '2026-01-01T00:00:00.000Z'
  })
}

describe('engaging an actor that holds an idle-bound grant', () => {
  const actor = creatureActor({ id: HOLDER_ID, snapshot: {} })

  it('engages an armed actor', () => {
    expect(encounterActorIdleTurnMark(engageIdleTurnActor(marked(actor, 'ARMED')))).toBe('ENGAGED')
  })

  it.each([null, 'ENGAGED'] as const)('leaves an actor marked %s as it is', (mark) => {
    const before = marked(actor, mark)
    expect(engageIdleTurnActor(before)).toBe(before)
  })
})

describe('arming an actor given an idle-bound grant', () => {
  const actor = creatureActor({ id: HOLDER_ID, snapshot: {} })

  it('arms a holder that is not on its own turn', async () => {
    const grant = await createdGrant({
      endTriggers: [{ event: 'LIFECYCLE', timing: 'END', code: 'ON_IDLE_TURN' }]
    })
    const armed = armIdleTurnActor({ actor, createdEffects: [grant], currentActorId: OTHER_ID })
    expect(encounterActorIdleTurnMark(armed)).toBe('ARMED')
  })

  it('exempts the turn the grant starts on by arriving engaged', async () => {
    const grant = await createdGrant({
      endTriggers: [{ event: 'LIFECYCLE', timing: 'END', code: 'ON_IDLE_TURN' }]
    })
    const engaged = armIdleTurnActor({ actor, createdEffects: [grant], currentActorId: HOLDER_ID })
    expect(encounterActorIdleTurnMark(engaged)).toBe('ENGAGED')
  })

  it('leaves an actor given no idle-bound grant unmarked', async () => {
    const grant = await createdGrant({})
    expect(armIdleTurnActor({ actor, createdEffects: [grant], currentActorId: OTHER_ID })).toBe(
      actor
    )
  })

  it.each(['ARMED', 'ENGAGED'] as const)('keeps the mark of a holder already %s', async (mark) => {
    const grant = await createdGrant({
      endTriggers: [{ event: 'LIFECYCLE', timing: 'END', code: 'ON_IDLE_TURN' }]
    })
    const before = marked(actor, mark)
    expect(
      armIdleTurnActor({ actor: before, createdEffects: [grant], currentActorId: OTHER_ID })
    ).toBe(before)
  })
})

describe('the mark changes an undo restores', () => {
  const holder = creatureActor({ id: HOLDER_ID, snapshot: {} })
  const other = creatureActor({ id: OTHER_ID, snapshot: {} })

  it('lists each actor whose mark changed with the mark it held before', () => {
    expect(
      idleTurnMarkChanges(
        [marked(holder, 'ARMED'), marked(other, null)],
        [marked(holder, 'ENGAGED'), marked(other, 'ARMED')]
      )
    ).toEqual([
      { actorId: HOLDER_ID, before: 'ARMED' },
      { actorId: OTHER_ID, before: null }
    ])
  })

  it('lists nothing for actors whose mark is unchanged', () => {
    expect(idleTurnMarkChanges([marked(holder, 'ARMED')], [marked(holder, 'ARMED')])).toEqual([])
  })
})
