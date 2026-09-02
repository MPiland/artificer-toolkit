import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import {
  createEncounterRepository,
  createReusableDefinitionRepository
} from '@artificer-toolkit/db'
import type {
  ActiveRuleEffectDefinitionDto,
  ActiveRuleEffectLifecycleDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  activeRuleEffectDefinitionDtoSchema,
  activeRuleEffectLifecycleDtoSchema
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  createPlatformRulesRuntime,
  deriveRulesRuntimeContinuationIntegrityKey
} from '../../../packages/functions/src/services/rules/platformRulesRuntime.js'
import { createReusableDefinitionRuntimeSource } from '../../../packages/functions/src/services/rules/reusableDefinitionService.js'
import {
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_HEAL_PROPOSAL_OPERATION_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
  dnd5eEffectActionCapability
} from '../../../packages/functions/src/services/rules/systems/dnd5e/effectActionCompiler.js'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '../../../packages/functions/src/services/rules/systems/dnd5e/concentrationPolicy.js'
import { getPendingEncounterConcentrationRuleOccurrence } from '../../../packages/functions/src/services/encounter/encounterCharacterRuleActionService.js'
import { lockEncounterActionSceneContext } from '../../../packages/functions/src/services/encounter/encounterActionSceneContext.js'
import { discoverEncounterFeatureActionCapabilities } from '../../../packages/functions/src/services/rules/encounterFeatureActionCapabilityDiscoveryRegistry.js'

import { createPhase81PostgresCommittedFixture } from './phase81PostgresCommittedFixture.js'
import {
  createPhase81RacePassResult,
  phase81RaceModuleContracts,
  runPhase81CampaignRootRace,
  type Phase81PostgresEnvironment,
  type Phase81RaceOperationResult,
  type Phase81RacePassResult
} from './phase81PostgresRaceSupport.js'

type Fixture = Awaited<ReturnType<typeof createPhase81PostgresCommittedFixture>>
type Runtime = ReturnType<typeof runtimeForFixture>
type PendingAction = Awaited<ReturnType<typeof startPendingAction>>

type DecisionRaceCase = Extract<
  (typeof phase81RaceModuleContracts.effectDecision.caseIds)[number],
  | 'P81-RACE-DECISION-SUPERSEDE-RESOLVE-FIRST'
  | 'P81-RACE-DECISION-SUPERSEDE-SUPERSEDE-FIRST'
  | 'P81-RACE-OPTIONAL-DECISION-DECISION-FIRST'
  | 'P81-RACE-OPTIONAL-DECISION-OVERRIDE-FIRST'
>

function runtimeForFixture(fixture: Fixture) {
  return createPlatformRulesRuntime({
    continuationIntegrityKey: deriveRulesRuntimeContinuationIntegrityKey(
      `phase81-effect-decision:${fixture.ids.encounterId}`
    ),
    definitions: createReusableDefinitionRuntimeSource(
      createReusableDefinitionRepository(fixture.db)
    )
  })
}

async function withDecisionFixture<T>(input: {
  environment: Phase81PostgresEnvironment
  run: (fixture: Fixture, runtime: Runtime) => Promise<T>
  runId: string
}): Promise<T> {
  const fixture = await createPhase81PostgresCommittedFixture(
    input.environment,
    `${input.runId}-${randomUUID()}`
  )
  try {
    return await input.run(fixture, runtimeForFixture(fixture))
  } finally {
    await fixture.cleanup()
  }
}

async function startPendingAction(input: { fixture: Fixture; runtime: Runtime }) {
  const character = await input.fixture.ensureCharacter()
  const scene = await input.fixture.ensureScene()
  const current = await input.fixture.db
    .selectFrom('encounters')
    .select('version')
    .where('id', '=', input.fixture.ids.encounterId)
    .executeTakeFirstOrThrow()
  const result = await input.fixture.adapters.executeEncounterCommand(
    input.fixture.db,
    input.fixture.ids.playerUserId,
    {
      actionId: character.actionId,
      actorId: character.actorId,
      commandId: randomUUID(),
      encounterId: input.fixture.ids.encounterId,
      expectedVersion: current.version,
      sceneContext: {
        expectedSceneVersion: scene.sceneVersion,
        sceneId: scene.sceneId,
        sourceTokenId: scene.sourceTokenId,
        targetTokenId: scene.creatureTokenId
      },
      targetActorId: input.fixture.ids.creatureActorId,
      type: 'RESOLVE_ACTION'
    },
    { rulesRuntime: input.runtime }
  )
  const occurrence = result.occurrence
  assert.ok(occurrence?.status === 'PENDING' && occurrence.pending?.kind === 'D20_EVIDENCE')
  return occurrence.pending
}

