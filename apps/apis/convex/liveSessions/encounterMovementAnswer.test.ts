// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { makeFunctionReference } from 'convex/server'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { LiveSessionMovementPrefetch } from '@artificer-toolkit/schema/api/liveSessionMovementAnswer'
import { setupAutomaticSceneMovement } from '../../tests/fixtures/automaticSceneMovement'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import {
  executeInRoom,
  insertActiveLiveAuthority,
  planStagedMovementInRoom,
  prefetchInRoom
} from '../../tests/fixtures/liveSessionWorker'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: () => 0 }))

const resolve = makeFunctionReference<'mutation', Record<string, unknown>, { outcome: string }>(
  'liveSessions/externalCommit:resolve'
)

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** The private routes a room command calls, beyond the Scene hydration the room keeps cached. */
const commandRoutes = new Set([
  '/live-sessions/encounter-route',
  '/live-sessions/encounter-bundle',
  '/live-sessions/encounter-rules',
  '/live-sessions/character-rules',
  '/live-sessions/encounter-movement-stage',
  '/live-sessions/encounter-movement',
  '/live-sessions/encounter-movement-answer'
])

/**
 * A reaction choice issued by a bound move, with the Campaign live under one epoch: the prefetch
 * and the answer must read under the same scope for the answer's checksum to match.
 */
async function issueReactionChoice() {
  const value = await setupAutomaticSceneMovement({
    policies: ['CHOICE', 'CHOICE'],
    reactorPositions: [150, 150],
    path: [
      { x: 150, y: 50 },
      { x: 450, y: 50 }
    ]
  })
  const initial = await (await planStagedMovementInRoom(value.owner.caller, value.saveId)).publish()
  const choice = initial.occurrence?.pending
  if (choice?.kind !== 'MOVEMENT_REACTION' || !choice.choice.options[0])
    throw new Error('Expected the issued movement reaction choice.')
  await value.base.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: value.base.campaign.id,
      epoch: crypto.randomUUID(),
      createdAt: value.base.campaign.createdAt
    })
  )
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
  // Counts the answer's own Convex calls; System-level reads are the room cache's when warm.
  const calls: string[] = []
  const caller = {
    ...value.owner.caller,
    fetch: async (pathname: string, init?: RequestInit) => {
      const response = await value.owner.caller.fetch(pathname, init)
      if (commandRoutes.has(pathname) && !isSystemLevelRead(pathname, init))
        calls.push(`${pathname.replace('/live-sessions/', '')} ${response.status}`)
      return response
    }
  }
  const records = () =>
    value.base.t.run(async (ctx) =>
      withoutStorageIds({
        runs: await ctx.db.query('encounterRuns').collect(),
        actors: await ctx.db.query('encounterRunActors').collect(),
        occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
        receipts: await ctx.db.query('encounterRuleReceipts').collect(),
        commands: await ctx.db.query('encounterRunCommands').collect(),
        liveStates: await ctx.db.query('sceneLiveStates').collect(),
        sceneCommands: await ctx.db.query('sceneLiveCommands').collect(),
        authority: await ctx.db.query('campaignLiveAuthorities').collect()
      })
    )
  return { value, command, caller, calls, records }
}

function isSystemLevelRead(pathname: string, init?: RequestInit) {
  if (typeof init?.body !== 'string') return false
  const { request } = JSON.parse(init.body) as { request?: { kind?: string } }
  return (
    (pathname === '/live-sessions/encounter-rules' &&
      (request?.kind === 'DEFINITION' || request?.kind === 'SYSTEM_VOCABULARY')) ||
    (pathname === '/live-sessions/character-rules' &&
      (request?.kind === 'PUBLICATIONS' ||
        request?.kind === 'CLASS_CATALOGUE' ||
        request?.kind === 'SPELL_CATALOGUE' ||
        request?.kind === 'SOURCE_INDEX'))
  )
}

/** Storage IDs and creation times differ between two otherwise identical tables. */
function withoutStorageIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutStorageIds)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== '_id' && key !== '_creationTime')
      .map(([key, entry]) => [key, withoutStorageIds(entry)])
  )
}

/** Runs a scenario with the same generated IDs and clock, so two runs can be compared exactly. */
async function deterministic<T>(scenario: () => Promise<T>): Promise<T> {
  let next = 0
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-09-27T12:00:00.000Z') })
  vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(
    () => `00000000-0000-4000-8000-${(next++).toString(16).padStart(12, '0')}` as const
  )
  try {
    return await scenario()
  } finally {
    vi.restoreAllMocks()
    vi.useRealTimers()
  }
}

it('answers a prefetched decision in one Convex call with the stage path results (D64)', async () => {
  const answered = async (prefetched: boolean) => {
    const issued = await issueReactionChoice()
    const prefetch = prefetched
      ? await prefetchInRoom(issued.value.owner.caller, issued.command)
      : undefined
    issued.calls.length = 0
    const result = await executeInRoom(
      issued.caller,
      { command: issued.command },
      undefined,
      prefetch
    )
    return { result, calls: issued.calls, records: await issued.records() }
  }
  const staged = await deterministic(() => answered(false))
  const prefetched = await deterministic(() => answered(true))
  expect(staged.calls).toEqual(['encounter-movement-stage 200', 'encounter-movement 200'])
  expect(prefetched.calls).toEqual(['encounter-movement-answer 200'])
  expect(prefetched.result.occurrence).toMatchObject({ status: 'PENDING' })
  expect(prefetched.result).toEqual(staged.result)
  expect(prefetched.records).toEqual(staged.records)
}, 120_000)

