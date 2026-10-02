import { makeFunctionReference } from 'convex/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type { campaignCharacterSheetExecuteInputSchema } from '@artificer-toolkit/schema/api/campaignCharacterSheet'
import type { CharacterSheetCommandResponseDto } from '@artificer-toolkit/schema/api/characterSheetCommands'
import type {
  LiveSessionActivationInput,
  LiveSessionAuthorityDto,
  LiveSessionBootstrapInput,
  LiveSessionBootstrapResponse,
  LiveSessionDrainReleaseInput
} from '@artificer-toolkit/schema/api/liveSessionState'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { api } from '../_generated/api'

const secret = 'test-live-session-worker-secret-that-is-long-enough'
const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const claim = makeFunctionReference<'mutation', { campaignId: string }, LiveSessionAuthorityDto>(
  'liveSessions/authority:claim'
)
const activate = makeFunctionReference<
  'mutation',
  LiveSessionActivationInput,
  LiveSessionAuthorityDto
>('liveSessions/state:activate')
const executeCampaignSheet = makeFunctionReference<
  'mutation',
  z.input<typeof campaignCharacterSheetExecuteInputSchema>,
  CharacterSheetCommandResponseDto
>('campaigns/characterSheet:execute')

beforeEach(() => vi.stubEnv('LIVE_SESSION_WORKER_SECRET', secret))
afterEach(() => vi.unstubAllEnvs())