async function resolvePendingAction(input: {
  connection: ReturnType<Fixture['connectionFactory']>
  fixture: Fixture
  pending: PendingAction
  rawFace?: number
  runtime: Runtime
}) {
  return input.fixture.adapters.executeEncounterCommand(
    input.connection,
    input.fixture.ids.playerUserId,
    {
      commandId: randomUUID(),
      correlationId: null,
      encounterId: input.fixture.ids.encounterId,
      expectedOccurrenceVersion: input.pending.occurrenceVersion,
      expectedVersion: input.pending.encounterVersion,
      occurrenceId: input.pending.occurrenceId,
      resolution: {
        kind: 'ENTER_DICE',
        rawFaces: [input.rawFace ?? 1],
        requestId: input.pending.request.requestId
      },
      type: 'RESOLVE_RULE_OCCURRENCE'
    },
    { rulesRuntime: input.runtime }
  )
}

function assertBlockedConflict(result: Phase81RaceOperationResult): void {
  assert.equal(result.fulfilled, false, 'The blocked stale command must fail closed.')
  assert.match(
    result.error instanceof Error ? result.error.message : String(result.error),
    /awaiting|changed|unavailable|current|stale|pending|conflict|version/u
  )
}

async function assertSingleTerminalOccurrence(input: {
  fixture: Fixture
  occurrenceId: string
}): Promise<void> {
  const occurrence = await input.fixture.db
    .selectFrom('encounter_rule_occurrences')
    .select(['state', 'version'])
    .where('id', '=', input.occurrenceId)
    .where('encounter_id', '=', input.fixture.ids.encounterId)
    .executeTakeFirstOrThrow()
  assert.equal(occurrence.state, 'COMPLETED')
  assert.equal(occurrence.version, 1)
}

async function replaceOptionalCombatRules(input: {
  connection: ReturnType<Fixture['connectionFactory']>
  fixture: Fixture
  expectedVersion: number
}) {
  return input.fixture.adapters.executeEncounterCommand(
    input.connection,
    input.fixture.ids.gmUserId,
    {
      commandId: randomUUID(),
      definitionIds: [],
      encounterId: input.fixture.ids.encounterId,
      expectedVersion: input.expectedVersion,
      type: 'REPLACE_OPTIONAL_COMBAT_RULES'
    }
  )
}

function pass(caseId: DecisionRaceCase, ordering: 'FIRST_WINS' | 'SECOND_WINS') {
  return createPhase81RacePassResult({
    assertions: [
      'real Encounter command service owns both transitions',
      'one frozen pending occurrence has one current settlement path',
      'receipt/currentness is checked by the aggregate coordinator'
    ],
    caseId,
    ordering
  })
}

async function encounterVersion(fixture: Fixture): Promise<number> {
  return fixture.db
    .selectFrom('encounters')
    .select('version')
    .where('id', '=', fixture.ids.encounterId)
    .executeTakeFirstOrThrow()
    .then(({ version }) => version)
}

async function commandWriteCounts(input: {
  commandId: string
  fixture: Fixture
}): Promise<{ events: number; occurrences: number; receipts: number }> {
  const [events, occurrences, receipts] = await Promise.all([
    input.fixture.db
      .selectFrom('encounter_events')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .where('encounter_id', '=', input.fixture.ids.encounterId)
      .where('command_id', '=', input.commandId)
      .executeTakeFirstOrThrow(),
    input.fixture.db
      .selectFrom('encounter_rule_occurrences')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .where('encounter_id', '=', input.fixture.ids.encounterId)
      .where('root_command_id', '=', input.commandId)
      .executeTakeFirstOrThrow(),
    input.fixture.db
      .selectFrom('encounter_rule_receipts')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .where('encounter_id', '=', input.fixture.ids.encounterId)
      .where('command_id', '=', input.commandId)
      .executeTakeFirstOrThrow()
  ])
  return {
    events: Number(events.count),
    occurrences: Number(occurrences.count),
    receipts: Number(receipts.count)
  }
}

