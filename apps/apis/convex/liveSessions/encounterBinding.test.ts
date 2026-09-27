import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import type {
  LiveSessionEncounterBindingCommitInput,
  LiveSessionExternalAuthority
} from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import type {
  BindEncounterToPresentedSceneInputDto,
  BindEncounterToPresentedSceneResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { callLiveSessionRoute } from '../../../session-worker/src/liveSessionRoutes'
import { createEncounterSceneFixture } from '../../tests/fixtures/encounterScene'
import {
  insertActiveLiveAuthority,
  stubLiveSessionFetch,
  workerEnvironment
} from '../../tests/fixtures/liveSessionWorker'

const workerSecret = 'encounter-binding-worker-test-secret-at-least-32-bytes'
const environment = workerEnvironment(workerSecret)
const bind = makeFunctionReference<
  'mutation',
  BindEncounterToPresentedSceneInputDto,
  BindEncounterToPresentedSceneResultDto
>('encounters/sceneBindings:bind')

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

type Member = Awaited<ReturnType<typeof createEncounterSceneFixture>>['other']

/** A Campaign whose room owns the presented Scene, with its private routes served by convex-test. */
async function liveRoom() {
  const base = await createEncounterSceneFixture()
  const epoch = crypto.randomUUID()
  await base.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: base.campaign.id,
      epoch,
      createdAt: base.campaign.createdAt
    })
  )
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', workerSecret)
  // Worker-secret routes such as the resolve need no member; commits route as their member.
  stubLiveSessionFetch((pathname, init) => base.other.caller.fetch(pathname, init))
  const command = (): BindEncounterToPresentedSceneInputDto => ({
    type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
    commandId: crypto.randomUUID(),
    encounterId: base.run.id
  })
  /** The room's commit for `member`; the GM is the fixture's `other`, the player its `owner`. */
  const commit = async (
    member: Member,
    role: 'OWNER' | 'PLAYER',
    bindCommand: BindEncounterToPresentedSceneInputDto,
    overrides: Partial<LiveSessionEncounterBindingCommitInput> = {}
  ) => {
    stubLiveSessionFetch((pathname, init) => member.caller.fetch(pathname, init))
    return callLiveSessionRoute(environment, 'fixture-access-token', 'encounterBindingCommit', {
      campaignId: base.campaign.id,
      authorityEpoch: epoch,
      expectedUserId: member.userId,
      expectedRole: role,
      command: bindCommand,
      sceneId: base.sceneId,
      presentation: { expectedPresentationVersion: 0 },
      authority: await roomAuthority(),
      expiresAt: Date.now() + 10_000,
      ...overrides
    })
  }
  const resolve = (
    subject: { encounterId: string; commandId: string; expiresAt: number },
    authority: LiveSessionExternalAuthority
  ) =>
    callLiveSessionRoute(environment, null, 'externalCommitResolve', {
      campaignId: base.campaign.id,
      epoch,
      subject: { kind: 'ENCOUNTER_BINDING', ...subject },
      expectedSequence: authority.sequence - 1,
      expectedStateChecksum: authority.expectedStateChecksum,
      nextStateChecksum: authority.stateChecksum
    })
  const persisted = () =>
    base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaignLiveAuthorities')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
        .unique()
      return { sequence: row?.persistedSequence, checksum: row?.persistedStateChecksum }
    })
  const bindings = () => base.t.run((ctx) => ctx.db.query('encounterSceneBindings').collect())
  /** A binding leaves the room's state unchanged, so only its sequence advances. */
  async function roomAuthority(): Promise<LiveSessionExternalAuthority> {
    const current = await persisted()
    if (current.sequence === undefined || current.checksum === undefined)
      throw new Error('Live authority fixture is missing.')
    return {
      sequence: current.sequence + 1,
      expectedStateChecksum: current.checksum,
      stateChecksum: current.checksum
    }
  }
  return { base, command, commit, resolve, persisted, bindings, roomAuthority }
}

