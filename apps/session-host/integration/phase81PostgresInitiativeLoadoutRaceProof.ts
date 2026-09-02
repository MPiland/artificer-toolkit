import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import {
  createEncounterRepository,
  createReusableDefinitionRepository,
  type DBLike
} from '@artificer-toolkit/db'
import { ruleGraphDefinitionDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import { initiativePolicyReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared'
import type { ReusableDefinitionDocumentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'
import { sql } from 'kysely'

import {
  createReusableDefinition,
  publishReusableDefinitionDraft,
  saveReusableDefinitionDraft
} from '../../../packages/functions/src/services/rules/reusableDefinitionAuthoringService.js'
import {
  createPlatformRulesRuntime,
  deriveRulesRuntimeContinuationIntegrityKey
} from '../../../packages/functions/src/services/rules/platformRulesRuntime.js'
import { createReusableDefinitionRuntimeSource } from '../../../packages/functions/src/services/rules/reusableDefinitionService.js'
import { discoverEncounterFeatureActionCapabilities } from '../../../packages/functions/src/services/rules/encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { snapshotCreatureEquipmentLoadout } from '../../../packages/functions/src/services/rules/encounterCreatureEquipmentSources.js'
import { createDnd5eCharacterActionRuntime } from '../../../packages/functions/src/services/rules/systems/dnd5e/characterActionRuntime.js'
import { DND5E_INITIATIVE_FACT_KEYS } from '../../../packages/functions/src/services/rules/systems/dnd5e/initiativeFactAdapter.js'
import { createEncounter } from '../../../packages/functions/src/services/encounter/encounterService.js'
import { lockEncounterActionSceneContext } from '../../../packages/functions/src/services/encounter/encounterActionSceneContext.js'
import { getCampaignPlaySettings } from '../../../packages/functions/src/services/campaign/campaignPlaySettingsService.js'
import { createPhase81PostgresCommittedFixture } from './phase81PostgresCommittedFixture.js'
import {
  createPhase81RacePassResult,
  phase81RaceModuleContracts,
  runPhase81CampaignRootRace,
  type Phase81PostgresEnvironment,
  type Phase81RacePassResult
} from './phase81PostgresRaceSupport.js'

type InitiativeLoadoutCaseId = (typeof phase81RaceModuleContracts.initiativeLoadout.caseIds)[number]
type Fixture = Awaited<ReturnType<typeof createPhase81PostgresCommittedFixture>>
type Runtime = ReturnType<typeof runtimeForFixture>

const SRD_HANDAXE_ID = '00000000-0000-0000-0060-000400000000'
const SRD_SCIMITAR_ID = '00000000-0000-0000-0060-001b00000000'

interface PendingInitiativeSelection {
  occurrenceId: string
  occurrenceVersion: number
  requestId: string
}

interface PublishedDefinition {
  checksum: string
  contentSourceId: string
  id: string
  version: number
}

interface SideInitiativeFixtureDefinitions {
  contentSourceIds: Set<string>
  definitionIds: Set<string>
}

function runtimeForFixture(fixture: Fixture) {
  return createPlatformRulesRuntime({
    continuationIntegrityKey: deriveRulesRuntimeContinuationIntegrityKey(
      `phase81-initiative-loadout:${fixture.ids.encounterId}`
    ),
    definitions: createReusableDefinitionRuntimeSource(
      createReusableDefinitionRepository(fixture.db)
    )
  })
}

async function encounterVersion(db: DBLike, encounterId: string): Promise<number> {
  const row = await db
    .selectFrom('encounters')
    .select('version')
    .where('id', '=', encounterId)
    .executeTakeFirstOrThrow()
  return row.version
}

async function setupSides(input: {
  actorIds: readonly string[]
  encounterId: string
  fixture: Fixture
}): Promise<{ correctedSideId: string; originalSideId: string; selectedActorId: string }> {
  const [selectedActorId, otherActorId] = input.actorIds
  assert.ok(
    selectedActorId && otherActorId,
    'Side Initiative requires two same-side Creature actors.'
  )
  const correctedSideId = randomUUID()
  const repository = createEncounterRepository(input.fixture.db)
  const selected = await input.fixture.db
    .selectFrom('encounter_actors')
    .select('side_id')
    .where('id', '=', selectedActorId)
    .where('encounter_id', '=', input.encounterId)
    .executeTakeFirstOrThrow()
  const originalSideId = selected.side_id
  await repository.createSide({
    id: correctedSideId,
    encounterId: input.encounterId,
    label: 'Phase 8.1 corrected side',
    sortOrder: 2
  })
  const version = await encounterVersion(input.fixture.db, input.encounterId)
  await input.fixture.adapters.executeEncounterCommand(
    input.fixture.db,
    input.fixture.ids.gmUserId,
    {
      type: 'UPDATE_ACTOR',
      encounterId: input.encounterId,
      commandId: randomUUID(),
      expectedVersion: version,
      actorId: otherActorId,
      sideId: originalSideId
    }
  )
  return { correctedSideId, originalSideId, selectedActorId }
}

async function startSelection(input: {
  encounterId: string
  fixture: Fixture
  runtime: Runtime
}): Promise<PendingInitiativeSelection> {
  const version = await encounterVersion(input.fixture.db, input.encounterId)
  await input.fixture.adapters.executeEncounterCommand(
    input.fixture.db,
    input.fixture.ids.gmUserId,
    {
      type: 'START',
      encounterId: input.encounterId,
      commandId: randomUUID(),
      expectedVersion: version,
      systemId: input.fixture.ids.gameSystemId
    },
    { rulesRuntime: input.runtime }
  )
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const row = await input.fixture.db
      .selectFrom('encounter_rule_occurrences')
      .select(['id', 'version', 'pending_snapshot'])
      .where('encounter_id', '=', input.encounterId)
      .where('state', '=', 'PENDING')
      .orderBy('created_at', 'desc')
      .executeTakeFirstOrThrow()
    const snapshot = serverRuleExecutionPendingSnapshotDtoSchema.parse(row.pending_snapshot)
    if (
      snapshot.snapshotKind === 'KERNEL_EVIDENCE' &&
      snapshot.applicationContext.kind === 'ENCOUNTER_INITIATIVE' &&
      snapshot.applicationContext.phase.kind === 'SIDE_ACTOR_ORDER'
    )
      return {
        occurrenceId: row.id,
        occurrenceVersion: row.version,
        requestId: snapshot.request.requestId
      }
    if (
      snapshot.snapshotKind !== 'KERNEL_EVIDENCE' ||
      snapshot.applicationContext.kind !== 'ENCOUNTER_INITIATIVE' ||
      (snapshot.applicationContext.phase.kind !== 'PRIMARY_SCORE' &&
        snapshot.applicationContext.phase.kind !== 'TIE_RESOLUTION')
    )
      throw new Error('START must create a SIDE_ACTOR_ORDER selection request.')
    await input.fixture.adapters.executeEncounterCommand(
      input.fixture.db,
      input.fixture.ids.gmUserId,
      {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: input.encounterId,
        commandId: randomUUID(),
        expectedVersion: await encounterVersion(input.fixture.db, input.encounterId),
        occurrenceId: row.id,
        expectedOccurrenceVersion: row.version,
        correlationId: null,
        resolution: { kind: 'SYSTEM_ROLL', requestId: snapshot.request.requestId }
      },
      { rulesRuntime: input.runtime }
    )
  }
  throw new Error('START did not reach a SIDE_ACTOR_ORDER selection request.')
}

async function resolveSelection(input: {
  db: DBLike
  encounterId: string
  fixture: Fixture
  pending: PendingInitiativeSelection
  runtime: Runtime
  selectedActorId: string
}): Promise<unknown> {
  return input.fixture.adapters.executeEncounterCommand(
    input.db,
    input.fixture.ids.gmUserId,
    {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: input.encounterId,
      commandId: randomUUID(),
      expectedVersion: await encounterVersion(input.db, input.encounterId),
      occurrenceId: input.pending.occurrenceId,
      expectedOccurrenceVersion: input.pending.occurrenceVersion,
      correlationId: null,
      resolution: {
        kind: 'INITIATIVE_ENTITY',
        requestId: input.pending.requestId,
        entityId: input.selectedActorId
      }
    },
    { rulesRuntime: input.runtime }
  )
}

async function assertNoDanglingActorState(fixture: Fixture): Promise<void> {
  const actorId = fixture.ids.creatureActorId
  const encounter = await fixture.db
    .selectFrom('encounters')
    .select('current_actor_id')
    .where('id', '=', fixture.ids.encounterId)
    .executeTakeFirstOrThrow()
  assert.notEqual(encounter.current_actor_id, actorId)
  const participants = await fixture.db
    .selectFrom('encounter_initiative_participants')
    .select(({ fn }) => fn.countAll<string>().as('count'))
    .where('encounter_id', '=', fixture.ids.encounterId)
    .where('actor_id', '=', actorId)
    .executeTakeFirstOrThrow()
  assert.equal(Number(participants.count), 0, 'Initiative retained a removed actor.')
}

async function publishDefinition(input: {
  document: ReusableDefinitionDocumentDto
  family: 'initiative-policy' | 'rules-runtime-graph'
  fixture: Fixture
  label: string
  tracked: SideInitiativeFixtureDefinitions
}): Promise<PublishedDefinition> {
  const workspace = await createReusableDefinition(input.fixture.db, input.fixture.ids.gmUserId, {
    gameSystemId: input.fixture.ids.gameSystemId,
    definitionFamilyKey: input.family,
    label: input.label,
    description: null
  })
  input.tracked.definitionIds.add(workspace.id)
  input.tracked.contentSourceIds.add(workspace.contentSourceId)
  const saved = await saveReusableDefinitionDraft(input.fixture.db, input.fixture.ids.gmUserId, {
    definitionId: workspace.id,
    expectedDefinitionVersion: workspace.version,
    expectedDraftVersion: null,
    document: { ...input.document, id: workspace.id }
  })
  assert.ok(saved.draft)
  const published = await publishReusableDefinitionDraft(
    input.fixture.db,
    input.fixture.ids.gmUserId,
    {
      definitionId: workspace.id,
      expectedDefinitionVersion: saved.version,
      expectedDraftVersion: saved.draft.version
    }
  )
  assert.ok(published.current)
  return {
    checksum: published.current.checksum,
    contentSourceId: published.contentSourceId,
    id: published.id,
    version: published.current.version
  }
}

async function configureSideInitiative(
  fixture: Fixture,
  tracked: SideInitiativeFixtureDefinitions
): Promise<void> {
  const scoreGraph = ruleGraphDefinitionDtoSchema.parse({
    schemaVersion: 1,
    id: randomUUID(),
    gameSystemId: fixture.ids.gameSystemId,
    definitionFamilyKey: 'rules-runtime-graph',
    nodes: [
      {
        id: 'd20',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 20 } }
      },
      {
        id: 'score',
        operation: { key: 'number.add', contractVersion: 1 },
        inputs: {
          left: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' },
          right: { kind: 'FACT', factKey: DND5E_INITIATIVE_FACT_KEYS.modifier }
        }
      }
    ],
    outputs: {
      automatic: { kind: 'LITERAL', value: true },
      score: { kind: 'NODE_OUTPUT', nodeId: 'score', port: 'value' }
    }
  })
  const orderGraph = ruleGraphDefinitionDtoSchema.parse({
    schemaVersion: 1,
    id: randomUUID(),
    gameSystemId: fixture.ids.gameSystemId,
    definitionFamilyKey: 'rules-runtime-graph',
    nodes: [
      {
        id: 'selected-index',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: {
          min: { kind: 'FACT', factKey: DND5E_INITIATIVE_FACT_KEYS.orderChoiceMinimumIndex },
          max: { kind: 'FACT', factKey: DND5E_INITIATIVE_FACT_KEYS.orderChoiceMaximumIndex }
        }
      }
    ],
    outputs: { selectedIndex: { kind: 'NODE_OUTPUT', nodeId: 'selected-index', port: 'value' } }
  })
  const evaluation = await publishDefinition({
    document: scoreGraph,
    family: 'rules-runtime-graph',
    fixture,
    label: 'Phase 8.1 side initiative evaluation',
    tracked
  })
  const tie = await publishDefinition({
    document: scoreGraph,
    family: 'rules-runtime-graph',
    fixture,
    label: 'Phase 8.1 side initiative tie',
    tracked
  })
  const order = await publishDefinition({
    document: orderGraph,
    family: 'rules-runtime-graph',
    fixture,
    label: 'Phase 8.1 side initiative order',
    tracked
  })
  const policy = await publishDefinition({
    document: initiativePolicyReusableDefinitionDocumentDtoSchema.parse({
      schemaVersion: 1,
      kind: 'INITIATIVE_POLICY',
      id: randomUUID(),
      gameSystemId: fixture.ids.gameSystemId,
      procedure: 'SIDE_ROLL',
      cadence: 'ENCOUNTER_START',
      evaluationGraph: {
        definitionId: evaluation.id,
        definitionVersion: evaluation.version,
        definitionChecksum: evaluation.checksum,
        scoreOutput: 'score',
        sortDirection: 'DESCENDING',
        automaticOutput: 'automatic'
      },
      orderChoiceGraph: {
        definitionId: order.id,
        definitionVersion: order.version,
        definitionChecksum: order.checksum,
        selectionOutput: 'selectedIndex',
        minimumIndexFact: DND5E_INITIATIVE_FACT_KEYS.orderChoiceMinimumIndex,
        maximumIndexFact: DND5E_INITIATIVE_FACT_KEYS.orderChoiceMaximumIndex
      },
      tieResolvers: [
        {
          definitionId: tie.id,
          definitionVersion: tie.version,
          definitionChecksum: tie.checksum,
          scoreOutput: 'score',
          sortDirection: 'DESCENDING',
          automaticOutput: 'automatic',
          repeatOnTie: true,
          maximumAttempts: 20
        }
      ],
      defaultTieResolverDefinitionId: tie.id
    }),
    family: 'initiative-policy',
    fixture,
    label: 'Phase 8.1 Side Initiative',
    tracked
  })
  const catalogue = await fixture.db
    .selectFrom('campaigns')
    .select('primary_rules_catalogue_id')
    .where('id', '=', fixture.ids.campaignId)
    .executeTakeFirstOrThrow()
  for (const contentSourceId of new Set([
    evaluation.contentSourceId,
    tie.contentSourceId,
    order.contentSourceId,
    policy.contentSourceId
  ])) {
    await sql`
      insert into public.rules_catalogue_content_sources (catalogue_id, content_source_id, game_system_id)
      values (${catalogue.primary_rules_catalogue_id}::uuid, ${contentSourceId}::uuid, ${fixture.ids.gameSystemId}::uuid)
      on conflict do nothing
    `.execute(fixture.db)
  }
  const settings = await getCampaignPlaySettings(
    fixture.db,
    fixture.ids.gmUserId,
    fixture.ids.campaignId
  )
  const { updatedAt: _updatedAt, version, ...currentSettings } = settings
  await fixture.adapters.saveCampaignPlaySettings(fixture.db, fixture.ids.gmUserId, {
    ...currentSettings,
    initiativePolicyDefinitionId: policy.id,
    initiativeTieDefinitionId: tie.id,
    expectedVersion: version
  })
}