async function requireEncounter(fixture: Fixture) {
  const encounter = await createEncounterRepository(fixture.db).find(fixture.ids.encounterId)
  assert.ok(encounter, 'The committed fixture Encounter must exist.')
  return encounter
}

function recurringHealDefinition(input: {
  activeEffectId: string
  compiledEntryId: string
  encounterId: string
  gameSystemId: string
  sourceActorId: string
}): ActiveRuleEffectDefinitionDto {
  const definitionId = input.activeEffectId
  return activeRuleEffectDefinitionDtoSchema.parse({
    schemaVersion: 1,
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: input.encounterId,
      sourceOccurrenceId: randomUUID(),
      rootCommandId: randomUUID(),
      sourceActorId: input.sourceActorId
    },
    authoredEffectId: definitionId,
    compiledEntryId: input.compiledEntryId,
    frozenGraphNodeId: 'phase81-recurring-heal',
    frozenGraph: {
      schemaVersion: 1,
      source: {
        definitionId,
        gameSystemId: input.gameSystemId,
        definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
        checksum: checksumRuleDocument({ definitionId, kind: 'PHASE81_RECURRING_HEAL' })
      },
      capabilityContractVersion: 1,
      factContracts: [...dnd5eEffectActionCapability.factContracts],
      nodes: [
        {
          id: 'phase81-recurring-heal',
          operation: { key: DND5E_HEAL_PROPOSAL_OPERATION_KEY, contractVersion: 1 },
          inputs: {
            targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
            amount: { kind: 'LITERAL', value: 1 },
            targetStateChecksum: { kind: 'FACT', factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY }
          }
        }
      ],
      outputs: {
        targetActorId: {
          kind: 'NODE_OUTPUT',
          nodeId: 'phase81-recurring-heal',
          port: 'targetActorId'
        },
        amount: { kind: 'NODE_OUTPUT', nodeId: 'phase81-recurring-heal', port: 'amount' }
      },
      sourceEntryBindings: [
        { sourceEntryId: input.compiledEntryId, nodeId: 'phase81-recurring-heal' }
      ]
    },
    adapterFacts: {},
    perceptionContributions: [],
    recurrence: {
      recurrenceStage: 'END_OF_TURN',
      consumeOnFirstEvent: null,
      endOnEvents: [],
      lifetimeScope: 'ENCOUNTER',
      expiration: { kind: 'TICKS', initialRemaining: 2, decrementStage: 'END_OF_TURN' }
    }
  })
}

async function prepareRecurringCreatureEffect(fixture: Fixture, runtime: Runtime) {
  await fixture.ensureCharacter()
  const currentVersion = await encounterVersion(fixture)
  const advanced = await fixture.adapters.executeEncounterCommand(
    fixture.db,
    fixture.ids.gmUserId,
    {
      type: 'ADVANCE_TURN',
      encounterId: fixture.ids.encounterId,
      commandId: randomUUID(),
      expectedVersion: currentVersion
    },
    { rulesRuntime: runtime }
  )
  assert.equal(advanced.projection.currentActorId, fixture.ids.creatureActorId)
  const activeEffectId = randomUUID()
  const lifecycle: ActiveRuleEffectLifecycleDto = activeRuleEffectLifecycleDtoSchema.parse({
    schemaVersion: 1,
    remainingTicks: 2
  })
  await fixture.repositories.activeEffects.create({
    id: activeEffectId,
    owner: {
      kind: 'ENCOUNTER_ACTOR',
      encounterId: fixture.ids.encounterId,
      targetActorId: fixture.ids.creatureActorId
    },
    definition: recurringHealDefinition({
      activeEffectId,
      compiledEntryId: randomUUID(),
      encounterId: fixture.ids.encounterId,
      gameSystemId: fixture.ids.gameSystemId,
      sourceActorId: fixture.ids.creatureActorId
    }),
    lifecycle
  })
  return { activeEffectId }
}

