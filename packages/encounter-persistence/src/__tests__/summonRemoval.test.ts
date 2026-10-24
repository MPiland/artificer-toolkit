import { describe, expect, it } from 'vitest'
import {
  ENCOUNTER_ID,
  creatureActor,
  srdEncounterState
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { encounterActorTokenBindingSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { insertRunActor } from '../documents.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import { removeConjuredActors } from '../summonRemoval.js'

const ACTOR_ID = '00000000-0000-4000-8000-0000000b5001'
const OTHER_ID = '00000000-0000-4000-8000-0000000b5002'
const SCENE_ID = '00000000-0000-4000-8000-0000000b5003'
const TOKEN_ID = '00000000-0000-4000-8000-0000000b5004'
const COMMAND_ID = '00000000-0000-4000-8000-0000000b5005'

const conjured = (id: string) =>
  creatureActor({ id, kind: 'CUSTOM', snapshot: { label: 'Spectral Hand' } })

const runState = srdEncounterState({
  actors: [conjured(ACTOR_ID), conjured(OTHER_ID)],
  currentActorId: null
})

describe('removing a conjured creature (D187b)', () => {
  it('takes the Scene token off through the room, then removes the binding and the actor', async () => {
    const memory = createMemoryEncounterStore()
    const removed: unknown[] = []
    const ctx = {
      db: memory.store,
      ports: { removeSummonTokens: async (input: unknown) => void removed.push(input) }
    }
    for (const id of [ACTOR_ID, OTHER_ID]) await insertRunActor(ctx, conjured(id))
    await memory.store.insert(
      'encounterActorTokenBindings',
      encounterActorTokenBindingSchema.parse({
        actorId: ACTOR_ID,
        encounterId: ENCOUNTER_ID,
        sceneId: SCENE_ID,
        tokenId: TOKEN_ID
      })
    )

    const next = await removeConjuredActors(ctx, {
      state: { ...runState, actorIds: [ACTOR_ID, OTHER_ID] },
      commandId: COMMAND_ID,
      actorIds: [ACTOR_ID]
    })
    expect(next.actorIds).toEqual([OTHER_ID])

    expect(removed).toEqual([
      {
        encounterId: ENCOUNTER_ID,
        commandId: COMMAND_ID,
        tokens: [{ sceneId: SCENE_ID, tokenId: TOKEN_ID }]
      }
    ])
    expect(memory.documents('encounterActorTokenBindings')).toEqual([])
    expect(memory.documents('encounterRunActors').map(({ id }) => id)).toEqual([OTHER_ID])
  })

  it('refuses where the room is not present to take the token off the Scene', async () => {
    const memory = createMemoryEncounterStore()
    await expect(
      removeConjuredActors(
        { db: memory.store, ports: {} },
        { state: runState, commandId: COMMAND_ID, actorIds: [ACTOR_ID] }
      )
    ).rejects.toThrow('Only the Session room')
  })

  it('refuses a creature that has no Scene token and removes nothing', async () => {
    const memory = createMemoryEncounterStore()
    const ctx = { db: memory.store, ports: { removeSummonTokens: async () => undefined } }
    await insertRunActor(ctx, conjured(ACTOR_ID))
    await expect(
      removeConjuredActors(ctx, {
        state: runState,
        commandId: COMMAND_ID,
        actorIds: [ACTOR_ID]
      })
    ).rejects.toThrow('no Scene token')
    expect(memory.documents('encounterRunActors')).toHaveLength(1)
  })
})