async function cleanupSideInitiativeDefinitions(
  fixture: Fixture,
  tracked: SideInitiativeFixtureDefinitions
): Promise<void> {
  const settings = await getCampaignPlaySettings(
    fixture.db,
    fixture.ids.gmUserId,
    fixture.ids.campaignId
  )
  if (
    [...tracked.definitionIds].includes(settings.initiativePolicyDefinitionId ?? '') ||
    [...tracked.definitionIds].includes(settings.initiativeTieDefinitionId ?? '')
  ) {
    const { updatedAt: _updatedAt, version, ...currentSettings } = settings
    await fixture.adapters.saveCampaignPlaySettings(fixture.db, fixture.ids.gmUserId, {
      ...currentSettings,
      initiativePolicyDefinitionId: null,
      initiativeTieDefinitionId: null,
      expectedVersion: version
    })
  }
  for (const definitionId of tracked.definitionIds) {
    await sql`
      delete from public.reusable_definitions
      where id = ${definitionId}::uuid
    `.execute(fixture.db)
  }
  for (const contentSourceId of tracked.contentSourceIds) {
    await sql`
      delete from public.rules_catalogue_content_sources
      where content_source_id = ${contentSourceId}::uuid
    `.execute(fixture.db)
    await sql`
      delete from public.content_sources
      where id = ${contentSourceId}::uuid
    `.execute(fixture.db)
  }
  const definitions = await sql<{ count: string }>`
    select count(*)::text as count
    from public.reusable_definitions
    where id = any(${[...tracked.definitionIds]}::uuid[])
  `.execute(fixture.db)
  const sources = await sql<{ count: string }>`
    select count(*)::text as count
    from public.content_sources
    where id = any(${[...tracked.contentSourceIds]}::uuid[])
  `.execute(fixture.db)
  assert.equal(Number(definitions.rows[0]?.count ?? '0'), 0)
  assert.equal(Number(sources.rows[0]?.count ?? '0'), 0)
}

