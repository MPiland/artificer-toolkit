import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import { ConcurrencyError, createDb } from '@artificer-toolkit/db'
import {
  claimLiveSessionRoomCommandAuthority,
  executeLiveSessionCommand,
  releaseLiveSessionRoomCommandAuthority
} from '@artificer-toolkit/functions/services'
import { sql } from 'kysely'

interface CompactCharacterPostgresProofOptions {
  campaignId: string
  characterId: string
  connectionString: string
  sessionId: string
  userId: string
}

interface CompactCharacterState {
  maximumAdjustment: { id: string; value: number } | null
  canonicalHitPoints: { current: number | null; temp: number | null }
  character: { snapshot: unknown; streamVersion: number }
  event: {
    commandId: string
    commandType: string | null
    committedStreamVersion: number | null
    snapshot: unknown
    type: string
  } | null
  mechanics: {
    commandLaneChecksum: string
    commandState: { state: { hitpoints: { current: number | null; temp: number | null } } }
    projectionChecksum: string
    snapshot: unknown
    streamVersion: number
  }
  overlay: {
    baseMechanicsProjectionChecksum: string
    manualMaximumModifierOwner: 'CHARACTER' | 'CAMPAIGN' | null
    projectionChecksum: string
    snapshot: unknown
    streamVersion: number
  }
}

const SCENE_VISION_CONTEXT = { characterVisions: [], encounterCharacterBindings: [] }
const LOCK_WAIT_TIMEOUT_MS = 5_000

class RollbackProbeError extends Error {
  constructor() {
    super('compact-character-postgres-rollback-probe')
  }
}

function compactCommand(characterId: string, commandId: string, expectedVersion: number) {
  return {
    aggregateKind: 'CHARACTER' as const,
    characterId,
    command: {
      amount: 1,
      commandId,
      expectedVersion,
      mode: 'DAMAGE' as const,
      type: 'ADJUST_HIT_POINTS' as const
    }
  }
}

function maximumModifierCommand(
  characterId: string,
  commandId: string,
  expectedVersion: number,
  value: number
) {
  return {
    aggregateKind: 'CHARACTER' as const,
    characterId,
    command: {
      adjustment: {
        family: 'HIT_POINTS' as const,
        field: 'MAXIMUM_MODIFIER' as const,
        id: randomUUID(),
        value
      },
      commandId,
      expectedVersion,
      type: 'UPSERT_SHEET_ADJUSTMENT' as const
    }
  }
}

async function readCompactCharacterState(
  db: ReturnType<typeof createDb>,
  campaignId: string,
  characterId: string,
  commandId: string
): Promise<CompactCharacterState> {
  const [character, canonicalHitPoints, mechanics, overlay, maximumAdjustment, event] =
    await Promise.all([
      sql<{ snapshot: unknown; streamVersion: number }>`
      select to_jsonb(character) as snapshot, character.stream_version as "streamVersion"
      from public.characters character
      where character.id = ${characterId}::uuid
    `.execute(db),
      sql<{ current: number | null; temp: number | null }>`
      select hit_points.current, hit_points.temp
      from public.character_hitpoint_state hit_points
      where hit_points.character_id = ${characterId}::uuid
    `.execute(db),
      sql<{
        commandLaneChecksum: string
        commandState: { state: { hitpoints: { current: number | null; temp: number | null } } }
        projectionChecksum: string
        snapshot: unknown
        streamVersion: number
      }>`
      select
        to_jsonb(projection) as snapshot,
        projection.stream_version as "streamVersion",
        projection.projection_checksum as "projectionChecksum",
        projection.command_lane_checksum as "commandLaneChecksum",
        projection.command_state as "commandState"
      from public.character_mechanics_projections projection
      where projection.character_id = ${characterId}::uuid
    `.execute(db),
      sql<{
        baseMechanicsProjectionChecksum: string
        manualMaximumModifierOwner: 'CHARACTER' | 'CAMPAIGN' | null
        projectionChecksum: string
        snapshot: unknown
        streamVersion: number
      }>`
      select
        to_jsonb(projection) as snapshot,
        projection.stream_version as "streamVersion",
        projection.projection_checksum as "projectionChecksum",
        projection.base_mechanics_projection_checksum as "baseMechanicsProjectionChecksum",
        projection.manual_maximum_modifier_owner as "manualMaximumModifierOwner"
      from public.campaign_character_mechanics_projections projection
      where projection.campaign_id = ${campaignId}::uuid
        and projection.character_id = ${characterId}::uuid
    `.execute(db),
      sql<{ id: string; value: number }>`
      select id, integer_value as value
      from public.character_hitpoint_adjustments
      where character_id = ${characterId}::uuid
        and field_kind = 'MAXIMUM_MODIFIER'
    `.execute(db),
      sql<{
        commandId: string
        commandType: string | null
        committedStreamVersion: number | null
        snapshot: unknown
        type: string
      }>`
      select
        to_jsonb(event) as snapshot,
        event.command_id::text as "commandId",
        event.event_type as type,
        event.event_data ->> 'commandType' as "commandType",
        (event.event_data ->> 'committedStreamVersion')::int as "committedStreamVersion"
      from public.character_events event
      where event.character_id = ${characterId}::uuid
        and event.command_id = ${commandId}::uuid
    `.execute(db)
    ])

  const characterRow = character.rows[0]
  const hitPointsRow = canonicalHitPoints.rows[0]
  const mechanicsRow = mechanics.rows[0]
  const overlayRow = overlay.rows[0]
  assert.ok(characterRow && hitPointsRow && mechanicsRow && overlayRow)
  return {
    canonicalHitPoints: hitPointsRow,
    character: characterRow,
    event: event.rows[0] ?? null,
    mechanics: mechanicsRow,
    maximumAdjustment: maximumAdjustment.rows[0] ?? null,
    overlay: overlayRow
  }
}

