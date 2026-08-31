import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import {
  createActiveRuleEffectRepository,
  createCampaignRepository,
  createCharacterMechanicsProjectionRepository,
  createDb,
  createEncounterRepository,
  createMediaRepository,
  createRuleOccurrenceRepository,
  createReusableDefinitionRepository,
  createVttSceneRepository,
  srdBaselineContent
} from '@artificer-toolkit/db'
import type {
  ActiveRuleEffectDefinitionDto,
  ActiveRuleEffectLifecycleDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { movementReactionChoiceGroupDtoSchema } from '@artificer-toolkit/schema/shared/reaction'
import {
  assignCampaignCharacter,
  createCampaign,
  createCampaignSession,
  createEncounter,
  createEncounterBlueprint,
  saveCampaignPlaySettings
} from '@artificer-toolkit/functions/services'
import { sql } from 'kysely'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { materializeCampaignScene, type SceneDefinition } from '@artificer-toolkit/shared/vtt'

import { dispatchAndReloadSheetCommand } from '../../../packages/functions/src/scripts/characterLifecycleIntegrationAssertions.js'
import { proveFixtureLifecycle } from '../../../packages/functions/src/scripts/characterLifecycleIntegrationBuilderProof.js'
import {
  findFixtureCatalog,
  type BuilderResolutionTiming,
  type CharacterLifecycleFixture,
  type CharacterRuleEvaluationTiming,
  type SheetReadTiming
} from '../../../packages/functions/src/scripts/characterLifecycleIntegrationFixtures.js'
import { getCharacterSheetForUser } from '../../../packages/functions/src/services/character/characterApplicationService.js'
import {
  executeEncounterActorDirectRuleAction,
  resumeEncounterActorDirectRuleAction
} from '../../../packages/functions/src/services/encounter/encounterActorDirectRuleActionService.js'
import { lockEncounterActionSceneContext } from '../../../packages/functions/src/services/encounter/encounterActionSceneContext.js'
import { compileSceneCurrentProjection } from '../../../packages/functions/src/services/encounter/sceneProjectionReplay.js'
import { startEncounterMovementReactionAtBoundary } from '../../../packages/functions/src/services/encounter/encounterMovementReactionContinuation.js'
import { createMovementReactionChoiceDefinition } from '../../../packages/functions/src/services/rules/movementReactionChoice.js'
import {
  createPlatformRulesRuntime,
  deriveRulesRuntimeContinuationIntegrityKey
} from '../../../packages/functions/src/services/rules/platformRulesRuntime.js'
import { createReusableDefinitionRuntimeSource } from '../../../packages/functions/src/services/rules/reusableDefinitionService.js'

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', 'host.docker.internal'])

interface DisposableUser {
  id: string
}

export interface Gate2EncounterRuleActionPostgresProofOptions {
  connectionString: string
  runId: string
  supabaseSecretKey: string
  supabaseUrl: string
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
    email: `gate2-action-${role}-${runId}@example.test`,
    email_confirm: true,
    password: `Local-${randomUUID()}-Aa1!`,
    user_metadata: {
      username: `gate2${role}${runId.replaceAll('-', '').slice(0, 12)}`
    }
  })
  if (error) throw error
  if (!data.user) throw new Error(`Supabase did not create the ${role} proof user.`)
  return { id: data.user.id }
}

