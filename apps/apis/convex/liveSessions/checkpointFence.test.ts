import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import type { LiveSessionCheckpointFenceInput } from '@artificer-toolkit/schema/api/liveSessionCheckpointFence'
import type { LiveSessionJoinOptionsDto } from '@artificer-toolkit/schema/api/liveSessionIdentity'
import type {
  LiveSessionActivationInput,
  LiveSessionAuthorityDto,
  LiveSessionDrainReleaseInput,
  LiveSessionPublishInput
} from '@artificer-toolkit/schema/api/liveSessionState'
import { createEncounterSceneFixture } from '../../tests/fixtures/encounterScene'
import { commitCampaignLiveCheckpoint } from './authority'
import { readCampaignLiveAuthority } from './authorityGuard'

afterEach(() => vi.useRealTimers())

const claim = makeFunctionReference<'mutation', LiveSessionJoinOptionsDto, LiveSessionAuthorityDto>(
  'liveSessions/authority:claim'
)
const commitActivation = makeFunctionReference<
  'mutation',
  LiveSessionActivationInput,
  LiveSessionAuthorityDto
>('liveSessions/authority:commitActivation')
const advancePersisted = makeFunctionReference<
  'mutation',
  Pick<
    LiveSessionPublishInput,
    'campaignId' | 'epoch' | 'expectedStateChecksum' | 'sequence' | 'stateChecksum'
  >,
  LiveSessionAuthorityDto
>('liveSessions/authority:advancePersisted')
const beginDrain = makeFunctionReference<
  'mutation',
  LiveSessionDrainReleaseInput,
  LiveSessionAuthorityDto
>('liveSessions/authority:beginDrain')
const release = makeFunctionReference<'mutation', LiveSessionDrainReleaseInput, null>(
  'liveSessions/authority:release'
)

async function activeFixture() {
  const base = await createEncounterSceneFixture()
  const claimed = await base.other.caller.mutation(claim, { campaignId: base.campaign.id })
  const active = await base.t.mutation(commitActivation, {
    campaignId: base.campaign.id,
    epoch: claimed.epoch,
    activationFingerprint: claimed.activationFingerprint,
    stateChecksum: 'a'.repeat(64)
  })
  const frame: LiveSessionCheckpointFenceInput = {
    campaignId: base.campaign.id,
    epoch: active.epoch,
    checkpointId: crypto.randomUUID(),
    fromSequence: 0,
    fromChecksum: active.persistedStateChecksum,
    sequence: 3,
    checksum: 'b'.repeat(64),
    payloadChecksum: 'c'.repeat(64)
  }
  return { ...base, active, frame }
}

function readStorage(base: Awaited<ReturnType<typeof createEncounterSceneFixture>>) {
  return base.t.run(async (ctx) => ({
    authority: await readCampaignLiveAuthority(ctx, base.campaign.id),
    memberships: await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_status', (q) => q.eq('campaignId', base.campaign.id))
      .collect()
  }))
}

it('commits a multi-command checkpoint and replays the exact fence without applying or writing again', async () => {
  const base = await activeFixture()
  const applied = vi.fn()
  const insertedUserId = crypto.randomUUID()
  const commit = () =>
    base.t.run((ctx) =>
      commitCampaignLiveCheckpoint(ctx, base.frame, async () => {
        applied()
        await ctx.db.insert('campaignMemberships', {
          campaignId: base.campaign.id,
          userId: insertedUserId,
          role: 'PLAYER',
          status: 'ACTIVE',
          accessStartedAt: base.campaign.createdAt,
          joinedAt: base.campaign.createdAt,
          leftAt: null
        })
      })
    )

  const committed = await commit()
  expect(base.active.checkpointedAt).toBeUndefined()
  expect(committed.authority.checkpointedAt).toBe(committed.authority.updatedAt)
  const { campaignId, epoch, ...storedFence } = base.frame
  expect(committed).toMatchObject({
    status: 'COMMITTED',
    authority: {
      campaignId,
      epoch,
      persistedSequence: 3,
      persistedStateChecksum: base.frame.checksum,
      lastCheckpoint: storedFence
    }
  })
  const beforeReplay = await readStorage(base)
  expect(beforeReplay.authority).toEqual(committed.authority)
  expect(beforeReplay.memberships.filter((row) => row.userId === insertedUserId)).toHaveLength(1)

  vi.useFakeTimers()
  vi.setSystemTime(Date.now() + 1_000)
  await expect(commit()).resolves.toEqual({ status: 'REPLAYED', authority: committed.authority })
  expect(applied).toHaveBeenCalledTimes(1)
  expect(await readStorage(base)).toEqual(beforeReplay)
  const drained = await base.t.mutation(beginDrain, {
    campaignId: base.campaign.id,
    epoch: base.active.epoch,
    finalSequence: base.frame.sequence,
    finalStateChecksum: base.frame.checksum
  })
  expect(drained.updatedAt).not.toBe(committed.authority.updatedAt)
  expect(drained.checkpointedAt).toBe(committed.authority.checkpointedAt)
})

