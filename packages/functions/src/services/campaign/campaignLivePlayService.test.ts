import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  owner: '00000000-0000-4000-8000-000000000002',
  command: '00000000-0000-4000-8000-000000000003',
  commandTwo: '00000000-0000-4000-8000-000000000004',
  character: '00000000-0000-4000-8000-000000000005',
  event: '00000000-0000-4000-8000-000000000006',
  session: '00000000-0000-4000-8000-000000000007'
}

const mocks = vi.hoisted(() => ({
  db: {} as DBLike,
  campaign: { lockCampaign: vi.fn() },
  live: {
    findCommand: vi.fn(),
    lockClock: vi.fn(),
    updateClock: vi.fn(),
    insertCommand: vi.fn(),
    insertClock: vi.fn(),
    hasRecovery: vi.fn(),
    insertRecovery: vi.fn()
  },
  character: { findAuthoredById: vi.fn(), findById: vi.fn() },
  adjustments: { listByCharacter: vi.fn() },
  playState: { listResourceUsage: vi.fn() },
  events: { insertCampaignEvent: vi.fn() },
  resolveBuilder: vi.fn(),
  buildSheet: vi.fn(),
  executeSheet: vi.fn(),
  broadcast: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createCampaignRepository: () => mocks.campaign,
    createCampaignLivePlayRepository: () => mocks.live,
    createCampaignAdjustmentsRepository: () => mocks.events,
    createCharacterRepository: () => mocks.character,
    createCharacterSheetAdjustmentRepository: () => mocks.adjustments,
    createCharacterSheetPlayStateRepository: () => mocks.playState,
    withTransaction: (_db: DBLike, callback: (trx: DBLike) => Promise<unknown>) =>
      callback(mocks.db)
  }
})

vi.mock('../character/builderService.js', () => ({ resolveCharacterBuilder: mocks.resolveBuilder }))
vi.mock('../character/sheetService.js', () => ({
  buildCharacterSheetResponse: mocks.buildSheet,
  executeCharacterSheetCommand: mocks.executeSheet
}))
vi.mock('./campaignService.js', () => ({
  assertActiveCampaignMember: vi.fn(),
  assertCampaignOwner: vi.fn(),
  assertCampaignWritable: vi.fn(),
  resolveCampaignAuthority: vi.fn(async () => ({
    campaign: { id: ids.campaign, status: 'ACTIVE' },
    membership: { role: 'OWNER', status: 'ACTIVE' }
  })),
  CampaignConflictError: class CampaignConflictError extends Error {},
  CampaignNotFoundError: class CampaignNotFoundError extends Error {},
  CampaignValidationError: class CampaignValidationError extends Error {}
}))
vi.mock('./realtimeService.js', () => ({ broadcastCampaignInvalidation: mocks.broadcast }))

import {
  advanceCampaignClock,
  initializeCampaignClock,
  rewindCampaignClock
} from './campaignLivePlayService.js'

const owner = { id: ids.owner }
let commandRecords = new Map<string, Record<string, unknown>>()

function chain(rows: unknown[]) {
  const builder = {
    innerJoin: () => builder,
    select: () => builder,
    where: () => builder,
    orderBy: () => builder,
    forUpdate: () => builder,
    execute: async () => rows
  }
  return builder
}

function clock(overrides: Record<string, unknown> = {}) {
  return {
    campaignId: ids.campaign,
    day: 1,
    minuteOfDay: 0,
    running: false,
    runningSince: null,
    dawnMinute: 2,
    duskMinute: 3,
    processedBoundaryAbsoluteMinute: 0,
    version: 1,
    updatedAt: '2026-08-07T12:00:00.000Z',
    ...overrides
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.db = { selectFrom: vi.fn(() => chain([])) } as unknown as DBLike
  mocks.campaign.lockCampaign.mockResolvedValue({ id: ids.campaign, status: 'ACTIVE' })
  commandRecords = new Map()
  mocks.live.findCommand.mockImplementation(
    async (_campaignId, commandId) => commandRecords.get(commandId) ?? null
  )
  mocks.live.insertCommand.mockImplementation(async (input) => {
    commandRecords.set(input.commandId, {
      campaignId: input.campaignId,
      commandId: input.commandId,
      commandType: input.commandType,
      inputFingerprint: input.inputFingerprint,
      resultPayload: input.resultPayload
    })
  })
  mocks.live.hasRecovery.mockResolvedValue(false)
  mocks.live.insertRecovery.mockResolvedValue(undefined)
  mocks.resolveBuilder.mockResolvedValue({})
  mocks.adjustments.listByCharacter.mockResolvedValue([])
  mocks.playState.listResourceUsage.mockResolvedValue([])
  mocks.broadcast.mockResolvedValue(true)
})

