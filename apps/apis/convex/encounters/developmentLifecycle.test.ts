import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type {
  EncounterExecuteInput,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  SceneGeometryBeginResult,
  SceneGeometryCommandResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/reactionEligibilityPolicy'
import type {
  BindEncounterToPresentedSceneInputDto,
  EncounterActorTokenBindingCommandInputDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { api, components, internal } from '../_generated/api'
import { createEncounterSceneFixture } from '../../tests/fixtures/encounterScene'
import { setupCreatureReactionRun } from '../../tests/fixtures/movementReaction'
import { setupReactionMovementScene } from '../../tests/fixtures/automaticSceneMovement'
import { createCutoverWorkloadCreature } from '../../tests/fixtures/encounterAction'
import { importedSubject } from '../../tests/fixtures/publication'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: (sides: number) => (sides === 20 ? 13 : 0) }))

type RollbackTarget = { ownerUserId: string; campaignId: string; encounterId: string }
type RollbackOperation =
  | { kind: 'COMMAND'; input: EncounterExecuteInput }
  | { kind: 'SCENE_BINDING'; input: BindEncounterToPresentedSceneInputDto }
  | { kind: 'TOKEN_BINDING'; input: EncounterActorTokenBindingCommandInputDto }
type RollbackInput = RollbackTarget & { operation: RollbackOperation }

const inspect = makeFunctionReference<'query', RollbackTarget, string>(
  'encounters/developmentLifecycle:inspect'
)
const verifyRollback = makeFunctionReference<'action', RollbackInput, { rolledBack: true }>(
  'encounters/developmentLifecycle:verifyRollback'
)
const bindScene = makeFunctionReference<'mutation', BindEncounterToPresentedSceneInputDto, unknown>(
  'encounters/sceneBindings:bind'
)
const executeCommand = makeFunctionReference<'mutation', EncounterExecuteInput, unknown>(
  'encounters/commands:execute'
)
const movementReactionDamage = makeFunctionReference<
  'query',
  { campaignId: string; encounterId: string; rootCommandId: string; terminalCommandId: string },
  {
    occurrenceId: string
    sourceActorId: string
    targetActorId: string
    resultPath: string
    requestedAmounts: number[]
    appliedAmount: number
    beforeHitPoints: number
    afterHitPoints: number
  }
>('encounters/developmentLifecycle:movementReactionDamage')
type MovementRequest = ReturnType<typeof sceneSpatialPrepareInputSchema.parse>
const prepareMovement = makeFunctionReference<'mutation', MovementRequest, SceneSpatialPreparation>(
  'scenes/spatialPreparation:prepare'
)
const finishMovement = makeFunctionReference<
  'mutation',
  MovementRequest,
  SceneGeometryCommandResult
>('scenes/geometryCommands:finish')
const beginMovementResponse = makeFunctionReference<
  'mutation',
  ResolveRuleOccurrenceInputDto,
  SceneGeometryBeginResult | null
>('scenes/movementResolutionStaging:begin')
const observeMovement = makeFunctionReference<
  'mutation',
  { saveId: string; characterRevisions: [] },
  { saveId: string }
>('scenes/geometryStaging:observe')

async function setup() {
  const base = await createEncounterSceneFixture()
  await base.t.run(async (ctx) => {
    for (const [index, userId] of [base.other.userId, base.owner.userId].entries()) {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Missing fixture profile.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email: `draft_123456abcde${index}@example.invalid` }
        }
      })
    }
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
    if (!campaign) throw new Error('Missing fixture Campaign.')
    await ctx.db.patch(campaign._id, { name: 'Encounter execution fixture' })
  })
  return {
    ...base,
    target: {
      ownerUserId: base.other.userId,
      campaignId: base.campaign.id,
      encounterId: base.run.id
    }
  }
}

async function read(base: Awaited<ReturnType<typeof setup>>) {
  return base.other.caller.run((ctx) => ctx.runQuery(inspect, base.target))
}

async function verify(base: Awaited<ReturnType<typeof setup>>, operation: RollbackOperation) {
  return base.other.caller.action(verifyRollback, { ...base.target, operation })
}

function commandOperation(base: Awaited<ReturnType<typeof setup>>): RollbackOperation {
  const actor = base.run.actors[0]
  if (!actor) throw new Error('Missing fixture actor.')
  return {
    kind: 'COMMAND',
    input: {
      command: {
        type: 'SET_INITIATIVE',
        commandId: crypto.randomUUID(),
        encounterId: base.run.id,
        expectedVersion: base.run.version,
        actorId: actor.id,
        initiative: 20,
        manualOrder: 0
      }
    }
  }
}

