import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import type {
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  commitSceneInRoom,
  insertActiveLiveAuthority
} from '../../tests/fixtures/liveSessionWorker'
import { createSceneDefinitionFixture, publishScene } from '../../tests/fixtures/sceneDefinitions'
import { SCENE_COMMAND_RETENTION_MS } from './commandRetention'

const purge = makeFunctionReference<'mutation', Record<string, never>, null>(
  'scenes/commandRetention:purge'
)
const setPresentation = makeFunctionReference<
  'mutation',
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
>('scenes/presentations:set')

afterEach(() => vi.useRealTimers())

it('deletes only expired Scene command ledgers, then their headers and geometry saves', async () => {
  const base = await createSceneDefinitionFixture()
  const token = {
    id: crypto.randomUUID(),
    assetId: null,
    label: 'Scout',
    width: 1,
    height: 1,
    position: { x: 100, y: 100 },
    rotationDegrees: 0,
    hidden: false,
    locked: false,
    controlledByUserIds: [],
    vision: { angleDegrees: 360, brightRange: 0, dimRange: 5, directionDegrees: 0, enabled: true }
  }
  const { sceneId } = await publishScene(base, { tokens: [token] })
  await base.owner.caller.mutation(setPresentation, {
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: null,
    campaignId: base.campaign.id,
    sceneId,
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
  })
  await base.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: base.campaign.id,
      epoch: crypto.randomUUID(),
      createdAt: base.campaign.createdAt
    })
  )
  const receipts = (commandId: string) =>
    base.t.run(async (ctx) => ({
      command: await ctx.db
        .query('sceneLiveCommands')
        .withIndex('by_sceneId_commandId', (q) =>
          q.eq('sceneId', sceneId).eq('commandId', commandId)
        )
        .unique(),
      save: await ctx.db
        .query('sceneGeometrySaves')
        .withIndex('by_sceneId_commandId', (q) =>
          q.eq('sceneId', sceneId).eq('commandId', commandId)
        )
        .unique()
    }))
  const ledgers = () =>
    base.t.run((ctx) =>
      ctx.db
        .query('receiptLedgers')
        .withIndex('by_scope_scopeId', (q) => q.eq('scope', 'SCENE').eq('scopeId', sceneId))
        .take(10)
    )
  const move = (commandId: string, expectedSceneVersion: number, from: number, to: number) =>
    commitSceneInRoom(base.owner.caller, base.campaign.id, {
      type: 'MOVE_SCENE_TOKEN',
      commandId,
      sceneId,
      tokenId: token.id,
      expectedSceneVersion,
      expectedEncounterVersion: null,
      correlationId: null,
      movementKind: 'VOLUNTARY',
      path: [
        { x: from, y: 100 },
        { x: to, y: 100 }
      ]
    })

  // Rooms need real timers, so both moves commit before the clock is faked.
  const expired = crypto.randomUUID()
  const first = await move(expired, 0, 100, 200)
  const retained = crypto.randomUUID()
  await move(retained, first.version, 200, 300)
  const expiredCommand = (await receipts(expired)).command
  const retainedCommand = (await receipts(retained)).command
  if (!expiredCommand || !retainedCommand) throw new Error('Missing committed receipts.')
  // The checkpoint stamps a ledger just before it inserts its headers; retention ages the ledger.
  const stored = await ledgers()
  const expiredLedger = stored.find((ledger) => ledger.id === expiredCommand.ledgerId)
  const retainedLedger = stored.find((ledger) => ledger.id === retainedCommand.ledgerId)
  if (stored.length !== 2 || !expiredLedger || !retainedLedger)
    throw new Error('Each checkpoint should pack its receipt into its own Scene ledger.')
  const expiredAt = Math.max(Date.parse(expiredLedger.createdAt), expiredCommand._creationTime)
  if (Date.parse(retainedLedger.createdAt) <= expiredAt + 1)
    throw new Error('The two receipts were created in the same millisecond.')
  expect(await receipts(expired)).toMatchObject({
    command: expect.anything(),
    save: expect.anything()
  })

  vi.useFakeTimers()
  vi.setSystemTime(Date.parse(expiredLedger.createdAt) + SCENE_COMMAND_RETENTION_MS - 1)
  await base.t.mutation(purge, {})
  expect(await ledgers()).toHaveLength(2)
  expect(await receipts(expired)).toMatchObject({
    command: expect.anything(),
    save: expect.anything()
  })

  vi.setSystemTime(expiredAt + SCENE_COMMAND_RETENTION_MS + 1)
  await base.t.mutation(purge, {})
  expect((await ledgers()).map((ledger) => ledger.id)).toEqual([retainedLedger.id])
  expect(await receipts(expired)).toEqual({ command: null, save: null })
  expect(await receipts(retained)).toMatchObject({
    command: expect.anything(),
    save: expect.anything()
  })
}, 120_000)
