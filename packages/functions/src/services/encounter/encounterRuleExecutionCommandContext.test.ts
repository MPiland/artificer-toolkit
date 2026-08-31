import { describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  encounter: '00000000-0000-4000-8000-000000000002',
  user: '00000000-0000-4000-8000-000000000003',
  definition: '00000000-0000-4000-8000-000000000004',
  command: '00000000-0000-4000-8000-000000000005'
}

const mocks = vi.hoisted(() => {
  const receipts = new Map<string, Record<string, unknown>>()
  const occurrences = new Map<string, Record<string, unknown>>()
  return {
    receipts,
    occurrences,
    campaign: { lockCampaign: vi.fn() },
    encounter: { lock: vi.fn() },
    update: vi.fn(),
    sessionExecute: vi.fn(),
    repository: {
      findReceipt: vi.fn(
        async (_kind: string, aggregateId: string, commandId: string) =>
          receipts.get(`${aggregateId}:${commandId}`) ?? null
      ),
      lockPendingEncounter: vi.fn(async (encounterId: string) => {
        for (const occurrence of occurrences.values()) {
          if (
            occurrence.aggregateKind === 'ENCOUNTER' &&
            occurrence.aggregateId === encounterId &&
            occurrence.state === 'PENDING'
          )
            return occurrence
        }
        return null
      }),
      createPending: vi.fn(async (input: Record<string, unknown>) => {
        const occurrence = {
          id: input.occurrenceId,
          aggregateKind: input.aggregateKind,
          aggregateId: input.aggregateId,
          rootCommandId: input.rootCommandId,
          state: 'PENDING',
          version: 0,
          expectedAggregateVersion: input.expectedAggregateVersion,
          pendingSnapshot: input.pendingSnapshot,
          completedAt: null,
          createdAt: '2026-08-26T00:00:00.000Z',
          updatedAt: '2026-08-26T00:00:00.000Z'
        }
        occurrences.set(String(input.occurrenceId), occurrence)
        return occurrence
      }),
      createCompleted: vi.fn(async (input: Record<string, unknown>) => ({
        id: input.occurrenceId,
        aggregateKind: input.aggregateKind,
        aggregateId: input.aggregateId,
        rootCommandId: input.rootCommandId,
        state: 'COMPLETED',
        version: 0,
        expectedAggregateVersion: input.aggregateVersion,
        pendingSnapshot: null,
        completedAt: '2026-08-26T00:00:00.000Z',
        createdAt: '2026-08-26T00:00:00.000Z',
        updatedAt: '2026-08-26T00:00:00.000Z'
      })),
      appendReceipt: vi.fn(async (input: Record<string, unknown>) => {
        receipts.set(`${input.aggregateId}:${input.commandId}`, input)
      })
    }
  }
})

vi.mock('@artificer-toolkit/db', () => ({
  createCampaignRepository: () => mocks.campaign,
  createEncounterRepository: () => mocks.encounter,
  createRuleOccurrenceRepository: () => mocks.repository,
  withTransaction: async (db: object, run: (transaction: object) => Promise<unknown>) => run(db)
}))

vi.mock('kysely', () => ({
  sql: () => ({ execute: mocks.sessionExecute })
}))

vi.mock('../campaign/campaignService.js', () => ({
  assertActiveCampaignMember: vi.fn(),
  assertCampaignOwner: vi.fn(),
  assertCampaignWritable: vi.fn(),
  resolveCampaignAuthority: vi.fn(async () => ({
    membership: { role: 'OWNER' },
    assignedCharacter: null
  }))
}))

vi.mock('../campaign/liveSessionCommandAuthority.js', () => ({
  assertSessionLiveSessionCommandAuthority: vi.fn()
}))

import { EncounterConflictError } from './encounterErrors.js'
import { lockEncounterRuleExecutionCommandContext } from './encounterRuleExecutionCommandContext.js'
import { createRuleExecutionOccurrenceService } from '../rules/ruleExecutionOccurrenceService.js'
import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'

function transaction(): DBLike {
  const updateChain = {
    set: () => updateChain,
    where: () => updateChain,
    returning: () => updateChain,
    executeTakeFirst: mocks.update
  }
  const encounterSelect = {
    select: () => encounterSelect,
    where: () => encounterSelect,
    executeTakeFirst: async () => ({ campaign_id: ids.campaign, session_id: ids.command })
  }
  return {
    isTransaction: true,
    selectFrom: () => encounterSelect,
    updateTable: () => updateChain
  } as unknown as DBLike
}

const continuation = {
  schemaVersion: 1 as const,
  occurrenceId: '00000000-0000-4000-8000-000000000101',
  graph: {},
  facts: {},
  nextNodeIndex: 0,
  nodeOutputs: {},
  trace: [],
  request: {
    requestId: 'child-roll',
    kind: 'INTEGER_RANGE' as const,
    nodeId: 'roll',
    ordinal: 0,
    min: 1,
    max: 20
  },
  authority: 'APPLICATION_SERVICE' as const,
  redaction: 'SERVER_ONLY' as const,
  seal: 'a'.repeat(64)
}