describe('campaign live-play clock', () => {
  it('crosses multiple boundaries over multiple days and broadcasts after commit', async () => {
    let current = clock()
    mocks.live.lockClock.mockImplementation(async () => current)
    mocks.live.updateClock.mockImplementation(async (input) => {
      const { expectedVersion: _expectedVersion, ...changes } = input
      current = { ...current, ...changes, version: current.version + 1 }
      return current
    })

    const result = await advanceCampaignClock({} as DBLike, owner.id, {
      campaignId: ids.campaign,
      commandId: ids.command,
      expectedVersion: 1,
      minutes: 2884
    })

    expect(result.day).toBe(3)
    expect(result.minuteOfDay).toBe(4)
    expect(result.processedBoundaryAbsoluteMinute).toBe(2884)
    expect(mocks.live.insertCommand).toHaveBeenCalledOnce()
    expect(mocks.broadcast).toHaveBeenCalledWith(
      {},
      ids.campaign,
      expect.objectContaining({ entity: 'CLOCK', event: 'UPDATED' })
    )
  })

  it('replays a command without applying it twice and never replays after rewind', async () => {
    let current = clock({ day: 2, minuteOfDay: 10, processedBoundaryAbsoluteMinute: 1450 })
    mocks.live.lockClock.mockImplementation(async () => current)
    mocks.live.updateClock.mockImplementation(async (input) => {
      const { expectedVersion: _expectedVersion, ...changes } = input
      current = { ...current, ...changes, version: current.version + 1 }
      return current
    })

    await rewindCampaignClock({} as DBLike, owner.id, {
      campaignId: ids.campaign,
      commandId: ids.command,
      expectedVersion: 1,
      minutes: 100,
      correctionReason: 'Fix the scene timestamp.'
    })
    expect(current.processedBoundaryAbsoluteMinute).toBe(1450)

    await advanceCampaignClock({} as DBLike, owner.id, {
      campaignId: ids.campaign,
      commandId: ids.commandTwo,
      expectedVersion: 2,
      minutes: 100
    })
    expect(current.processedBoundaryAbsoluteMinute).toBe(1450)
    expect(mocks.live.updateClock).toHaveBeenCalledTimes(2)

    await advanceCampaignClock({} as DBLike, owner.id, {
      campaignId: ids.campaign,
      commandId: ids.commandTwo,
      expectedVersion: 2,
      minutes: 100
    })
    expect(mocks.live.updateClock).toHaveBeenCalledTimes(2)

    await expect(
      advanceCampaignClock({} as DBLike, owner.id, {
        campaignId: ids.campaign,
        commandId: ids.commandTwo,
        expectedVersion: 2,
        minutes: 101
      })
    ).rejects.toThrow('different input')
  })

  it('recovers an eligible resource once and broadcasts the Character after commit', async () => {
    let current = clock({ dawnMinute: 2 })
    mocks.db = {
      selectFrom: vi.fn(() => chain([{ characterId: ids.character, userId: ids.owner }]))
    } as unknown as DBLike
    mocks.live.lockClock.mockImplementation(async () => current)
    mocks.live.updateClock.mockImplementation(async (input) => {
      const { expectedVersion: _expectedVersion, ...changes } = input
      current = { ...current, ...changes, version: current.version + 1 }
      return current
    })
    mocks.character.findAuthoredById.mockResolvedValue({ id: ids.character })
    mocks.character.findById.mockResolvedValue({ id: ids.character, stream_version: 1 })
    mocks.buildSheet.mockResolvedValue({
      resources: {
        items: [
          {
            used: 1,
            owner: {
              kind: 'AUTHORED_GRANT',
              resourceGrantId: 'resource',
              source: {
                kind: 'AUTHORED',
                sourceKind: 'CLASS',
                definitionId: 'class',
                sourceInstanceId: 'CLASS:class'
              }
            },
            recoveries: [{ trigger: 'DAWN' }]
          }
        ]
      }
    })
    mocks.executeSheet.mockResolvedValue({ historyEntry: { eventId: ids.event } })
    mocks.events.insertCampaignEvent.mockResolvedValue({ id: ids.event })

    await advanceCampaignClock({} as DBLike, owner.id, {
      campaignId: ids.campaign,
      commandId: ids.command,
      expectedVersion: 1,
      minutes: 2
    })

    expect(mocks.executeSheet).toHaveBeenCalledOnce()
    expect(mocks.live.insertRecovery).toHaveBeenCalledOnce()
    expect(mocks.broadcast).toHaveBeenCalledWith(
      {},
      ids.campaign,
      expect.objectContaining({ entity: 'CHARACTER', entityId: ids.character, event: 'UPDATED' })
    )
  })
})
