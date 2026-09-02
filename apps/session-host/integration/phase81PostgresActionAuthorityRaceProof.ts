import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import {
  createEncounterRepository,
  createReusableDefinitionRepository,
  type DBLike
} from '@artificer-toolkit/db'
import {
  createPlatformRulesRuntime,
  createReusableDefinitionRuntimeSource,
  deriveRulesRuntimeContinuationIntegrityKey,
  unassignCampaignCharacter
} from '@artificer-toolkit/functions/services'
import { sql } from 'kysely'

import { lockEncounterActionSceneContext } from '../../../packages/functions/src/services/encounter/encounterActionSceneContext.js'
import { leaveCampaign } from '../../../packages/functions/src/services/campaign/campaignService.js'
import { claimLiveSessionRoomCommandAuthority } from '../../../packages/functions/src/services/liveSession/liveSessionService.js'
import { createPhase81PostgresCommittedFixture } from './phase81PostgresCommittedFixture.js'
import {
  createPhase81RacePassResult,
  phase81RaceModuleContracts,
  requirePhase81BackendPid,
  runPhase81CampaignRootRace,
  runPhase81ProductionRootRace,
  type Phase81PostgresEnvironment,
  type Phase81RaceOperationResult,
  type Phase81RacePassResult
} from './phase81PostgresRaceSupport.js'

type ActionAuthorityCaseId = (typeof phase81RaceModuleContracts.actionAuthority.caseIds)[number]

type Phase81Fixture = Awaited<ReturnType<typeof createPhase81PostgresCommittedFixture>>
type PendingDirectActionResult = Extract<
  Awaited<ReturnType<Phase81Fixture['adapters']['executeEncounterActorDirectRuleAction']>>,
  { status: 'PENDING' }
>

function runtimeFor(db: DBLike, runId: string) {
  return createPlatformRulesRuntime({
    continuationIntegrityKey: deriveRulesRuntimeContinuationIntegrityKey(
      `phase81-action-authority-${runId}`
    ),
    definitions: createReusableDefinitionRuntimeSource(createReusableDefinitionRepository(db))
  })
}

function isPendingDirectActionResult(value: unknown): value is PendingDirectActionResult {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    candidate.status === 'PENDING' &&
    typeof candidate.occurrenceId === 'string' &&
    typeof candidate.occurrenceVersion === 'number'
  )
}

function automaticResolution(pending: PendingDirectActionResult) {
  if ('request' in pending) return { kind: 'SYSTEM' as const, requestId: pending.request.requestId }
  if ('requests' in pending)
    return {
      kind: 'SYSTEM_OUTCOME' as const,
      requestIds: pending.requests.map(({ requestId }) => requestId)
    }
  return { kind: 'LEGENDARY_RESISTANCE' as const, selection: 'DECLINE' as const }
}

function assertAuthorityOrCurrentnessConflict(result: Phase81RaceOperationResult): void {
  assert.equal(result.fulfilled, false)
  assert.match(
    result.error instanceof Error ? result.error.message : String(result.error),
    /authority|assign|membership|campaign|lease|turn|current|controlled|changed|unavailable|stale|version|awaiting resolution/iu
  )
}

async function runActionAuthorityRace(input: {
  action: (db: DBLike) => Promise<unknown>
  fixture: Phase81Fixture
  lane: 'CAMPAIGN' | 'LEASE'
  mutate: (db: DBLike) => Promise<unknown>
  mutateFirst: boolean
}): Promise<readonly [Phase81RaceOperationResult, Phase81RaceOperationResult]> {
  const winner = input.mutateFirst ? input.mutate : input.action
  const contender = input.mutateFirst ? input.action : input.mutate
  if (input.lane === 'CAMPAIGN') {
    return runPhase81CampaignRootRace({
      campaignId: input.fixture.ids.campaignId,
      connectionFactory: input.fixture.connectionFactory,
      observer: input.fixture.db,
      winner,
      contender
    })
  }
  return runPhase81ProductionRootRace({
    connectionFactory: input.fixture.connectionFactory,
    observer: input.fixture.db,
    winner,
    contender,
    lockWinnerRoot: async (trx) => {
      await sql`
        select id
        from public.campaigns
        where id = ${input.fixture.ids.campaignId}::uuid
        for update
      `.execute(trx)
      await sql`
        select id
        from public.campaign_sessions
        where id = ${input.fixture.ids.sessionId}::uuid
        for update
      `.execute(trx)
      return requirePhase81BackendPid(trx)
    }
  })
}

