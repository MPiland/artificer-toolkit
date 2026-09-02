import assert from 'node:assert/strict'

import type { DBLike } from '@artificer-toolkit/db'
import { sql } from 'kysely'

import { createPhase81PostgresCommittedFixture } from './phase81PostgresCommittedFixture.js'
import type { Phase81PostgresEnvironment } from './phase81PostgresRaceSupport.js'

interface TrackedRows {
  column: string
  id: string
  table: string
}

async function countTrackedRows(db: DBLike, row: TrackedRows): Promise<number> {
  const result = await sql
    .raw<{ count: string }>(
      `select count(*)::text as count from ${row.table} where ${row.column} = '${row.id}'::uuid`
    )
    .execute(db)
  return Number(result.rows[0]?.count ?? '0')
}

async function assertZeroRows(db: DBLike, rows: readonly TrackedRows[]): Promise<void> {
  for (const row of rows) {
    assert.equal(
      await countTrackedRows(db, row),
      0,
      `Phase 8.1 cleanup left rows in ${row.table} for ${row.column}=${row.id}.`
    )
  }
}

/**
 * The fixture itself creates each aggregate through its production service
 * path. This proof ensures cleanup removes every aggregate-owned persistence
 * row visible from those roots, using a fresh connection after cleanup.
 */
export async function provePhase81PostgresCleanup(
  environment: Phase81PostgresEnvironment,
  runId: string
): Promise<void> {
  const fixture = await createPhase81PostgresCommittedFixture(environment, `${runId}-cleanup`)
  let proofError: unknown
  let cleanupError: unknown
  let cleaned = false
  try {
    const character = await fixture.ensureCharacter()
    const scene = await fixture.ensureScene()
    const now = new Date()
    assert.equal(
      await fixture.lease.claim({
        authorityId: fixture.ids.gmUserId,
        expiresAt: new Date(now.getTime() + 60_000).toISOString(),
        now: now.toISOString(),
        sessionId: fixture.ids.sessionId
      }),
      true,
      'Cleanup proof must create the disposable live-session lease it verifies.'
    )

    const rows: readonly TrackedRows[] = [
      { table: 'auth.users', column: 'id', id: fixture.ids.gmUserId },
      { table: 'auth.users', column: 'id', id: fixture.ids.playerUserId },
      { table: 'auth.users', column: 'id', id: fixture.ids.otherUserId },
      { table: 'public.profiles', column: 'id', id: fixture.ids.gmUserId },
      { table: 'public.profiles', column: 'id', id: fixture.ids.playerUserId },
      { table: 'public.profiles', column: 'id', id: fixture.ids.otherUserId },
      { table: 'public.campaigns', column: 'id', id: fixture.ids.campaignId },
      { table: 'public.authored_route_ids', column: 'subject_id', id: fixture.ids.campaignId },
      { table: 'public.campaign_memberships', column: 'campaign_id', id: fixture.ids.campaignId },
      { table: 'public.campaign_play_settings', column: 'campaign_id', id: fixture.ids.campaignId },
      { table: 'public.campaign_sessions', column: 'id', id: fixture.ids.sessionId },
      {
        table: 'public.live_session_command_leases',
        column: 'session_id',
        id: fixture.ids.sessionId
      },
      {
        table: 'public.campaign_session_attendance',
        column: 'session_id',
        id: fixture.ids.sessionId
      },
      {
        table: 'public.campaign_session_scene_presentations',
        column: 'session_id',
        id: fixture.ids.sessionId
      },
      {
        table: 'public.campaign_character_assignments',
        column: 'campaign_id',
        id: fixture.ids.campaignId
      },
      { table: 'public.encounter_blueprints', column: 'id', id: fixture.ids.encounterBlueprintId },
      { table: 'public.encounters', column: 'id', id: fixture.ids.encounterId },
      { table: 'public.encounter_actors', column: 'encounter_id', id: fixture.ids.encounterId },
      { table: 'public.encounter_events', column: 'encounter_id', id: fixture.ids.encounterId },
      {
        table: 'public.encounter_rule_occurrences',
        column: 'encounter_id',
        id: fixture.ids.encounterId
      },
      {
        table: 'public.encounter_rule_receipts',
        column: 'encounter_id',
        id: fixture.ids.encounterId
      },
      {
        table: 'public.encounter_initiative_rounds',
        column: 'encounter_id',
        id: fixture.ids.encounterId
      },
      {
        table: 'public.encounter_initiative_participants',
        column: 'encounter_id',
        id: fixture.ids.encounterId
      },
      {
        table: 'public.encounter_initiative_sides',
        column: 'encounter_id',
        id: fixture.ids.encounterId
      },
      {
        table: 'public.encounter_active_rule_effects',
        column: 'encounter_id',
        id: fixture.ids.encounterId
      },
      {
        table: 'public.encounter_maintained_effect_states',
        column: 'encounter_id',
        id: fixture.ids.encounterId
      },
      {
        table: 'public.encounter_spatial_rule_effects',
        column: 'encounter_id',
        id: fixture.ids.encounterId
      },
      {
        table: 'public.encounter_scene_bindings',
        column: 'encounter_id',
        id: fixture.ids.encounterId
      },
      {
        table: 'public.encounter_scene_actor_token_bindings',
        column: 'encounter_id',
        id: fixture.ids.encounterId
      },
      { table: 'public.characters', column: 'id', id: character.characterId },
      {
        table: 'public.character_mechanics_projections',
        column: 'character_id',
        id: character.characterId
      },
      {
        table: 'public.campaign_character_mechanics_projections',
        column: 'character_id',
        id: character.characterId
      },
      { table: 'public.character_events', column: 'character_id', id: character.characterId },
      {
        table: 'public.character_rule_occurrences',
        column: 'character_id',
        id: character.characterId
      },
      {
        table: 'public.character_rule_receipts',
        column: 'character_id',
        id: character.characterId
      },
      {
        table: 'public.character_active_rule_effects',
        column: 'character_id',
        id: character.characterId
      },
      { table: 'public.campaign_live_scenes', column: 'id', id: scene.sceneId },
      { table: 'public.campaign_scene_events', column: 'scene_id', id: scene.sceneId }
    ]
    const map = await fixture.db
      .selectFrom('campaign_live_scenes')
      .select('definition_snapshot')
      .where('id', '=', scene.sceneId)
      .executeTakeFirstOrThrow()
    const assetId = (map.definition_snapshot as { map?: { assetId?: string } }).map?.assetId
    assert.ok(assetId, 'Cleanup proof must retain the Scene media asset identity before cleanup.')
    const mediaRows: readonly TrackedRows[] = [
      { table: 'public.media_assets', column: 'id', id: assetId },
      { table: 'public.media_variants', column: 'asset_id', id: assetId },
      { table: 'public.vtt_map_tiles', column: 'asset_id', id: assetId }
    ]
    await fixture.cleanup()
    cleaned = true

    const verifier = fixture.connectionFactory()
    try {
      await assertZeroRows(verifier, [...rows, ...mediaRows])
    } finally {
      await verifier.destroy()
    }
  } catch (error) {
    proofError = error
  } finally {
    if (!cleaned) {
      try {
        await fixture.cleanup()
      } catch (error) {
        cleanupError = error
      }
    }
  }
  if (proofError && cleanupError)
    throw new AggregateError(
      [proofError, cleanupError],
      'Phase 8.1 cleanup proof and cleanup failed.'
    )
  if (proofError) throw proofError
  if (cleanupError) throw cleanupError
}