it('refuses a stale prefetch (409) and falls back to the stage with the fresh inputs (D64)', async () => {
  const answered = async (stale: boolean) => {
    const issued = await issueReactionChoice()
    const prefetch = stale
      ? await prefetchInRoom(issued.value.owner.caller, issued.command)
      : undefined
    // A read no commit fence covers changes after the prefetch: the GM stops auto-rolling.
    await setAutoRollDice(issued.value.base.t, issued.value.owner.userId, false)
    issued.calls.length = 0
    const result = await executeInRoom(
      issued.caller,
      { command: issued.command },
      undefined,
      prefetch
    )
    return { result, calls: issued.calls, records: await issued.records() }
  }
  const fresh = await deterministic(() => answered(false))
  const fallback = await deterministic(() => answered(true))
  expect(fallback.calls).toEqual([
    'encounter-movement-answer 409',
    'encounter-movement-stage 200',
    'encounter-movement 200'
  ])
  expect(fallback.result).toEqual(fresh.result)
  expect(fallback.records).toEqual(fresh.records)
}, 120_000)

it('refuses an answer to a decision the GM voided after its prefetch, writing nothing', async () => {
  const issued = await issueReactionChoice()
  const prefetch = await prefetchInRoom(issued.value.owner.caller, issued.command)
  await executeInRoom(issued.value.owner.caller, {
    command: {
      type: 'VOID_RULE_OCCURRENCE',
      commandId: crypto.randomUUID(),
      encounterId: issued.command.encounterId,
      expectedVersion: issued.command.expectedVersion,
      occurrenceId: issued.command.occurrenceId,
      expectedOccurrenceVersion: issued.command.expectedOccurrenceVersion
    }
  })
  const before = await issued.records()
  issued.calls.length = 0
  await expect(
    executeInRoom(issued.caller, { command: issued.command }, undefined, prefetch)
  ).rejects.toThrow()
  // The answer is stale itself (Rule occurrence is unavailable), so nothing falls back or commits.
  expect(issued.calls.filter((call) => call.endsWith(' 200'))).toEqual([])
  expect(await issued.records()).toEqual(before)
}, 120_000)

it('admits a prefetch only for a member who may answer, and never answers with another member’s', async () => {
  const issued = await issueReactionChoice()
  const { value, command } = issued
  // The GM controls both reacting creatures; the player may not answer their choice.
  await expect(prefetchInRoom(value.player.caller, command)).rejects.toMatchObject({
    data: { reason: 'NOT_ACTOR_CONTROLLER' }
  })
  const ownerPrefetch = await prefetchInRoom(value.owner.caller, command)
  const before = await issued.records()
  // The owner's prefetch was admitted for the owner; Convex routes and rereads the answer as the player.
  await expect(
    executeInRoom(value.player.caller, { command }, undefined, ownerPrefetch)
  ).rejects.toThrow()
  expect(await issued.records()).toEqual(before)
}, 120_000)

it('answers through the stage when the room holds no prefetch, as after a restart', async () => {
  const issued = await issueReactionChoice()
  const result = await executeInRoom(issued.caller, { command: issued.command })
  expect(issued.calls).toEqual(['encounter-movement-stage 200', 'encounter-movement 200'])
  expect(result.occurrence).toMatchObject({ status: 'PENDING' })
}, 120_000)

it('settles a prefetched answer idempotently and resolves its commit by Scene and command', async () => {
  const issued = await issueReactionChoice()
  const { value, command } = issued
  const prefetch: LiveSessionMovementPrefetch = await prefetchInRoom(value.owner.caller, command)
  const before = await value.base.t.run((ctx) =>
    ctx.db
      .query('campaignLiveAuthorities')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', value.base.campaign.id))
      .unique()
  )
  if (!before) throw new Error('Expected the live authority.')
  const subject = {
    kind: 'MOVEMENT_ANSWER' as const,
    sceneId: value.sceneId,
    commandId: command.commandId,
    expiresAt: Date.now() + 60_000
  }
  const settle = (expiresAt: number) =>
    value.owner.caller.mutation(resolve, {
      campaignId: value.base.campaign.id,
      epoch: before.epoch,
      subject: { ...subject, expiresAt },
      expectedSequence: before.persistedSequence,
      expectedStateChecksum: before.persistedStateChecksum,
      nextStateChecksum: '1'.repeat(64)
    })
  // Nothing landed: the answer may still land until it expires, and is abandoned after.
  await expect(settle(Date.now() + 60_000)).rejects.toThrow()
  await expect(settle(Date.now() - 1)).resolves.toEqual({ outcome: 'ABANDONED' })
  const result = await executeInRoom(issued.caller, { command }, undefined, prefetch)
  expect(result.occurrence).toMatchObject({ status: 'PENDING' })
  const after = await issued.records()
  // A resent answer is refused and writes nothing; the room answers a retry from its journal.
  await expect(executeInRoom(issued.caller, { command }, undefined, prefetch)).rejects.toThrow()
  expect(await issued.records()).toEqual(after)
}, 120_000)
