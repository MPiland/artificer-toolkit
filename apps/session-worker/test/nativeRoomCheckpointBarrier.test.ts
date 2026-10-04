import { createExecutionContext, evictDurableObject, runInDurableObject } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { afterEach, expect, it, vi } from 'vitest'
import {
  LIVE_SESSION_CHECKPOINT_BARRIER_PATH,
  LIVE_SESSION_CONTROL_SECRET_HEADER
} from '@artificer-toolkit/schema/api/liveSessions'
import { liveSessionCheckpointRequestSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import { DurableCommandJournal } from '../src/durableCommandJournal.js'
import worker from '../src/index.js'
import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { aggregate, encounterId, uuid } from '../src/testing/roomAggregateFixture.js'
import { NO_CHECKPOINT_IO } from './checkpointIoFixture.js'

const EPOCH = uuid(0xb01)
const CAMPAIGN_ID = uuid(2)
const secret = 'test-secret-that-contains-at-least-thirty-two-bytes'
// The Worker's own bindings plus the secret the typed environment requires; the routes under test never read it.
const workerEnvironment = { ...env, CONTENT_SNAPSHOT_TOKEN_SECRET: `${secret}-content` }
const developmentEnvironment = {
  ...workerEnvironment,
  LOCAL_CONTENT_SNAPSHOT_ORIGIN: 'http://127.0.0.1:8026'
}

afterEach(() => {
  vi.restoreAllMocks()
})

function roomStub(campaignId: string) {
  return env.LIVE_SESSION_ROOMS.get(env.LIVE_SESSION_ROOMS.idFromName(campaignId))
}

/** A room that committed `commands` Run commands, none of them published, then restarted. */
async function roomWithPendingCommands(commands: number) {
  const stub = roomStub(`barrier:${crypto.randomUUID()}`)
  await runInDurableObject(stub, async (_instance, state) => {
    const { storage } = state
    storage.sql.exec(
      'INSERT INTO native_room_identity (id, campaign_id) VALUES (1, ?)',
      CAMPAIGN_ID
    )
    const store = new RoomEncounterStore(storage)
    store.hydrate({ epoch: EPOCH, ...aggregate(1) })
    const journal = new DurableCommandJournal(storage)
    const sceneJson = JSON.stringify({ scene: 'barrier' })
    const current = journal.activate({
      authorityEpoch: EPOCH,
      snapshotChecksum: store.checksum,
      stateJson: sceneJson
    })
    for (let ordinal = 0; ordinal < commands; ordinal++) {
      const head = journal.readCurrent() ?? current
      await store.transact(
        async () => {
          const run = await store.store
            .query('encounterRuns')
            .withIndex('by_publicId', (q) => q.eq('id', encounterId))
            .unique()
          if (!run) throw new Error('Missing Run fixture.')
          const stateJson = JSON.stringify({ command: ordinal })
          await store.store.patch(run._id, {
            version: run.version + 1,
            stateJson,
            stateChecksum: sha256Hex(stateJson)
          })
        },
        (entry) => {
          journal.commitInTransaction({
            actorId: uuid(0xb02),
            authorityEpoch: EPOCH,
            commandId: uuid(0xb10 + ordinal),
            expectedSequence: head.sequence,
            expectedStateChecksum: head.stateChecksum,
            fingerprint: `barrier-command-${ordinal}`,
            nextStateChecksum: entry.chainChecksum,
            nextStateJson: sceneJson,
            outboxPayloadJson: JSON.stringify({ sequence: entry.sequence }),
            receiptJson: JSON.stringify({ accepted: true })
          })
          return undefined
        }
      )
    }
  })
  await evictDurableObject(stub)
  return stub
}

/** Convex's acknowledgement of whatever prefix the room sends; records each request. */
function acknowledgeCheckpoints() {
  const requests: Array<ReturnType<typeof liveSessionCheckpointRequestSchema.parse>> = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = new Request(input, init)
    expect(new URL(request.url).pathname).toBe('/live-sessions/checkpoint')
    const body = liveSessionCheckpointRequestSchema.parse(await request.json())
    requests.push(body)
    const now = new Date().toISOString()
    return Response.json({
      status: 'COMMITTED',
      authority: {
        activationFingerprint: 'a'.repeat(64),
        campaignId: body.campaignId,
        createdAt: now,
        epoch: body.epoch,
        persistedSequence: body.sequence,
        persistedStateChecksum: body.checksum,
        phase: 'DO_ACTIVE',
        updatedAt: now
      },
      adopted: { characters: [] },
      io: NO_CHECKPOINT_IO
    })
  })
  return requests
}

