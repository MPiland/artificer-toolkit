import { expect, it } from 'vitest'
import { createMemoryEncounterStore } from '@artificer-toolkit/encounter-persistence/memoryEncounterStore'
import { DND5E_SYSTEM_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import { readRoomEncounterPlayAuthorization } from './roomEncounterCommands.js'
import { encounterRunFixture } from './testing/encounterRunFixture.js'
import { uuid } from './testing/roomAggregateFixture.js'

const campaignId = uuid(0xa01)
const sceneId = uuid(0xa02)

/** Two Runs bound to one Scene: the ACTIVE one, then a PREPARED one bound after it. */
async function twoRunsOnOneScene() {
  const memory = createMemoryEncounterStore({ idPrefix: 'play-authorization' })
  const active = await encounterRunFixture({
    memory,
    campaignId,
    systemId: DND5E_SYSTEM_ID,
    actors: [{ characterId: uuid(0xa03) }],
    scene: { sceneId, tokenId: uuid(0xa04) }
  })
  const prepared = await encounterRunFixture({
    memory,
    campaignId,
    systemId: DND5E_SYSTEM_ID,
    actors: [{ characterId: uuid(0xa05) }],
    scene: { sceneId, tokenId: uuid(0xa06) },
    status: 'PREPARED'
  })
  return { active, prepared, ctx: { db: memory.store } }
}

it('plays the ACTIVE Run bound to the Scene, not a PREPARED Run bound to it later', async () => {
  const { active, prepared, ctx } = await twoRunsOnOneScene()

  const play = await readRoomEncounterPlayAuthorization(
    ctx,
    campaignId,
    { encounter: null },
    sceneId
  )

  expect(play?.encounter?.encounterId).toBe(active.encounterId)
  expect(play?.encounter?.actors.map(({ id }) => id)).toEqual(active.actorIds)
  for (const id of prepared.actorIds)
    expect(play?.encounter?.actors.map((actor) => actor.id)).not.toContain(id)
})

it('plays nothing on a Scene its ACTIVE Run is not bound to', async () => {
  const { ctx } = await twoRunsOnOneScene()
  const held = await readRoomEncounterPlayAuthorization(
    ctx,
    campaignId,
    { encounter: null },
    sceneId
  )
  if (!held) throw new Error('Missing held play.')

  expect(await readRoomEncounterPlayAuthorization(ctx, campaignId, held, uuid(0xa07))).toEqual({
    encounter: null
  })
})