async function runEffectRemoveRace(input: {
  environment: Phase81PostgresEnvironment
  removeFirst: boolean
  runId: string
}): Promise<void> {
  const fixture = await createPhase81PostgresCommittedFixture(
    input.environment,
    `${input.runId}-${randomUUID()}`
  )
  try {
    const runtime = runtimeForFixture(fixture)
    const { activeEffectId } = await prepareRecurringCreatureEffect(fixture, runtime)
    const before = await requireEncounter(fixture)
    let advanceCommandId: string | null = null
    let removeCommandId: string | null = null
    const advance = async (connection: ReturnType<Fixture['connectionFactory']>) =>
      fixture.adapters.executeEncounterCommand(
        connection,
        fixture.ids.gmUserId,
        {
          type: 'ADVANCE_TURN',
          encounterId: fixture.ids.encounterId,
          commandId: (advanceCommandId = randomUUID()),
          expectedVersion: await connection
            .selectFrom('encounters')
            .select('version')
            .where('id', '=', fixture.ids.encounterId)
            .executeTakeFirstOrThrow()
            .then(({ version }) => version)
        },
        { rulesRuntime: runtime }
      )
    const remove = async (connection: ReturnType<Fixture['connectionFactory']>) =>
      fixture.adapters.executeEncounterCommand(connection, fixture.ids.gmUserId, {
        type: 'REMOVE_ACTOR',
        encounterId: fixture.ids.encounterId,
        commandId: (removeCommandId = randomUUID()),
        expectedVersion: await connection
          .selectFrom('encounters')
          .select('version')
          .where('id', '=', fixture.ids.encounterId)
          .executeTakeFirstOrThrow()
          .then(({ version }) => version),
        actorId: fixture.ids.creatureActorId
      })
    const [winner, contender] = await runPhase81CampaignRootRace({
      campaignId: fixture.ids.campaignId,
      connectionFactory: fixture.connectionFactory,
      observer: fixture.db,
      winner: input.removeFirst ? remove : advance,
      contender: input.removeFirst ? advance : remove
    })
    if (!winner.fulfilled) throw winner.error
    assert.ok(winner.value)
    assertBlockedConflict(contender)
    assert.ok(advanceCommandId && removeCommandId)
    const [advanceWrites, removeWrites, settled] = await Promise.all([
      commandWriteCounts({ commandId: advanceCommandId, fixture }),
      commandWriteCounts({ commandId: removeCommandId, fixture }),
      requireEncounter(fixture)
    ])
    assert.equal(
      settled.version,
      before.version + 1,
      'Only the winner may advance Encounter state.'
    )
    assert.equal(settled.status, 'ACTIVE')
    const effectRows = await fixture.db
      .selectFrom('encounter_active_rule_effects')
      .select(['id', 'lifecycle'])
      .where('id', '=', activeEffectId)
      .execute()
    if (input.removeFirst) {
      assert.equal(effectRows.length, 0, 'Actor removal must clean its active effect exactly once.')
      assert.equal(
        settled.actors.some((actor) => actor.id === fixture.ids.creatureActorId),
        false,
        'The winning removal must leave no Creature actor behind.'
      )
      assert.equal(
        settled.currentActorId,
        null,
        'Removing the current actor must clear the turn cursor.'
      )
      assert.deepEqual(advanceWrites, { events: 0, occurrences: 0, receipts: 0 })
      assert.deepEqual(removeWrites, { events: 1, occurrences: 1, receipts: 1 })
    } else {
      assert.equal(effectRows.length, 1, 'A winning tick must retain its unexpired active effect.')
      assert.deepEqual(effectRows[0]?.lifecycle, { schemaVersion: 1, remainingTicks: 1 })
      assert.ok(
        settled.actors.some((actor) => actor.id === fixture.ids.creatureActorId),
        'The stale removal must not partially remove the Creature actor.'
      )
      assert.deepEqual(advanceWrites, { events: 1, occurrences: 1, receipts: 1 })
      assert.deepEqual(removeWrites, { events: 0, occurrences: 0, receipts: 0 })
    }
  } finally {
    await fixture.cleanup()
  }
}

