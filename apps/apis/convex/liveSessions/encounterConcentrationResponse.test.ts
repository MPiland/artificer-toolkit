// @vitest-environment node
import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type {
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { serverKernelRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import {
  createPlatformRulesRuntime,
  deriveRulesContinuationKey
} from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import {
  commitNativeLiveEncounterAction,
  planNativeLiveEncounterAction
} from '../../../session-worker/src/nativeEncounterRules'
import {
  commitNativeLiveConcentrationResponse,
  planNativeLiveConcentrationResponse
} from '../../../session-worker/src/nativeConcentrationResponse'
import {
  concentrationAction,
  concentrationRecords,
  seedConcentration,
  setupConcentration
} from '../../tests/fixtures/concentration'
import { seedActiveInitiative } from '../../tests/fixtures/activeInitiative'
import { api, components, internal } from '../_generated/api'
import { resumeNativeConcentration } from '../encounters/concentrationResponses'
import {
  insertActiveLiveAuthority,
  stubLiveSessionFetch,
  workerEnvironment
} from '../../tests/fixtures/liveSessionWorker'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: vi.fn(() => 19) }))

const workerSecret = 'private-concentration-response-test-secret-at-least-32-bytes'
const authSecret = 'private-concentration-response-continuation-test-secret-at-least-32-bytes'
const environment = workerEnvironment(workerSecret)
const capture = makeFunctionReference<
  'query',
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesResponse
>('liveSessions/encounterRulesCapture:capture')

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

async function runtime() {
  return createPlatformRulesRuntime({
    continuationIntegrityKey: await deriveRulesContinuationKey(
      process.env.RULES_CONTINUATION_SECRET
    ),
    definitions: {
      async requireCurrent() {
        throw new Error('Concentration graphs are supplied by their sealed capture.')
      }
    }
  })
}

async function pendingFixture() {
  const fixture = await setupConcentration('ASSISTED')
  const seeded = await seedConcentration(fixture)
  await fixture.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (query) => query.eq('id', fixture.run.id))
      .unique()
    if (!row) throw new Error('Concentration Run is unavailable.')
    await seedActiveInitiative(ctx, encounterRunStateSchema.parse(JSON.parse(row.stateJson)), [
      fixture.actor.id,
      fixture.target.id
    ])
    await insertActiveLiveAuthority(ctx, {
      campaignId: fixture.campaign.id,
      sessionId: fixture.run.sessionId,
      epoch: fixture.run.id,
      createdAt: fixture.campaign.createdAt
    })
  })
  vi.stubEnv('BETTER_AUTH_SECRET', authSecret)
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', workerSecret)
  stubLiveSessionFetch((pathname, init) => {
    const token = new Headers(init?.headers).get('authorization')
    const caller =
      token === 'Bearer fixture-player-token'
        ? fixture.player.caller
        : token === 'Bearer fixture-owner-token'
          ? fixture.owner.caller
          : null
    if (!caller) throw new Error('Unknown fixture access token.')
    return caller.fetch(pathname, init)
  })
  const ownerScope = {
    campaignId: fixture.campaign.id,
    sessionId: fixture.run.sessionId,
    authorityEpoch: fixture.run.id,
    expectedUserId: fixture.owner.userId,
    expectedRole: 'OWNER' as const,
    encounterId: fixture.run.id,
    expectedVersion: fixture.run.version
  }
  const parent = await planNativeLiveEncounterAction(
    environment,
    'fixture-owner-token',
    ownerScope,
    concentrationAction(fixture),
    { runtime: await runtime(), random: () => 19 }
  )
  if (parent.kind !== 'PLANNED' || !parent.concentration.pending)
    throw new Error('Expected completed parent with pending concentration child.')
  const before = await concentrationRecords(fixture)
  await commitNativeLiveEncounterAction(environment, 'fixture-owner-token', ownerScope, parent)
  const staged = await concentrationRecords(fixture)
  expect(staged).not.toEqual(before)
  expect(staged.pending).toHaveLength(1)
  const pending = await fixture.player.caller.query(
    api.encounters.pendingReads.pendingRuleOccurrence,
    { encounterId: fixture.run.id }
  )
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Assigned player cannot discover the concentration child.')
  expect(pending.occurrenceId).toBe(staged.pending[0]?.id)
  return { fixture, seeded, staged, pending }
}

async function unassignedPlayer(fixture: Awaited<ReturnType<typeof setupConcentration>>) {
  const user = await fixture.t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'Unassigned player',
          email: 'unassigned-concentration-player@example.invalid',
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      },
      onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
    })
  )
  const session = await fixture.t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: {
          userId: user._id,
          token: crypto.randomUUID(),
          expiresAt: Date.now() + 60000,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
  )
  const caller = fixture.t.withIdentity({ subject: user._id, sessionId: session._id })
  const identity = await caller.query(api.account.identity, {})
  if (!identity) throw new Error('Unassigned player identity is unavailable.')
  await fixture.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: fixture.campaign.id,
      userId: identity.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: fixture.campaign.createdAt,
      joinedAt: fixture.campaign.createdAt,
      leftAt: null
    })
  )
  return { caller, userId: identity.userId }
}