describe('development lifecycle rollback proof', () => {
  it('rolls back a real Encounter command and preserves every inspected row', async () => {
    const base = await setup()
    const before = await read(base)
    await expect(verify(base, commandOperation(base))).resolves.toEqual({ rolledBack: true })
    expect(await read(base)).toBe(before)
  }, 30_000)

  it('rolls back a real Scene binding and preserves every inspected row', async () => {
    const base = await setup()
    const before = await read(base)
    await expect(
      verify(base, {
        kind: 'SCENE_BINDING',
        input: {
          type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
          commandId: crypto.randomUUID(),
          encounterId: base.run.id
        }
      })
    ).resolves.toEqual({ rolledBack: true })
    expect(await read(base)).toBe(before)
  }, 30_000)

  it('rolls back a real actor-token binding and preserves every inspected row', async () => {
    const base = await setup()
    await base.other.caller.mutation(bindScene, {
      type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
      commandId: crypto.randomUUID(),
      encounterId: base.run.id
    })
    const actor = base.run.actors[0]
    const token = base.tokens[0]
    if (!actor || !token) throw new Error('Missing fixture actor or token.')
    const before = await read(base)
    await expect(
      verify(base, {
        kind: 'TOKEN_BINDING',
        input: {
          type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
          commandId: crypto.randomUUID(),
          encounterId: base.run.id,
          actorId: actor.id,
          sceneId: base.sceneId,
          tokenId: token.id,
          expectedEncounterVersion: base.run.version
        }
      })
    ).resolves.toEqual({ rolledBack: true })
    expect(await read(base)).toBe(before)
  }, 30_000)

  it('rejects anonymous, player, and nonfixture callers', async () => {
    const base = await setup()
    const input: RollbackInput = { ...base.target, operation: commandOperation(base) }
    await expect(base.t.action(verifyRollback, input)).rejects.toThrow('Unauthenticated')
    await expect(base.owner.caller.action(verifyRollback, input)).rejects.toThrow(
      'Fixture owner does not match the caller.'
    )
    await base.t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
        .unique()
      if (!profile) throw new Error('Missing fixture profile.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email: 'owner@example.invalid' }
        }
      })
    })
    await expect(verify(base, commandOperation(base))).rejects.toThrow(
      'Fixture account is required.'
    )
  }, 30_000)

  it('rejects an origin outside personal development without writes', async () => {
    const base = await setup()
    const before = await read(base)
    const originalOrigin = process.env.SITE_URL
    try {
      process.env.SITE_URL = 'https://example.com'
      await expect(verify(base, commandOperation(base))).rejects.toThrow(
        'Fixture cleanup requires the development application origin.'
      )
    } finally {
      if (originalOrigin === undefined) delete process.env.SITE_URL
      else process.env.SITE_URL = originalOrigin
    }
    expect(await read(base)).toBe(before)
  }, 30_000)

  it('refuses a replay no-op and an operation targeting another Run without writes', async () => {
    const base = await setup()
    const operation = commandOperation(base)
    if (operation.kind !== 'COMMAND') throw new Error('Expected command operation.')
    await base.other.caller.mutation(executeCommand, operation.input)
    const replayBefore = await read(base)
    await expect(verify(base, operation)).rejects.toThrow(
      'Fixture lifecycle operation did not change persisted state.'
    )
    expect(await read(base)).toBe(replayBefore)

    const mismatched: RollbackOperation = {
      kind: 'SCENE_BINDING',
      input: {
        type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
        commandId: crypto.randomUUID(),
        encounterId: crypto.randomUUID()
      }
    }
    const mismatchBefore = await read(base)
    await expect(verify(base, mismatched)).rejects.toThrow(
      'Fixture lifecycle operation targets another Encounter Run.'
    )
    expect(await read(base)).toBe(mismatchBefore)
  }, 30_000)

  it('refuses a snapshot that exceeds its bounded actor read', async () => {
    const base = await setup()
    await base.t.run(async (ctx) => {
      const actors = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id))
        .take(2)
      const actor = actors[0]
      if (!actor) throw new Error('Missing fixture actor.')
      const { _id, _creationTime, ...stored } = actor
      for (let index = 0; index < 10; index++)
        await ctx.db.insert('encounterRunActors', { ...stored, id: crypto.randomUUID() })
    })
    await expect(read(base)).rejects.toThrow('Fixture lifecycle inspection exceeds its bounds.')
  }, 30_000)
})