function completeExecution() {
  return {
    status: 'COMPLETE' as const,
    outputs: { result: 14 },
    evidence: {
      source: {
        definitionId: ids.definition,
        gameSystemId: '00000000-0000-4000-8000-000000000020',
        definitionFamilyKey: 'test-resolution',
        checksum: 'a'.repeat(64)
      },
      capabilityContractVersion: 1,
      facts: {},
      trace: [],
      outputs: { result: 14 }
    }
  }
}

describe('lockEncounterRuleExecutionCommandContext receipt-only child capability', () => {
  async function lock(transactionDb: DBLike) {
    mocks.campaign.lockCampaign.mockResolvedValue({
      id: ids.campaign,
      attunementSlotOverride: null
    })
    mocks.encounter.lock.mockResolvedValue({
      id: ids.encounter,
      campaignId: ids.campaign,
      sessionId: ids.command,
      version: 3
    })
    mocks.sessionExecute.mockResolvedValue({ rows: [{ id: ids.command, status: 'OPEN' }] })
    mocks.update.mockResolvedValue({ version: 4 })
    return lockEncounterRuleExecutionCommandContext(transactionDb, {
      actorUserId: ids.user,
      authority: 'OWNER',
      encounterId: ids.encounter
    })
  }

  it('rejects a nontransaction before any Encounter lookup or lock', async () => {
    const selectFrom = vi.fn()
    await expect(
      lockEncounterRuleExecutionCommandContext(
        { isTransaction: false, selectFrom } as unknown as DBLike,
        {
          actorUserId: ids.user,
          authority: 'OWNER',
          encounterId: ids.encounter
        }
      )
    ).rejects.toBeInstanceOf(EncounterConflictError)
    expect(selectFrom).not.toHaveBeenCalled()
    expect(mocks.campaign.lockCampaign).not.toHaveBeenCalled()
    expect(mocks.encounter.lock).not.toHaveBeenCalled()
  })

  it('issues transaction-bound child capabilities at the concrete initial and post-CAS versions', async () => {
    const transactionDb = transaction()
    const { context } = await lock(transactionDb)
    const initialPort = context.createReceiptOnlyChildOccurrencePort()

    await initialPort.withLockedAuthorized(transactionDb, async (aggregate) => {
      expect(aggregate).toMatchObject({
        aggregateKind: 'ENCOUNTER',
        aggregateId: ids.encounter,
        campaignId: ids.campaign,
        actorUserId: ids.user,
        currentVersion: 3
      })
    })
    expect(await context.advanceVersion(3)).toBe(4)
    expect(context.currentVersion).toBe(4)

    const postCasPort = context.createReceiptOnlyChildOccurrencePort()
    await postCasPort.withLockedAuthorized(transactionDb, async (aggregate) => {
      expect(aggregate.currentVersion).toBe(4)
    })
    const staleCallback = vi.fn()
    await expect(
      initialPort.withLockedAuthorized(transactionDb, async () => {
        staleCallback()
      })
    ).rejects.toBeInstanceOf(EncounterConflictError)
    expect(staleCallback).not.toHaveBeenCalled()
    await expect(
      postCasPort.withLockedAuthorized(transaction(), async () => undefined)
    ).rejects.toBeInstanceOf(EncounterConflictError)
    await expect(
      postCasPort.withLockedAuthorized(transactionDb, async (aggregate) =>
        aggregate.advanceVersion(transactionDb, 4)
      )
    ).rejects.toBeInstanceOf(EncounterConflictError)
    await expect(context.advanceVersion(3)).rejects.toBeInstanceOf(EncounterConflictError)
  })

  it('uses the concrete child capability for receipt-only completion and the Encounter pending gate', async () => {
    mocks.receipts.clear()
    mocks.occurrences.clear()
    const transactionDb = transaction()
    const { context } = await lock(transactionDb)
    await context.advanceVersion(3)
    const childPort = context.createReceiptOnlyChildOccurrencePort()
    const runtime = {
      execute: vi
        .fn()
        .mockResolvedValueOnce(completeExecution())
        .mockResolvedValueOnce({ status: 'PAUSED' as const, continuation })
    }
    const occurrenceIds = [
      '00000000-0000-4000-8000-000000000111',
      '00000000-0000-4000-8000-000000000112'
    ]
    const service = createRuleExecutionOccurrenceService({
      db: transactionDb,
      runtime: runtime as unknown as RulesRuntimeService,
      createOccurrenceId: () => occurrenceIds.shift()!
    })
    const firstCommand = {
      commandId: '00000000-0000-4000-8000-000000000121',
      correlationId: null,
      expectedAggregateVersion: 4,
      definitionId: ids.definition,
      facts: {}
    }

    const completed = await service.execute(childPort, firstCommand)
    expect(completed).toMatchObject({ status: 'COMPLETE' })
    expect(context.currentVersion).toBe(4)

    const pending = await service.execute(childPort, {
      ...firstCommand,
      commandId: '00000000-0000-4000-8000-000000000122'
    })
    expect(pending).toMatchObject({ status: 'PAUSED' })
    await expect(
      service.execute(childPort, {
        ...firstCommand,
        commandId: '00000000-0000-4000-8000-000000000123'
      })
    ).rejects.toThrow('already has a pending rule occurrence')
    expect(context.currentVersion).toBe(4)
  })
})