it('rejects altered retries at the acknowledged sequence before applying any payload', async () => {
  const base = await activeFixture()
  await base.t.run((ctx) => commitCampaignLiveCheckpoint(ctx, base.frame, async () => {}))
  const before = await readStorage(base)
  const apply = vi.fn(async () => {})
  const variants: Partial<LiveSessionCheckpointFenceInput>[] = [
    { checkpointId: crypto.randomUUID() },
    { fromSequence: 1 },
    { fromChecksum: 'd'.repeat(64) },
    { checksum: 'd'.repeat(64) },
    { payloadChecksum: 'd'.repeat(64) }
  ]
  for (const variant of variants) {
    await expect(
      base.t.run((ctx) => commitCampaignLiveCheckpoint(ctx, { ...base.frame, ...variant }, apply))
    ).rejects.toThrow('retry differs from the acknowledged payload')
    expect(await readStorage(base)).toEqual(before)
  }
  expect(apply).not.toHaveBeenCalled()
})

it('rejects checkpoint publication while activating and for a foreign epoch', async () => {
  const base = await createEncounterSceneFixture()
  const claimed = await base.other.caller.mutation(claim, { campaignId: base.campaign.id })
  const frame: LiveSessionCheckpointFenceInput = {
    campaignId: base.campaign.id,
    epoch: claimed.epoch,
    checkpointId: crypto.randomUUID(),
    fromSequence: 0,
    fromChecksum: 'a'.repeat(64),
    sequence: 3,
    checksum: 'b'.repeat(64),
    payloadChecksum: 'c'.repeat(64)
  }
  const apply = vi.fn(async () => {})
  const activating = await readStorage(base)
  await expect(
    base.t.run((ctx) => commitCampaignLiveCheckpoint(ctx, frame, apply))
  ).rejects.toThrow('authority is not active')
  expect(await readStorage(base)).toEqual(activating)

  await base.t.mutation(commitActivation, {
    campaignId: frame.campaignId,
    epoch: frame.epoch,
    activationFingerprint: claimed.activationFingerprint,
    stateChecksum: frame.fromChecksum
  })
  const active = await readStorage(base)
  await expect(
    base.t.run((ctx) =>
      commitCampaignLiveCheckpoint(ctx, { ...frame, epoch: crypto.randomUUID() }, apply)
    )
  ).rejects.toThrow('authority is stale')
  expect(await readStorage(base)).toEqual(active)
  expect(apply).not.toHaveBeenCalled()
})

it('rejects empty, reversed, negative, fractional and unsafe checkpoint ranges', async () => {
  const base = await activeFixture()
  const before = await readStorage(base)
  const apply = vi.fn(async () => {})
  const variants: Partial<LiveSessionCheckpointFenceInput>[] = [
    { sequence: 0 },
    { fromSequence: 2, sequence: 1 },
    { fromSequence: -1 },
    { sequence: -1 },
    { fromSequence: 0.5 },
    { sequence: 3.5 },
    { fromSequence: Number.MAX_SAFE_INTEGER + 1 },
    { sequence: Number.MAX_SAFE_INTEGER + 1 }
  ]
  for (const variant of variants) {
    await expect(
      base.t.run((ctx) => commitCampaignLiveCheckpoint(ctx, { ...base.frame, ...variant }, apply))
    ).rejects.toThrow()
    expect(await readStorage(base)).toEqual(before)
  }
  expect(apply).not.toHaveBeenCalled()
})

it('rejects stale starts, gaps and divergent starting checksums after a committed batch', async () => {
  const base = await activeFixture()
  await base.t.run((ctx) => commitCampaignLiveCheckpoint(ctx, base.frame, async () => {}))
  const before = await readStorage(base)
  const apply = vi.fn(async () => {})
  const variants: Partial<LiveSessionCheckpointFenceInput>[] = [
    { sequence: 4 },
    { fromSequence: 4, fromChecksum: base.frame.checksum, sequence: 5 },
    { fromSequence: 3, fromChecksum: 'd'.repeat(64), sequence: 4 },
    { sequence: 2 }
  ]
  for (const variant of variants) {
    await expect(
      base.t.run((ctx) => commitCampaignLiveCheckpoint(ctx, { ...base.frame, ...variant }, apply))
    ).rejects.toThrow('not contiguous')
    expect(await readStorage(base)).toEqual(before)
  }
  expect(apply).not.toHaveBeenCalled()
})