async function preparePendingConcentration(fixture: Fixture, runtime: Runtime) {
  const character = await fixture.ensureCharacter()
  const state = await fixture.repositories.activeEffects.createMaintainedState({
    id: randomUUID(),
    encounterId: fixture.ids.encounterId,
    ownerActorId: character.actorId,
    descriptor: {
      schemaVersion: 2,
      maintenanceDefinitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
      definitionChecksum: checksumRuleDocument({
        kind: 'DND5E_CONCENTRATION_MAINTENANCE',
        definitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
      }),
      sourceActionId: randomUUID(),
      sourceOccurrenceId: randomUUID(),
      sourceActorId: character.actorId,
      replacementPolicy: 'REPLACE_SAME_DEFINITION',
      emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
    }
  })
  const dependentEffectId = randomUUID()
  await fixture.repositories.activeEffects.create({
    id: dependentEffectId,
    owner: { kind: 'CHARACTER', characterId: character.characterId },
    maintainedEffectStateId: state.id,
    definition: recurringHealDefinition({
      activeEffectId: randomUUID(),
      compiledEntryId: randomUUID(),
      encounterId: fixture.ids.encounterId,
      gameSystemId: fixture.ids.gameSystemId,
      sourceActorId: character.actorId
    }),
    lifecycle: activeRuleEffectLifecycleDtoSchema.parse({ schemaVersion: 1, remainingTicks: 2 })
  })
  const scene = await fixture.ensureScene()
  const current = await requireEncounter(fixture)
  const creature = current.actors.find((actor) => actor.id === fixture.ids.creatureActorId)
  assert.ok(creature && creature.kind === 'CREATURE')
  const capability = discoverEncounterFeatureActionCapabilities({ actor: creature }).find(
    (candidate) =>
      candidate.attackMechanic !== null &&
      candidate.compiledEffect.invocation.range.rangeKind === 'DISTANCE' &&
      candidate.compiledEffect.invocation.range.amount >= 10 &&
      candidate.compiledEffect.invocation.targeting?.selectionKind === 'SINGLE_TARGET' &&
      candidate.compiledEffect.invocation.targeting.dispositionKind === 'ANY'
  )
  assert.ok(capability, 'The pinned Duergar must expose a ranged direct-damage Feature action.')
  const advanced = await fixture.adapters.executeEncounterCommand(
    fixture.db,
    fixture.ids.gmUserId,
    {
      commandId: randomUUID(),
      encounterId: fixture.ids.encounterId,
      expectedVersion: current.version,
      type: 'ADVANCE_TURN'
    },
    { rulesRuntime: runtime }
  )
  assert.equal(advanced.projection.currentActorId, creature.id)
  const beforeDamage = await fixture.db
    .selectFrom('encounter_actors')
    .select('current_hit_points')
    .where('id', '=', character.actorId)
    .executeTakeFirstOrThrow()
  const sceneContext = await lockEncounterActionSceneContext({
    db: fixture.db,
    encounterId: fixture.ids.encounterId,
    actorId: creature.id,
    targetActorId: character.actorId,
    request: {
      expectedSceneVersion: scene.sceneVersion,
      sceneId: scene.sceneId,
      sourceTokenId: scene.creatureTokenId,
      targetTokenId: scene.sourceTokenId
    }
  })
  assert.ok(sceneContext, 'The committed fixture must provide the Duergar action Scene context.')
  const initial = await fixture.adapters.executeEncounterActorDirectRuleAction({
    db: fixture.db,
    runtime,
    command: {
      actionId: capability.actionId,
      actorId: creature.id,
      actorUserId: fixture.ids.gmUserId,
      commandId: randomUUID(),
      correlationId: null,
      encounterId: fixture.ids.encounterId,
      expectedEncounterVersion: await encounterVersion(fixture),
      sceneContext,
      targetActorId: character.actorId
    }
  })
  assert.ok(initial.status === 'PENDING' && 'request' in initial)
  const tested = await fixture.adapters.resumeEncounterActorDirectRuleAction({
    db: fixture.db,
    runtime,
    command: {
      actorUserId: fixture.ids.gmUserId,
      commandId: randomUUID(),
      correlationId: null,
      encounterId: fixture.ids.encounterId,
      expectedEncounterVersion: await encounterVersion(fixture),
      expectedOccurrenceVersion: initial.occurrenceVersion,
      occurrenceId: initial.occurrenceId,
      resolution: { kind: 'PHYSICAL', rawFaces: [20], requestId: initial.request.requestId }
    }
  })
  const completed =
    tested.status === 'PENDING' && 'phase' in tested && tested.phase === 'OUTCOME'
      ? await fixture.adapters.resumeEncounterActorDirectRuleAction({
          db: fixture.db,
          runtime,
          rollInteger: (min) => min,
          command: {
            actorUserId: fixture.ids.gmUserId,
            commandId: randomUUID(),
            correlationId: null,
            encounterId: fixture.ids.encounterId,
            expectedEncounterVersion: await encounterVersion(fixture),
            expectedOccurrenceVersion: tested.occurrenceVersion,
            occurrenceId: initial.occurrenceId,
            resolution: {
              kind: 'SYSTEM_OUTCOME',
              requestIds: tested.requests.map(({ requestId }) => requestId)
            }
          }
        })
      : tested
  assert.equal(completed.status, 'COMPLETE')
  assert.equal(completed.application.kind, 'CHARACTER_MECHANICS_BATCH')
  assert.ok(completed.application.applications.some(({ kind }) => kind === 'DAMAGE'))
  assert.ok(
    completed.application.targetTransition.after.currentHitPoints < beforeDamage.current_hit_points,
    'The production Duergar action must finalize positive damage before concentration is pending.'
  )
  const pending = await getPendingEncounterConcentrationRuleOccurrence({
    actorUserId: fixture.ids.playerUserId,
    db: fixture.db,
    encounterId: fixture.ids.encounterId
  })
  assert.ok(pending, 'The production damage action must create a concentration occurrence.')
  if (pending.kind !== 'D20_EVIDENCE') {
    throw new Error('The production concentration occurrence must request d20 evidence.')
  }
  return { character, dependentEffectId, pending, stateId: state.id }
}