it.each([
  { face: 20, outcome: 'SAVE_SUCCESS' as const, responder: 'OWNER' as const },
  { face: 1, outcome: 'SAVE_FAILURE' as const, responder: 'PLAYER' as const }
])(
  'commits and replays an Assisted concentration $outcome for $responder with native parity',
  async ({ face, outcome, responder }) => {
    const { fixture, seeded, staged, pending } = await pendingFixture()
    const actor = responder === 'OWNER' ? fixture.owner : fixture.player
    const token = responder === 'OWNER' ? 'fixture-owner-token' : 'fixture-player-token'
    const response: ResolveRuleOccurrenceInputDto = {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: fixture.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: pending.encounterVersion,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      correlationId: null,
      resolution: { kind: 'SYSTEM_ROLL', requestId: pending.request.requestId }
    }
    const scope = {
      campaignId: fixture.campaign.id,
      sessionId: fixture.run.sessionId,
      authorityEpoch: fixture.run.id,
      expectedUserId: actor.userId,
      expectedRole: responder,
      encounterId: fixture.run.id,
      expectedVersion: pending.encounterVersion
    }
    if (responder === 'PLAYER') {
      const outsider = await unassignedPlayer(fixture)
      const beforeRefusal = await concentrationRecords(fixture)
      await expect(
        outsider.caller.query(capture, {
          ...scope,
          expectedUserId: outsider.userId,
          concentrationResponse: response,
          request: { kind: 'CONCENTRATION_RESPONSE' }
        })
      ).rejects.toThrow()
      expect(await concentrationRecords(fixture)).toEqual(beforeRefusal)
    }
    let rolls = 0
    const plan = await planNativeLiveConcentrationResponse(environment, token, scope, response, {
      runtime: await runtime(),
      random: () => {
        rolls++
        return face - 1
      }
    })
    if (plan.kind !== 'PLANNED') throw new Error('Expected completed concentration response.')
    expect(rolls).toBe(1)
    expect(plan.input.execution).toMatchObject({
      applicationOutputs: { kind: 'CONCENTRATION_CHECK', outcome }
    })
    expect(await concentrationRecords(fixture)).toEqual(staged)

    const native: { result?: Awaited<ReturnType<typeof resumeNativeConcentration>> } = {}
    const random = await import('../lib/rollRandom')
    vi.mocked(random.nextRollInt).mockReturnValueOnce(face - 1)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(plan.input.occurredAt))
    try {
      await expect(
        actor.caller.run(async (ctx) => {
          native.result = await resumeNativeConcentration(ctx, response, actor.userId)
          throw new Error('Roll back native concentration parity probe.')
        })
      ).rejects.toThrow('Roll back native concentration parity probe.')
    } finally {
      vi.useRealTimers()
    }
    if (!native.result) throw new Error('Native concentration response did not complete.')
    expect(await concentrationRecords(fixture)).toEqual(staged)

    if (outcome === 'SAVE_FAILURE') {
      const revision = plan.input.revisions[0]
      if (!revision) throw new Error('Concentration revision was not captured.')
      await expect(
        commitNativeLiveConcentrationResponse(environment, token, {
          ...plan,
          input: {
            ...plan.input,
            revisions: [
              { ...revision, revision: crypto.randomUUID() },
              ...plan.input.revisions.slice(1)
            ]
          }
        })
      ).rejects.toThrow()
      expect(await concentrationRecords(fixture)).toEqual(staged)
      const execution = storedRuleExecutionResultDtoSchema.parse(plan.input.execution)
      if (
        execution.status !== 'COMPLETE' ||
        execution.applicationOutputs.kind !== 'CONCENTRATION_CHECK' ||
        !execution.applicationOutputs.cleanup
      )
        throw new Error('Expected completed concentration cleanup receipt.')
      await expect(
        commitNativeLiveConcentrationResponse(environment, token, {
          ...plan,
          input: {
            ...plan.input,
            execution: {
              ...execution,
              applicationOutputs: {
                ...execution.applicationOutputs,
                cleanup: {
                  ...execution.applicationOutputs.cleanup,
                  removedDependentEffectIds: [crypto.randomUUID()]
                }
              }
            }
          }
        })
      ).rejects.toThrow()
      expect(await concentrationRecords(fixture)).toEqual(staged)
      expect(plan.input.pending).toBeNull()
      const storedSnapshot = staged.pending[0]?.pendingSnapshotJson
      if (!storedSnapshot) throw new Error('Stored concentration child snapshot is unavailable.')
      const unexpectedNext = serverKernelRuleExecutionPendingSnapshotDtoSchema.parse(
        JSON.parse(storedSnapshot)
      )
      await expect(
        commitNativeLiveConcentrationResponse(environment, token, {
          ...plan,
          input: { ...plan.input, pending: unexpectedNext }
        })
      ).rejects.toThrow()
      expect(await concentrationRecords(fixture)).toEqual(staged)
    }

    const committed = await commitNativeLiveConcentrationResponse(environment, token, plan)
    expect(committed).toEqual(native.result)
    expect(committed.occurrence).toMatchObject({ status: 'COMPLETE', outcome })
    const after = await concentrationRecords(fixture)
    expect(after.run?.version).toBe(staged.run!.version + (outcome === 'SAVE_FAILURE' ? 1 : 0))
    expect(after.states.some((state) => state.id === seeded.state.id)).toBe(
      outcome === 'SAVE_SUCCESS'
    )
    expect(after.effects.some((effect) => effect.id === seeded.dependent.id)).toBe(
      outcome === 'SAVE_SUCCESS'
    )
    expect(after.effects.some((effect) => effect.id === seeded.independent.id)).toBe(true)
    expect(after.pending).toEqual([])
    expect(after.completed.map((entry) => entry.id)).toContain(response.occurrenceId)
    expect(await commitNativeLiveConcentrationResponse(environment, token, plan)).toEqual(committed)
    expect(await concentrationRecords(fixture)).toEqual(after)
    const retry = await planNativeLiveConcentrationResponse(environment, token, scope, response, {
      runtime: await runtime(),
      random: () => {
        throw new Error('Replayed concentration response must not reroll.')
      }
    })
    expect(retry).toEqual({ kind: 'REPLAY', result: committed })
    expect(rolls).toBe(1)
    expect(await concentrationRecords(fixture)).toEqual(after)
  },
  60_000
)