async function createSideInitiativeEncounter(fixture: Fixture): Promise<readonly string[]> {
  // The committed fixture's initial Encounter predates its user-authored policy.
  // It is disposable setup only; the race itself starts from the production-created
  // Encounter below, which pins the configured Side Initiative policy.
  await fixture.db.deleteFrom('encounters').where('id', '=', fixture.ids.encounterId).execute()
  const created = await createEncounter(fixture.db, fixture.ids.gmUserId, {
    campaignId: fixture.ids.campaignId,
    sessionId: fixture.ids.sessionId,
    blueprintId: fixture.ids.encounterBlueprintId,
    commandId: randomUUID()
  })
  fixture.ids.encounterId = created.id
  const actorIds = created.actors
    .filter(
      (actor) => actor.kind === 'CREATURE' && actor.sourceId === fixture.ids.creatureDefinitionId
    )
    .map((actor) => actor.id)
  assert.equal(actorIds.length, 2, 'Side Initiative Encounter must retain two Creature actors.')
  fixture.ids.creatureActorId = actorIds[0]!
  fixture.ids.creatureActorIds = actorIds
  return actorIds
}

async function loadoutFacts(
  fixture: Fixture
): Promise<{ equipmentId: string; loadoutEntryId: string; replacementEquipmentId: string }> {
  const actor = await fixture.db
    .selectFrom('encounter_actors')
    .select('snapshot')
    .where('id', '=', fixture.ids.creatureActorId)
    .executeTakeFirstOrThrow()
  const snapshot = actor.snapshot as Record<string, unknown>
  const payload = snapshot.payload as Record<string, unknown> | undefined
  const loadout = payload?.equipmentLoadout
  assert.ok(
    Array.isArray(loadout) && loadout.length > 0,
    'Seeded Goblin must retain a pinned loadout.'
  )
  const entry = loadout.find(
    (candidate) => (candidate as Record<string, unknown>).equipmentId === SRD_SCIMITAR_ID
  ) as Record<string, unknown> | undefined
  if (typeof entry?.id !== 'string' || typeof entry.equipmentId !== 'string')
    throw new Error('Seeded Goblin loadout must use UUID-backed equipment identities.')
  return {
    loadoutEntryId: entry.id,
    equipmentId: entry.equipmentId,
    replacementEquipmentId: SRD_HANDAXE_ID
  }
}