async function runConcentrationCleanupRace(input: {
  checkFirst: boolean
  environment: Phase81PostgresEnvironment
  runId: string
}): Promise<void> {
  const fixture = await createPhase81PostgresCommittedFixture(
    input.environment,
    `${input.runId}-${randomUUID()}`,
    { creatureLabel: 'Duergar' }
  )
  try {
    const runtime = runtimeForFixture(fixture)
    const { character, dependentEffectId, pending, stateId } = await preparePendingConcentration(
      fixture,
      runtime
    )
    const before = await requireEncounter(fixture)
    let resolveCommandId: string | null = null
    let removeCommandId: string | null = null
    const resolve = async (connection: ReturnType<Fixture['connectionFactory']>) =>
      fixture.adapters.executeEncounterCommand(
        connection,
        fixture.ids.playerUserId,
        {
          commandId: (resolveCommandId = randomUUID()),
          correlationId: null,
          encounterId: fixture.ids.encounterId,
          expectedOccurrenceVersion: pending.occurrenceVersion,
          expectedVersion: pending.encounterVersion,
          occurrenceId: pending.occurrenceId,
          resolution: {
            kind: 'ENTER_DICE',
            rawFaces: [1],
            requestId: pending.request.requestId
          },
          type: 'RESOLVE_RULE_OCCURRENCE'
        },
        { rulesRuntime: runtime }
      )
    const remove = async (connection: ReturnType<Fixture['connectionFactory']>) =>
      fixture.adapters.executeEncounterCommand(connection, fixture.ids.gmUserId, {
        type: 'REMOVE_ACTOR',
        encounterId: fixture.ids.encounterId,
        commandId: (removeCommandId = randomUUID()),
        expectedVersion: await connection
          .selectFrom('encounters')
          .select('version')
          .where('id', '=', fixture.ids.encounterId)
          .executeTakeFirstOrThrow()
          .then(({ version }) => version),
        actorId: character.actorId
      })
    const [winner, contender] = await runPhase81CampaignRootRace({
      campaignId: fixture.ids.campaignId,
      connectionFactory: fixture.connectionFactory,
      observer: fixture.db,
      winner: input.checkFirst ? resolve : remove,
      contender: input.checkFirst ? remove : resolve
    })
    if (!winner.fulfilled) throw winner.error
    assertBlockedConflict(contender)
    assert.ok(resolveCommandId && removeCommandId)
    const [stateRows, dependentRows, occurrence, resolveWrites, removeWrites, settled] =
      await Promise.all([
        fixture.db
          .selectFrom('encounter_maintained_effect_states')
          .select('id')
          .where('id', '=', stateId)
          .execute(),
        fixture.db
          .selectFrom('character_active_rule_effects')
          .select('id')
          .where('id', '=', dependentEffectId)
          .execute(),
        fixture.db
          .selectFrom('encounter_rule_occurrences')
          .select(['state', 'version'])
          .where('encounter_id', '=', fixture.ids.encounterId)
          .where('id', '=', pending.occurrenceId)
          .executeTakeFirstOrThrow(),
        commandWriteCounts({ commandId: resolveCommandId, fixture }),
        commandWriteCounts({ commandId: removeCommandId, fixture }),
        requireEncounter(fixture)
      ])
    assert.equal(
      settled.version,
      before.version + 1,
      'Only the winner may advance Encounter state.'
    )
    assert.equal(settled.status, 'ACTIVE')
    assert.equal(stateRows.length, 0, 'Terminal concentration state must be removed exactly once.')
    assert.equal(
      dependentRows.length,
      0,
      'Terminal concentration cleanup must remove its dependent effect.'
    )
    assert.equal(
      occurrence.version,
      pending.occurrenceVersion + 1,
      'Exactly one winner must terminally advance the concentration occurrence.'
    )
    if (input.checkFirst) {
      assert.ok(
        settled.actors.some((actor) => actor.id === character.actorId),
        'A stale actor removal must not partially remove the concentrating Character.'
      )
      assert.equal(occurrence.state, 'COMPLETED')
      assert.deepEqual(resolveWrites, { events: 1, occurrences: 0, receipts: 1 })
      assert.deepEqual(removeWrites, { events: 0, occurrences: 0, receipts: 0 })
    } else {
      assert.equal(
        settled.actors.some((actor) => actor.id === character.actorId),
        false,
        'The winning removal must leave no concentrating Character actor behind.'
      )
      assert.equal(
        settled.currentActorId,
        fixture.ids.creatureActorId,
        'Removing the target Character must preserve the current Duergar turn.'
      )
      assert.equal(
        occurrence.state,
        'COMPLETED',
        'Removal must terminally supersede the exact pending concentration occurrence.'
      )
      assert.deepEqual(resolveWrites, { events: 0, occurrences: 0, receipts: 0 })
      assert.deepEqual(removeWrites, { events: 1, occurrences: 0, receipts: 1 })
    }
  } finally {
    await fixture.cleanup()
  }
}

