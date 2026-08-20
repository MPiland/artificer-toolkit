import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import { createDb } from '@artificer-toolkit/db'
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

async function readCompactCharacterState(
  db: ReturnType<typeof createDb>,
  campaignId: string,
  characterId: string,
  commandId: string
): Promise<CompactCharacterState> {
  const [character, canonicalHitPoints, mechanics, overlay, event] = await Promise.all([
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
      projectionChecksum: string
      snapshot: unknown
      streamVersion: number
    }>`
      select
        to_jsonb(projection) as snapshot,
        projection.stream_version as "streamVersion",
        projection.projection_checksum as "projectionChecksum",
        projection.base_mechanics_projection_checksum as "baseMechanicsProjectionChecksum"
      from public.campaign_character_mechanics_projections projection
      where projection.campaign_id = ${campaignId}::uuid
        and projection.character_id = ${characterId}::uuid
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
    overlay: overlayRow
  }
}

function assertCompactAdvance(
  before: CompactCharacterState,
  after: CompactCharacterState,
  commandId: string
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
  assert.equal(
    after.overlay.baseMechanicsProjectionChecksum,
    after.mechanics.projectionChecksum
  )
  assert.notEqual(after.overlay.projectionChecksum, before.overlay.projectionChecksum)
  assert.ok(after.event)
  assert.equal(after.event.commandId, commandId)
  assert.equal(after.event.type, 'CHARACTER_SHEET_COMMAND_APPLIED')
  assert.equal(after.event.commandType, 'ADJUST_HIT_POINTS')
  assert.equal(after.event.committedStreamVersion, nextVersion)
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
    let contentionFailure: unknown
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
    let executionsPromise: ReturnType<typeof Promise.allSettled> | undefined
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
      const executions = await executionsPromise
      assert.equal(executions.every((execution) => execution.status === 'fulfilled'), true)
      const results = executions.map((execution) => {
        assert.equal(execution.status, 'fulfilled')
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
      const characterResults = results.filter(
        (result): result is Extract<(typeof results)[number], { aggregateKind: 'CHARACTER' }> =>
          result.aggregateKind === 'CHARACTER'
      )
      assert.equal(characterResults.length, 2)
      assert.deepEqual(characterResults[0]?.characterVision, characterResults[1]?.characterVision)
    } catch (error) {
      contentionFailure = error
      throw error
    } finally {
      releaseAssignmentLock?.()
      try {
        await heldLock
      } catch (error) {
        if (!contentionFailure) throw error
      }
      if (executionsPromise) await executionsPromise
    }

    const afterContention = await readCompactCharacterState(
      control,
      options.campaignId,
      options.characterId,
      contentionCommandId
    )
    assertCompactAdvance(contentionBaseline, afterContention, contentionCommandId)
    assert.notDeepEqual(afterContention.canonicalHitPoints, contentionBaseline.canonicalHitPoints)
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