it('rolls back callback writes and the authority when its enclosing mutation throws', async () => {
  const base = await activeFixture()
  const before = await readStorage(base)
  const apply = vi.fn()
  for (const failInCallback of [true, false]) {
    await expect(
      base.t.run(async (ctx) => {
        await commitCampaignLiveCheckpoint(ctx, base.frame, async () => {
          apply()
          await ctx.db.insert('campaignMemberships', {
            campaignId: base.campaign.id,
            userId: crypto.randomUUID(),
            role: 'PLAYER',
            status: 'ACTIVE',
            accessStartedAt: base.campaign.createdAt,
            joinedAt: base.campaign.createdAt,
            leftAt: null
          })
          if (failInCallback) throw new Error('Injected checkpoint rollback')
        })
        expect((await readCampaignLiveAuthority(ctx, base.campaign.id))?.persistedSequence).toBe(3)
        throw new Error('Injected checkpoint rollback')
      })
    ).rejects.toThrow('Injected checkpoint rollback')
    expect(await readStorage(base)).toEqual(before)
  }
  expect(apply).toHaveBeenCalledTimes(2)
})

it('accepts draining checkpoints through the exact final fence, then rejects publications after release', async () => {
  const base = await activeFixture()
  const finalChecksum = 'd'.repeat(64)
  const drain: LiveSessionDrainReleaseInput = {
    campaignId: base.campaign.id,
    epoch: base.frame.epoch,
    finalSequence: 5,
    finalStateChecksum: finalChecksum
  }
  await base.t.mutation(beginDrain, drain)
  const apply = vi.fn(async () => {})
  await expect(
    base.t.run((ctx) => commitCampaignLiveCheckpoint(ctx, base.frame, apply))
  ).resolves.toMatchObject({ status: 'COMMITTED', authority: { phase: 'DRAINING' } })
  await expect(base.t.mutation(release, drain)).rejects.toThrow('final publication is incomplete')

  const finalFrame: LiveSessionCheckpointFenceInput = {
    ...base.frame,
    checkpointId: crypto.randomUUID(),
    fromSequence: 3,
    fromChecksum: base.frame.checksum,
    sequence: 5,
    checksum: finalChecksum,
    payloadChecksum: 'e'.repeat(64)
  }
  const beforeFinal = await readStorage(base)
  for (const variant of [{ sequence: 6 }, { checksum: 'f'.repeat(64) }]) {
    await expect(
      base.t.run((ctx) => commitCampaignLiveCheckpoint(ctx, { ...finalFrame, ...variant }, apply))
    ).rejects.toThrow('exceeds its drain fence')
    expect(await readStorage(base)).toEqual(beforeFinal)
  }
  expect(apply).toHaveBeenCalledTimes(1)
  await expect(
    base.t.run((ctx) => commitCampaignLiveCheckpoint(ctx, finalFrame, apply))
  ).resolves.toMatchObject({
    status: 'COMMITTED',
    authority: { phase: 'DRAINING', persistedSequence: 5, persistedStateChecksum: finalChecksum }
  })
  await expect(
    base.t.run((ctx) => commitCampaignLiveCheckpoint(ctx, finalFrame, apply))
  ).resolves.toMatchObject({ status: 'REPLAYED' })
  expect(apply).toHaveBeenCalledTimes(2)
  await expect(base.t.mutation(release, drain)).resolves.toBeNull()
  const released = await readStorage(base)
  expect(released.authority).toBeNull()
  await expect(
    base.t.run((ctx) => commitCampaignLiveCheckpoint(ctx, finalFrame, apply))
  ).rejects.toThrow('authority is stale')
  expect(apply).toHaveBeenCalledTimes(2)
  expect(await readStorage(base)).toEqual(released)
})

it('clears checkpoint replay metadata on the next per-command publication', async () => {
  const base = await activeFixture()
  await base.t.run((ctx) => commitCampaignLiveCheckpoint(ctx, base.frame, async () => {}))
  const before = await readStorage(base)
  expect(before.authority?.lastCheckpoint?.checkpointId).toBe(base.frame.checkpointId)
  const published = await base.t.mutation(advancePersisted, {
    campaignId: base.campaign.id,
    epoch: base.frame.epoch,
    expectedStateChecksum: base.frame.checksum,
    sequence: 4,
    stateChecksum: 'd'.repeat(64)
  })
  expect(published.persistedSequence).toBe(4)
  expect(published.lastCheckpoint).toBeUndefined()
  const after = await readStorage(base)
  expect(after.authority?.lastCheckpoint).toBeUndefined()
  expect(after.memberships).toEqual(before.memberships)
  const apply = vi.fn(async () => {})
  await expect(
    base.t.run((ctx) =>
      commitCampaignLiveCheckpoint(
        ctx,
        { ...base.frame, sequence: 4, checksum: published.persistedStateChecksum },
        apply
      )
    )
  ).rejects.toThrow('retry differs from the acknowledged payload')
  expect(apply).not.toHaveBeenCalled()
  expect(await readStorage(base)).toEqual(after)
})