/**
 * Every settled case below uses the real Encounter command coordinator. The
 * fixture creates only schema-validated, repository-backed active effect state.
 */
export async function provePhase81EffectDecisionRaces(
  environment: Phase81PostgresEnvironment,
  runId: string
): Promise<readonly Phase81RacePassResult[]> {
  const results: Phase81RacePassResult[] = []

  await withDecisionFixture({
    environment,
    runId,
    run: async (fixture, runtime) => {
      const pending = await startPendingAction({ fixture, runtime })
      const [winner, contender] = await runPhase81CampaignRootRace({
        campaignId: fixture.ids.campaignId,
        connectionFactory: fixture.connectionFactory,
        observer: fixture.db,
        winner: (connection) =>
          resolvePendingAction({ connection, fixture, pending, rawFace: 1, runtime }),
        contender: (connection) =>
          resolvePendingAction({ connection, fixture, pending, rawFace: 20, runtime })
      })
      if (!winner.fulfilled) throw winner.error
      assert.ok(winner.value)
      assert.equal(winner.value.occurrence?.status, 'COMPLETE')
      assertBlockedConflict(contender)
      await assertSingleTerminalOccurrence({ fixture, occurrenceId: pending.occurrenceId })
      results.push(pass('P81-RACE-DECISION-SUPERSEDE-RESOLVE-FIRST', 'FIRST_WINS'))
    }
  })

  await withDecisionFixture({
    environment,
    runId,
    run: async (fixture, runtime) => {
      const pending = await startPendingAction({ fixture, runtime })
      const [winner, contender] = await runPhase81CampaignRootRace({
        campaignId: fixture.ids.campaignId,
        connectionFactory: fixture.connectionFactory,
        observer: fixture.db,
        winner: (connection) =>
          resolvePendingAction({ connection, fixture, pending, rawFace: 20, runtime }),
        contender: (connection) =>
          resolvePendingAction({ connection, fixture, pending, rawFace: 1, runtime })
      })
      if (!winner.fulfilled) throw winner.error
      assert.ok(winner.value)
      assert.equal(winner.value.occurrence?.status, 'PENDING')
      assert.equal(winner.value.occurrence.pending?.kind, 'ACTION_OUTCOME_EVIDENCE')
      assertBlockedConflict(contender)
      const advanced = await fixture.db
        .selectFrom('encounter_rule_occurrences')
        .select(['state', 'version'])
        .where('id', '=', pending.occurrenceId)
        .where('encounter_id', '=', fixture.ids.encounterId)
        .executeTakeFirstOrThrow()
      assert.deepEqual(advanced, { state: 'PENDING', version: 1 })
      results.push(pass('P81-RACE-DECISION-SUPERSEDE-SUPERSEDE-FIRST', 'SECOND_WINS'))
    }
  })

  await withDecisionFixture({
    environment,
    runId,
    run: async (fixture, runtime) => {
      const pending = await startPendingAction({ fixture, runtime })
      const [winner, contender] = await runPhase81CampaignRootRace({
        campaignId: fixture.ids.campaignId,
        connectionFactory: fixture.connectionFactory,
        observer: fixture.db,
        winner: (connection) => resolvePendingAction({ connection, fixture, pending, runtime }),
        contender: (connection) =>
          replaceOptionalCombatRules({
            connection,
            fixture,
            expectedVersion: pending.encounterVersion
          })
      })
      if (!winner.fulfilled) throw winner.error
      assert.ok(winner.value)
      assert.equal(winner.value.occurrence?.status, 'COMPLETE')
      assertBlockedConflict(contender)
      await assertSingleTerminalOccurrence({ fixture, occurrenceId: pending.occurrenceId })
      results.push(pass('P81-RACE-OPTIONAL-DECISION-DECISION-FIRST', 'FIRST_WINS'))
    }
  })

  await withDecisionFixture({
    environment,
    runId,
    run: async (fixture, runtime) => {
      const pending = await startPendingAction({ fixture, runtime })
      const [blockedOverride, decision] = await runPhase81CampaignRootRace({
        campaignId: fixture.ids.campaignId,
        connectionFactory: fixture.connectionFactory,
        observer: fixture.db,
        winner: (connection) =>
          replaceOptionalCombatRules({
            connection,
            fixture,
            expectedVersion: pending.encounterVersion
          }),
        contender: (connection) => resolvePendingAction({ connection, fixture, pending, runtime })
      })
      assertBlockedConflict(blockedOverride)
      if (!decision.fulfilled) throw decision.error
      assert.ok(decision.value)
      assert.equal(decision.value.occurrence?.status, 'COMPLETE')
      await assertSingleTerminalOccurrence({ fixture, occurrenceId: pending.occurrenceId })
      results.push(pass('P81-RACE-OPTIONAL-DECISION-OVERRIDE-FIRST', 'SECOND_WINS'))
    }
  })

  await runEffectRemoveRace({ environment, runId, removeFirst: false })
  results.push(
    createPhase81RacePassResult({
      caseId: 'P81-RACE-EFFECT-REMOVE-TICK-FIRST',
      ordering: 'FIRST_WINS',
      assertions: [
        'A recurring effect advances through the production turn command.',
        'A stale actor removal fails behind the locked Campaign root.',
        'The unexpired effect remains exactly once after the winning tick.'
      ]
    })
  )
  await runEffectRemoveRace({ environment, runId, removeFirst: true })
  results.push(
    createPhase81RacePassResult({
      caseId: 'P81-RACE-EFFECT-REMOVE-REMOVE-FIRST',
      ordering: 'FIRST_WINS',
      assertions: [
        'Actor removal uses the production maintained-effect cleanup lifecycle.',
        'A blocked stale turn command fails closed.',
        'Removal leaves no active effect for the removed actor.'
      ]
    })
  )
  await runConcentrationCleanupRace({ checkFirst: true, environment, runId })
  results.push(
    createPhase81RacePassResult({
      caseId: 'P81-RACE-CONCENTRATION-CLEANUP-CHECK-FIRST',
      ordering: 'FIRST_WINS',
      assertions: [
        'A real Assisted damage action created the concentration occurrence.',
        'The current concentration settlement won the Campaign-root race.',
        'Failed concentration removed the maintained state exactly once.'
      ]
    })
  )
  await runConcentrationCleanupRace({ checkFirst: false, environment, runId })
  results.push(
    createPhase81RacePassResult({
      caseId: 'P81-RACE-CONCENTRATION-CLEANUP-CLEANUP-FIRST',
      ordering: 'FIRST_WINS',
      assertions: [
        'Actor removal used the production maintained-state cleanup path.',
        'The stale concentration resolution failed closed.',
        'Cleanup left no maintained concentration state.'
      ]
    })
  )

  return results
}