it('keeps Character Sheet commands in Convex while Scene authority is active and draining', async () => {
  const { owner: player, other: gm, ...base } = await readySheetFixture()
  const campaign = await gm.caller.mutation(createCampaign, {
    name: 'Live Scene with Convex Character Sheet',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  await base.t.run(async (ctx) => {
    await ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: player.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
    await ctx.db.insert('campaignCharacterAssignments', {
      campaignId: campaign.id,
      userId: player.userId,
      characterId: base.character.id,
      assignedAt: campaign.createdAt
    })
  })
  const authority = await player.caller.mutation(claim, { campaignId: campaign.id })
  const bootstrapInput: LiveSessionBootstrapInput = {
    campaignId: campaign.id,
    authorityEpoch: authority.epoch,
    expectedUserId: player.userId,
    expectedRole: 'PLAYER'
  }
  const playerBootstrap = await player.caller.fetch(
    '/live-sessions/bootstrap',
    request(bootstrapInput, authHeaders())
  )
  expect(playerBootstrap.status).toBe(200)
  const metadata = (await playerBootstrap.json()) as LiveSessionBootstrapResponse
  expect(metadata).toEqual({
    activationFingerprint: authority.activationFingerprint,
    persistedSequence: 0,
    persistedStateChecksum: authority.persistedStateChecksum
  })
  const gmBootstrap = await gm.caller.fetch(
    '/live-sessions/bootstrap',
    request({ ...bootstrapInput, expectedUserId: gm.userId, expectedRole: 'OWNER' }, authHeaders())
  )
  expect(gmBootstrap.status).toBe(200)
  expect(await gmBootstrap.json()).toEqual(metadata)
  expect(
    (
      await player.caller.fetch(
        '/live-sessions/bootstrap',
        request(bootstrapInput, {
          ...authHeaders(),
          'x-artificer-live-session-secret': secret + '-bad'
        })
      )
    ).status
  ).toBe(401)
  expect(
    (
      await player.caller.fetch(
        '/live-sessions/bootstrap',
        request({ ...bootstrapInput, expectedUserId: gm.userId }, authHeaders())
      )
    ).status
  ).toBe(409)
  expect(
    (
      await player.caller.fetch(
        '/live-sessions/bootstrap',
        request({ ...bootstrapInput, authorityEpoch: crypto.randomUUID() }, authHeaders())
      )
    ).status
  ).toBe(409)

  const sceneChecksum = 'a'.repeat(64)
  const active = await base.t.mutation(activate, {
    campaignId: campaign.id,
    epoch: authority.epoch,
    activationFingerprint: authority.activationFingerprint,
    stateChecksum: sceneChecksum
  })
  expect(active.phase).toBe('DO_ACTIVE')
  const before = await player.caller.query(api.campaigns.characterSheet.get, {
    campaignId: campaign.id,
    characterId: base.character.id
  })
  const adjustment = {
    campaignId: campaign.id,
    characterId: base.character.id,
    command: adjustmentCommand(1)
  }
  const [adjusted, duplicate] = await Promise.all([
    player.caller.mutation(executeCampaignSheet, adjustment),
    player.caller.mutation(executeCampaignSheet, adjustment)
  ])
  const adjustedSheet = await player.caller.query(api.campaigns.characterSheet.get, {
    campaignId: campaign.id,
    characterId: adjusted.characterId
  })
  expect(adjusted).not.toHaveProperty('sheet')
  expect(adjusted).not.toHaveProperty('panels')
  expect(duplicate).toEqual(adjusted)
  expect(adjusted.streamVersion).toBe(2)
  expect(adjustedSheet.overview.maxHitPoints).toBe(before.overview.maxHitPoints + 1)
  expect((await base.readState()).receipts).toHaveLength(1)

  const drainInput: LiveSessionDrainReleaseInput = {
    campaignId: campaign.id,
    epoch: authority.epoch,
    finalSequence: 0,
    finalStateChecksum: sceneChecksum
  }
  const drainResponse = await base.t.fetch(
    '/live-sessions/begin-drain',
    request(drainInput, workerHeaders())
  )
  expect(drainResponse.status).toBe(200)
  expect((await drainResponse.json()) as LiveSessionAuthorityDto).toMatchObject({
    phase: 'DRAINING',
    persistedSequence: 0
  })
  const damage = {
    campaignId: campaign.id,
    characterId: base.character.id,
    command: {
      type: 'ADJUST_HIT_POINTS' as const,
      commandId: crypto.randomUUID(),
      expectedVersion: 2,
      mode: 'DAMAGE' as const,
      amount: 2
    }
  }
  const damaged = await player.caller.mutation(executeCampaignSheet, damage)
  const damagedSheet = await player.caller.query(api.campaigns.characterSheet.get, {
    campaignId: campaign.id,
    characterId: damaged.characterId
  })
  expect(damaged.streamVersion).toBe(3)
  expect(damagedSheet.overview.currentHitPoints).toBe(adjustedSheet.overview.currentHitPoints - 2)
  const replay = await player.caller.mutation(executeCampaignSheet, adjustment)
  expect(replay.streamVersion).toBe(3)
  expect(replay.historyEntry).toEqual(adjusted.historyEntry)

  const competing = await Promise.allSettled(
    [1, 2].map((amount) =>
      player.caller.mutation(executeCampaignSheet, {
        campaignId: campaign.id,
        characterId: base.character.id,
        command: {
          type: 'ADJUST_HIT_POINTS',
          commandId: crypto.randomUUID(),
          expectedVersion: 3,
          mode: 'DAMAGE',
          amount
        }
      })
    )
  )
  expect(competing.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
  expect(competing.filter((result) => result.status === 'rejected')).toHaveLength(1)
  const rejected = competing.find((result) => result.status === 'rejected')
  if (!rejected) throw new Error('Expected one stale Character Sheet command.')
  expect(rejected.reason).toMatchObject({
    message: expect.stringContaining('Character Sheet changed')
  })
  const stored = await base.readState()
  expect(stored.character?.play.streamVersion).toBe(4)
  expect(stored.receipts).toHaveLength(3)
  const authorityRow = await base.t.run((ctx) =>
    ctx.db
      .query('campaignLiveAuthorities')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
      .unique()
  )
  expect(authorityRow).toMatchObject({ phase: 'DRAINING', persistedSequence: 0 })
  expect(
    (await base.t.fetch('/live-sessions/release', request(drainInput, workerHeaders()))).status
  ).toBe(200)
}, 60_000)

function adjustmentCommand(expectedVersion: number) {
  return {
    type: 'UPSERT_SHEET_ADJUSTMENT' as const,
    commandId: crypto.randomUUID(),
    expectedVersion,
    adjustment: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      family: 'HIT_POINTS' as const,
      field: 'MAXIMUM_MODIFIER' as const,
      value: 1,
      sourceNote: 'Campaign adjustment'
    }
  }
}

function request(input: unknown, headers: Record<string, string>): RequestInit {
  return { body: JSON.stringify(input), headers, method: 'POST' }
}

function workerHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-artificer-live-session-secret': secret
  }
}
function authHeaders(): Record<string, string> {
  return {
    Authorization: 'Bearer test-convex-identity',
    'Content-Type': 'application/json',
    'x-artificer-live-session-secret': secret
  }
}