async function runInitiativeRace(input: {
  environment: Phase81PostgresEnvironment
  runId: string
  correctionFirst: boolean
  remove: boolean
}): Promise<void> {
  const fixture = await createPhase81PostgresCommittedFixture(
    input.environment,
    `${input.runId}-${randomUUID()}`,
    { creatureCount: 2 }
  )
  const definitions: SideInitiativeFixtureDefinitions = {
    contentSourceIds: new Set(),
    definitionIds: new Set()
  }
  const runtime = runtimeForFixture(fixture)
  const executeRace = async (): Promise<void> => {
    await configureSideInitiative(fixture, definitions)
    const actorIds = await createSideInitiativeEncounter(fixture)
    const { correctedSideId, originalSideId, selectedActorId } = await setupSides({
      actorIds,
      encounterId: fixture.ids.encounterId,
      fixture
    })
    const pending = await startSelection({
      encounterId: fixture.ids.encounterId,
      fixture,
      runtime
    })
    const versionBeforeRace = await encounterVersion(fixture.db, fixture.ids.encounterId)
    const update = async (db: DBLike) =>
      fixture.adapters.executeEncounterCommand(db, fixture.ids.gmUserId, {
        type: input.remove ? 'REMOVE_ACTOR' : 'UPDATE_ACTOR',
        encounterId: fixture.ids.encounterId,
        commandId: randomUUID(),
        expectedVersion: await encounterVersion(db, fixture.ids.encounterId),
        actorId: selectedActorId,
        ...(input.remove ? {} : { sideId: correctedSideId })
      })
    const [winner, contender] = await runPhase81CampaignRootRace({
      campaignId: fixture.ids.campaignId,
      connectionFactory: fixture.connectionFactory,
      observer: fixture.db,
      winner: input.correctionFirst
        ? update
        : (db) =>
            resolveSelection({
              db,
              encounterId: fixture.ids.encounterId,
              fixture,
              pending,
              runtime,
              selectedActorId
            }),
      contender: input.correctionFirst
        ? (db) =>
            resolveSelection({
              db,
              encounterId: fixture.ids.encounterId,
              fixture,
              pending,
              runtime,
              selectedActorId
            })
        : update
    })
    assert.equal(
      winner.fulfilled,
      true,
      `The lock-owning production command must settle: ${
        winner.error instanceof Error ? winner.error.message : String(winner.error)
      }`
    )
    assert.equal(
      contender.fulfilled,
      false,
      'The blocked stale production command must fail closed.'
    )
    const selection = await fixture.repositories.occurrences.lockOccurrence(
      'ENCOUNTER',
      fixture.ids.encounterId,
      pending.occurrenceId
    )
    assert.ok(selection)
    if (!input.correctionFirst) {
      assert.equal(selection.state, 'COMPLETED', 'The selected actor must settle Side Initiative.')
      const [actor, encounter, participants] = await Promise.all([
        fixture.db
          .selectFrom('encounter_actors')
          .select('side_id')
          .where('id', '=', selectedActorId)
          .where('encounter_id', '=', fixture.ids.encounterId)
          .executeTakeFirstOrThrow(),
        fixture.db
          .selectFrom('encounters')
          .select(['current_actor_id', 'version'])
          .where('id', '=', fixture.ids.encounterId)
          .executeTakeFirstOrThrow(),
        fixture.db
          .selectFrom('encounter_initiative_participants')
          .select(['actor_id', 'status', 'turn_order_ordinal'])
          .where('encounter_id', '=', fixture.ids.encounterId)
          .where('round', '=', 1)
          .orderBy('actor_id', 'asc')
          .execute()
      ])
      assert.equal(actor.side_id, originalSideId)
      assert.equal(encounter.current_actor_id, selectedActorId)
      assert.equal(encounter.version, versionBeforeRace + 1)
      const active = participants.filter((participant) => participant.status === 'ACTIVE')
      assert.deepEqual(active, [
        { actor_id: selectedActorId, status: 'ACTIVE', turn_order_ordinal: 0 }
      ])
      assert.ok(
        participants
          .filter((participant) => participant.actor_id !== selectedActorId)
          .every((participant) => participant.status !== 'ACTIVE')
      )
      return
    }
    if (input.remove)
      assert.equal(
        selection.state,
        'COMPLETED',
        'Actor removal must close the obsolete Side Initiative selection.'
      )
    else
      assert.notEqual(
        selection.state,
        'COMPLETED',
        'An allegiance correction must preserve the current-round Side Initiative selection.'
      )
    const encounter = await fixture.db
      .selectFrom('encounters')
      .select(['current_actor_id', 'version'])
      .where('id', '=', fixture.ids.encounterId)
      .executeTakeFirstOrThrow()
    assert.equal(encounter.current_actor_id, null)
    assert.equal(encounter.version, versionBeforeRace + 1)
    if (input.remove) {
      await assertNoDanglingActorState(fixture)
      return
    }
    const actor = await fixture.db
      .selectFrom('encounter_actors')
      .select('side_id')
      .where('id', '=', selectedActorId)
      .where('encounter_id', '=', fixture.ids.encounterId)
      .executeTakeFirstOrThrow()
    const snapshot = serverRuleExecutionPendingSnapshotDtoSchema.parse(selection.pendingSnapshot)
    assert.equal(snapshot.snapshotKind, 'KERNEL_EVIDENCE')
    assert.equal(snapshot.applicationContext.kind, 'ENCOUNTER_INITIATIVE')
    const participant =
      snapshot.applicationContext.kind === 'ENCOUNTER_INITIATIVE'
        ? snapshot.applicationContext.root.stagedInitiativeRoundState.participants.find(
            (candidate) => candidate.actorId === selectedActorId
          )
        : undefined
    assert.ok(participant)
    assert.equal(actor.side_id, correctedSideId)
    assert.notEqual(actor.side_id, originalSideId)
    assert.equal(participant.sideId, originalSideId)
    assert.notEqual(participant.status, 'ACTIVE')
    assert.equal(participant.turnOrderOrdinal, null)
  }

  const errors: unknown[] = []
  try {
    await executeRace()
  } catch (error) {
    errors.push(error)
  }
  try {
    await cleanupSideInitiativeDefinitions(fixture, definitions)
  } catch (error) {
    errors.push(error)
  }
  try {
    await fixture.cleanup()
  } catch (error) {
    errors.push(error)
  }
  if (errors.length === 1) throw errors[0]
  if (errors.length > 1)
    throw new AggregateError(errors, 'Side Initiative race and fixture cleanup failed.')
}

