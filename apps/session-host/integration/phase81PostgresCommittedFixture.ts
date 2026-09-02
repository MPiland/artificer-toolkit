import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import {
  createActiveRuleEffectRepository,
  createCampaignRepository,
  createCharacterMechanicsProjectionRepository,
  createDb,
  createLiveSessionCommandLeaseRepository,
  createMediaRepository,
  createRuleOccurrenceRepository,
  createVttSceneRepository,
  srdBaselineContent,
  type DBLike
} from '@artificer-toolkit/db'
import {
  assignCampaignCharacter,
  createCampaign,
  createCampaignSession,
  createEncounter,
  createEncounterBlueprint,
  executeEncounterCommand,
  getCampaignPlaySettings,
  saveCampaignPlaySettings
} from '@artificer-toolkit/functions/services'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { materializeCampaignScene, type SceneDefinition } from '@artificer-toolkit/shared/vtt'
import type { SaveCampaignPlaySettingsInput } from '@artificer-toolkit/schema/api/campaigns'
import { sql } from 'kysely'

import { dispatchAndReloadSheetCommand } from '../../../packages/functions/src/scripts/characterLifecycleIntegrationAssertions.js'
import {
  findFixtureCatalog,
  type BuilderResolutionTiming,
  type CharacterLifecycleFixture,
  type CharacterRuleEvaluationTiming,
  type SheetReadTiming
} from '../../../packages/functions/src/scripts/characterLifecycleIntegrationFixtures.js'
import { proveFixtureLifecycle } from '../../../packages/functions/src/scripts/characterLifecycleIntegrationBuilderProof.js'
import {
  executeEncounterActorDirectRuleAction,
  resumeEncounterActorDirectRuleAction
} from '../../../packages/functions/src/services/encounter/encounterActorDirectRuleActionService.js'
import { compileSceneCurrentProjection } from '../../../packages/functions/src/services/encounter/sceneProjectionReplay.js'
import { executeEncounterSceneCommand } from '../../../packages/functions/src/services/encounter/vttSceneService.js'

import type { Phase81PostgresEnvironment } from './phase81PostgresRaceSupport.js'

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', 'host.docker.internal'])
const SRD_LIGHT_CROSSBOW_ID = '00000000-0000-0000-0060-000b00000000'

interface DisposableUser {
  id: string
}

export interface Phase81CommittedFixtureIds {
  campaignId: string
  creatureActorId: string
  creatureActorIds: readonly string[]
  creatureDefinitionId: string
  encounterBlueprintId: string
  encounterId: string
  gameSystemId: string
  gmUserId: string
  otherUserId: string
  playerUserId: string
  sessionId: string
}

export interface Phase81PostgresCommittedFixtureOptions {
  creatureCount?: 1 | 2
  creatureLabel?: string
  preCreatePlaySettings?: Partial<
    Omit<SaveCampaignPlaySettingsInput, 'campaignId' | 'expectedVersion'>
  >
}

export interface Phase81CommittedCharacterFixture {
  actionId: string
  actorId: string
  characterId: string
}

export interface Phase81CommittedSceneFixture {
  creatureTokenId: string
  sceneId: string
  sceneVersion: number
  sourceTokenId: string
}

export interface Phase81PostgresCommittedFixture {
  adapters: {
    assignCampaignCharacter: typeof assignCampaignCharacter
    executeEncounterActorDirectRuleAction: typeof executeEncounterActorDirectRuleAction
    executeEncounterCommand: typeof executeEncounterCommand
    executeEncounterSceneCommand: typeof executeEncounterSceneCommand
    resumeEncounterActorDirectRuleAction: typeof resumeEncounterActorDirectRuleAction
    saveCampaignPlaySettings: typeof saveCampaignPlaySettings
  }
  cleanup(): Promise<void>
  connectionFactory(): ReturnType<typeof createDb>
  db: ReturnType<typeof createDb>
  ensureCharacter(): Promise<Phase81CommittedCharacterFixture>
  ensureScene(): Promise<Phase81CommittedSceneFixture>
  ids: Phase81CommittedFixtureIds
  lease: ReturnType<typeof createLiveSessionCommandLeaseRepository>
  repositories: {
    activeEffects: ReturnType<typeof createActiveRuleEffectRepository>
    occurrences: ReturnType<typeof createRuleOccurrenceRepository>
    scenes: ReturnType<typeof createVttSceneRepository>
  }
}