const barrier = (instance: { fetch(request: Request): Promise<Response> }) =>
  instance.fetch(
    new Request(`https://live-session.internal${LIVE_SESSION_CHECKPOINT_BARRIER_PATH}`, {
      method: 'POST'
    })
  )

it('publishes every pending command as a BARRIER checkpoint and answers the published sequence', async () => {
  const stub = await roomWithPendingCommands(3)
  await runInDurableObject(stub, async (instance) => {
    const requests = acknowledgeCheckpoints()
    const response = await barrier(instance)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ publishedSequence: 3 })
    expect(requests.map(({ reason, sequence }) => ({ reason, sequence }))).toEqual([
      { reason: 'BARRIER', sequence: 3 }
    ])
  })
})

it('answers at once, publishing nothing, when everything is already published', async () => {
  const stub = await roomWithPendingCommands(1)
  await runInDurableObject(stub, async (instance) => {
    const requests = acknowledgeCheckpoints()
    await barrier(instance)
    expect(requests).toHaveLength(1)
    const again = await barrier(instance)
    await expect(again.json()).resolves.toEqual({ publishedSequence: 1 })
    expect(requests).toHaveLength(1)
  })
})

it('surfaces a failed checkpoint as a 500 with no detail of why', async () => {
  const stub = await roomWithPendingCommands(2)
  await runInDurableObject(stub, async (instance) => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('convex-failure-detail'))
    const response = await barrier(instance)
    expect(response.status).toBe(500)
    const body = await response.text()
    expect(body).toBe('The room barrier checkpoint failed.')
  })
})

it('refuses a room that holds no live authority', async () => {
  await runInDurableObject(roomStub(`barrier:${crypto.randomUUID()}`), async (instance) => {
    expect((await barrier(instance)).status).toBe(409)
  })
})

function route(
  method: string,
  headers: Record<string, string> = { [LIVE_SESSION_CONTROL_SECRET_HEADER]: secret },
  origin = 'http://127.0.0.1:8787'
) {
  return worker.fetch!(
    new Request(`${origin}${LIVE_SESSION_CHECKPOINT_BARRIER_PATH}/${crypto.randomUUID()}`, {
      headers,
      method
    }),
    developmentEnvironment,
    createExecutionContext()
  )
}

it('serves the barrier route only to a local development Worker with the worker secret', async () => {
  expect((await route('POST')).status).toBe(409)
  expect((await route('GET')).status).toBe(404)
  expect((await route('POST', {}, undefined)).status).toBe(401)
  expect((await route('POST', { [LIVE_SESSION_CONTROL_SECRET_HEADER]: 'wrong' })).status).toBe(401)
  expect((await route('POST', undefined, 'https://session.example.test')).status).toBe(404)
  const deployed = await worker.fetch!(
    new Request(
      `http://127.0.0.1:8787${LIVE_SESSION_CHECKPOINT_BARRIER_PATH}/${crypto.randomUUID()}`,
      {
        headers: { [LIVE_SESSION_CONTROL_SECRET_HEADER]: secret },
        method: 'POST'
      }
    ),
    workerEnvironment,
    createExecutionContext()
  )
  expect(deployed.status).toBe(404)
})