export async function proveGate2EncounterRuleActionPostgresSemantics(
  options: Gate2EncounterRuleActionPostgresProofOptions
): Promise<void> {
  requireLoopback('DATABASE_CONNECTION_STRING', options.connectionString)
  requireLoopback('SUPABASE_URL', options.supabaseUrl)

  const db = createDb({ connectionString: options.connectionString })
  const admin = createClient(options.supabaseUrl, options.supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  })
  const users: DisposableUser[] = []
  const cleanupErrors: unknown[] = []
  let runError: unknown

  try {
    const gm = await createDisposableUser(admin.auth.admin, options.runId, 'gm')
    const player = await createDisposableUser(admin.auth.admin, options.runId, 'player')
    const outsider = await createDisposableUser(admin.auth.admin, options.runId, 'outsider')
    users.push(gm, player, outsider)
    const characterId = randomUUID()
    const rollback = new Error(`ROLLBACK_GATE2_ACTION_${options.runId}`)

    try {
      await db.transaction().execute(async (trx) => {
        const catalog = await findFixtureCatalog(trx)
        const fixture: CharacterLifecycleFixture = {
          ...catalog,
          characterId,
          classes: [{ classId: catalog.fighterId, classLabel: 'Fighter', classLevel: 1 }],
          expectedMaxHitPoints: 12,
          hitpointLevels: [{ level: 1, classId: catalog.fighterId, classLevel: 1, value: 12 }],
          label: `Gate 2 Action ${options.runId}`,
          raceId: catalog.humanId,
          raceLabel: 'Human',
          userId: player.id
        }
        const resolutionTimings: BuilderResolutionTiming[] = []
        const sheetReadTimings: SheetReadTiming[] = []
        const ruleEvaluationTimings: CharacterRuleEvaluationTiming[] = []
        let sheet = await proveFixtureLifecycle(
          trx,
          fixture,
          resolutionTimings,
          sheetReadTimings,
          ruleEvaluationTimings
        )
        sheet = await dispatchAndReloadSheetCommand(trx, fixture, sheet, {
          type: 'SET_HIT_POINTS',
          current: 5,
          temp: 0
        })
        let mechanics = await createCharacterMechanicsProjectionRepository(trx).requireCurrent({
          characterId: fixture.characterId,
          expectedStreamVersion: sheet.meta.streamVersion
        })
        const compiledAction = mechanics.compiledActionEntryPoints.find(
          (entry) =>
            entry.schemaVersion === 4 &&
            entry.compilation.kind === 'COMPILED' &&
            entry.compilation.executionPlan.kind === 'TEST_OUTCOME' &&
            sheet.actions.items.some(
              (action) => action.id === entry.actionId && action.availability.status === 'AVAILABLE'
            )
        )
        assert.ok(
          compiledAction,
          'The finalized Fighter must expose a committed two-phase weapon action.'
        )
        const actionId = compiledAction.actionId
        let selectedCandidate = mechanics.rulePolicyInput.actionCandidates.find(
          (candidate) => candidate.actionId === actionId
        )
        assert.ok(selectedCandidate)
        if (selectedCandidate.equipment && !selectedCandidate.equipment.equipped) {
          sheet = await dispatchAndReloadSheetCommand(trx, fixture, sheet, {
            type: 'EQUIP_ITEM',
            itemId: selectedCandidate.equipment.itemInstanceId
          })
          mechanics = await createCharacterMechanicsProjectionRepository(trx).requireCurrent({
            characterId: fixture.characterId,
            expectedStreamVersion: sheet.meta.streamVersion
          })
          selectedCandidate = mechanics.rulePolicyInput.actionCandidates.find(
            (candidate) => candidate.actionId === actionId
          )
          assert.ok(selectedCandidate)
        }
        const action = sheet.actions.items.find(({ id }) => id === actionId)
        assert.ok(action)
        const selectedDecision = mechanics.rulePolicyOutput.actionDecisions.find(
          (decision) => decision.actionId === action.id
        )
        assert.equal(
          typeof action.mechanic?.attackBonus,
          'number',
          `The finalized Fighter weapon action must retain its attack modifier: ${JSON.stringify({
            candidate: selectedCandidate,
            decision: selectedDecision,
            modifierGroups: mechanics.rulePolicyOutput.modifierGroups.filter((group) =>
              group.contributions.some(
                (contribution) => contribution.sourceId === selectedCandidate?.sourceId
              )
            ),
            proficiencies: mechanics.rulePolicyOutput.proficiencies
          })}`
        )

        const catalogue = await trx
          .selectFrom('rules_catalogues')
          .select('id')
          .where('game_system_id', '=', fixture.systemId)
          .orderBy('id', 'asc')
          .executeTakeFirstOrThrow()
        const campaign = await createCampaign(trx, gm.id, {
          name: `Gate 2 action ${options.runId}`,
          format: 'ONE_SHOT',
          toneTags: ['HEROIC'],
          contentMaturity: 'STANDARD',
          gameSystemId: fixture.systemId,
          primaryRulesCatalogueId: catalogue.id
        })
        await createCampaignRepository(trx).activatePlayerMembership(
          campaign.id,
          player.id,
          new Date().toISOString()
        )
        await assignCampaignCharacter(trx, gm.id, campaign.id, fixture.characterId)
        const session = await createCampaignSession(
          trx,
          { campaignId: campaign.id, title: 'Gate 2 action proof' },
          gm.id
        )
        const targetCreature = srdBaselineContent.subjects.creatures.find(
          (creature) => creature.label === 'Goblin' && creature.systemId === fixture.systemId
        )
        assert.ok(targetCreature, 'The seeded SRD must retain the Goblin target fixture.')
        const blueprint = await createEncounterBlueprint(trx, gm.id, {
          gameSystemId: fixture.systemId,
          name: `Gate 2 action encounter ${options.runId}`,
          enemies: [{ kind: 'CREATURE', sourceId: targetCreature.id }],
          commandId: randomUUID()
        })
        const mapAssetId = randomUUID()
        const mapObjectKey = `gate2-action/${options.runId}/map.png`
        const media = createMediaRepository(trx)
        await media.createPending({
          declaredBytes: 1,
          declaredMimeType: 'image/png',
          id: mapAssetId,
          idempotencyKey: randomUUID(),
          originalFileName: 'gate2-action-map.png',
          ownerUserId: gm.id,
          profile: 'VTT_MAP',
          rawObjectKey: `gate2-action/${options.runId}/map-original.png`,
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
        let playSettingsVersion = 0
        let activeEncounterId: string | null = null
        const createActionEncounter = async (
          automationMode: 'AUTOMATIC' | 'ASSISTED' | 'MANUAL',
          manualReminderMode: 'OFF' | 'SUBTLE' = 'OFF'
        ) => {
          if (activeEncounterId) {
            await trx
              .updateTable('encounters')
              .set((eb) => ({
                status: 'COMPLETED',
                current_actor_id: null,
                version: eb('version', '+', 1),
                updated_at: new Date().toISOString()
              }))
              .where('id', '=', activeEncounterId)
              .executeTakeFirstOrThrow()
            activeEncounterId = null
          }
          const settings = await saveCampaignPlaySettings(trx, gm.id, {
            campaignId: campaign.id,
            normalCadenceDays: null,
            expectedDurationMinutes: null,
            quorum: null,
            absentCharacterPolicy: null,
            contentGuidance: null,
            allowedContentRules: null,
            tableConduct: null,
            contentBoundaries: null,
            safetyPractices: [],
            liveSafetyMethod: null,
            automationMode,
            manualReminderMode,
            initiativePolicyDefinitionId: null,
            initiativeTieDefinitionId: null,
            optionalCombatRuleDefinitionIds: [],
            expectedVersion: playSettingsVersion
          })
          playSettingsVersion = settings.version
          const encounter = await createEncounter(trx, gm.id, {
            campaignId: campaign.id,
            sessionId: session.id,
            blueprintId: blueprint.id,
            commandId: randomUUID()
          })
          assert.equal(encounter.automationMode, automationMode)
          assert.equal(encounter.manualReminderMode, manualReminderMode)
          const characterActor = encounter.actors.find(
            (candidate) =>
              candidate.kind === 'CHARACTER' && candidate.sourceId === fixture.characterId
          )
          assert.ok(
            characterActor,
            'The attending Character must be snapshotted into the Encounter.'
          )
          assert.equal(characterActor.currentHitPoints, 5)
          const targetActor = encounter.actors.find(
            (candidate) => candidate.kind === 'CREATURE' && candidate.sourceId === targetCreature.id
          )
          assert.ok(targetActor, 'The Creature target must be snapshotted into the Encounter.')
          assert.equal(targetActor.currentHitPoints, targetCreature.hitPoints)
          const sourceTokenId = randomUUID()
          const targetTokenId = randomUUID()
          const sceneDefinition: SceneDefinition = {
            id: randomUUID(),
            version: 1,
            campaignId: campaign.id,
            name: `Gate 2 ${automationMode.toLowerCase()} action scene ${options.runId}`,
            map: {
              assetId: mapAssetId,
              tileManifestAssetId: null,
              width: 200,
              height: 200
            },
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
                label: 'Source',
                locked: false,
                position: { x: 25, y: 25 },
                rotationDegrees: 0,
                vision: null,
                width: 50
              },
              {
                id: targetTokenId,
                assetId: null,
                controlledByUserIds: [],
                height: 50,
                hidden: false,
                label: 'Target',
                locked: false,
                position: { x: 75, y: 25 },
                rotationDegrees: 0,
                vision: null,
                width: 50
              }
            ]
          }
          const scenes = createVttSceneRepository(trx)
          await scenes.createDefinition(sceneDefinition)
          const sceneId = randomUUID()
          const sceneState = materializeCampaignScene(sceneDefinition, sceneId)
          await scenes.createCampaignLiveScene({
            materializationCommandFingerprint: checksumRuleDocument({
              kind: 'GATE_2_ACTION_PROOF',
              automationMode,
              sceneDefinitionId: sceneDefinition.id
            }),
            materializationCommandId: randomUUID(),
            definitionSnapshot: sceneDefinition,
            projection: compileSceneCurrentProjection(sceneState)
          })
          const bindingCommandId = randomUUID()
          assert.equal(
            await scenes.bindEncounterToScene({
              campaignId: campaign.id,
              commandFingerprint: checksumRuleDocument({
                commandId: bindingCommandId,
                encounterId: encounter.id,
                kind: 'GATE_2_ACTION_SCENE_BINDING',
                sceneId
              }),
              commandId: bindingCommandId,
              encounterId: encounter.id,
              sceneId
            }),
            true
          )
          await scenes.setActorTokenBinding({
            actorId: characterActor.id,
            encounterId: encounter.id,
            sceneId,
            tokenId: sourceTokenId
          })
          await scenes.setActorTokenBinding({
            actorId: targetActor.id,
            encounterId: encounter.id,
            sceneId,
            tokenId: targetTokenId
          })
          const sceneContext = await lockEncounterActionSceneContext({
            db: trx,
            encounterId: encounter.id,
            actorId: characterActor.id,
            targetActorId: targetActor.id,
            request: {
              sceneId,
              expectedSceneVersion: 0,
              sourceTokenId,
              targetTokenId
            }
          })
          assert.ok(sceneContext)
          await trx
            .updateTable('encounters')
            .set({ status: 'ACTIVE', current_actor_id: characterActor.id })
            .where('id', '=', encounter.id)
            .executeTakeFirstOrThrow()
          activeEncounterId = encounter.id
          return { characterActor, encounter, sceneContext, targetActor }
        }

        const { characterActor, encounter, sceneContext, targetActor } =
          await createActionEncounter('ASSISTED')

        const runtime = createPlatformRulesRuntime({
          continuationIntegrityKey: deriveRulesRuntimeContinuationIntegrityKey(
            `gate2-action-${options.runId}`
          ),
          definitions: createReusableDefinitionRuntimeSource(
            createReusableDefinitionRepository(trx)
          )
        })
        const initialCommandId = randomUUID()
        const initialCorrelationId = randomUUID()
        const initial = await executeEncounterActorDirectRuleAction({
          db: trx,
          runtime,
          command: {
            actionId: action.id,
            actorId: characterActor.id,
            actorUserId: player.id,
            commandId: initialCommandId,
            correlationId: initialCorrelationId,
            encounterId: encounter.id,
            expectedEncounterVersion: 0,
            sceneContext,
            targetActorId: targetActor.id
          }
        })
        assert.equal(initial.status, 'PENDING')
        assert.ok('request' in initial, 'The weapon action must pause for its attack roll.')
        const afterTestPause = await trx
          .selectFrom('encounters')
          .select('version')
          .where('id', '=', encounter.id)
          .executeTakeFirstOrThrow()
        assert.equal(afterTestPause.version, 0)

        const testResult = await resumeEncounterActorDirectRuleAction({
          db: trx,
          runtime,
          rollD20: () => 20,
          command: {
            actorUserId: player.id,
            commandId: randomUUID(),
            correlationId: randomUUID(),
            encounterId: encounter.id,
            expectedEncounterVersion: afterTestPause.version,
            expectedOccurrenceVersion: initial.occurrenceVersion,
            occurrenceId: initial.occurrenceId,
            resolution: {
              kind: 'SYSTEM' as const,
              requestId: initial.request.requestId
            }
          }
        })
        assert.equal(testResult.status, 'PENDING')
        assert.ok(
          'phase' in testResult && testResult.phase === 'OUTCOME',
          'A successful attack must pause for its damage evidence.'
        )
        const afterOutcomePause = await trx
          .selectFrom('encounters')
          .select('version')
          .where('id', '=', encounter.id)
          .executeTakeFirstOrThrow()
        assert.equal(afterOutcomePause.version, 0)

        const outcomeCommand = {
          actorUserId: player.id,
          commandId: randomUUID(),
          correlationId: randomUUID(),
          encounterId: encounter.id,
          expectedEncounterVersion: afterOutcomePause.version,
          expectedOccurrenceVersion: testResult.occurrenceVersion,
          occurrenceId: initial.occurrenceId,
          resolution: {
            kind: 'SYSTEM_OUTCOME' as const,
            requestIds: testResult.requests.map(({ requestId }) => requestId)
          }
        }
        const completed = await resumeEncounterActorDirectRuleAction({
          db: trx,
          runtime,
          rollInteger: () => 3,
          command: outcomeCommand
        })
        assert.equal(completed.status, 'COMPLETE')
        assert.equal(completed.application.targetActorId, targetActor.id)
        assert.ok(completed.application.applications.length > 0)
        assert.ok(completed.application.applications.every(({ kind }) => kind === 'DAMAGE'))
        const targetAfter = completed.application.targetTransition.after.currentHitPoints
        assert.ok(targetAfter < targetCreature.hitPoints)

        const persistedSheet = await getCharacterSheetForUser(trx, fixture.characterId, player.id)
        assert.ok(persistedSheet)
        assert.equal(persistedSheet.overview.currentHitPoints, 5)
        const persistedTarget = await trx
          .selectFrom('encounter_actors')
          .select('current_hit_points')
          .where('id', '=', targetActor.id)
          .executeTakeFirstOrThrow()
        assert.equal(persistedTarget.current_hit_points, targetAfter)
        const afterComplete = await trx
          .selectFrom('encounters')
          .select('version')
          .where('id', '=', encounter.id)
          .executeTakeFirstOrThrow()
        assert.equal(afterComplete.version, 1)

        const beforeReplay = await sql<{
          events: string
          occurrences: string
          receipts: string
        }>`
          select
            (select count(*)::text from public.encounter_events
              where encounter_id = ${encounter.id}::uuid and command_type = 'RESOLVE_RULE_ACTION') as events,
            (select count(*)::text from public.encounter_rule_occurrences
              where encounter_id = ${encounter.id}::uuid) as occurrences,
            (select count(*)::text from public.encounter_rule_receipts
              where encounter_id = ${encounter.id}::uuid) as receipts
        `.execute(trx)
        assert.deepEqual(beforeReplay.rows[0], {
          events: '1',
          occurrences: '1',
          receipts: '3'
        })

        const replay = await resumeEncounterActorDirectRuleAction({
          db: trx,
          runtime,
          rollInteger: () => {
            throw new Error('Replay must not roll again.')
          },
          command: outcomeCommand
        })
        assert.deepEqual(replay, completed)
        const replaySheet = await getCharacterSheetForUser(trx, fixture.characterId, player.id)
        assert.ok(replaySheet)
        assert.equal(replaySheet.meta.streamVersion, persistedSheet.meta.streamVersion)
        assert.equal(replaySheet.overview.currentHitPoints, 5)
        const replayTarget = await trx
          .selectFrom('encounter_actors')
          .select('current_hit_points')
          .where('id', '=', targetActor.id)
          .executeTakeFirstOrThrow()
        assert.equal(replayTarget.current_hit_points, targetAfter)
        const afterReplay = await sql<{
          encounter_version: number
          events: string
          occurrences: string
          receipts: string
        }>`
          select
            (select version from public.encounters where id = ${encounter.id}::uuid) as encounter_version,
            (select count(*)::text from public.encounter_events
              where encounter_id = ${encounter.id}::uuid and command_type = 'RESOLVE_RULE_ACTION') as events,
            (select count(*)::text from public.encounter_rule_occurrences
              where encounter_id = ${encounter.id}::uuid) as occurrences,
            (select count(*)::text from public.encounter_rule_receipts
              where encounter_id = ${encounter.id}::uuid) as receipts
        `.execute(trx)
        assert.deepEqual(afterReplay.rows[0], {
          encounter_version: 1,
          events: '1',
          occurrences: '1',
          receipts: '3'
        })

        const physicalContext = await createActionEncounter('ASSISTED')
        const physicalInitial = await executeEncounterActorDirectRuleAction({
          db: trx,
          runtime,
          command: {
            actionId: action.id,
            actorId: physicalContext.characterActor.id,
            actorUserId: player.id,
            commandId: randomUUID(),
            correlationId: randomUUID(),
            encounterId: physicalContext.encounter.id,
            expectedEncounterVersion: 0,
            sceneContext: physicalContext.sceneContext,
            targetActorId: physicalContext.targetActor.id
          }
        })
        assert.equal(physicalInitial.status, 'PENDING')
        assert.ok('request' in physicalInitial)
        const physicalTest = await resumeEncounterActorDirectRuleAction({
          db: trx,
          runtime,
          command: {
            actorUserId: player.id,
            commandId: randomUUID(),
            correlationId: randomUUID(),
            encounterId: physicalContext.encounter.id,
            expectedEncounterVersion: 0,
            expectedOccurrenceVersion: physicalInitial.occurrenceVersion,
            occurrenceId: physicalInitial.occurrenceId,
            resolution: {
              kind: 'PHYSICAL',
              requestId: physicalInitial.request.requestId,
              rawFaces: [20]
            }
          }
        })
        assert.equal(physicalTest.status, 'PENDING')
        assert.ok('phase' in physicalTest && physicalTest.phase === 'OUTCOME')
        const physicalComplete = await resumeEncounterActorDirectRuleAction({
          db: trx,
          runtime,
          command: {
            actorUserId: player.id,
            commandId: randomUUID(),
            correlationId: randomUUID(),
            encounterId: physicalContext.encounter.id,
            expectedEncounterVersion: 0,
            expectedOccurrenceVersion: physicalTest.occurrenceVersion,
            occurrenceId: physicalTest.occurrenceId,
            resolution: {
              kind: 'PHYSICAL_OUTCOME',
              values: physicalTest.requests.map(({ requestId, min }) => ({ requestId, value: min }))
            }
          }
        })
        assert.equal(physicalComplete.status, 'COMPLETE')
        assert.ok(
          physicalComplete.application.targetTransition.after.currentHitPoints <
            targetCreature.hitPoints
        )

        const automaticContext = await createActionEncounter('AUTOMATIC')
        let automaticD20Rolls = 0
        let automaticOutcomeRolls = 0
        const automaticCommand = {
          actionId: action.id,
          actorId: automaticContext.characterActor.id,
          actorUserId: player.id,
          commandId: randomUUID(),
          correlationId: randomUUID(),
          encounterId: automaticContext.encounter.id,
          expectedEncounterVersion: 0,
          sceneContext: automaticContext.sceneContext,
          targetActorId: automaticContext.targetActor.id
        }
        const automaticComplete = await executeEncounterActorDirectRuleAction({
          db: trx,
          runtime,
          rollD20: () => {
            automaticD20Rolls += 1
            return 20
          },
          rollInteger: (min) => {
            automaticOutcomeRolls += 1
            return min
          },
          command: automaticCommand
        })
        assert.equal(automaticComplete.status, 'COMPLETE')
        assert.equal(automaticD20Rolls, 1)
        assert.ok(automaticOutcomeRolls > 0)
        assert.ok(
          automaticComplete.application.targetTransition.after.currentHitPoints <
            targetCreature.hitPoints
        )
        const automaticReplay = await executeEncounterActorDirectRuleAction({
          db: trx,
          runtime,
          rollD20: () => {
            throw new Error('Automatic replay must not roll a d20 again.')
          },
          rollInteger: () => {
            throw new Error('Automatic replay must not roll an outcome again.')
          },
          command: automaticCommand
        })
        assert.deepEqual(automaticReplay, automaticComplete)
        await assert.rejects(
          executeEncounterActorDirectRuleAction({
            db: trx,
            runtime,
            rollD20: () => {
              throw new Error('Mismatched replay must reject before rolling a d20.')
            },
            rollInteger: () => {
              throw new Error('Mismatched replay must reject before rolling an outcome.')
            },
            command: { ...automaticCommand, correlationId: randomUUID() }
          })
        )

        const missContext = await createActionEncounter('AUTOMATIC')
        const miss = await executeEncounterActorDirectRuleAction({
          db: trx,
          runtime,
          rollD20: () => 1,
          rollInteger: () => {
            throw new Error('A missed attack must not roll an outcome.')
          },
          command: {
            actionId: action.id,
            actorId: missContext.characterActor.id,
            actorUserId: player.id,
            commandId: randomUUID(),
            correlationId: randomUUID(),
            encounterId: missContext.encounter.id,
            expectedEncounterVersion: 0,
            sceneContext: missContext.sceneContext,
            targetActorId: missContext.targetActor.id
          }
        })
        assert.equal(miss.status, 'COMPLETE')
        const missedTarget = await trx
          .selectFrom('encounter_actors')
          .select('current_hit_points')
          .where('id', '=', missContext.targetActor.id)
          .executeTakeFirstOrThrow()
        assert.equal(missedTarget.current_hit_points, targetCreature.hitPoints)

        const denialContext = await createActionEncounter('ASSISTED')
        await assert.rejects(
          executeEncounterActorDirectRuleAction({
            db: trx,
            runtime,
            command: {
              actionId: action.id,
              actorId: denialContext.characterActor.id,
              actorUserId: outsider.id,
              commandId: randomUUID(),
              correlationId: randomUUID(),
              encounterId: denialContext.encounter.id,
              expectedEncounterVersion: 0,
              sceneContext: denialContext.sceneContext,
              targetActorId: denialContext.targetActor.id
            }
          })
        )
        const deniedOccurrences = await trx
          .selectFrom('encounter_rule_occurrences')
          .select(({ fn }) => fn.countAll<string>().as('count'))
          .where('encounter_id', '=', denialContext.encounter.id)
          .executeTakeFirstOrThrow()
        assert.equal(deniedOccurrences.count, '0')

        const manualContext = await createActionEncounter('MANUAL', 'SUBTLE')
        const manualCommand = {
          actionId: action.id,
          actorId: manualContext.characterActor.id,
          actorUserId: player.id,
          commandId: randomUUID(),
          correlationId: randomUUID(),
          encounterId: manualContext.encounter.id,
          expectedEncounterVersion: 0,
          sceneContext: manualContext.sceneContext,
          targetActorId: manualContext.targetActor.id
        }
        const manual = await executeEncounterActorDirectRuleAction({
          db: trx,
          runtime,
          rollD20: () => {
            throw new Error('Manual mode must not roll a d20.')
          },
          rollInteger: () => {
            throw new Error('Manual mode must not roll an outcome.')
          },
          command: manualCommand
        })
        assert.equal(manual.status, 'MANUAL')
        const manualTarget = await trx
          .selectFrom('encounter_actors')
          .select('current_hit_points')
          .where('id', '=', manualContext.targetActor.id)
          .executeTakeFirstOrThrow()
        assert.equal(manualTarget.current_hit_points, targetCreature.hitPoints)
        const manualReplay = await executeEncounterActorDirectRuleAction({
          db: trx,
          runtime,
          rollD20: () => {
            throw new Error('Manual replay must not roll a d20.')
          },
          rollInteger: () => {
            throw new Error('Manual replay must not roll an outcome.')
          },
          command: manualCommand
        })
        assert.deepEqual(manualReplay, manual)

        const manualOffContext = await createActionEncounter('MANUAL', 'OFF')
        const manualOff = await executeEncounterActorDirectRuleAction({
          db: trx,
          runtime,
          rollD20: () => {
            throw new Error('Manual OFF must not roll a d20.')
          },
          rollInteger: () => {
            throw new Error('Manual OFF must not roll an outcome.')
          },
          command: {
            actionId: action.id,
            actorId: manualOffContext.characterActor.id,
            actorUserId: player.id,
            commandId: randomUUID(),
            correlationId: randomUUID(),
            encounterId: manualOffContext.encounter.id,
            expectedEncounterVersion: 0,
            sceneContext: manualOffContext.sceneContext,
            targetActorId: manualOffContext.targetActor.id
          }
        })
        assert.equal(manualOff.status, 'MANUAL')

        const encounterRepository = createEncounterRepository(trx)
        assert.ok(await encounterRepository.lock(manualOffContext.encounter.id))
        const initiativeRound = await encounterRepository.createInitiativeRound({
          encounterId: manualOffContext.encounter.id,
          round: 1,
          procedure: 'MANUAL',
          cadence: 'ENCOUNTER_START',
          policySnapshotChecksum: null
        })
        assert.equal(initiativeRound.status, 'PREPARING')
        const initiativeState = await encounterRepository.lockInitiativeRound({
          encounterId: manualOffContext.encounter.id,
          round: 1
        })
        assert.ok(initiativeState)
        assert.equal(initiativeState.participants.length, manualOffContext.encounter.actors.length)
        assert.equal(initiativeState.sides.length, 0)
        const updatedInitiativeRound = await encounterRepository.updateInitiativeRound({
          encounterId: manualOffContext.encounter.id,
          round: 1,
          expectedVersion: initiativeRound.version,
          status: 'PREPARING',
          nextTurnOrderOrdinal: 0
        })
        assert.equal(updatedInitiativeRound.version, initiativeRound.version + 1)
        await assert.rejects(
          encounterRepository.updateInitiativeRound({
            encounterId: manualOffContext.encounter.id,
            round: 1,
            expectedVersion: initiativeRound.version,
            status: 'PREPARING',
            nextTurnOrderOrdinal: 0
          })
        )

        const persistedEncounter = await encounterRepository.find(manualOffContext.encounter.id)
        assert.ok(persistedEncounter)
        assert.equal(
          persistedEncounter.optionalCombatSnapshot === null,
          persistedEncounter.optionalCombatSnapshotChecksum === null
        )
        if (persistedEncounter.optionalCombatSnapshot !== null)
          assert.equal(
            checksumRuleDocument(persistedEncounter.optionalCombatSnapshot),
            persistedEncounter.optionalCombatSnapshotChecksum
          )

        const reactionChoiceDefinitionId = randomUUID()
        const reactionContactSourceId = 'b'.repeat(64)
        const reactionOptionId = 'c'.repeat(64)
        const reactionPath = [
          { ...manualOffContext.sceneContext.targetToken.position },
          {
            x: manualOffContext.sceneContext.targetToken.position.x + 10,
            y: manualOffContext.sceneContext.targetToken.position.y
          }
        ]
        const reactionChoice = movementReactionChoiceGroupDtoSchema.parse({
          pathDistance: 0,
          reactorActorId: manualOffContext.characterActor.id,
          reactorTokenId: manualOffContext.sceneContext.sourceToken.tokenId,
          options: [
            {
              optionId: reactionOptionId,
              contactSourceId: reactionContactSourceId,
              actionId: action.id,
              actionSourceKind: 'CHARACTER_ACTION',
              actionSourceCurrentnessChecksum: 'd'.repeat(64),
              candidate: {
                contact: reactionPath[0],
                movingActorId: manualOffContext.targetActor.id,
                pathDistance: 0,
                reactorActorId: manualOffContext.characterActor.id,
                reactorTokenId: manualOffContext.sceneContext.sourceToken.tokenId,
                sourceId: reactionContactSourceId,
                stage: 'BEFORE_LEAVE_REACH'
              },
              binding: {
                kind: 'MOVEMENT',
                stage: 'BEFORE_LEAVE_REACH',
                perceptionRequirement: 'SEE',
                eligibilityDefinitionId: randomUUID(),
                movementInterruption: null
              },
              policy: {
                eligible: true,
                allowanceDefinitionId: randomUUID(),
                allowanceMaximum: 1,
                allowanceRefreshBoundary: 'START_OF_TURN',
                selectionPolicy: 'CHOICE',
                choiceDefinitionId: reactionChoiceDefinitionId,
                targetPolicy: 'MOVER'
              },
              eligibilityEvidenceChecksum: 'e'.repeat(64),
              authority: {
                kind: 'CHARACTER_CONTROLLER',
                characterId: fixture.characterId
              },
              visibility: 'CONTROLLER'
            }
          ]
        })
        const reactionRootCommandId = randomUUID()
        const reactionOccurrenceId = randomUUID()
        const reactionPendingSnapshot = await startEncounterMovementReactionAtBoundary({
          runtime,
          occurrenceId: reactionOccurrenceId,
          gameSystemId: fixture.systemId,
          publishedChoice: createMovementReactionChoiceDefinition({
            definitionId: reactionChoiceDefinitionId,
            gameSystemId: fixture.systemId
          }),
          root: {
            commandId: reactionRootCommandId,
            commandFingerprint: checksumRuleDocument({
              kind: 'GATE_2_REACTION_PERSISTENCE',
              encounterId: manualOffContext.encounter.id,
              tokenId: manualOffContext.sceneContext.targetToken.tokenId
            }),
            initiatorUserId: player.id,
            correlationId: null,
            encounterId: manualOffContext.encounter.id,
            sceneId: manualOffContext.sceneContext.sceneId,
            tokenId: manualOffContext.sceneContext.targetToken.tokenId,
            expectedEncounterVersion: persistedEncounter.version,
            expectedSceneVersion: manualOffContext.sceneContext.sceneVersion,
            movementKind: 'VOLUNTARY',
            originalPath: reactionPath
          },
          currentSceneVersion: manualOffContext.sceneContext.sceneVersion,
          boundary: {
            kind: 'REACTION_BOUNDARY',
            boundaryDistance: 0,
            boundaryPosition: reactionPath[0],
            movementIntent: {
              tokenId: manualOffContext.sceneContext.targetToken.tokenId,
              position: reactionPath[0]
            },
            completedExecutions: [],
            appliedPrefix: null,
            completedReactionExecutions: [],
            remainingCandidates: [],
            resolutionCommands: [],
            selectionChecksum: 'f'.repeat(64),
            currentnessChecksum: 'a'.repeat(64)
          },
          reactionTimeline: [{ kind: 'CONTROLLER_CHOICE', group: reactionChoice }]
        })
        const occurrences = createRuleOccurrenceRepository(trx)
        const reactionOccurrence = await occurrences.createPending({
          aggregateKind: 'ENCOUNTER',
          aggregateId: manualOffContext.encounter.id,
          campaignId: campaign.id,
          occurrenceId: reactionOccurrenceId,
          rootCommandId: reactionRootCommandId,
          expectedAggregateVersion: persistedEncounter.version,
          pendingSnapshot: reactionPendingSnapshot
        })
        assert.equal(reactionOccurrence.state, 'PENDING')
        assert.equal(
          (
            await occurrences.lockOccurrence(
              'ENCOUNTER',
              manualOffContext.encounter.id,
              reactionOccurrenceId
            )
          )?.pendingSnapshot?.applicationContext.kind,
          'ENCOUNTER_MOVEMENT_REACTION'
        )
        assert.equal(
          await occurrences.lockOccurrence(
            'ENCOUNTER',
            denialContext.encounter.id,
            reactionOccurrenceId
          ),
          null
        )
        const advancedReactionOccurrence = await occurrences.advancePending({
          aggregateKind: 'ENCOUNTER',
          aggregateId: manualOffContext.encounter.id,
          occurrenceId: reactionOccurrenceId,
          expectedOccurrenceVersion: reactionOccurrence.version,
          expectedAggregateVersion: persistedEncounter.version,
          nextAggregateVersion: persistedEncounter.version,
          pendingSnapshot: reactionPendingSnapshot
        })
        await assert.rejects(
          occurrences.advancePending({
            aggregateKind: 'ENCOUNTER',
            aggregateId: manualOffContext.encounter.id,
            occurrenceId: reactionOccurrenceId,
            expectedOccurrenceVersion: reactionOccurrence.version,
            expectedAggregateVersion: persistedEncounter.version,
            nextAggregateVersion: persistedEncounter.version,
            pendingSnapshot: reactionPendingSnapshot
          })
        )
        const completedReactionOccurrence = await occurrences.complete({
          aggregateKind: 'ENCOUNTER',
          aggregateId: manualOffContext.encounter.id,
          occurrenceId: reactionOccurrenceId,
          expectedOccurrenceVersion: advancedReactionOccurrence.version,
          expectedAggregateVersion: persistedEncounter.version,
          nextAggregateVersion: persistedEncounter.version
        })
        assert.equal(completedReactionOccurrence.state, 'COMPLETED')
        assert.equal(completedReactionOccurrence.pendingSnapshot, null)

        const effectDefinitionId = randomUUID()
        const effectEntryId = randomUUID()
        const activeEffectDefinition: ActiveRuleEffectDefinitionDto = {
          schemaVersion: 1,
          origin: {
            kind: 'ENCOUNTER',
            sourceAggregateId: manualOffContext.encounter.id,
            sourceOccurrenceId: randomUUID(),
            rootCommandId: randomUUID(),
            sourceActorId: manualOffContext.characterActor.id
          },
          authoredEffectId: effectDefinitionId,
          compiledEntryId: effectEntryId,
          frozenGraphNodeId: 'entry',
          frozenGraph: {
            schemaVersion: 1,
            source: {
              definitionId: effectDefinitionId,
              gameSystemId: fixture.systemId,
              definitionFamilyKey: 'effect',
              checksum: 'a'.repeat(64)
            },
            capabilityContractVersion: 1,
            factContracts: [],
            nodes: [
              {
                id: 'entry',
                operation: { key: 'comparison', contractVersion: 1 },
                inputs: {}
              }
            ],
            sourceEntryBindings: [{ sourceEntryId: effectEntryId, nodeId: 'entry' }],
            outputs: { result: { kind: 'LITERAL', value: true } }
          },
          adapterFacts: {},
          perceptionContributions: [],
          recurrence: {
            recurrenceStage: 'NONE',
            consumeOnFirstEvent: null,
            endOnEvents: [],
            lifetimeScope: 'ENCOUNTER',
            expiration: {
              kind: 'TICKS',
              initialRemaining: 3,
              decrementStage: 'END_OF_TURN'
            }
          }
        }
        const initialEffectLifecycle: ActiveRuleEffectLifecycleDto = {
          schemaVersion: 1,
          remainingTicks: 3
        }
        const activeEffects = createActiveRuleEffectRepository(trx)
        const activeEffect = await activeEffects.create({
          id: randomUUID(),
          owner: {
            kind: 'ENCOUNTER_ACTOR',
            encounterId: manualOffContext.encounter.id,
            targetActorId: manualOffContext.targetActor.id
          },
          definition: activeEffectDefinition,
          lifecycle: initialEffectLifecycle
        })
        const updatedActiveEffect = await activeEffects.updateLifecycleCas({
          id: activeEffect.id,
          owner: activeEffect.owner,
          expectedVersion: activeEffect.version,
          lifecycle: { schemaVersion: 1, remainingTicks: 2 }
        })
        assert.equal(updatedActiveEffect.version, activeEffect.version + 1)
        await assert.rejects(
          activeEffects.updateLifecycleCas({
            id: activeEffect.id,
            owner: activeEffect.owner,
            expectedVersion: activeEffect.version,
            lifecycle: { schemaVersion: 1, remainingTicks: 1 }
          })
        )
        await activeEffects.deleteCas({
          id: updatedActiveEffect.id,
          owner: updatedActiveEffect.owner,
          expectedVersion: updatedActiveEffect.version
        })

        console.log(
          JSON.stringify({
            gate2PostgresSchedule: 'AUTOMATION_ACTION_AND_STATE_PERSISTENCE',
            status: 'PASS'
          })
        )
        throw rollback
      })
    } catch (error) {
      if (error !== rollback) throw error
    }

    const rolledBack = await sql<{
      campaigns: string
      characters: string
      encounters: string
    }>`
      select
        (select count(*)::text from public.campaigns where owner_user_id = ${gm.id}::uuid) as campaigns,
        (select count(*)::text from public.characters where id = ${characterId}::uuid) as characters,
        (select count(*)::text from public.encounters where campaign_id in
          (select id from public.campaigns where owner_user_id = ${gm.id}::uuid)) as encounters
    `.execute(db)
    assert.deepEqual(rolledBack.rows[0], {
      campaigns: '0',
      characters: '0',
      encounters: '0'
    })
  } catch (error) {
    runError = error
  } finally {
    for (const user of users.reverse()) {
      try {
        const deletion = await admin.auth.admin.deleteUser(user.id)
        if (deletion.error) cleanupErrors.push(deletion.error)
      } catch (error) {
        cleanupErrors.push(error)
      }
    }
    try {
      await db.destroy()
    } catch (error) {
      cleanupErrors.push(error)
    }
  }

  if (runError && cleanupErrors.length > 0) {
    throw new AggregateError(
      [runError, ...cleanupErrors],
      'Gate 2 action proof and cleanup failed.'
    )
  }
  if (runError) throw runError
  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, 'Gate 2 action proof cleanup failed.')
  }
}