async function runLoadoutRace(input: {
  environment: Phase81PostgresEnvironment
  runId: string
  replaceFirst: boolean
}): Promise<void> {
  const fixture = await createPhase81PostgresCommittedFixture(
    input.environment,
    `${input.runId}-${randomUUID()}`,
    { preCreatePlaySettings: { automationMode: 'AUTOMATIC' } }
  )
  try {
    const character = await fixture.ensureCharacter()
    const scene = await fixture.ensureScene()
    const loadout = await loadoutFacts(fixture)
    const encounter = await createEncounterRepository(fixture.db).find(fixture.ids.encounterId)
    assert.ok(encounter)
    const creature = encounter.actors.find((actor) => actor.id === fixture.ids.creatureActorId)
    assert.ok(creature && creature.kind === 'CREATURE')
    const capability = discoverEncounterFeatureActionCapabilities({ actor: creature }).find(
      (candidate) =>
        candidate.equipmentBinding?.loadoutEntryId === loadout.loadoutEntryId &&
        candidate.equipmentBinding.equipmentId === loadout.equipmentId
    )
    assert.ok(capability, 'The seeded Creature loadout must expose an exact executable action.')
    const advanced = await fixture.adapters.executeEncounterCommand(
      fixture.db,
      fixture.ids.gmUserId,
      {
        type: 'ADVANCE_TURN',
        encounterId: fixture.ids.encounterId,
        commandId: randomUUID(),
        expectedVersion: encounter.version
      },
      { rulesRuntime: runtimeForFixture(fixture) }
    )
    assert.equal(advanced.projection.currentActorId, creature.id)
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
    assert.ok(sceneContext, 'The committed fixture must provide the loadout action Scene context.')
    const initialVersion = await encounterVersion(fixture.db, fixture.ids.encounterId)
    const actionCommandId = randomUUID()
    const replacementCommandId = randomUUID()
    const replace = async (
      db: DBLike,
      expectedVersion = initialVersion,
      commandId = replacementCommandId
    ) =>
      fixture.adapters.executeEncounterCommand(db, fixture.ids.gmUserId, {
        type: 'REPLACE_CREATURE_EQUIPMENT',
        encounterId: fixture.ids.encounterId,
        commandId,
        expectedVersion,
        actorId: fixture.ids.creatureActorId,
        equipmentId: loadout.replacementEquipmentId,
        loadoutEntryId: loadout.loadoutEntryId
      })
    const action = async (db: DBLike) =>
      fixture.adapters.executeEncounterActorDirectRuleAction({
        db,
        runtime: createDnd5eCharacterActionRuntime({
          continuationIntegrityKey: new Uint8Array(32).fill(81),
          definitions: {
            async requireCurrent() {
              throw new Error('A pinned Creature action must not reload a definition.')
            }
          }
        }),
        rollD20: () => 20,
        command: {
          actionId: capability.actionId,
          actorId: fixture.ids.creatureActorId,
          actorUserId: fixture.ids.gmUserId,
          commandId: actionCommandId,
          correlationId: null,
          encounterId: fixture.ids.encounterId,
          expectedEncounterVersion: initialVersion,
          sceneContext,
          targetActorId: character.actorId
        }
      })
    const [winner, contender] = await runPhase81CampaignRootRace({
      campaignId: fixture.ids.campaignId,
      connectionFactory: fixture.connectionFactory,
      observer: fixture.db,
      winner: (db): Promise<unknown> => (input.replaceFirst ? replace(db) : action(db)),
      contender: (db): Promise<unknown> => (input.replaceFirst ? action(db) : replace(db))
    })
    const actionOccurrences = await fixture.db
      .selectFrom('encounter_rule_occurrences')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .where('encounter_id', '=', fixture.ids.encounterId)
      .where('root_command_id', '=', actionCommandId)
      .executeTakeFirstOrThrow()
    if (input.replaceFirst) {
      assert.equal(
        winner.fulfilled,
        true,
        winner.error instanceof Error ? winner.error.message : String(winner.error)
      )
      assert.equal(contender.fulfilled, false)
      assert.equal(Number(actionOccurrences.count), 0, 'Stale action must not create a receipt.')
    } else {
      assert.equal(
        winner.fulfilled,
        true,
        winner.error instanceof Error ? winner.error.message : String(winner.error)
      )
      assert.equal(contender.fulfilled, false)
      assert.equal(Number(actionOccurrences.count), 1, 'Action must settle exactly once.')
      await replace(
        fixture.db,
        await encounterVersion(fixture.db, fixture.ids.encounterId),
        randomUUID()
      )
      const afterRetry = await fixture.db
        .selectFrom('encounter_rule_occurrences')
        .select(({ fn }) => fn.countAll<string>().as('count'))
        .where('encounter_id', '=', fixture.ids.encounterId)
        .where('root_command_id', '=', actionCommandId)
        .executeTakeFirstOrThrow()
      assert.equal(Number(afterRetry.count), 1, 'Prospective replacement must not alter receipt.')
    }
    const replacedEncounter = await createEncounterRepository(fixture.db).find(
      fixture.ids.encounterId
    )
    const replacedActor = replacedEncounter?.actors.find(
      (candidate) => candidate.id === fixture.ids.creatureActorId
    )
    assert.ok(replacedActor?.kind === 'CREATURE')
    const replacedLoadout = snapshotCreatureEquipmentLoadout(replacedActor)
    const replacedEntry = replacedLoadout.find(
      (candidate) => candidate.id === loadout.loadoutEntryId
    )
    assert.equal(replacedEntry?.equipmentId, loadout.replacementEquipmentId)
    assert.notEqual(replacedEntry?.equipmentId, loadout.equipmentId)
  } finally {
    await fixture.cleanup()
  }
}

