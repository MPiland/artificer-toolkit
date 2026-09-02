import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import type { DBLike } from '@artificer-toolkit/db'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { executeEncounterCommand } from '../../../packages/functions/src/services/encounter/encounterService.js'
import { startEncounterMovementReactionAtBoundary } from '../../../packages/functions/src/services/encounter/encounterMovementReactionContinuation.js'
import {
  checksumSpatialCurrentness,
  checksumSpatialMovementSelection
} from '../../../packages/functions/src/services/encounter/encounterSpatialMovementRuleService.js'
import { createDnd5eCharacterActionRuntime } from '../../../packages/functions/src/services/rules/systems/dnd5e/characterActionRuntime.js'
import { createMovementReactionChoiceDefinition } from '../../../packages/functions/src/services/rules/movementReactionChoice.js'

import {
  createPhase81RacePassResult,
  phase81RaceModuleContracts,
  runPhase81CampaignRootRace,
  type Phase81PostgresEnvironment,
  type Phase81RacePassResult
} from './phase81PostgresRaceSupport.js'
import { createPhase81PostgresCommittedFixture } from './phase81PostgresCommittedFixture.js'

type MovementRaceResult =
  | { kind: 'MOVED'; sceneVersion: number }
  | { kind: 'REACTION_SETTLED'; sceneVersion: number }
  | { kind: 'SCENE_MUTATED'; sceneVersion: number }
  | { kind: 'STALE_OR_PENDING'; reason: string }

type RaceOrder = 'MOVE_FIRST' | 'CONTROL_FIRST'