function assertCompactAdvance(
  before: CompactCharacterState,
  after: CompactCharacterState,
  commandId: string,
  commandType = 'ADJUST_HIT_POINTS'
): void {
  const nextVersion = before.character.streamVersion + 1
  assert.equal(after.character.streamVersion, nextVersion)
  assert.equal(after.mechanics.streamVersion, before.mechanics.streamVersion + 1)
  assert.equal(after.overlay.streamVersion, before.overlay.streamVersion + 1)
  assert.notEqual(after.mechanics.projectionChecksum, before.mechanics.projectionChecksum)
  assert.notEqual(after.mechanics.commandLaneChecksum, before.mechanics.commandLaneChecksum)
  assert.deepEqual(
    {
      current: after.mechanics.commandState.state.hitpoints.current,
      temp: after.mechanics.commandState.state.hitpoints.temp
    },
    after.canonicalHitPoints
  )
  assert.equal(after.overlay.baseMechanicsProjectionChecksum, after.mechanics.projectionChecksum)
  assert.notEqual(after.overlay.projectionChecksum, before.overlay.projectionChecksum)
  assert.ok(after.event)
  assert.equal(after.event.commandId, commandId)
  assert.equal(after.event.type, 'CHARACTER_SHEET_COMMAND_APPLIED')
  assert.equal(after.event.commandType, commandType)
  assert.equal(after.event.committedStreamVersion, nextVersion)
}

function assertMaximumModifierAdvance(
  before: CompactCharacterState,
  after: CompactCharacterState,
  commandId: string,
  value: number
): void {
  assertCompactAdvance(before, after, commandId, 'UPSERT_SHEET_ADJUSTMENT')
  assert.ok(after.maximumAdjustment)
  assert.equal(after.maximumAdjustment.value, value)
  assert.equal(after.overlay.manualMaximumModifierOwner, 'CHARACTER')
  assert.notDeepEqual(after.maximumAdjustment, before.maximumAdjustment)
  assert.notDeepEqual(after.character.snapshot, before.character.snapshot)
  assert.notDeepEqual(after.mechanics.snapshot, before.mechanics.snapshot)
  assert.notDeepEqual(after.overlay.snapshot, before.overlay.snapshot)
  assert.equal(after.event?.commandType, 'UPSERT_SHEET_ADJUSTMENT')
}