export async function provePhase81InitiativeLoadoutRaces(input: {
  environment: Phase81PostgresEnvironment
  runId: string
}): Promise<readonly Phase81RacePassResult<InitiativeLoadoutCaseId>[]> {
  assert.deepEqual(phase81RaceModuleContracts.initiativeLoadout.caseIds, [
    'P81-RACE-INITIATIVE-ALLEGIANCE-ALLEGIANCE-FIRST',
    'P81-RACE-INITIATIVE-ALLEGIANCE-SELECT-FIRST',
    'P81-RACE-INITIATIVE-REMOVE-REMOVE-FIRST',
    'P81-RACE-INITIATIVE-REMOVE-SELECT-FIRST',
    'P81-RACE-LOADOUT-ACTION-ACTION-FIRST',
    'P81-RACE-LOADOUT-ACTION-REPLACE-FIRST'
  ])
  await runInitiativeRace({ ...input, correctionFirst: true, remove: false })
  await runInitiativeRace({ ...input, correctionFirst: false, remove: false })
  await runInitiativeRace({ ...input, correctionFirst: true, remove: true })
  await runInitiativeRace({ ...input, correctionFirst: false, remove: true })
  await runLoadoutRace({ ...input, replaceFirst: false })
  await runLoadoutRace({ ...input, replaceFirst: true })
  const rows = [
    ['P81-RACE-INITIATIVE-ALLEGIANCE-ALLEGIANCE-FIRST', 'FIRST_WINS'],
    ['P81-RACE-INITIATIVE-ALLEGIANCE-SELECT-FIRST', 'SECOND_WINS'],
    ['P81-RACE-INITIATIVE-REMOVE-REMOVE-FIRST', 'FIRST_WINS'],
    ['P81-RACE-INITIATIVE-REMOVE-SELECT-FIRST', 'SECOND_WINS'],
    ['P81-RACE-LOADOUT-ACTION-ACTION-FIRST', 'SECOND_WINS'],
    ['P81-RACE-LOADOUT-ACTION-REPLACE-FIRST', 'FIRST_WINS']
  ] as const
  return rows.map(([caseId, ordering]) =>
    createPhase81RacePassResult({
      caseId,
      ordering,
      assertions: [
        'Independent PostgreSQL transactions used production Encounter commands.',
        'One root transition committed.',
        'Fixture cascade cleanup is asserted.'
      ]
    })
  )
}