function requireLoopback(name: string, value: string): void {
  const host = new URL(value).hostname.toLowerCase()
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`${name} must use a loopback host; received "${host}".`)
  }
}

async function createDisposableUser(
  admin: ReturnType<typeof createClient>['auth']['admin'],
  runId: string,
  role: string
): Promise<DisposableUser> {
  const { data, error } = await admin.createUser({
    email: `phase81-${role}-${runId}@example.test`,
    email_confirm: true,
    password: `Local-${randomUUID()}-Aa1!`,
    user_metadata: { username: `p81${role}${runId.replaceAll('-', '').slice(-14)}` }
  })
  if (error) throw error
  if (!data.user) throw new Error(`Supabase did not create the ${role} fixture user.`)
  return { id: data.user.id }
}

async function deleteDisposableUser(
  admin: ReturnType<typeof createClient>['auth']['admin'],
  userId: string
): Promise<void> {
  const result = await admin.deleteUser(userId)
  if (result.error) throw result.error
}

async function trackedCount(db: DBLike, table: string, column: string, ids: readonly string[]) {
  if (ids.length === 0) return 0
  const literals = ids.map((id) => `'${id}'::uuid`).join(', ')
  const result = await sql
    .raw<{ count: string }>(
      `select count(*)::text as count from ${table} where ${column} in (${literals})`
    )
    .execute(db)
  return Number(result.rows[0]?.count ?? '0')
}

/**
 * Creates only committed, disposable aggregate roots.  Race modules get real
 * service entry points and may ask for the Character/Scene projections only
 * when their schedule actually needs them.
 */