async function waitForCampaignContention(db: ReturnType<typeof createDb>): Promise<void> {
  const deadline = Date.now() + LOCK_WAIT_TIMEOUT_MS
  while (Date.now() < deadline) {
    const result = await sql<{ count: number }>`
      select count(*)::int as count
      from pg_stat_activity
      where datname = current_database()
        and wait_event_type = 'Lock'
        and query ilike '%from public.campaigns%'
    `.execute(db)
    if ((result.rows[0]?.count ?? 0) >= 1) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  assert.fail('The compact Max-HP command did not wait on the Campaign lock.')
}

async function waitForSessionContention(db: ReturnType<typeof createDb>): Promise<void> {
  const deadline = Date.now() + LOCK_WAIT_TIMEOUT_MS
  while (Date.now() < deadline) {
    const result = await sql<{ count: number }>`
      select count(*)::int as count
      from pg_stat_activity
      where datname = current_database()
        and wait_event_type = 'Lock'
        and query ilike '%from public.campaign_sessions%'
    `.execute(db)
    if ((result.rows[0]?.count ?? 0) >= 1) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  assert.fail('The room authority claim did not wait on the Campaign session lock.')
}

async function waitForCampaignUpdateContention(db: ReturnType<typeof createDb>): Promise<void> {
  const deadline = Date.now() + LOCK_WAIT_TIMEOUT_MS
  while (Date.now() < deadline) {
    const result = await sql<{ count: number }>`
      select count(*)::int as count
      from pg_stat_activity
      where datname = current_database()
        and wait_event_type = 'Lock'
        and query ilike '%update public.campaigns%'
    `.execute(db)
    if ((result.rows[0]?.count ?? 0) >= 1) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  assert.fail('The Campaign update did not wait behind the room authority claim.')
}

async function waitForAssignmentContention(db: ReturnType<typeof createDb>): Promise<void> {
  const deadline = Date.now() + LOCK_WAIT_TIMEOUT_MS
  while (Date.now() < deadline) {
    const result = await sql<{ count: number }>`
      select count(*)::int as count
      from pg_stat_activity
      where datname = current_database()
        and wait_event_type = 'Lock'
        and query ilike '%campaign_character_assignments%'
    `.execute(db)
    if ((result.rows[0]?.count ?? 0) >= 2) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  assert.fail('The compact Character contenders did not both reach the Campaign assignment lock.')
}

export async function proveCompactCharacterPostgresSemantics(
  options: CompactCharacterPostgresProofOptions
): Promise<void> {
  const control = createDb({ connectionString: options.connectionString })
  const contenderA = createDb({ connectionString: options.connectionString })
  const contenderB = createDb({ connectionString: options.connectionString })
  const lockObserver = createDb({ connectionString: options.connectionString })
  const lockHolder = createDb({ connectionString: options.connectionString })
  const authorityId = `compact-postgres-proof-${randomUUID()}`
  const sessionOptions = { campaignId: options.campaignId, sessionId: options.sessionId }
  let authorityClaimed = false

  try {
    const transactionAuthorityId = `compact-claim-transaction-${randomUUID()}`
    let releaseSessionLock: (() => void) | undefined
    const sessionLockReleased = new Promise<void>((resolve) => {
      releaseSessionLock = resolve
    })
    let sessionLockReady: (() => void) | undefined
    const sessionLockHeld = new Promise<void>((resolve) => {
      sessionLockReady = resolve
    })
    const heldSessionLock = lockHolder.transaction().execute(async (trx) => {
      await sql`
        select id from public.campaign_sessions
        where id = ${options.sessionId}::uuid
        for update
      `.execute(trx)
      sessionLockReady?.()
      await sessionLockReleased
    })
    const campaignUpdateRollback = new RollbackProbeError()
    let transactionAuthorityClaimed = false
    let pendingClaim: Promise<void> | undefined
    let pendingCampaignUpdate: Promise<void> | undefined
    try {
      await sessionLockHeld
      pendingClaim = claimLiveSessionRoomCommandAuthority(
        contenderA,
        options.userId,
        sessionOptions,
        transactionAuthorityId
      )
      await waitForSessionContention(lockObserver)
      pendingCampaignUpdate = contenderB.transaction().execute(async (trx) => {
        await sql`
          update public.campaigns
          set updated_at = updated_at
          where id = ${options.campaignId}::uuid
        `.execute(trx)
        throw campaignUpdateRollback
      })
      await waitForCampaignUpdateContention(lockObserver)
      releaseSessionLock?.()
      await heldSessionLock
      await pendingClaim
      pendingClaim = undefined
      transactionAuthorityClaimed = true
      await assert.rejects(
        pendingCampaignUpdate,
        (error: unknown) => error === campaignUpdateRollback
      )
      pendingCampaignUpdate = undefined
      const lease = await sql<{ authorityId: string; campaignStatus: string }>`
        select lease.authority_id as "authorityId", campaign.status as "campaignStatus"
        from public.live_session_command_leases lease
        join public.campaign_sessions session on session.id = lease.session_id
        join public.campaigns campaign on campaign.id = session.campaign_id
        where lease.session_id = ${options.sessionId}::uuid
      `.execute(control)
      assert.deepEqual(lease.rows, [
        { authorityId: transactionAuthorityId, campaignStatus: 'ACTIVE' }
      ])
    } finally {
      releaseSessionLock?.()
      await heldSessionLock
      await Promise.allSettled(
        [pendingClaim, pendingCampaignUpdate].filter(
          (pending): pending is Promise<void> => pending !== undefined
        )
      )
      if (transactionAuthorityClaimed) {
        await releaseLiveSessionRoomCommandAuthority(
          control,
          sessionOptions,
          transactionAuthorityId
        )
      }
    }

    await claimLiveSessionRoomCommandAuthority(control, options.userId, sessionOptions, authorityId)
    authorityClaimed = true

    const rollbackCommandId = randomUUID()
    const rollbackBaseline = await readCompactCharacterState(
      control,
      options.campaignId,
      options.characterId,
      rollbackCommandId
    )
    const rollbackCommand = compactCommand(
      options.characterId,
      rollbackCommandId,
      rollbackBaseline.character.streamVersion
    )
    const rollbackError = new RollbackProbeError()
    await assert.rejects(
      control.transaction().execute(async (trx) => {
        const execution = await executeLiveSessionCommand(
          trx,
          options.userId,
          sessionOptions,
          rollbackCommand,
          authorityId,
          SCENE_VISION_CONTEXT
        )
        assert.equal(execution.aggregateKind, 'CHARACTER')
        assert.equal(execution.response, null)
        assert.equal(execution.replayed, false)
        assert.equal(execution.version, rollbackBaseline.character.streamVersion + 1)
        const duringRollback = await readCompactCharacterState(
          trx,
          options.campaignId,
          options.characterId,
          rollbackCommandId
        )
        assertCompactAdvance(rollbackBaseline, duringRollback, rollbackCommandId)
        assert.notDeepEqual(duringRollback.canonicalHitPoints, rollbackBaseline.canonicalHitPoints)
        throw rollbackError
      }),
      (error: unknown) => error === rollbackError
    )
    assert.deepEqual(
      await readCompactCharacterState(
        control,
        options.campaignId,
        options.characterId,
        rollbackCommandId
      ),
      rollbackBaseline
    )

    const contentionCommandId = randomUUID()
    const contentionBaseline = await readCompactCharacterState(
      control,
      options.campaignId,
      options.characterId,
      contentionCommandId
    )
    const contentionCommand = compactCommand(
      options.characterId,
      contentionCommandId,
      contentionBaseline.character.streamVersion
    )
    let releaseAssignmentLock: (() => void) | undefined
    let heldLockFailure: unknown
    const assignmentLockReleased = new Promise<void>((resolve) => {
      releaseAssignmentLock = resolve
    })
    let assignmentLockAcquired: (() => void) | undefined
    const assignmentLockReady = new Promise<void>((resolve) => {
      assignmentLockAcquired = resolve
    })
    const heldLock = lockHolder.transaction().execute(async (trx) => {
      await sql`
        select campaign_id
        from public.campaign_character_assignments
        where campaign_id = ${options.campaignId}::uuid
          and character_id = ${options.characterId}::uuid
        for update
      `.execute(trx)
      assignmentLockAcquired?.()
      await assignmentLockReleased
    })
    let executionsPromise:
      | Promise<PromiseSettledResult<Awaited<ReturnType<typeof executeLiveSessionCommand>>>[]>
      | undefined
    try {
      await assignmentLockReady
      executionsPromise = Promise.allSettled([
        executeLiveSessionCommand(
          contenderA,
          options.userId,
          sessionOptions,
          contentionCommand,
          authorityId,
          SCENE_VISION_CONTEXT
        ),
        executeLiveSessionCommand(
          contenderB,
          options.userId,
          sessionOptions,
          contentionCommand,
          authorityId,
          SCENE_VISION_CONTEXT
        )
      ])
      await waitForAssignmentContention(lockObserver)
      releaseAssignmentLock?.()
      await heldLock
      if (!executionsPromise) throw new Error('Character contention executions did not start.')
      const executions = await executionsPromise
      const results = executions.map((execution) => {
        if (execution.status !== 'fulfilled') {
          throw execution.reason
        }
        return execution.value
      })
      assert.equal(results.filter((result) => result.replayed).length, 1)
      assert.equal(results.filter((result) => !result.replayed).length, 1)
      for (const result of results) {
        assert.equal(result.aggregateKind, 'CHARACTER')
        assert.equal(result.aggregateId, options.characterId)
        assert.equal(result.commandId, contentionCommandId)
        assert.equal(result.response, null)
        assert.equal(result.version, contentionBaseline.character.streamVersion + 1)
      }
      const characterResults = results.filter((result) => result.aggregateKind === 'CHARACTER')
      assert.equal(characterResults.length, 2)
      assert.deepEqual(characterResults[0]?.characterVision, characterResults[1]?.characterVision)
    } finally {
      releaseAssignmentLock?.()
      try {
        await heldLock
      } catch (error) {
        heldLockFailure = error
      }
      if (executionsPromise) await executionsPromise
    }
    if (heldLockFailure) throw heldLockFailure

    const afterContention = await readCompactCharacterState(
      control,
      options.campaignId,
      options.characterId,
      contentionCommandId
    )
    assertCompactAdvance(contentionBaseline, afterContention, contentionCommandId)
    assert.notDeepEqual(afterContention.canonicalHitPoints, contentionBaseline.canonicalHitPoints)

    // The maximum-modifier lane is intentionally independent from the ordinary
    // hit-point lane above: it locks Campaign admission first, then publishes
    // canonical state, both projections, and the receipt in one transaction.
    const maximumBaseline = await readCompactCharacterState(
      control,
      options.campaignId,
      options.characterId,
      randomUUID()
    )
    const firstMaximumValue = maximumBaseline.maximumAdjustment?.value === 7 ? 9 : 7
    const firstMaximumCommandId = randomUUID()
    const firstMaximumCommand = maximumModifierCommand(
      options.characterId,
      firstMaximumCommandId,
      maximumBaseline.character.streamVersion,
      firstMaximumValue
    )
    const firstMaximumExecution = await executeLiveSessionCommand(
      control,
      options.userId,
      sessionOptions,
      firstMaximumCommand,
      authorityId,
      SCENE_VISION_CONTEXT
    )
    assert.equal(firstMaximumExecution.aggregateKind, 'CHARACTER')
    assert.equal(firstMaximumExecution.replayed, false)
    assert.equal(firstMaximumExecution.response, null)
    assert.equal(firstMaximumExecution.version, maximumBaseline.character.streamVersion + 1)
    const afterFirstMaximum = await readCompactCharacterState(
      control,
      options.campaignId,
      options.characterId,
      firstMaximumCommandId
    )
    assertMaximumModifierAdvance(
      maximumBaseline,
      afterFirstMaximum,
      firstMaximumCommandId,
      firstMaximumValue
    )

    const rollbackMaximumCommandId = randomUUID()
    const rollbackMaximumBaseline = await readCompactCharacterState(
      control,
      options.campaignId,
      options.characterId,
      rollbackMaximumCommandId
    )
    const rollbackMaximumValue = 11
    const rollbackMaximumCommand = maximumModifierCommand(
      options.characterId,
      rollbackMaximumCommandId,
      rollbackMaximumBaseline.character.streamVersion,
      rollbackMaximumValue
    )
    const rollbackMaximumError = new RollbackProbeError()
    await assert.rejects(
      control.transaction().execute(async (trx) => {
        const execution = await executeLiveSessionCommand(
          trx,
          options.userId,
          sessionOptions,
          rollbackMaximumCommand,
          authorityId,
          SCENE_VISION_CONTEXT
        )
        assert.equal(execution.aggregateKind, 'CHARACTER')
        assert.equal(execution.replayed, false)
        assert.equal(execution.version, rollbackMaximumBaseline.character.streamVersion + 1)
        const duringRollback = await readCompactCharacterState(
          trx,
          options.campaignId,
          options.characterId,
          rollbackMaximumCommandId
        )
        assertMaximumModifierAdvance(
          rollbackMaximumBaseline,
          duringRollback,
          rollbackMaximumCommandId,
          rollbackMaximumValue
        )
        throw rollbackMaximumError
      }),
      (error: unknown) => error === rollbackMaximumError
    )
    assert.deepEqual(
      await readCompactCharacterState(
        control,
        options.campaignId,
        options.characterId,
        rollbackMaximumCommandId
      ),
      rollbackMaximumBaseline
    )

    const replayMaximumCommandId = randomUUID()
    const replayMaximumBaseline = await readCompactCharacterState(
      control,
      options.campaignId,
      options.characterId,
      replayMaximumCommandId
    )
    const replayMaximumValue = 17
    const replayMaximumCommand = maximumModifierCommand(
      options.characterId,
      replayMaximumCommandId,
      replayMaximumBaseline.character.streamVersion,
      replayMaximumValue
    )
    const replayExecutions = await Promise.all([
      executeLiveSessionCommand(
        contenderA,
        options.userId,
        sessionOptions,
        replayMaximumCommand,
        authorityId,
        SCENE_VISION_CONTEXT
      ),
      executeLiveSessionCommand(
        contenderB,
        options.userId,
        sessionOptions,
        replayMaximumCommand,
        authorityId,
        SCENE_VISION_CONTEXT
      )
    ])
    assert.equal(replayExecutions.filter((execution) => execution.replayed).length, 1)
    assert.equal(replayExecutions.filter((execution) => !execution.replayed).length, 1)
    for (const execution of replayExecutions) {
      assert.equal(execution.aggregateKind, 'CHARACTER')
      assert.equal(execution.commandId, replayMaximumCommandId)
      assert.equal(execution.version, replayMaximumBaseline.character.streamVersion + 1)
      assert.equal(execution.response, null)
    }
    const replayCharacterExecutions = replayExecutions.filter(
      (execution): execution is Extract<typeof execution, { aggregateKind: 'CHARACTER' }> =>
        execution.aggregateKind === 'CHARACTER'
    )
    assert.equal(replayCharacterExecutions.length, 2)
    assert.deepEqual(
      replayCharacterExecutions[0]?.characterVision,
      replayCharacterExecutions[1]?.characterVision
    )
    const afterReplayMaximum = await readCompactCharacterState(
      control,
      options.campaignId,
      options.characterId,
      replayMaximumCommandId
    )
    assertMaximumModifierAdvance(
      replayMaximumBaseline,
      afterReplayMaximum,
      replayMaximumCommandId,
      replayMaximumValue
    )

    const competingMaximumBaseline = await readCompactCharacterState(
      control,
      options.campaignId,
      options.characterId,
      randomUUID()
    )
    const competingMaximumAId = randomUUID()
    const competingMaximumBId = randomUUID()
    const competingMaximumA = maximumModifierCommand(
      options.characterId,
      competingMaximumAId,
      competingMaximumBaseline.character.streamVersion,
      23
    )
    const competingMaximumB = maximumModifierCommand(
      options.characterId,
      competingMaximumBId,
      competingMaximumBaseline.character.streamVersion,
      29
    )
    const competingMaximumResults = await Promise.allSettled([
      executeLiveSessionCommand(
        contenderA,
        options.userId,
        sessionOptions,
        competingMaximumA,
        authorityId,
        SCENE_VISION_CONTEXT
      ),
      executeLiveSessionCommand(
        contenderB,
        options.userId,
        sessionOptions,
        competingMaximumB,
        authorityId,
        SCENE_VISION_CONTEXT
      )
    ])
    assert.equal(
      competingMaximumResults.filter((result) => result.status === 'fulfilled').length,
      1
    )
    assert.equal(competingMaximumResults.filter((result) => result.status === 'rejected').length, 1)
    const rejectedMaximum = competingMaximumResults.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    )
    assert.ok(rejectedMaximum)
    assert.ok(rejectedMaximum.reason instanceof ConcurrencyError)
    const winningMaximum = competingMaximumResults.find(
      (
        result
      ): result is PromiseFulfilledResult<Awaited<ReturnType<typeof executeLiveSessionCommand>>> =>
        result.status === 'fulfilled'
    )
    assert.ok(winningMaximum)
    assert.equal(winningMaximum.value.aggregateKind, 'CHARACTER')
    assert.equal(winningMaximum.value.replayed, false)
    assert.equal(winningMaximum.value.version, competingMaximumBaseline.character.streamVersion + 1)
    const afterCompetingMaximum = await readCompactCharacterState(
      control,
      options.campaignId,
      options.characterId,
      winningMaximum.value.commandId
    )
    const winningMaximumValue = winningMaximum.value.commandId === competingMaximumAId ? 23 : 29
    assertMaximumModifierAdvance(
      competingMaximumBaseline,
      afterCompetingMaximum,
      winningMaximum.value.commandId,
      winningMaximumValue
    )
    const eventCount = await sql<{ count: number }>`
      select count(*)::int as count
      from public.character_events
      where character_id = ${options.characterId}::uuid
        and command_id in (${competingMaximumAId}::uuid, ${competingMaximumBId}::uuid)
    `.execute(control)
    assert.equal(eventCount.rows[0]?.count, 1)

    const campaignLockBaseline = await readCompactCharacterState(
      control,
      options.campaignId,
      options.characterId,
      randomUUID()
    )
    const campaignLockCommandId = randomUUID()
    const campaignLockCommand = maximumModifierCommand(
      options.characterId,
      campaignLockCommandId,
      campaignLockBaseline.character.streamVersion,
      31
    )
    let releaseCampaignLock: (() => void) | undefined
    const campaignLockReleased = new Promise<void>((resolve) => {
      releaseCampaignLock = resolve
    })
    let campaignLockReady: (() => void) | undefined
    const campaignLockHeld = new Promise<void>((resolve) => {
      campaignLockReady = resolve
    })
    let touchDependentLocks: (() => void) | undefined
    const dependentLockTouchRequested = new Promise<void>((resolve) => {
      touchDependentLocks = resolve
    })
    let dependentLocksTouched: (() => void) | undefined
    const dependentLockTouchComplete = new Promise<void>((resolve) => {
      dependentLocksTouched = resolve
    })
    const heldCampaignLock = lockHolder.transaction().execute(async (trx) => {
      await sql`
        select id from public.campaigns
        where id = ${options.campaignId}::uuid
        for update
      `.execute(trx)
      campaignLockReady?.()
      await dependentLockTouchRequested
      await sql`
        select id from public.campaign_sessions
        where id = ${options.sessionId}::uuid
        for update
      `.execute(trx)
      await sql`
        select campaign_id from public.campaign_character_assignments
        where campaign_id = ${options.campaignId}::uuid
          and character_id = ${options.characterId}::uuid
        for update
      `.execute(trx)
      dependentLocksTouched?.()
      await campaignLockReleased
    })
    try {
      await campaignLockHeld
      const campaignLockedExecution = executeLiveSessionCommand(
        contenderA,
        options.userId,
        sessionOptions,
        campaignLockCommand,
        authorityId,
        SCENE_VISION_CONTEXT
      )
      await waitForCampaignContention(lockObserver)
      touchDependentLocks?.()
      await dependentLockTouchComplete
      releaseCampaignLock?.()
      await heldCampaignLock
      const execution = await campaignLockedExecution
      assert.equal(execution.aggregateKind, 'CHARACTER')
      assert.equal(execution.replayed, false)
      assert.equal(execution.version, campaignLockBaseline.character.streamVersion + 1)
      const afterCampaignLock = await readCompactCharacterState(
        control,
        options.campaignId,
        options.characterId,
        campaignLockCommandId
      )
      assertMaximumModifierAdvance(
        campaignLockBaseline,
        afterCampaignLock,
        campaignLockCommandId,
        31
      )
    } finally {
      touchDependentLocks?.()
      releaseCampaignLock?.()
      await heldCampaignLock
    }
  } finally {
    try {
      if (authorityClaimed) {
        await releaseLiveSessionRoomCommandAuthority(control, sessionOptions, authorityId)
      }
    } finally {
      await Promise.all([
        control.destroy(),
        contenderA.destroy(),
        contenderB.destroy(),
        lockObserver.destroy(),
        lockHolder.destroy()
      ])
    }
  }
}