function runtime() {
  return createDnd5eCharacterActionRuntime({
    continuationIntegrityKey: new Uint8Array(32).fill(81),
    definitions: {
      async requireCurrent() {
        throw new Error('A bounded reaction-choice continuation must not reload a definition.')
      }
    }
  })
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isExpectedConflict(error: unknown): boolean {
  return /awaiting resolution|changed before|unavailable|stale|conflict|current position/iu.test(
    message(error)
  )
}

async function currentVersions(input: {
  db: DBLike
  encounterId: string
  sceneId: string
}): Promise<{ encounterVersion: number; sceneVersion: number }> {
  const encounter = await input.db
    .selectFrom('encounters')
    .select('version')
    .where('id', '=', input.encounterId)
    .executeTakeFirstOrThrow()
  const scene = await input.db
    .selectFrom('campaign_live_scenes')
    .select('version')
    .where('id', '=', input.sceneId)
    .executeTakeFirstOrThrow()
  return { encounterVersion: encounter.version, sceneVersion: scene.version }
}

async function createPendingReaction(input: {
  fixture: Awaited<ReturnType<typeof createPhase81PostgresCommittedFixture>>
  occurrenceId: string
  path: readonly { x: number; y: number }[]
}): Promise<{ encounterVersion: number; occurrenceVersion: number; sceneVersion: number }> {
  const scene = await input.fixture.ensureScene()
  const character = await input.fixture.ensureCharacter()
  const versions = await currentVersions({
    db: input.fixture.db,
    encounterId: input.fixture.ids.encounterId,
    sceneId: scene.sceneId
  })
  const choiceDefinitionId = randomUUID()
  const sourceId = checksumRuleDocument({
    kind: 'PHASE81_MOVEMENT_RACE_CONTACT',
    occurrenceId: input.occurrenceId
  })
  const optionId = checksumRuleDocument({
    kind: 'PHASE81_MOVEMENT_RACE_OPTION',
    occurrenceId: input.occurrenceId
  })
  const selectionChecksum = checksumSpatialMovementSelection({
    encounterId: input.fixture.ids.encounterId,
    sceneId: scene.sceneId,
    tokenId: scene.sourceTokenId,
    movementKind: 'VOLUNTARY',
    path: input.path,
    candidates: []
  })
  const currentnessChecksum = checksumSpatialCurrentness({
    encounter: { id: input.fixture.ids.encounterId, version: versions.encounterVersion },
    candidates: []
  })
  const choice = {
    pathDistance: 0,
    reactorActorId: input.fixture.ids.creatureActorId,
    reactorTokenId: scene.creatureTokenId,
    options: [
      {
        optionId,
        contactSourceId: sourceId,
        actionId: 'phase81-decline-only-reaction',
        actionSourceKind: 'ENCOUNTER_FEATURE' as const,
        actionSourceCurrentnessChecksum: 'a'.repeat(64),
        candidate: {
          contact: input.path[0]!,
          movingActorId: character.actorId,
          pathDistance: 0,
          reactorActorId: input.fixture.ids.creatureActorId,
          reactorTokenId: scene.creatureTokenId,
          sourceId,
          stage: 'BEFORE_LEAVE_REACH' as const
        },
        binding: {
          kind: 'MOVEMENT' as const,
          stage: 'BEFORE_LEAVE_REACH' as const,
          perceptionRequirement: 'SEE' as const,
          eligibilityDefinitionId: randomUUID(),
          movementInterruption: null
        },
        policy: {
          eligible: true,
          allowanceDefinitionId: randomUUID(),
          allowanceMaximum: 1,
          allowanceRefreshBoundary: 'START_OF_TURN' as const,
          selectionPolicy: 'CHOICE' as const,
          choiceDefinitionId,
          targetPolicy: 'MOVER' as const
        },
        eligibilityEvidenceChecksum: 'b'.repeat(64),
        authority: { kind: 'GM' as const },
        visibility: 'GM_ONLY' as const
      }
    ]
  }
  const pendingSnapshot = await startEncounterMovementReactionAtBoundary({
    runtime: runtime(),
    occurrenceId: input.occurrenceId,
    gameSystemId: input.fixture.ids.gameSystemId,
    publishedChoice: createMovementReactionChoiceDefinition({
      definitionId: choiceDefinitionId,
      gameSystemId: input.fixture.ids.gameSystemId
    }),
    root: {
      commandId: randomUUID(),
      commandFingerprint: checksumRuleDocument({
        kind: 'PHASE81_MOVEMENT_REACTION_ROOT',
        occurrenceId: input.occurrenceId
      }),
      initiatorUserId: input.fixture.ids.playerUserId,
      correlationId: null,
      encounterId: input.fixture.ids.encounterId,
      sceneId: scene.sceneId,
      tokenId: scene.sourceTokenId,
      expectedEncounterVersion: versions.encounterVersion,
      expectedSceneVersion: versions.sceneVersion,
      movementKind: 'VOLUNTARY',
      originalPath: input.path
    },
    currentSceneVersion: versions.sceneVersion,
    boundary: {
      kind: 'REACTION_BOUNDARY',
      boundaryDistance: 0,
      boundaryPosition: input.path[0]!,
      movementIntent: { tokenId: scene.sourceTokenId, position: input.path[0]! },
      completedExecutions: [],
      appliedPrefix: null,
      completedReactionExecutions: [],
      remainingCandidates: [],
      resolutionCommands: [],
      selectionChecksum,
      currentnessChecksum
    },
    reactionTimeline: [{ kind: 'CONTROLLER_CHOICE' as const, group: choice }]
  })
  assert.equal(pendingSnapshot.applicationContext.kind, 'ENCOUNTER_MOVEMENT_REACTION')
  const occurrence = await input.fixture.repositories.occurrences.createPending({
    aggregateKind: 'ENCOUNTER',
    aggregateId: input.fixture.ids.encounterId,
    campaignId: input.fixture.ids.campaignId,
    occurrenceId: input.occurrenceId,
    rootCommandId: pendingSnapshot.applicationContext.root.commandId,
    expectedAggregateVersion: versions.encounterVersion,
    pendingSnapshot
  })
  return {
    encounterVersion: versions.encounterVersion,
    occurrenceVersion: occurrence.version,
    sceneVersion: versions.sceneVersion
  }
}

async function sceneEventCount(
  fixture: Awaited<ReturnType<typeof createPhase81PostgresCommittedFixture>>,
  sceneId: string
): Promise<number> {
  return (await fixture.repositories.scenes.listEvents(sceneId)).length
}

function movementCommand(input: {
  commandId: string
  encounterVersion: number
  sceneId: string
  sceneVersion: number
  tokenId: string
}): Parameters<
  Awaited<
    ReturnType<typeof createPhase81PostgresCommittedFixture>
  >['adapters']['executeEncounterSceneCommand']
>[2] {
  return {
    commandId: input.commandId,
    correlationId: null,
    expectedEncounterVersion: input.encounterVersion,
    expectedSceneVersion: input.sceneVersion,
    movementKind: 'VOLUNTARY',
    path: [
      { x: 25, y: 25 },
      { x: 75, y: 25 }
    ],
    sceneId: input.sceneId,
    tokenId: input.tokenId,
    type: 'MOVE_SCENE_TOKEN'
  }
}

async function runReactionRace(input: {
  environment: Phase81PostgresEnvironment
  runId: string
  order: RaceOrder
}): Promise<{
  assertions: readonly string[]
  ordering: 'FIRST_WINS' | 'SECOND_WINS'
}> {
  const fixture = await createPhase81PostgresCommittedFixture(
    input.environment,
    `${input.runId}-${input.order}`
  )
  try {
    const scene = await fixture.ensureScene()
    const occurrenceId = randomUUID()
    const path = [
      { x: 25, y: 25 },
      { x: 75, y: 25 }
    ]
    const pending = await createPendingReaction({ fixture, occurrenceId, path })
    const beforeEvents = await sceneEventCount(fixture, scene.sceneId)
    const move = async (db: DBLike): Promise<MovementRaceResult> => {
      try {
        const result = await fixture.adapters.executeEncounterSceneCommand(
          db,
          fixture.ids.playerUserId,
          movementCommand({
            commandId: randomUUID(),
            encounterVersion: pending.encounterVersion,
            sceneId: scene.sceneId,
            sceneVersion: pending.sceneVersion,
            tokenId: scene.sourceTokenId
          }),
          { encounterId: fixture.ids.encounterId }
        )
        return { kind: 'MOVED', sceneVersion: result.version }
      } catch (error) {
        if (isExpectedConflict(error)) return { kind: 'STALE_OR_PENDING', reason: message(error) }
        throw error
      }
    }
    const control = async (db: DBLike): Promise<MovementRaceResult> => {
      try {
        const result = await executeEncounterCommand(
          db,
          fixture.ids.gmUserId,
          {
            commandId: randomUUID(),
            correlationId: null,
            encounterId: fixture.ids.encounterId,
            expectedOccurrenceVersion: pending.occurrenceVersion,
            expectedVersion: pending.encounterVersion,
            occurrenceId,
            resolution: { kind: 'DECLINE' },
            type: 'RESOLVE_RULE_OCCURRENCE'
          },
          { rulesRuntime: runtime() }
        )
        const occurrence = result.occurrence
        assert.ok(occurrence)
        return { kind: 'REACTION_SETTLED', sceneVersion: pending.sceneVersion }
      } catch (error) {
        if (isExpectedConflict(error)) return { kind: 'STALE_OR_PENDING', reason: message(error) }
        throw error
      }
    }
    const [winner, contender] = await runPhase81CampaignRootRace({
      campaignId: fixture.ids.campaignId,
      connectionFactory: fixture.connectionFactory,
      observer: fixture.db,
      winner: (db): Promise<MovementRaceResult> =>
        input.order === 'MOVE_FIRST' ? move(db) : control(db),
      contender: (db): Promise<MovementRaceResult> =>
        input.order === 'MOVE_FIRST' ? control(db) : move(db)
    })
    assert.ok(winner.fulfilled && winner.value)
    assert.ok(
      contender.fulfilled && contender.value,
      `Movement-race contender failed: ${message(contender.error)}`
    )
    const results =
      input.order === 'MOVE_FIRST'
        ? [winner.value, contender.value]
        : [contender.value, winner.value]
    assert.equal(
      results[0]?.kind,
      'STALE_OR_PENDING',
      'A pre-existing pending reaction prevents the submitted move from becoming a root winner.'
    )
    assert.equal(results.filter((result) => result.kind === 'MOVED').length, 0)
    assert.equal(
      results.filter((result) => result.kind === 'REACTION_SETTLED').length,
      1,
      JSON.stringify(results)
    )
    const occurrence = await fixture.repositories.occurrences.lockOccurrence(
      'ENCOUNTER',
      fixture.ids.encounterId,
      occurrenceId
    )
    assert.equal(occurrence?.state, 'COMPLETED')
    assert.equal(occurrence?.pendingSnapshot, null)
    const receiptCount = await fixture.db
      .selectFrom('encounter_rule_receipts')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .where('encounter_id', '=', fixture.ids.encounterId)
      .where('occurrence_id', '=', occurrenceId)
      .executeTakeFirstOrThrow()
    assert.equal(
      Number(receiptCount.count),
      1,
      'The settled reaction must retain one terminal receipt.'
    )
    const afterEvents = await sceneEventCount(fixture, scene.sceneId)
    assert.equal(
      afterEvents - beforeEvents,
      1,
      'The settled frozen path must create one genuine Scene child delta.'
    )
    const versions = await currentVersions({
      db: fixture.db,
      encounterId: fixture.ids.encounterId,
      sceneId: scene.sceneId
    })
    assert.equal(versions.encounterVersion, pending.encounterVersion + 1)
    assert.equal(versions.sceneVersion, pending.sceneVersion + 1)
    const current = await fixture.repositories.scenes.findLiveScene(scene.sceneId)
    assert.ok(current)
    const token = current.state.tokens.find((candidate) => candidate.id === scene.sourceTokenId)
    assert.ok(token)
    assert.deepEqual(
      token.position,
      { x: 75, y: 25 },
      'Only the settled frozen path moves the token.'
    )
    return {
      ordering: 'SECOND_WINS',
      assertions: [
        'the pending reaction settlement is the only successful movement root',
        'the blocked move cannot duplicate the frozen path',
        'one genuine Scene child delta',
        'Encounter and Scene versions advance once'
      ]
    }
  } finally {
    await fixture.cleanup()
  }
}

async function runSceneRace(input: {
  environment: Phase81PostgresEnvironment
  runId: string
  order: RaceOrder
}): Promise<{
  assertions: readonly string[]
  ordering: 'FIRST_WINS' | 'SECOND_WINS'
}> {
  const fixture = await createPhase81PostgresCommittedFixture(
    input.environment,
    `${input.runId}-${input.order}`
  )
  try {
    const scene = await fixture.ensureScene()
    const versions = await currentVersions({
      db: fixture.db,
      encounterId: fixture.ids.encounterId,
      sceneId: scene.sceneId
    })
    const beforeEvents = await sceneEventCount(fixture, scene.sceneId)
    const move = async (db: DBLike): Promise<MovementRaceResult> => {
      try {
        const result = await fixture.adapters.executeEncounterSceneCommand(
          db,
          fixture.ids.playerUserId,
          movementCommand({
            commandId: randomUUID(),
            encounterVersion: versions.encounterVersion,
            sceneId: scene.sceneId,
            sceneVersion: versions.sceneVersion,
            tokenId: scene.sourceTokenId
          }),
          { encounterId: fixture.ids.encounterId }
        )
        return { kind: 'MOVED', sceneVersion: result.version }
      } catch (error) {
        if (isExpectedConflict(error)) return { kind: 'STALE_OR_PENDING', reason: message(error) }
        throw error
      }
    }
    const mutateScene = async (db: DBLike): Promise<MovementRaceResult> => {
      try {
        const result = await fixture.adapters.executeEncounterSceneCommand(
          db,
          fixture.ids.gmUserId,
          {
            commandId: randomUUID(),
            expectedSceneVersion: versions.sceneVersion,
            illumination: 'DIM',
            sceneId: scene.sceneId,
            type: 'SET_SCENE_AMBIENT_ILLUMINATION'
          },
          { encounterId: fixture.ids.encounterId }
        )
        return { kind: 'SCENE_MUTATED', sceneVersion: result.version }
      } catch (error) {
        if (isExpectedConflict(error)) return { kind: 'STALE_OR_PENDING', reason: message(error) }
        throw error
      }
    }
    const [winner, contender] = await runPhase81CampaignRootRace({
      campaignId: fixture.ids.campaignId,
      connectionFactory: fixture.connectionFactory,
      observer: fixture.db,
      winner: (db): Promise<MovementRaceResult> =>
        input.order === 'MOVE_FIRST' ? move(db) : mutateScene(db),
      contender: (db): Promise<MovementRaceResult> =>
        input.order === 'MOVE_FIRST' ? mutateScene(db) : move(db)
    })
    assert.ok(winner.fulfilled && winner.value)
    assert.ok(contender.fulfilled && contender.value)
    const results =
      input.order === 'MOVE_FIRST'
        ? [winner.value, contender.value]
        : [contender.value, winner.value]
    assert.equal(
      results.filter((result) => result.kind === 'MOVED').length,
      input.order === 'MOVE_FIRST' ? 1 : 0
    )
    assert.equal(results.filter((result) => result.kind === 'SCENE_MUTATED').length, 1)
    assert.equal(
      results.filter((result) => result.kind === 'STALE_OR_PENDING').length,
      input.order === 'MOVE_FIRST' ? 0 : 1
    )
    const afterEvents = await sceneEventCount(fixture, scene.sceneId)
    assert.equal(afterEvents - beforeEvents, input.order === 'MOVE_FIRST' ? 2 : 1)
    const current = await fixture.repositories.scenes.findLiveScene(scene.sceneId)
    assert.ok(current)
    assert.equal(
      current.state.version,
      versions.sceneVersion + (input.order === 'MOVE_FIRST' ? 2 : 1)
    )
    const source = current.state.tokens.find((token) => token.id === scene.sourceTokenId)
    assert.ok(source)
    assert.deepEqual(
      source.position,
      input.order === 'MOVE_FIRST' ? { x: 75, y: 25 } : { x: 25, y: 25 }
    )
    assert.equal(current.state.ambientIllumination, 'DIM')
    return {
      ordering: input.order === 'MOVE_FIRST' ? 'FIRST_WINS' : 'SECOND_WINS',
      assertions: [
        input.order === 'MOVE_FIRST'
          ? 'a later disjoint Scene command rebases safely'
          : 'an earlier Scene mechanics change rejects stale movement',
        'Scene root events remain ordered and exact',
        'committed movement and illumination are retained',
        'Scene version advances only for committed roots'
      ]
    }
  } finally {
    await fixture.cleanup()
  }
}

export async function provePhase81MovementRaces(
  environment: Phase81PostgresEnvironment,
  runId: string
): Promise<
  readonly [
    Phase81RacePassResult<'P81-RACE-MOVEMENT-REACTION-MOVE-FIRST'>,
    Phase81RacePassResult<'P81-RACE-MOVEMENT-REACTION-REACTION-FIRST'>,
    Phase81RacePassResult<'P81-RACE-MOVEMENT-SCENE-MOVE-FIRST'>,
    Phase81RacePassResult<'P81-RACE-MOVEMENT-SCENE-SCENE-FIRST'>
  ]
> {
  assert.deepEqual(phase81RaceModuleContracts.movement.caseIds, [
    'P81-RACE-MOVEMENT-REACTION-MOVE-FIRST',
    'P81-RACE-MOVEMENT-REACTION-REACTION-FIRST',
    'P81-RACE-MOVEMENT-SCENE-MOVE-FIRST',
    'P81-RACE-MOVEMENT-SCENE-SCENE-FIRST'
  ])
  const reactionMoveFirst = await runReactionRace({ environment, runId, order: 'MOVE_FIRST' })
  const reactionFirst = await runReactionRace({ environment, runId, order: 'CONTROL_FIRST' })
  const sceneMoveFirst = await runSceneRace({ environment, runId, order: 'MOVE_FIRST' })
  const sceneFirst = await runSceneRace({ environment, runId, order: 'CONTROL_FIRST' })
  return [
    createPhase81RacePassResult({
      caseId: 'P81-RACE-MOVEMENT-REACTION-MOVE-FIRST',
      ...reactionMoveFirst
    }),
    createPhase81RacePassResult({
      caseId: 'P81-RACE-MOVEMENT-REACTION-REACTION-FIRST',
      ...reactionFirst
    }),
    createPhase81RacePassResult({
      caseId: 'P81-RACE-MOVEMENT-SCENE-MOVE-FIRST',
      ...sceneMoveFirst
    }),
    createPhase81RacePassResult({
      caseId: 'P81-RACE-MOVEMENT-SCENE-SCENE-FIRST',
      ...sceneFirst
    })
  ]
}