export async function createPhase81PostgresCommittedFixture(
  environment: Phase81PostgresEnvironment,
  runId: string,
  options: Phase81PostgresCommittedFixtureOptions = {}
): Promise<Phase81PostgresCommittedFixture> {
  requireLoopback('DATABASE_CONNECTION_STRING', environment.connectionString)
  requireLoopback('SUPABASE_URL', environment.supabaseUrl)

  const db = createDb({ connectionString: environment.connectionString })
  const admin = createClient(environment.supabaseUrl, environment.supabaseSecretKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false }
  })
  const users: DisposableUser[] = []
  const cleanupErrors: unknown[] = []
  let cleaned = false
  let character: Phase81CommittedCharacterFixture | null = null
  let scene: Phase81CommittedSceneFixture | null = null
  let mapAssetId: string | null = null
  let campaignIdForCleanup: string | null = null
  let blueprintIdForCleanup: string | null = null
  let characterIdForCleanup: string | null = null

  try {
    const gm = await createDisposableUser(admin.auth.admin, runId, 'gm')
    const player = await createDisposableUser(admin.auth.admin, runId, 'player')
    const other = await createDisposableUser(admin.auth.admin, runId, 'other')
    users.push(gm, player, other)

    const catalogue = await db
      .selectFrom('rules_catalogues')
      .select(['id', 'game_system_id'])
      .orderBy('id', 'asc')
      .executeTakeFirstOrThrow()
    const creatureLabel = options.creatureLabel ?? 'Goblin'
    const creature = srdBaselineContent.subjects.creatures.find(
      (candidate) =>
        candidate.label === creatureLabel && candidate.systemId === catalogue.game_system_id
    )
    assert.ok(creature, `The canonical SRD ${creatureLabel} fixture is unavailable.`)

    const campaign = await createCampaign(db, gm.id, {
      name: `Phase 8.1 committed fixture ${runId.slice(0, 36)}`,
      format: 'ONE_SHOT',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: catalogue.game_system_id,
      primaryRulesCatalogueId: catalogue.id
    })
    campaignIdForCleanup = campaign.id
    await createCampaignRepository(db).activatePlayerMembership(
      campaign.id,
      player.id,
      new Date().toISOString()
    )
    if (options.preCreatePlaySettings) {
      const currentSettings = await getCampaignPlaySettings(db, gm.id, campaign.id)
      const {
        campaignId: _campaignId,
        updatedAt: _updatedAt,
        version,
        ...settings
      } = currentSettings
      await saveCampaignPlaySettings(db, gm.id, {
        ...settings,
        ...options.preCreatePlaySettings,
        campaignId: campaign.id,
        expectedVersion: version
      })
    }
    const session = await createCampaignSession(
      db,
      { campaignId: campaign.id, title: `Phase 8.1 fixture ${runId}` },
      gm.id
    )
    const blueprint = await createEncounterBlueprint(db, gm.id, {
      gameSystemId: catalogue.game_system_id,
      name: `Phase 8.1 fixture ${runId}`,
      enemies: Array.from({ length: options.creatureCount ?? 1 }, () => ({
        kind: 'CREATURE' as const,
        sourceId: creature.id
      })),
      commandId: randomUUID()
    })
    blueprintIdForCleanup = blueprint.id
    const encounter = await createEncounter(db, gm.id, {
      campaignId: campaign.id,
      sessionId: session.id,
      blueprintId: blueprint.id,
      commandId: randomUUID()
    })
    const creatureActors = encounter.actors.filter(
      (candidate) => candidate.kind === 'CREATURE' && candidate.sourceId === creature.id
    )
    assert.equal(
      creatureActors.length,
      options.creatureCount ?? 1,
      'The fixture Encounter must contain each requested Creature actor.'
    )
    const creatureActor = creatureActors[0]
    assert.ok(creatureActor, 'The fixture Encounter must contain its primary Creature actor.')

    const ids: Phase81CommittedFixtureIds = {
      campaignId: campaign.id,
      creatureActorId: creatureActor.id,
      creatureActorIds: creatureActors.map(({ id }) => id),
      creatureDefinitionId: creature.id,
      encounterBlueprintId: blueprint.id,
      encounterId: encounter.id,
      gameSystemId: catalogue.game_system_id,
      gmUserId: gm.id,
      otherUserId: other.id,
      playerUserId: player.id,
      sessionId: session.id
    }

    const startCharacterEncounter = async (characterActorId: string): Promise<void> => {
      const current = await db
        .selectFrom('encounters')
        .select(['status', 'version', 'current_actor_id'])
        .where('id', '=', ids.encounterId)
        .executeTakeFirstOrThrow()
      if (current.status === 'ACTIVE') {
        assert.equal(current.current_actor_id, characterActorId)
        return
      }
      assert.equal(current.status, 'PREPARED')
      const actorIds = await db
        .selectFrom('encounter_actors')
        .select('id')
        .where('encounter_id', '=', ids.encounterId)
        .orderBy('stable_tie_key', 'asc')
        .execute()
      assert.ok(actorIds.some(({ id }) => id === characterActorId))
      await executeEncounterCommand(db, gm.id, {
        type: 'REORDER',
        encounterId: ids.encounterId,
        commandId: randomUUID(),
        expectedVersion: current.version,
        actorIds: [
          characterActorId,
          ...actorIds.map(({ id }) => id).filter((id) => id !== characterActorId)
        ]
      })
      const reordered = await db
        .selectFrom('encounters')
        .select('version')
        .where('id', '=', ids.encounterId)
        .executeTakeFirstOrThrow()
      await executeEncounterCommand(db, gm.id, {
        type: 'START',
        encounterId: ids.encounterId,
        commandId: randomUUID(),
        expectedVersion: reordered.version,
        systemId: ids.gameSystemId
      })
      const active = await db
        .selectFrom('encounters')
        .select(['status', 'current_actor_id'])
        .where('id', '=', ids.encounterId)
        .executeTakeFirstOrThrow()
      assert.equal(active.status, 'ACTIVE', 'The fixture Encounter must start through production.')
      assert.equal(
        active.current_actor_id,
        characterActorId,
        'The committed Character must own the first production turn.'
      )
    }

    const ensureCharacter = async (): Promise<Phase81CommittedCharacterFixture> => {
      if (character) return character
      const characterId = randomUUID()
      characterIdForCleanup = characterId
      const catalog = await findFixtureCatalog(db)
      const fixture: CharacterLifecycleFixture = {
        ...catalog,
        characterId,
        classes: [{ classId: catalog.fighterId, classLabel: 'Fighter', classLevel: 1 }],
        expectedMaxHitPoints: 12,
        hitpointLevels: [{ level: 1, classId: catalog.fighterId, classLevel: 1, value: 12 }],
        label: `Phase 8.1 Character ${runId}`,
        raceId: catalog.humanId,
        raceLabel: 'Human',
        userId: player.id
      }
      const resolutionTimings: BuilderResolutionTiming[] = []
      const sheetTimings: SheetReadTiming[] = []
      const ruleTimings: CharacterRuleEvaluationTiming[] = []
      const sheet = await db
        .transaction()
        .execute(async (trx) =>
          proveFixtureLifecycle(trx, fixture, resolutionTimings, sheetTimings, ruleTimings)
        )
      let mechanics = await createCharacterMechanicsProjectionRepository(db).requireCurrent({
        characterId,
        expectedStreamVersion: sheet.meta.streamVersion
      })
      const selectedCandidate = mechanics.rulePolicyInput.actionCandidates.find(
        (candidate) => candidate.equipment?.equipmentId === SRD_LIGHT_CROSSBOW_ID
      )
      assert.ok(selectedCandidate, 'The committed Character fixture must own the SRD crossbow.')
      const compiledAction = mechanics.compiledActionEntryPoints.find(
        (entry) =>
          entry.actionId === selectedCandidate.actionId &&
          entry.schemaVersion === 4 &&
          entry.compilation.kind === 'COMPILED'
      )
      assert.ok(
        compiledAction,
        'The committed Character fixture must expose a direct compiled action.'
      )
      const action = sheet.actions.items.find(({ id }) => id === compiledAction.actionId)
      assert.ok(action)
      await assignCampaignCharacter(db, gm.id, campaign.id, characterId)
      await sql`
        insert into public.campaign_session_attendance (session_id, campaign_id, character_id, present)
        values (${session.id}::uuid, ${campaign.id}::uuid, ${characterId}::uuid, true)
        on conflict (session_id, character_id) do update set present = excluded.present
      `.execute(db)
      let refreshed = await db.transaction().execute((trx) =>
        dispatchAndReloadSheetCommand(trx, fixture, sheet, {
          type: 'SET_HIT_POINTS',
          current: 12,
          temp: 0
        })
      )
      mechanics = await createCharacterMechanicsProjectionRepository(db).requireCurrent({
        characterId,
        expectedStreamVersion: refreshed.meta.streamVersion
      })
      let refreshedCandidate = mechanics.rulePolicyInput.actionCandidates.find(
        (candidate) => candidate.actionId === action.id
      )
      assert.ok(refreshedCandidate)
      if (refreshedCandidate.equipment && !refreshedCandidate.equipment.equipped) {
        refreshed = await db.transaction().execute((trx) =>
          dispatchAndReloadSheetCommand(trx, fixture, refreshed, {
            type: 'EQUIP_ITEM',
            itemId: refreshedCandidate!.equipment!.itemInstanceId
          })
        )
        mechanics = await createCharacterMechanicsProjectionRepository(db).requireCurrent({
          characterId,
          expectedStreamVersion: refreshed.meta.streamVersion
        })
        refreshedCandidate = mechanics.rulePolicyInput.actionCandidates.find(
          (candidate) => candidate.actionId === action.id
        )
        assert.ok(refreshedCandidate)
      }
      const refreshedAction = refreshed.actions.items.find(({ id }) => id === action.id)
      assert.ok(refreshedAction?.availability.status === 'AVAILABLE')
      assert.equal(typeof refreshedAction.mechanic?.attackBonus, 'number')
      const actor = await db
        .selectFrom('encounter_actors')
        .select('id')
        .where('encounter_id', '=', encounter.id)
        .where('kind', '=', 'CHARACTER')
        .where('source_id', '=', characterId)
        .executeTakeFirst()
      // The Encounter snapshot predates the Character. Recreate it only when a
      // race needs an actual Character actor, preserving committed visibility.
      if (!actor) {
        await db.deleteFrom('encounters').where('id', '=', encounter.id).executeTakeFirstOrThrow()
        const replacement = await createEncounter(db, gm.id, {
          campaignId: campaign.id,
          sessionId: session.id,
          blueprintId: blueprint.id,
          commandId: randomUUID()
        })
        const characterActor = replacement.actors.find(
          (candidate) => candidate.kind === 'CHARACTER' && candidate.sourceId === characterId
        )
        assert.ok(characterActor, 'Recreated Encounter must contain the fixture Character actor.')
        ids.encounterId = replacement.id
        const replacementCreatureActors = replacement.actors.filter(
          (candidate) => candidate.kind === 'CREATURE' && candidate.sourceId === creature.id
        )
        assert.equal(
          replacementCreatureActors.length,
          options.creatureCount ?? 1,
          'Recreated Encounter must retain each requested Creature actor.'
        )
        ids.creatureActorId = replacementCreatureActors[0]!.id
        ids.creatureActorIds = replacementCreatureActors.map(({ id }) => id)
        character = { actionId: action.id, actorId: characterActor.id, characterId }
      } else {
        character = { actionId: action.id, actorId: actor.id, characterId }
      }
      await startCharacterEncounter(character.actorId)
      return character
    }

    const ensureScene = async (): Promise<Phase81CommittedSceneFixture> => {
      if (scene) return scene
      const currentCharacter = await ensureCharacter()
      const sourceTokenId = randomUUID()
      const creatureTokenId = randomUUID()
      mapAssetId = randomUUID()
      const mapObjectKey = `phase81/${runId}/map.png`
      const media = createMediaRepository(db)
      await media.createPending({
        declaredBytes: 1,
        declaredMimeType: 'image/png',
        id: mapAssetId,
        idempotencyKey: randomUUID(),
        originalFileName: 'phase81-map.png',
        ownerUserId: gm.id,
        profile: 'VTT_MAP',
        rawObjectKey: `phase81/${runId}/map-original.png`,
        storageProvider: 'SUPABASE',
        targetKey: `VTT_MAP:${campaign.id}`
      })
      assert.ok(await media.claimForProcessing(mapAssetId, gm.id))
      assert.equal(
        await media.replaceReady({
          assetId: mapAssetId,
          height: 200,
          ownerUserId: gm.id,
          quotaBytes: 100_000_000,
          reservationBytes: 26_214_400,
          variants: [
            {
              byte_size: 1,
              height: 200,
              id: randomUUID(),
              kind: 'DISPLAY',
              mime_type: 'image/png',
              object_key: mapObjectKey,
              width: 200
            }
          ],
          verifiedBytes: 1,
          verifiedMimeType: 'image/png',
          vttMapTiles: [
            {
              byte_size: 1,
              column_index: 0,
              height: 200,
              object_key: mapObjectKey,
              row_index: 0,
              width: 200
            }
          ],
          width: 200
        }),
        true
      )
      const definition: SceneDefinition = {
        id: randomUUID(),
        version: 1,
        campaignId: campaign.id,
        name: `Phase 8.1 Scene ${runId}`,
        map: { assetId: mapAssetId, tileManifestAssetId: null, width: 200, height: 200 },
        grid: {
          kind: 'SQUARE',
          cellSize: 50,
          diagonalPolicy: 'EQUAL',
          distancePerCell: 5,
          origin: { x: 0, y: 0 },
          unit: 'FEET'
        },
        fogMode: 'SHARED_PARTY',
        visionRevealMode: 'ON_DROP',
        ambientIllumination: 'BRIGHT',
        annotations: [],
        barriers: [],
        darknessZones: [],
        lights: [],
        tokens: [
          {
            id: sourceTokenId,
            assetId: null,
            controlledByUserIds: [player.id],
            height: 50,
            hidden: false,
            label: 'Phase 8.1 source',
            locked: false,
            position: { x: 25, y: 25 },
            rotationDegrees: 0,
            vision: null,
            width: 50
          },
          {
            id: creatureTokenId,
            assetId: null,
            controlledByUserIds: [],
            height: 50,
            hidden: false,
            label: 'Phase 8.1 creature',
            locked: false,
            position: { x: 125, y: 25 },
            rotationDegrees: 0,
            vision: null,
            width: 50
          }
        ]
      }
      const scenes = createVttSceneRepository(db)
      await scenes.createDefinition(definition)
      const sceneId = randomUUID()
      await scenes.createCampaignLiveScene({
        materializationCommandFingerprint: checksumRuleDocument({
          definitionId: definition.id,
          kind: 'PHASE81_COMMITTED_FIXTURE'
        }),
        materializationCommandId: randomUUID(),
        definitionSnapshot: definition,
        projection: compileSceneCurrentProjection(materializeCampaignScene(definition, sceneId))
      })
      const bindingCommandId = randomUUID()
      assert.equal(
        await scenes.bindEncounterToScene({
          campaignId: campaign.id,
          commandFingerprint: checksumRuleDocument({
            bindingCommandId,
            encounterId: ids.encounterId,
            sceneId
          }),
          commandId: bindingCommandId,
          encounterId: ids.encounterId,
          sceneId
        }),
        true
      )
      await scenes.setActorTokenBinding({
        actorId: currentCharacter.actorId,
        encounterId: ids.encounterId,
        sceneId,
        tokenId: sourceTokenId
      })
      await scenes.setActorTokenBinding({
        actorId: ids.creatureActorId,
        encounterId: ids.encounterId,
        sceneId,
        tokenId: creatureTokenId
      })
      scene = { creatureTokenId, sceneId, sceneVersion: 0, sourceTokenId }
      return scene
    }

    const cleanup = async (): Promise<void> => {
      if (cleaned) return
      cleanupErrors.length = 0
      const capture = async (operation: () => Promise<unknown>) => {
        try {
          await operation()
        } catch (error) {
          cleanupErrors.push(error)
        }
      }
      // Children first; Campaign removal is the final aggregate-level fallback.
      await capture(() =>
        sql`
          delete from public.character_active_rule_effects
          where maintained_effect_state_id in (
            select state.id
            from public.encounter_maintained_effect_states state
            join public.encounters encounter on encounter.id = state.encounter_id
            where encounter.campaign_id = ${campaign.id}::uuid
          )
        `.execute(db)
      )
      await capture(() =>
        sql`
          delete from public.encounter_initiative_rounds
          where encounter_id in (
            select id from public.encounters where campaign_id = ${campaign.id}::uuid
          )
        `.execute(db)
      )
      await capture(() =>
        sql`delete from public.encounters where campaign_id = ${campaign.id}::uuid`.execute(db)
      )
      await capture(() =>
        sql`delete from public.encounter_blueprints where id = ${blueprint.id}::uuid`.execute(db)
      )
      if (characterIdForCleanup) {
        await capture(() =>
          sql`delete from public.characters where id = ${characterIdForCleanup!}::uuid`.execute(db)
        )
      }
      await capture(() =>
        sql`delete from public.campaigns where id = ${campaign.id}::uuid`.execute(db)
      )
      await capture(() =>
        sql`delete from public.authored_route_ids where subject_kind = 'CAMPAIGN' and subject_id = ${campaign.id}::uuid`.execute(
          db
        )
      )
      if (mapAssetId) {
        await capture(() =>
          sql`delete from public.media_assets where id = ${mapAssetId!}::uuid`.execute(db)
        )
      }
      for (const user of [...users].reverse()) {
        await capture(() => deleteDisposableUser(admin.auth.admin, user.id))
      }
      await capture(async () => {
        assert.equal(await trackedCount(db, 'public.campaigns', 'id', [campaign.id]), 0)
        assert.equal(await trackedCount(db, 'public.encounters', 'campaign_id', [campaign.id]), 0)
        assert.equal(await trackedCount(db, 'public.encounter_blueprints', 'id', [blueprint.id]), 0)
        if (mapAssetId)
          assert.equal(await trackedCount(db, 'public.media_assets', 'id', [mapAssetId]), 0)
        if (characterIdForCleanup)
          assert.equal(
            await trackedCount(db, 'public.characters', 'id', [characterIdForCleanup]),
            0
          )
        assert.equal(
          await trackedCount(
            db,
            'auth.users',
            'id',
            users.map(({ id }) => id)
          ),
          0
        )
      })
      await capture(() => db.destroy())
      cleaned = true
      if (cleanupErrors.length > 0)
        throw new AggregateError(cleanupErrors, 'Phase 8.1 committed fixture cleanup failed.')
    }

    return {
      adapters: {
        assignCampaignCharacter,
        executeEncounterActorDirectRuleAction,
        executeEncounterCommand,
        executeEncounterSceneCommand,
        resumeEncounterActorDirectRuleAction,
        saveCampaignPlaySettings
      },
      cleanup,
      connectionFactory: () => createDb({ connectionString: environment.connectionString }),
      db,
      ensureCharacter,
      ensureScene,
      ids,
      lease: createLiveSessionCommandLeaseRepository(db),
      repositories: {
        activeEffects: createActiveRuleEffectRepository(db),
        occurrences: createRuleOccurrenceRepository(db),
        scenes: createVttSceneRepository(db)
      }
    }
  } catch (error) {
    const setupCleanupErrors: unknown[] = []
    const capture = async (operation: () => Promise<unknown>) => {
      try {
        await operation()
      } catch (cleanupError) {
        setupCleanupErrors.push(cleanupError)
      }
    }
    if (campaignIdForCleanup) {
      await capture(() =>
        sql`delete from public.encounters where campaign_id = ${campaignIdForCleanup!}::uuid`.execute(
          db
        )
      )
    }
    if (blueprintIdForCleanup) {
      await capture(() =>
        sql`delete from public.encounter_blueprints where id = ${blueprintIdForCleanup!}::uuid`.execute(
          db
        )
      )
    }
    if (characterIdForCleanup) {
      await capture(() =>
        sql`delete from public.characters where id = ${characterIdForCleanup!}::uuid`.execute(db)
      )
    }
    if (campaignIdForCleanup) {
      await capture(() =>
        sql`delete from public.campaigns where id = ${campaignIdForCleanup!}::uuid`.execute(db)
      )
      await capture(() =>
        sql`delete from public.authored_route_ids where subject_kind = 'CAMPAIGN' and subject_id = ${campaignIdForCleanup!}::uuid`.execute(
          db
        )
      )
    }
    if (mapAssetId) {
      await capture(() =>
        sql`delete from public.media_assets where id = ${mapAssetId!}::uuid`.execute(db)
      )
    }
    for (const user of [...users].reverse()) {
      await capture(() => deleteDisposableUser(admin.auth.admin, user.id))
    }
    await capture(() => db.destroy())
    if (setupCleanupErrors.length > 0) {
      throw new AggregateError(
        [error, ...setupCleanupErrors],
        'Phase 8.1 committed fixture setup and cleanup failed.'
      )
    }
    throw error
  }
}