async function assertActionCommandCardinality(input: {
  db: DBLike
  commandId: string
  encounterId: string
  expectedOccurrences: number
  expectedReceipts: number
}): Promise<void> {
  const occurrences = await input.db
    .selectFrom('encounter_rule_occurrences')
    .select(({ fn }) => fn.countAll<string>().as('count'))
    .where('encounter_id', '=', input.encounterId)
    .where('root_command_id', '=', input.commandId)
    .executeTakeFirstOrThrow()
  const receipts = await input.db
    .selectFrom('encounter_rule_receipts')
    .select(({ fn }) => fn.countAll<string>().as('count'))
    .where('encounter_id', '=', input.encounterId)
    .where('command_id', '=', input.commandId)
    .executeTakeFirstOrThrow()
  assert.equal(Number(occurrences.count), input.expectedOccurrences)
  assert.equal(Number(receipts.count), input.expectedReceipts)
}

/**
 * These schedules deliberately invoke the production command services through
 * independent database handles.  They never race repository CAS calls in
 * isolation: the assertions are about the command/authority outcomes.
 */
export async function provePhase81PostgresActionAuthorityRaces(input: {
  environment: Phase81PostgresEnvironment
  runId: string
}): Promise<readonly Phase81RacePassResult<ActionAuthorityCaseId>[]> {
  const results: Phase81RacePassResult<ActionAuthorityCaseId>[] = []

  const run = async <TCaseId extends ActionAuthorityCaseId>(
    caseId: TCaseId,
    ordering: 'FIRST_WINS' | 'SECOND_WINS',
    mutate: (fixture: Phase81Fixture, db: DBLike) => Promise<unknown>,
    mutateFirst: boolean,
    lane: 'CAMPAIGN' | 'LEASE' = 'CAMPAIGN'
  ) => {
    const fixture = await createPhase81PostgresCommittedFixture(
      input.environment,
      `${input.runId}-${caseId}`
    )
    try {
      const character = await fixture.ensureCharacter()
      const scene = await fixture.ensureScene()
      const sceneContext = await lockEncounterActionSceneContext({
        db: fixture.db,
        encounterId: fixture.ids.encounterId,
        actorId: character.actorId,
        targetActorId: fixture.ids.creatureActorId,
        request: {
          sceneId: scene.sceneId,
          expectedSceneVersion: scene.sceneVersion,
          sourceTokenId: scene.sourceTokenId,
          targetTokenId: scene.creatureTokenId
        }
      })
      assert.ok(sceneContext, 'The committed fixture must provide an action Scene context.')
      const commandId = randomUUID()
      const runtimeKey = `${input.runId}-${caseId}-${commandId}`
      const initialEncounter = await createEncounterRepository(fixture.db).find(
        fixture.ids.encounterId
      )
      assert.ok(initialEncounter, 'The prepared fixture Encounter must exist.')
      const action = (db: DBLike) =>
        fixture.adapters.executeEncounterActorDirectRuleAction({
          db,
          runtime: runtimeFor(db, runtimeKey),
          command: {
            actionId: character.actionId,
            actorId: character.actorId,
            actorUserId: fixture.ids.playerUserId,
            commandId,
            correlationId: randomUUID(),
            encounterId: fixture.ids.encounterId,
            expectedEncounterVersion: initialEncounter.version,
            sceneContext,
            targetActorId: fixture.ids.creatureActorId
          }
        })
      const [winnerResult, contenderResult] = await runActionAuthorityRace({
        action,
        fixture,
        lane,
        mutate: (db) => mutate(fixture, db),
        mutateFirst
      })
      if (mutateFirst) {
        assert.ok(
          winnerResult.fulfilled,
          `The authority mutation must settle first: ${winnerResult.error instanceof Error ? (winnerResult.error.stack ?? `${winnerResult.error.name}: ${winnerResult.error.message}`) : String(winnerResult.error)}`
        )
        assertAuthorityOrCurrentnessConflict(contenderResult)
      } else if (caseId === 'P81-RACE-ACTION-ADVANCE-ACTION-FIRST') {
        assert.ok(
          isPendingDirectActionResult(winnerResult.value),
          `The action must pause once: ${winnerResult.fulfilled ? JSON.stringify(winnerResult.value) : winnerResult.error instanceof Error ? `${winnerResult.error.name}: ${winnerResult.error.message}` : String(winnerResult.error)}`
        )
        assertAuthorityOrCurrentnessConflict(contenderResult)
        const encounter = await createEncounterRepository(fixture.db).find(fixture.ids.encounterId)
        assert.equal(
          encounter?.currentActorId,
          character.actorId,
          'The blocked advance preserves turn state.'
        )
        const pending = await fixture.repositories.occurrences.lockOccurrence(
          'ENCOUNTER',
          fixture.ids.encounterId,
          winnerResult.value.occurrenceId
        )
        assert.equal(pending?.state, 'PENDING')
        assert.equal(pending?.version, winnerResult.value.occurrenceVersion)
      } else {
        assert.ok(
          winnerResult.fulfilled && contenderResult.fulfilled,
          `A pending action may be invalidated only after its authority change settles. Winner: ${winnerResult.fulfilled ? JSON.stringify(winnerResult.value) : winnerResult.error instanceof Error ? `${winnerResult.error.name}: ${winnerResult.error.message}` : String(winnerResult.error)}. Contender: ${contenderResult.fulfilled ? JSON.stringify(contenderResult.value) : contenderResult.error instanceof Error ? `${contenderResult.error.name}: ${contenderResult.error.message}` : String(contenderResult.error)}.`
        )
        assert.ok(isPendingDirectActionResult(winnerResult.value), 'The action must be pending.')
        await assert.rejects(
          fixture.adapters.resumeEncounterActorDirectRuleAction({
            db: fixture.db,
            runtime: runtimeFor(fixture.db, runtimeKey),
            command: {
              actorUserId: fixture.ids.playerUserId,
              commandId: randomUUID(),
              correlationId: randomUUID(),
              encounterId: fixture.ids.encounterId,
              expectedEncounterVersion:
                (await createEncounterRepository(fixture.db).find(fixture.ids.encounterId))
                  ?.version ?? -1,
              expectedOccurrenceVersion: winnerResult.value.occurrenceVersion,
              occurrenceId: winnerResult.value.occurrenceId,
              resolution: automaticResolution(winnerResult.value)
            }
          }),
          /authority|assign|membership|campaign|lease|turn|current|controlled|changed|unavailable|stale|version|awaiting resolution/iu
        )
        const pending = await fixture.repositories.occurrences.lockOccurrence(
          'ENCOUNTER',
          fixture.ids.encounterId,
          winnerResult.value.occurrenceId
        )
        assert.equal(pending?.state, 'PENDING')
        assert.equal(pending?.version, winnerResult.value.occurrenceVersion)
      }
      await assertActionCommandCardinality({
        db: fixture.db,
        commandId,
        encounterId: fixture.ids.encounterId,
        expectedOccurrences: mutateFirst ? 0 : 1,
        expectedReceipts: mutateFirst ? 0 : 1
      })
      if (caseId.includes('ASSIGNMENT')) {
        const assignment = await sql<{ count: string }>`
          select count(*)::text as count
          from public.campaign_character_assignments
          where campaign_id = ${fixture.ids.campaignId}::uuid
            and user_id = ${fixture.ids.playerUserId}::uuid
        `.execute(fixture.db)
        assert.equal(Number(assignment.rows[0]?.count ?? '0'), 0)
      }
      if (caseId.includes('LEASE')) {
        const lease = await sql<{ count: string }>`
          select count(*)::text as count
          from public.live_session_command_leases
          where session_id = ${fixture.ids.sessionId}::uuid
        `.execute(fixture.db)
        assert.equal(Number(lease.rows[0]?.count ?? '0'), 1)
      }
      if (caseId.includes('MEMBER')) {
        const membership = await sql<{ left_at: Date | null }>`
          select left_at
          from public.campaign_memberships
          where campaign_id = ${fixture.ids.campaignId}::uuid
            and user_id = ${fixture.ids.playerUserId}::uuid
        `.execute(fixture.db)
        assert.ok(membership.rows[0]?.left_at)
      }
      results.push(
        createPhase81RacePassResult({
          caseId,
          ordering,
          assertions: [
            'Independent production commands settled under aggregate locks.',
            'The losing command failed or the invalidated action could not resume.',
            'Fixture cleanup is aggregate-owned and exact.'
          ]
        })
      )
    } finally {
      await fixture.cleanup()
    }
  }

  const advance = async (fixture: Phase81Fixture, db: DBLike) => {
    return fixture.adapters.executeEncounterCommand(
      db,
      fixture.ids.gmUserId,
      {
        type: 'ADVANCE_TURN',
        encounterId: fixture.ids.encounterId,
        commandId: randomUUID(),
        expectedVersion:
          (await createEncounterRepository(db).find(fixture.ids.encounterId))?.version ?? -1
      },
      { rulesRuntime: runtimeFor(db, `advance-${fixture.ids.encounterId}`) }
    )
  }
  const unassign = async (fixture: Phase81Fixture, db: DBLike) => {
    const { characterId } = await fixture.ensureCharacter()
    return unassignCampaignCharacter(db, fixture.ids.gmUserId, fixture.ids.campaignId, characterId)
  }
  const claimLease = async (fixture: Phase81Fixture, db: DBLike) => {
    await claimLiveSessionRoomCommandAuthority(
      db,
      fixture.ids.gmUserId,
      { campaignId: fixture.ids.campaignId, sessionId: fixture.ids.sessionId },
      `phase81-${randomUUID()}`
    )
  }
  const leaveMembership = async (fixture: Phase81Fixture, db: DBLike) => {
    const membership = await sql<{ access_started_at: Date }>`
      select access_started_at
      from public.campaign_memberships
      where campaign_id = ${fixture.ids.campaignId}::uuid
        and user_id = ${fixture.ids.playerUserId}::uuid
    `.execute(db)
    const campaign = await sql<{ version: number }>`
      select version from public.campaigns where id = ${fixture.ids.campaignId}::uuid
    `.execute(db)
    const currentMembership = membership.rows[0]
    const currentCampaign = campaign.rows[0]
    assert.ok(currentMembership && currentCampaign)
    return leaveCampaign(
      db,
      fixture.ids.playerUserId,
      fixture.ids.campaignId,
      currentCampaign.version,
      new Date(currentMembership.access_started_at).toISOString(),
      randomUUID()
    )
  }
  const duplicateContext = async (fixture: Phase81Fixture) => {
    const character = await fixture.ensureCharacter()
    const scene = await fixture.ensureScene()
    const sceneContext = await lockEncounterActionSceneContext({
      db: fixture.db,
      encounterId: fixture.ids.encounterId,
      actorId: character.actorId,
      targetActorId: fixture.ids.creatureActorId,
      request: {
        sceneId: scene.sceneId,
        expectedSceneVersion: scene.sceneVersion,
        sourceTokenId: scene.sourceTokenId,
        targetTokenId: scene.creatureTokenId
      }
    })
    assert.ok(sceneContext)
    const commandId = randomUUID()
    const runtimeKey = `${input.runId}-duplicate-${commandId}`
    const currentEncounter = await createEncounterRepository(fixture.db).find(
      fixture.ids.encounterId
    )
    assert.ok(currentEncounter, 'The prepared fixture Encounter must exist.')
    const invoke = (db: DBLike) =>
      fixture.adapters.executeEncounterActorDirectRuleAction({
        db,
        runtime: runtimeFor(db, runtimeKey),
        command: {
          actionId: character.actionId,
          actorId: character.actorId,
          actorUserId: fixture.ids.playerUserId,
          commandId,
          correlationId: null,
          encounterId: fixture.ids.encounterId,
          expectedEncounterVersion: currentEncounter.version,
          sceneContext,
          targetActorId: fixture.ids.creatureActorId
        }
      })
    return { character, commandId, currentEncounter, invoke, runtimeKey, sceneContext }
  }

  const settlePendingAction = async (input: {
    fixture: Phase81Fixture
    pending: PendingDirectActionResult
    runtimeKey: string
  }) => {
    const beforeResume = await createEncounterRepository(input.fixture.db).find(
      input.fixture.ids.encounterId
    )
    assert.ok(beforeResume)
    let pending = input.pending
    for (let phase = 0; phase < 3; phase += 1) {
      const result = await input.fixture.adapters.resumeEncounterActorDirectRuleAction({
        db: input.fixture.db,
        runtime: runtimeFor(input.fixture.db, input.runtimeKey),
        command: {
          actorUserId: input.fixture.ids.playerUserId,
          commandId: randomUUID(),
          correlationId: null,
          encounterId: input.fixture.ids.encounterId,
          expectedEncounterVersion: beforeResume.version,
          expectedOccurrenceVersion: pending.occurrenceVersion,
          occurrenceId: pending.occurrenceId,
          resolution: automaticResolution(pending)
        }
      })
      if (!isPendingDirectActionResult(result)) return result
      pending = result
    }
    throw new Error('The direct action exceeded its bounded pending phases.')
  }

  const concurrentDuplicate = async (fixture: Phase81Fixture) => {
    const context = await duplicateContext(fixture)
    const [winner, contender] = await runPhase81CampaignRootRace({
      campaignId: fixture.ids.campaignId,
      connectionFactory: fixture.connectionFactory,
      observer: fixture.db,
      winner: context.invoke,
      contender: context.invoke
    })
    assert.ok(winner.fulfilled && contender.fulfilled)
    assert.deepEqual(contender.value, winner.value, 'Concurrent duplicate must replay identically.')
    assert.ok(isPendingDirectActionResult(winner.value))
    const settled = await settlePendingAction({
      fixture,
      pending: winner.value,
      runtimeKey: context.runtimeKey
    })
    const beforeReplay = await createEncounterRepository(fixture.db).find(fixture.ids.encounterId)
    assert.ok(beforeReplay)
    const replay = await context.invoke(fixture.db)
    const afterReplay = await createEncounterRepository(fixture.db).find(fixture.ids.encounterId)
    assert.ok(afterReplay)
    assert.equal(afterReplay.version, beforeReplay.version)
    assert.equal(
      (replay as { occurrenceId?: string }).occurrenceId,
      (settled as { occurrenceId?: string }).occurrenceId
    )
    await assertActionCommandCardinality({
      db: fixture.db,
      commandId: context.commandId,
      encounterId: fixture.ids.encounterId,
      expectedOccurrences: 1,
      expectedReceipts: 1
    })
  }

  const retryReplay = async (fixture: Phase81Fixture) => {
    const context = await duplicateContext(fixture)
    const initial = await context.invoke(fixture.db)
    assert.ok(
      isPendingDirectActionResult(initial),
      'Initial submission must create one pending action.'
    )
    const settled = await settlePendingAction({
      fixture,
      pending: initial,
      runtimeKey: context.runtimeKey
    })
    const beforeReplay = await createEncounterRepository(fixture.db).find(fixture.ids.encounterId)
    assert.ok(beforeReplay)
    const replay = await context.invoke(fixture.db)
    const afterReplay = await createEncounterRepository(fixture.db).find(fixture.ids.encounterId)
    assert.ok(afterReplay)
    assert.equal(
      afterReplay.version,
      beforeReplay.version,
      'Retry must replay without a second settlement.'
    )
    assert.deepEqual(replay, initial, 'Retry must return the original command-scoped receipt.')
    assert.equal(
      (replay as { occurrenceId?: string }).occurrenceId,
      (settled as { occurrenceId?: string }).occurrenceId
    )
    await assertActionCommandCardinality({
      db: fixture.db,
      commandId: context.commandId,
      encounterId: fixture.ids.encounterId,
      expectedOccurrences: 1,
      expectedReceipts: 1
    })
    const events = await createEncounterRepository(fixture.db).listEvents(fixture.ids.encounterId)
    assert.equal(
      events.filter(
        (event) =>
          event.commandType === 'RESOLVE_RULE_ACTION' &&
          (event.resultPayload as { ruleReceipt?: { occurrenceId?: string } }).ruleReceipt
            ?.occurrenceId === (settled as { occurrenceId?: string }).occurrenceId
      ).length,
      1,
      'The settled occurrence must retain one durable Encounter event.'
    )
  }

  await run('P81-RACE-ACTION-ADVANCE-ACTION-FIRST', 'FIRST_WINS', advance, false)
  await run('P81-RACE-ACTION-ADVANCE-ADVANCE-FIRST', 'SECOND_WINS', advance, true)
  await run('P81-RACE-ACTION-ASSIGNMENT-ACTION-FIRST', 'FIRST_WINS', unassign, false)
  await run('P81-RACE-ACTION-ASSIGNMENT-ASSIGNMENT-FIRST', 'SECOND_WINS', unassign, true)
  await run('P81-RACE-ACTION-LEASE-ACTION-FIRST', 'FIRST_WINS', claimLease, false, 'LEASE')
  await run('P81-RACE-ACTION-LEASE-LEASE-FIRST', 'SECOND_WINS', claimLease, true, 'LEASE')
  await run('P81-RACE-ACTION-MEMBER-ACTION-FIRST', 'FIRST_WINS', leaveMembership, false)
  await run('P81-RACE-ACTION-MEMBER-MEMBER-FIRST', 'SECOND_WINS', leaveMembership, true)

  for (const [caseId, ordering, proof] of [
    ['P81-RACE-DUPLICATE-DUPLICATE-FIRST', 'FIRST_WINS', concurrentDuplicate],
    ['P81-RACE-DUPLICATE-RETRY-FIRST', 'SECOND_WINS', retryReplay]
  ] as const) {
    const fixture = await createPhase81PostgresCommittedFixture(
      input.environment,
      `${input.runId}-${caseId}`
    )
    try {
      await proof(fixture)
      results.push(
        createPhase81RacePassResult({
          caseId,
          ordering,
          assertions: [
            caseId === 'P81-RACE-DUPLICATE-DUPLICATE-FIRST'
              ? 'Independent concurrent duplicate commands reached the real direct-action service.'
              : 'A later retry replayed the settled real direct-action command.',
            'Replay retained one durable occurrence and receipt.',
            'Fixture cleanup is aggregate-owned and exact.'
          ]
        })
      )
    } finally {
      await fixture.cleanup()
    }
  }

  assert.deepEqual(
    results.map(({ caseId }) => caseId).sort(),
    [...phase81RaceModuleContracts.actionAuthority.caseIds].sort()
  )
  return results
}
