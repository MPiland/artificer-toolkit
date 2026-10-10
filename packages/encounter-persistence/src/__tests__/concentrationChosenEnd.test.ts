import { describe, expect, it, vi } from 'vitest'
import {
  ENCOUNTER_ID,
  creatureActor,
  srdEncounterState
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { endChosenConcentration, endOutsideCasterConcentration } from '../concentrationChosenEnd.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import type { EncounterCharacterWriteTransaction } from '../ports.js'
import type { EncounterDocument } from '../store.js'

const ACTOR_ID = '00000000-0000-4000-8000-0000000d0001'
const USER_ID = '00000000-0000-4000-8000-0000000d0002'
const COMMAND_ID = '00000000-0000-4000-8000-0000000d0003'
const CASTER_ID = '00000000-0000-4000-8000-0000000d0004'
const OCCURRED_AT = '2026-01-01T00:00:00.000Z'

function fixture() {
  const memory = createMemoryEncounterStore()
  memory.load(
    'encounterRuns',
    [
      { _id: 'run', _creationTime: 1, id: ENCOUNTER_ID }
    ] as unknown as EncounterDocument<'encounterRuns'>[],
    { validate: false }
  )
  const postRulesChatMessage = vi.fn()
  const ctx = {
    db: memory.store,
    ports: { postRulesChatMessage }
  } as unknown as Parameters<typeof endChosenConcentration>[0]
  const holder = creatureActor({ id: ACTOR_ID, kind: 'CUSTOM', snapshot: {} })
  const state = srdEncounterState({ actors: [holder], currentActorId: null })
  return { ctx, holder, state, postRulesChatMessage }
}

describe('endChosenConcentration (SPELLS-5.11)', () => {
  it('refuses a manual Encounter, which records no Concentration', async () => {
    const { ctx, holder, state, postRulesChatMessage } = fixture()
    await expect(
      endChosenConcentration(ctx, {
        state: { ...state, automationMode: 'MANUAL' },
        actors: [holder],
        holder,
        commandId: COMMAND_ID,
        userId: USER_ID,
        occurredAt: OCCURRED_AT
      })
    ).rejects.toThrow('Concentration is not tracked in a manual Encounter.')
    expect(postRulesChatMessage).not.toHaveBeenCalled()
  })

  it('refuses an actor that holds no Concentration and posts nothing', async () => {
    const { ctx, holder, state, postRulesChatMessage } = fixture()
    await expect(
      endChosenConcentration(ctx, {
        state,
        actors: [holder],
        holder,
        commandId: COMMAND_ID,
        userId: USER_ID,
        occurredAt: OCCURRED_AT
      })
    ).rejects.toThrow('is not concentrating.')
    expect(postRulesChatMessage).not.toHaveBeenCalled()
  })
})

describe('endOutsideCasterConcentration (SPELLS-5.11)', () => {
  it('refuses a caster that carries no Concentration grant', async () => {
    const { ctx, holder, state } = fixture()
    await expect(
      endOutsideCasterConcentration(ctx as unknown as EncounterCharacterWriteTransaction, {
        state,
        actors: [holder],
        casterCharacterId: CASTER_ID,
        commandId: COMMAND_ID,
        userId: USER_ID,
        occurredAt: OCCURRED_AT
      })
    ).rejects.toThrow('This Character is not concentrating.')
  })
})