it('binds an Encounter mid-session through the room, advancing its sequence, and replays (D47)', async () => {
  const room = await liveRoom()
  const { base } = room
  const input = room.command()
  // A direct Convex binding stays refused while the room owns the presented Scene.
  await expect(base.other.caller.mutation(bind, input)).rejects.toThrow(
    'owned by its Campaign live table'
  )
  const before = await room.persisted()

  const bound = await room.commit(base.other, 'OWNER', input)
  expect(bound).toEqual({
    commandId: input.commandId,
    encounterId: base.run.id,
    replayed: false,
    sceneId: base.sceneId
  })
  // The binding advances the room's sequence; the room's state (and checksum) is unchanged.
  expect(await room.persisted()).toEqual({ sequence: 1, checksum: before.checksum })
  // The binding row is what members' `sceneBindings:get` subscriptions read.
  expect(await room.bindings()).toMatchObject([
    { encounterId: base.run.id, sceneId: base.sceneId, commandId: input.commandId }
  ])
  // A retried commit replays without advancing again.
  await expect(
    room.commit(base.other, 'OWNER', input, {
      authority: {
        sequence: 1,
        expectedStateChecksum: before.checksum!,
        stateChecksum: before.checksum!
      }
    })
  ).resolves.toEqual({ ...bound, replayed: true })
  expect(await room.persisted()).toMatchObject({ sequence: 1 })
  expect(await room.bindings()).toHaveLength(1)
}, 60_000)

it('refuses a player, a stale presentation or sequence, and an expired commit without binding', async () => {
  const room = await liveRoom()
  const { base } = room
  const refused = { status: 409 }
  await expect(room.commit(base.owner, 'PLAYER', room.command())).rejects.toMatchObject(refused)
  await expect(
    room.commit(base.other, 'OWNER', room.command(), {
      presentation: { expectedPresentationVersion: 1 }
    })
  ).rejects.toMatchObject(refused)
  await expect(
    room.commit(base.other, 'OWNER', room.command(), { sceneId: crypto.randomUUID() })
  ).rejects.toMatchObject(refused)
  await expect(
    room.commit(base.other, 'OWNER', room.command(), {
      authority: {
        sequence: 2,
        expectedStateChecksum: '0'.repeat(64),
        stateChecksum: '0'.repeat(64)
      }
    })
  ).rejects.toMatchObject(refused)
  await expect(
    room.commit(base.other, 'OWNER', room.command(), { expiresAt: Date.now() - 1 })
  ).rejects.toMatchObject(refused)
  expect(await room.bindings()).toEqual([])
  expect(await room.persisted()).toMatchObject({ sequence: 0 })
}, 60_000)

it('resolves an unsettled binding: ABANDONED only after its expiry, then COMMITTED once it landed', async () => {
  const room = await liveRoom()
  const { base } = room
  const authority = await room.roomAuthority()
  const lost = room.command()
  const subject = { encounterId: base.run.id, commandId: lost.commandId }
  // Before its expiry the commit may still land, so the outcome stays unsettled.
  await expect(
    room.resolve({ ...subject, expiresAt: Date.now() + 10_000 }, authority)
  ).rejects.toMatchObject({ status: 409 })
  const expiresAt = Date.now() - 1
  await expect(room.resolve({ ...subject, expiresAt }, authority)).resolves.toEqual({
    outcome: 'ABANDONED'
  })
  // A delayed commit of the abandoned binding is past its expiry and fails.
  await expect(room.commit(base.other, 'OWNER', lost, { expiresAt })).rejects.toMatchObject({
    status: 409
  })
  expect(await room.bindings()).toEqual([])

  const landed = room.command()
  const landedAt = Date.now() + 10_000
  await room.commit(base.other, 'OWNER', landed, { expiresAt: landedAt })
  await expect(
    room.resolve(
      { encounterId: base.run.id, commandId: landed.commandId, expiresAt: landedAt },
      authority
    )
  ).resolves.toEqual({ outcome: 'COMMITTED' })
}, 60_000)

it('keeps binding natively while no room is live', async () => {
  const base = await createEncounterSceneFixture()
  await expect(
    base.other.caller.mutation(bind, {
      type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
      commandId: crypto.randomUUID(),
      encounterId: base.run.id
    })
  ).resolves.toMatchObject({ replayed: false, sceneId: base.sceneId })
}, 60_000)
