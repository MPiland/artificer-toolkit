import { readReceiptHeaders } from '../lib/receiptLedgers'
import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import type {
  LiveSessionMovementStage,
  LiveSessionMovementStageInput
} from '@artificer-toolkit/schema/api/liveSessionMovementStage'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { setupAutomaticSceneMovement } from '../../tests/fixtures/automaticSceneMovement'
import {
  insertActiveLiveAuthority,
  planStagedMovementInRoom
} from '../../tests/fixtures/liveSessionWorker'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: () => 0 }))

const observe = makeFunctionReference<
  'mutation',
  { saveId: string; characterRevisions: [] },
  { saveId: string }
>('scenes/geometryStaging:observe')
const privateStage = makeFunctionReference<
  'mutation',
  LiveSessionMovementStageInput,
  LiveSessionMovementStage
>('liveSessions/encounterMovement:stage')

it('stages a current movement choice only for its live authority and actor, with exact replay and no gameplay writes', async () => {
  const value = await setupAutomaticSceneMovement({
    policies: ['CHOICE', 'AUTOMATIC'],
    reactorPositions: [50, 150],
    path: [
      { x: 150, y: 50 },
      { x: 450, y: 50 }
    ]
  })
  await value.owner.caller.mutation(observe, { saveId: value.saveId, characterRevisions: [] })
  const root = await planStagedMovementInRoom(value.owner.caller, value.saveId)
  const initial = await root.publish()
  const choice = initial.occurrence?.pending
  if (!choice || choice.kind !== 'MOVEMENT_REACTION' || !choice.choice.options[0])
    throw new Error('Expected an issued movement choice.')

  const command: ResolveRuleOccurrenceInputDto = {
    type: 'RESOLVE_RULE_OCCURRENCE',
    commandId: crypto.randomUUID(),
    encounterId: value.base.run.id,
    expectedVersion: choice.encounterVersion,
    occurrenceId: choice.occurrenceId,
    expectedOccurrenceVersion: choice.occurrenceVersion,
    correlationId: null,
    resolution: { kind: 'OPTION', optionId: choice.choice.options[0].optionId }
  }
  const epoch = crypto.randomUUID()
  await value.base.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: value.base.campaign.id,
      epoch,
      createdAt: value.base.campaign.createdAt
    })
  )
  const input: LiveSessionMovementStageInput = {
    campaignId: value.base.campaign.id,
    authorityEpoch: epoch,
    expectedUserId: value.owner.userId,
    expectedRole: 'OWNER',
    command,
    characterRevisions: [],
    tokenOrdinals: value.request.tokenOrdinals,
    maintenanceDefinitionIds: [],
    cachedSystem: null
  }
  const gameplay = () =>
    value.base.t.run(async (ctx) => ({
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      runs: await ctx.db.query('encounterRuns').collect(),
      actors: await ctx.db.query('encounterRunActors').collect(),
      occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
      receipts: await ctx.db
        .query('encounterRuleReceipts')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRuleReceipts', headers)),
      commands: await ctx.db
        .query('encounterRunCommands')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers)),
      scenes: await ctx.db.query('campaignScenes').collect(),
      entities: await ctx.db.query('sceneLiveEntities').collect(),
      sceneCommands: await ctx.db.query('sceneLiveCommands').collect()
    }))
  const saves = () => value.base.t.run((ctx) => ctx.db.query('sceneGeometrySaves').collect())
  const before = await gameplay()
  const beforeSaves = await saves()

  for (const change of [
    { expectedUserId: value.player.userId },
    { expectedRole: 'PLAYER' as const },
    { authorityEpoch: crypto.randomUUID() },
    { campaignId: crypto.randomUUID() }
  ])
    await expect(
      value.owner.caller.mutation(privateStage, { ...input, ...change })
    ).rejects.toThrow()
  expect(await gameplay()).toEqual(before)
  expect(await saves()).toEqual(beforeSaves)

  const staged = await value.owner.caller.mutation(privateStage, input)
  if (staged.kind !== 'STAGED') throw new Error('Expected private movement response staging.')
  const afterSaves = await saves()
  expect(afterSaves).toHaveLength(beforeSaves.length + 1)
  const save = afterSaves.find((entry) => entry.id === staged.saveId)
  expect(save).toMatchObject({
    actorUserId: value.owner.userId,
    commandId: command.commandId,
    status: 'RECEIVING',
    movementResolution: {
      commandChecksum: checksumCanonicalJson(command)
    }
  })
  if (!save?.movementResolution) throw new Error('Movement response evidence was not retained.')
  expect(JSON.parse(save.movementResolution.commandJson)).toEqual(command)
  expect(save?.movementResolution?.pendingSnapshotJson).toBeTruthy()
  expect(save?.movementResolution?.pendingSnapshotChecksum).toBeTruthy()
  expect(await gameplay()).toEqual(before)

  await expect(value.owner.caller.mutation(privateStage, input)).resolves.toEqual(staged)
  await expect(
    value.owner.caller.mutation(privateStage, {
      ...input,
      command: { ...command, resolution: { kind: 'DECLINE' } }
    })
  ).rejects.toThrow('already used')
  await expect(
    value.player.caller.mutation(privateStage, {
      ...input,
      expectedUserId: value.player.userId,
      expectedRole: 'PLAYER'
    })
  ).rejects.toThrow()
  expect(await gameplay()).toEqual(before)
  expect(await saves()).toEqual(afterSaves)
}, 30_000)