it('reads one completed movement reaction from authenticated, matching Scene receipts', async () => {
  const fixture = await setupCreatureReactionRun()
  const creature = creatureAuthoredDtoSchema.parse({
    ...createCutoverWorkloadCreature(DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID),
    id: crypto.randomUUID()
  })
  await fixture.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ ...creature, subjectKind: 'CREATURE', document: creature })]
  })
  const blueprint = await fixture.owner.caller.mutation(api.encounters.blueprints.create, {
    gameSystemId: fixture.campaign.gameSystemId,
    name: 'V15 movement receipt proof',
    commandId: crypto.randomUUID(),
    enemies: [
      { kind: 'CREATURE', sourceId: creature.id },
      { kind: 'CREATURE', sourceId: creature.id }
    ]
  })
  const run = encounterGmProjectionDtoSchema.parse(
    await fixture.owner.caller.mutation(api.encounters.runs.create, {
      campaignId: fixture.campaign.id,
      blueprintId: blueprint.id,
      commandId: crypto.randomUUID()
    })
  )
  const [reactor, mover] = run.actors
  if (!reactor || !mover) throw new Error('Missing V15 movement actors.')
  await fixture.t.run(async (ctx) => {
    // A Campaign has one ACTIVE Run, so retire the fixture Run before activating this proof Run.
    const fixtureRunRow = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', fixture.run.id))
      .unique()
    if (!fixtureRunRow) throw new Error('Missing fixture Run.')
    const completed = encounterRunStateSchema.parse({
      ...JSON.parse(fixtureRunRow.stateJson),
      status: 'COMPLETED'
    })
    const completedProjection = encounterGmProjectionDtoSchema.parse({
      ...JSON.parse(fixtureRunRow.projectionJson),
      status: 'COMPLETED'
    })
    await ctx.db.patch(fixtureRunRow._id, {
      status: 'COMPLETED',
      stateJson: JSON.stringify(completed),
      stateChecksum: checksumCanonicalJson(completed),
      projectionJson: JSON.stringify(completedProjection),
      projectionChecksum: checksumCanonicalJson(completedProjection)
    })
    const runRow = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', run.id))
      .unique()
    const reactorRow = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', reactor.id))
      .unique()
    if (!runRow || !reactorRow) throw new Error('Missing V15 movement rows.')
    const state = encounterRunStateSchema.parse(JSON.parse(runRow.stateJson))
    const party = state.sides.find((side) => side.label === 'Party')
    if (!party) throw new Error('Missing V15 Party side.')
    const active = encounterRunStateSchema.parse({
      ...state,
      status: 'ACTIVE',
      automationMode: 'ASSISTED',
      round: 1,
      currentActorId: reactor.id
    })
    const projection = encounterGmProjectionDtoSchema.parse({
      ...JSON.parse(runRow.projectionJson),
      status: 'ACTIVE'
    })
    const reactorState = encounterRunActorStateSchema.parse({
      ...JSON.parse(reactorRow.stateJson),
      sideId: party.id
    })
    await ctx.db.patch(runRow._id, {
      status: 'ACTIVE',
      stateJson: JSON.stringify(active),
      stateChecksum: checksumCanonicalJson(active),
      projectionJson: JSON.stringify(projection),
      projectionChecksum: checksumCanonicalJson(projection)
    })
    await ctx.db.patch(reactorRow._id, {
      stateJson: JSON.stringify(reactorState),
      stateChecksum: checksumCanonicalJson(reactorState)
    })
  })
  const base = { ...fixture, run, reactor, mover }
  const scene = await setupReactionMovementScene(base, [base.reactor, base.mover], [50])
  await base.t.run(async (ctx) => {
    for (const [index, userId] of [base.owner.userId, base.other.userId].entries()) {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Missing movement fixture profile.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email: `draft_123456abcde${index}@example.invalid` }
        }
      })
    }
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
    if (!campaign) throw new Error('Missing movement fixture Campaign.')
    await ctx.db.patch(campaign._id, { name: 'Encounter execution fixture' })
  })

  await scene.owner.caller.mutation(observeMovement, {
    saveId: scene.saveId,
    characterRevisions: []
  })
  await scene.owner.caller.mutation(prepareMovement, scene.request)
  const root = await scene.owner.caller.mutation(finishMovement, scene.request)
  const choice = root.occurrence?.pending
  if (!choice || choice.kind !== 'MOVEMENT_REACTION' || !choice.choice.options[0])
    throw new Error('Expected a movement reaction choice.')
  const command: ResolveRuleOccurrenceInputDto = {
    type: 'RESOLVE_RULE_OCCURRENCE',
    commandId: crypto.randomUUID(),
    encounterId: base.run.id,
    expectedVersion: choice.encounterVersion,
    occurrenceId: choice.occurrenceId,
    expectedOccurrenceVersion: choice.occurrenceVersion,
    correlationId: null,
    resolution: { kind: 'OPTION', optionId: choice.choice.options[0].optionId }
  }
  const staged = await scene.owner.caller.mutation(beginMovementResponse, command)
  if (!staged || staged.kind !== 'READY') throw new Error('Expected movement response staging.')
  const request = { ...scene.request, saveId: staged.saveId }
  await scene.owner.caller.mutation(observeMovement, {
    saveId: request.saveId,
    characterRevisions: []
  })
  const prepared = await scene.owner.caller.mutation(prepareMovement, request)
  if (prepared.outcome.kind !== 'TERMINAL') throw new Error('Expected terminal reaction damage.')
  expect(prepared.outcome.result.reactionExecutions).toHaveLength(1)
  const terminal = await scene.owner.caller.mutation(finishMovement, request)
  expect(terminal.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })

  const rows = await base.t.run(async (ctx) => ({
    root: await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) =>
        q.eq('encounterId', base.run.id).eq('commandId', scene.rootInput.commandId)
      )
      .unique(),
    terminal: await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) =>
        q.eq('encounterId', base.run.id).eq('commandId', command.commandId)
      )
      .unique(),
    occurrence: await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_publicId', (q) => q.eq('id', choice.occurrenceId))
      .unique()
  }))
  if (!rows.root || !rows.terminal || !rows.occurrence) throw new Error('Missing movement lineage.')
  const rootResult = storedRuleExecutionResultDtoSchema.parse(JSON.parse(rows.root.resultJson))
  const terminalResult = storedRuleExecutionResultDtoSchema.parse(
    JSON.parse(rows.terminal.resultJson)
  )
  expect(rows.root).toMatchObject({
    commandType: 'MOVE_SCENE_TOKEN',
    occurrenceId: choice.occurrenceId,
    resultChecksum: checksumCanonicalJson(rootResult)
  })
  expect(rows.terminal).toMatchObject({
    commandType: 'RESOLVE_RULE_OCCURRENCE',
    occurrenceId: choice.occurrenceId,
    resultChecksum: checksumCanonicalJson(terminalResult)
  })
  expect(rows.occurrence).toMatchObject({
    rootCommandId: scene.rootInput.commandId,
    state: 'COMPLETED'
  })
  expect(rootResult).toMatchObject({ status: 'ENCOUNTER_OCCURRENCE_PENDING' })
  expect(terminalResult).toMatchObject({ occurrenceVersion: rows.occurrence.version })
  if (
    terminalResult.status !== 'MOVEMENT_COMPLETE' &&
    (terminalResult.status !== 'BATCH_COMPLETE' ||
      terminalResult.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT')
  )
    throw new Error('Expected a stored movement terminal.')
  expect(terminalResult.reactionExecutions).toHaveLength(1)
  const reaction = terminalResult.reactionExecutions[0]!
  expect({
    sourceCommandId: reaction.sourceCommandId,
    applicationKind: reaction.application.kind,
    applicationKinds:
      reaction.application.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
        ? reaction.application.applications.map((entry) => entry.kind)
        : [],
    phaseReceiptsPresent: reaction.phaseReceipts !== undefined,
    resultPath:
      reaction.phaseReceipts?.find((phase) => phase.phase === 'TEST')?.execution.outputs
        .resultPath ?? reaction.execution.outputs.resultPath
  }).toEqual({
    sourceCommandId: command.commandId,
    applicationKind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH',
    applicationKinds: ['DAMAGE'],
    phaseReceiptsPresent: true,
    resultPath: 'ON_HIT'
  })
  const evidence = await scene.owner.caller.query(movementReactionDamage, {
    campaignId: base.campaign.id,
    encounterId: base.run.id,
    rootCommandId: scene.rootInput.commandId,
    terminalCommandId: command.commandId
  })
  expect(evidence).toMatchObject({
    occurrenceId: choice.occurrenceId,
    sourceActorId: base.reactor.id,
    targetActorId: base.mover.id,
    resultPath: 'ON_HIT'
  })
  expect(evidence.requestedAmounts).toHaveLength(1)
  expect(evidence.requestedAmounts[0]).toBeGreaterThan(0)
  expect(evidence.appliedAmount).toBeGreaterThan(0)
  expect(evidence.afterHitPoints).toBe(evidence.beforeHitPoints - evidence.appliedAmount)
  await expect(
    base.t.query(movementReactionDamage, {
      campaignId: base.campaign.id,
      encounterId: base.run.id,
      rootCommandId: scene.rootInput.commandId,
      terminalCommandId: command.commandId
    })
  ).rejects.toThrow('Unauthenticated')
  await expect(
    scene.player.caller.query(movementReactionDamage, {
      campaignId: base.campaign.id,
      encounterId: base.run.id,
      rootCommandId: scene.rootInput.commandId,
      terminalCommandId: command.commandId
    })
  ).rejects.toThrow('Fixture Campaign ownership mismatch.')
  await expect(
    scene.owner.caller.query(movementReactionDamage, {
      campaignId: base.campaign.id,
      encounterId: base.run.id,
      rootCommandId: command.commandId,
      terminalCommandId: scene.rootInput.commandId
    })
  ).rejects.toThrow('Fixture movement receipt lineage is unavailable.')
}, 30_000)
