import { makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  encounterGmProjectionDtoSchema,
  type PendingEncounterRuleOccurrenceSummaryDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  SceneGeometryBeginResult,
  SceneGeometryCommandResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import type { LiveSessionMovementCommitInput } from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  encounterRuleUsageSnapshot,
  withEncounterRuleUsageUsed
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '@artificer-toolkit/source-data/srd/optionalCombat.js'
import {
  SRD_REACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { sourceImportBatches } from '../content/importBatches'
import * as rollRandom from '../lib/rollRandom'
import { setupReactionMovementScene } from '../../tests/fixtures/automaticSceneMovement'
import { setupCreatureReactionRun } from '../../tests/fixtures/movementReaction'
import { setAutoRollDice, type FixtureRolls } from '../../tests/fixtures/rollPreferences'
import { seedSpatialSaveEffect } from '../../tests/fixtures/spatialSaveEffect'
import {
  preparePrivateMovementResponse,
  privateMovementEnvironment
} from '../../tests/fixtures/liveMovementResponse'
import { prepareSceneMovement } from './movementPerceptionAction'
import { callLiveSessionRoute } from '../../../session-worker/src/liveSessionRoutes'
import { insertActiveLiveAuthority } from '../../tests/fixtures/liveSessionWorker'

type Request = ReturnType<typeof sceneSpatialPrepareInputSchema.parse>

const importDefinitions = makeFunctionReference<
  'mutation',
  {
    contentSourceId: string
    definitions: readonly unknown[]
  },
  unknown
>('content/import:importDefinitions')
const prepare = makeFunctionReference<'mutation', Request, SceneSpatialPreparation>(
  'scenes/spatialPreparation:prepare'
)
const finish = makeFunctionReference<'mutation', Request, SceneGeometryCommandResult>(
  'scenes/geometryCommands:finish'
)
const privateFinish = makeFunctionReference<
  'mutation',
  LiveSessionMovementCommitInput,
  SceneGeometryCommandResult
>('liveSessions/encounterMovement:commit')
const beginResponse = makeFunctionReference<
  'mutation',
  ResolveRuleOccurrenceInputDto,
  SceneGeometryBeginResult | null
>('scenes/movementResolutionStaging:begin')
const observe = makeFunctionReference<
  'mutation',
  { saveId: string; characterRevisions: [] },
  { saveId: string }
>('scenes/geometryStaging:observe')
const pendingRuleOccurrence = makeFunctionReference<
  'query',
  { encounterId: string },
  PendingEncounterRuleOccurrenceSummaryDto | null
>('encounters/pendingReads:pendingRuleOccurrence')

function optional(kind: 'OVERRUN' | 'TUMBLE') {
  const definition = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
    (candidate) => candidate.document.kind === kind
  )
  if (!definition) throw new Error(`Missing ${kind} fixture definition.`)
  return definition
}

/** Actual Scene setup with two authored Creature snapshots and active optional-combat definitions. */
async function setupPassageScene(
  input: {
    rolls?: FixtureRolls
    perceptionRequirement?: 'SEE'
    laterBlocker?: boolean
    path?: { x: number; y: number }[]
  } = {}
) {
  const base = await setupCreatureReactionRun(
    input.perceptionRequirement ?? null,
    true,
    input.laterBlocker ?? false,
    'AUTOMATIC'
  )
  if (input.rolls === 'PROMPT') await setAutoRollDice(base.t, base.owner.userId, false)
  for (const definitions of sourceImportBatches([
    ...SRD_RULE_STATE_DEFINITIONS,
    optional('OVERRUN'),
    optional('TUMBLE')
  ]))
    await base.t.mutation(importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions
    })
  const overrun = optional('OVERRUN').document.parameters
  const tumble = optional('TUMBLE').document.parameters
  if (overrun.kind !== 'OVERRUN' || tumble.kind !== 'TUMBLE')
    throw new Error('Passage definitions are invalid.')
  await base.t.run(async (ctx) => {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!run) throw new Error('Passage fixture run is unavailable.')
    const state = encounterRunStateSchema.parse(JSON.parse(run.stateJson))
    const optionalSnapshot = {
      schemaVersion: 1 as const,
      gameSystemId: state.gameSystemId,
      definitions: [optional('OVERRUN'), optional('TUMBLE')].map((definition) => ({
        definitionId: definition.id,
        contentSourceId: SRD_CONTENT_SOURCE.id,
        definitionVersion: 1,
        definitionChecksum: definition.checksum,
        contractVersion: 1,
        label: definition.label,
        document: definition.document
      }))
    }
    const active = encounterRunStateSchema.parse({
      ...state,
      status: 'ACTIVE',
      automationMode: 'ASSISTED',
      round: 1,
      currentActorId: base.mover.id,
      optionalCombatSnapshot: optionalSnapshot,
      optionalCombatSnapshotChecksum: checksumCanonicalJson(optionalSnapshot)
    })
    const projection = encounterGmProjectionDtoSchema.parse({
      ...JSON.parse(run.projectionJson),
      status: 'ACTIVE'
    })
    await ctx.db.patch(run._id, {
      status: 'ACTIVE',
      stateJson: JSON.stringify(active),
      stateChecksum: checksumCanonicalJson(active),
      projectionJson: JSON.stringify(projection),
      projectionChecksum: checksumCanonicalJson(projection)
    })
  })
  const additionalReactor = base.additionalReactorActor
  const actors = [base.reactor, base.mover]
  if (input.laterBlocker) {
    if (!additionalReactor) throw new Error('Passage blocker fixture is unavailable.')
    actors.push(additionalReactor)
  }
  const scene = await setupReactionMovementScene(
    base,
    actors,
    input.laterBlocker ? [350, 550] : [350],
    input.path ?? [
      { x: 150, y: 50 },
      { x: 650, y: 50 }
    ]
  )
  return scene
}

async function issuePassage(value: Awaited<ReturnType<typeof setupPassageScene>>) {
  await value.owner.caller.mutation(observe, { saveId: value.saveId, characterRevisions: [] })
  const { preparation, perceptionEnvironments } = await value.owner.caller.action((ctx) =>
    prepareSceneMovement(ctx, value.request)
  )
  expect(preparation.outcome.kind).toBe('PENDING')
  const initial = await value.owner.caller.mutation(finish, {
    ...value.request,
    perceptionEnvironments
  })
  const choice = initial.occurrence?.pending
  if (!choice || choice.kind !== 'MOVEMENT_PASSAGE_CHOICE')
    throw new Error('Expected the native movement passage choice.')
  return { choice, initial }
}

async function prepareResponse(
  value: Awaited<ReturnType<typeof setupPassageScene>>,
  choice: { encounterVersion: number; occurrenceId: string; occurrenceVersion: number },
  resolution: ResolveRuleOccurrenceInputDto['resolution']
) {
  const command: ResolveRuleOccurrenceInputDto = {
    type: 'RESOLVE_RULE_OCCURRENCE',
    commandId: crypto.randomUUID(),
    encounterId: value.base.run.id,
    expectedVersion: choice.encounterVersion,
    occurrenceId: choice.occurrenceId,
    expectedOccurrenceVersion: choice.occurrenceVersion,
    correlationId: null,
    resolution
  }
  const started = await value.owner.caller.mutation(beginResponse, command)
  if (!started || started.kind !== 'READY')
    throw new Error('Expected Scene passage response staging.')
  const stagedRequest = { ...value.request, saveId: started.saveId }
  await value.owner.caller.mutation(observe, {
    saveId: stagedRequest.saveId,
    characterRevisions: []
  })
  const { preparation: prepared, perceptionEnvironments } = await value.owner.caller.action((ctx) =>
    prepareSceneMovement(ctx, stagedRequest)
  )
  const request = { ...stagedRequest, perceptionEnvironments }
  return { command, prepared, request }
}

async function respond(
  value: Awaited<ReturnType<typeof setupPassageScene>>,
  choice: { encounterVersion: number; occurrenceId: string; occurrenceVersion: number },
  resolution: ResolveRuleOccurrenceInputDto['resolution']
) {
  const response = await prepareResponse(value, choice, resolution)
  const result = await value.owner.caller.mutation(finish, response.request)
  return { ...response, result }
}

async function exhaustFixtureReaction(value: Awaited<ReturnType<typeof setupPassageScene>>) {
  await value.base.t.run(async (ctx) => {
    const actor = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', value.base.run.id).eq('id', value.base.reactor.id)
      )
      .unique()
    if (!actor) throw new Error('Passage fixture reactor is unavailable.')
    const state = encounterRunActorStateSchema.parse(JSON.parse(actor.stateJson))
    const exhausted = encounterRunActorStateSchema.parse({
      ...state,
      resources: withEncounterRuleUsageUsed(state, SRD_REACTION_ALLOWANCE_DEFINITION_ID, 1)
    })
    await ctx.db.patch(actor._id, {
      stateJson: JSON.stringify(exhausted),
      stateChecksum: checksumCanonicalJson(exhausted)
    })
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('native Scene movement passage', () => {
  it('publishes a passage choice and declines at the hostile contact without economy', async () => {
    const value = await setupPassageScene()
    const { choice, initial } = await issuePassage(value)
    expect(initial.delta).toMatchObject({ kind: 'TOKEN_MOVED', position: { x: 250, y: 50 } })
    expect(choice.options.map((option) => option.ruleKind).sort()).toEqual([
      'OVERRUN',
      'OVERRUN',
      'TUMBLE',
      'TUMBLE'
    ])
    const before = await value.base.t.run(async (ctx) => ({
      actors: await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', value.base.run.id))
        .collect(),
      scene: await ctx.db
        .query('campaignScenes')
        .withIndex('by_publicId', (q) => q.eq('id', value.sceneId))
        .unique()
    }))
    const response = await respond(value, choice, { kind: 'PASSAGE_DECLINE' })
    expect(response.prepared.outcome.kind).toBe('TERMINAL')
    const result = response.result
    expect(result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    expect(result.delta).toBeNull()
    const after = await value.base.t.run(async (ctx) => ({
      actors: await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', value.base.run.id))
        .collect(),
      scene: await ctx.db
        .query('campaignScenes')
        .withIndex('by_publicId', (q) => q.eq('id', value.sceneId))
        .unique()
    }))
    expect(after.actors.map((actor) => actor.stateChecksum)).toEqual(
      before.actors.map((actor) => actor.stateChecksum)
    )
    expect(after.scene?.version).toBe(before.scene?.version)
    await expect(value.owner.caller.mutation(finish, response.request)).resolves.toMatchObject({
      replayed: true
    })
  }, 30_000)

  it('refuses a foreign Campaign binding at publication without publishing movement', async () => {
    const value = await setupPassageScene()
    await value.owner.caller.mutation(observe, { saveId: value.saveId, characterRevisions: [] })
    await value.owner.caller.mutation(prepare, value.request)
    const before = await value.base.t.run(async (ctx) => {
      const binding = await ctx.db
        .query('encounterSceneBindings')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', value.base.run.id))
        .unique()
      if (!binding) throw new Error('Missing fixture binding.')
      await ctx.db.patch(binding._id, { campaignId: crypto.randomUUID() })
      return {
        entities: await ctx.db.query('sceneLiveEntities').collect(),
        occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
        receipts: await ctx.db.query('encounterRuleReceipts').collect()
      }
    })
    await expect(value.owner.caller.mutation(finish, value.request)).rejects.toThrow()
    expect(
      await value.base.t.run(async (ctx) => ({
        entities: await ctx.db.query('sceneLiveEntities').collect(),
        occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
        receipts: await ctx.db.query('encounterRuleReceipts').collect()
      }))
    ).toEqual(before)
  }, 30_000)

  it('rejects voluntary movement whose endpoint overlaps a hostile footprint', async () => {
    const value = await setupPassageScene({
      path: [
        { x: 150, y: 50 },
        { x: 300, y: 50 }
      ]
    })
    await value.owner.caller.mutation(observe, { saveId: value.saveId, characterRevisions: [] })
    await expect(value.owner.caller.mutation(prepare, value.request)).rejects.toThrow(
      'Voluntary movement cannot end inside a hostile occupied footprint.'
    )
  }, 30_000)

  it('resumes an assisted spatial pause into Passage using the original movement distance', async () => {
    const value = await setupPassageScene({
      rolls: 'PROMPT',
      path: [
        { x: 150, y: 50 },
        { x: 700, y: 50 }
      ]
    })
    await exhaustFixtureReaction(value)
    await seedSpatialSaveEffect(value, {
      center: { x: 225, y: 50 },
      radius: 5,
      targetActorId: value.base.mover.id
    })
    await value.owner.caller.mutation(observe, { saveId: value.saveId, characterRevisions: [] })
    expect((await value.owner.caller.mutation(prepare, value.request)).outcome.kind).toBe('PENDING')
    const paused = await value.owner.caller.mutation(finish, value.request)
    const evidence = paused.occurrence?.pending
    if (!evidence || evidence.kind !== 'D20_EVIDENCE')
      throw new Error(`Expected spatial pause d20 request; received ${evidence?.kind ?? 'none'}.`)
    const resumed = await respond(value, evidence, {
      kind: 'ENTER_DICE',
      requestId: evidence.request.requestId,
      rawFaces: [1]
    })
    const choice = resumed.result.occurrence?.pending
    if (!choice || choice.kind !== 'MOVEMENT_PASSAGE_CHOICE')
      throw new Error('Expected Passage after spatial pause.')
    const issued = await value.base.t.run((ctx) =>
      ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_publicId', (q) => q.eq('id', choice.occurrenceId))
        .unique()
    )
    if (!issued?.pendingSnapshotJson) throw new Error('Resumed Passage choice is unavailable.')
    expect(JSON.parse(issued.pendingSnapshotJson).applicationContext.movement).toMatchObject({
      root: {
        originalPath: [
          { x: 150, y: 50 },
          { x: 700, y: 50 }
        ]
      },
      contactPathDistance: 100
    })
  }, 30_000)

  it('settles an automatic selected option once, continues its suffix, and replays without rerolling', async () => {
    const value = await setupPassageScene()
    await exhaustFixtureReaction(value)
    const { choice } = await issuePassage(value)
    vi.spyOn(rollRandom, 'nextRollInt').mockReturnValueOnce(19).mockReturnValueOnce(0)
    const option = choice.options.find((entry) => entry.ruleKind === 'OVERRUN')
    if (!option) throw new Error('Expected an Overrun passage option.')
    const before = await value.base.t.run(async (ctx) =>
      ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', value.base.run.id))
        .collect()
    )
    const response = await respond(value, choice, {
      kind: 'PASSAGE_OPTION',
      optionId: option.optionId
    })
    expect(response.prepared.outcome.kind).toBe('TERMINAL')
    if (response.prepared.outcome.kind === 'TERMINAL')
      expect(response.prepared.outcome.result.terminalPosition).toEqual({ x: 650, y: 50 })
    expect(response.result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    expect(response.result.delta).toMatchObject({
      kind: 'TOKEN_MOVED',
      position: { x: 650, y: 50 }
    })
    const after = await value.base.t.run(async (ctx) =>
      ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', value.base.run.id))
        .collect()
    )
    expect(after.map((actor) => actor.stateChecksum)).not.toEqual(
      before.map((actor) => actor.stateChecksum)
    )
    vi.spyOn(rollRandom, 'nextRollInt').mockImplementation(() => {
      throw new Error('random during Scene passage replay')
    })
    await expect(value.owner.caller.mutation(finish, response.request)).resolves.toMatchObject({
      replayed: true
    })
  }, 30_000)

  it('revalidates reaction eligibility in the final transaction after passage preparation', async () => {
    const value = await setupPassageScene({ rolls: 'PROMPT' })
    const { choice } = await issuePassage(value)
    const option = choice.options.find((entry) => entry.ruleKind === 'OVERRUN')
    if (!option) throw new Error('Expected an Overrun passage option.')
    const selected = await respond(value, choice, {
      kind: 'PASSAGE_OPTION',
      optionId: option.optionId
    })
    const initiator = selected.result.occurrence?.pending
    if (!initiator || initiator.kind !== 'D20_EVIDENCE')
      throw new Error('Expected the assisted initiator d20 request.')
    const defender = await respond(value, initiator, {
      kind: 'ENTER_DICE',
      requestId: initiator.request.requestId,
      rawFaces: [20]
    })
    const pending = defender.result.occurrence?.pending
    if (!pending || pending.kind !== 'D20_EVIDENCE')
      throw new Error('Expected the assisted defender d20 request.')
    const response = await prepareResponse(value, pending, {
      kind: 'ENTER_DICE',
      requestId: pending.request.requestId,
      rawFaces: [1]
    })
    expect(response.prepared.outcome).toMatchObject({
      kind: 'PENDING',
      pendingSnapshot: { applicationContext: { kind: 'ENCOUNTER_MOVEMENT_REACTION' } }
    })
    await exhaustFixtureReaction(value)
    const rows = () =>
      value.base.t.run(async (ctx) => ({
        actors: await ctx.db.query('encounterRunActors').collect(),
        runs: await ctx.db.query('encounterRuns').collect(),
        scenes: await ctx.db.query('sceneLiveStates').collect(),
        occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
        receipts: await ctx.db.query('encounterRuleReceipts').collect()
      }))
    const before = await rows()
    await expect(value.owner.caller.mutation(finish, response.request)).rejects.toThrow(
      /reaction|passage|retained|snapshot/i
    )
    expect(await rows()).toEqual(before)
  }, 30_000)

  it('keeps an assisted passage pending through both canonical d20 requests before consuming its allowance', async () => {
    const value = await setupPassageScene({
      rolls: 'PROMPT',
      perceptionRequirement: 'SEE'
    })
    const { choice } = await issuePassage(value)
    const option = choice.options.find((entry) => entry.ruleKind === 'OVERRUN')
    if (!option) throw new Error('Expected an Overrun passage option.')
    const selected = await respond(value, choice, {
      kind: 'PASSAGE_OPTION',
      optionId: option.optionId
    })
    expect(selected.request.perceptionEnvironments).toHaveLength(1)
    const initiator = selected.result.occurrence?.pending
    if (!initiator || initiator.kind !== 'D20_EVIDENCE')
      throw new Error('Expected the assisted initiator d20 request.')
    expect(selected.prepared.outcome.kind).toBe('PENDING')
    const before = await value.base.t.run(async (ctx) =>
      ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', value.base.run.id))
        .collect()
    )
    const defender = await respond(value, initiator, {
      kind: 'ENTER_DICE',
      requestId: initiator.request.requestId,
      rawFaces: [20]
    })
    expect(defender.request.perceptionEnvironments).toHaveLength(1)
    const pending = defender.result.occurrence?.pending
    if (!pending || pending.kind !== 'D20_EVIDENCE')
      throw new Error('Expected the assisted defender d20 request.')
    const completed = await respond(value, pending, {
      kind: 'ENTER_DICE',
      requestId: pending.request.requestId,
      rawFaces: [1]
    })
    expect(completed.request.perceptionEnvironments).toHaveLength(1)
    // The retained System-automatic reaction fires without a choice; its d20 pauses as evidence.
    const reaction = completed.result.occurrence?.pending
    if (!reaction || reaction.kind !== 'D20_EVIDENCE')
      throw new Error('Expected the retained automatic reaction d20 after the assisted contest.')
    const terminal = await respond(value, reaction, {
      kind: 'ENTER_DICE',
      requestId: reaction.request.requestId,
      rawFaces: [1]
    })
    expect(terminal.result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    const after = await value.base.t.run(async (ctx) =>
      ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', value.base.run.id))
        .collect()
    )
    expect(after.map((actor) => actor.stateChecksum)).not.toEqual(
      before.map((actor) => actor.stateChecksum)
    )
  }, 30_000)

  it.each(['native', 'private'] as const)(
    'rolls back a %s settled passage when final publication fails, then consumes its allowance once',
    async (route) => {
      const authSecret = 'private-passage-auth-secret-at-least-32-bytes'
      if (route === 'private') vi.stubEnv('BETTER_AUTH_SECRET', authSecret)
      const value = await setupPassageScene({ rolls: 'PROMPT' })
      await exhaustFixtureReaction(value)
      const { choice } = await issuePassage(value)
      const option = choice.options.find((entry) => entry.ruleKind === 'OVERRUN')
      if (!option) throw new Error('Expected an Overrun passage option.')
      const selected = await respond(value, choice, {
        kind: 'PASSAGE_OPTION',
        optionId: option.optionId
      })
      const initiator = selected.result.occurrence?.pending
      if (!initiator || initiator.kind !== 'D20_EVIDENCE')
        throw new Error('Expected initiator d20 request.')
      const defender = await respond(value, initiator, {
        kind: 'ENTER_DICE',
        requestId: initiator.request.requestId,
        rawFaces: [20]
      })
      const pending = defender.result.occurrence?.pending
      if (!pending || pending.kind !== 'D20_EVIDENCE')
        throw new Error('Expected defender d20 request.')
      let response: Awaited<ReturnType<typeof prepareResponse>> | null = null
      let privateCommit: LiveSessionMovementCommitInput | null = null
      if (route === 'private') {
        const epoch = crypto.randomUUID()
        await value.base.t.run((ctx) =>
          insertActiveLiveAuthority(ctx, {
            campaignId: value.base.campaign.id,
            epoch,
            createdAt: value.base.campaign.createdAt
          })
        )
        const command: ResolveRuleOccurrenceInputDto = {
          type: 'RESOLVE_RULE_OCCURRENCE',
          commandId: crypto.randomUUID(),
          encounterId: value.base.run.id,
          expectedVersion: pending.encounterVersion,
          occurrenceId: pending.occurrenceId,
          expectedOccurrenceVersion: pending.occurrenceVersion,
          correlationId: null,
          resolution: {
            kind: 'ENTER_DICE',
            requestId: pending.request.requestId,
            rawFaces: [1]
          }
        }
        const prepared = await preparePrivateMovementResponse({
          value,
          caller: value.owner.caller,
          userId: value.owner.userId,
          role: 'OWNER',
          epoch,
          authSecret,
          command
        })
        expect(prepared.planned.outcome.kind).toBe('TERMINAL')
        expect(prepared.planned.settlementInputs.map((step) => step.kind)).toEqual(['PASSAGE'])
        privateCommit = prepared.commitInput
      } else {
        response = await prepareResponse(value, pending, {
          kind: 'ENTER_DICE',
          requestId: pending.request.requestId,
          rawFaces: [1]
        })
        expect(response.prepared.outcome.kind).toBe('TERMINAL')
      }
      const rows = () =>
        value.base.t.run(async (ctx) => ({
          actors: await ctx.db.query('encounterRunActors').collect(),
          runs: await ctx.db.query('encounterRuns').collect(),
          scenes: await ctx.db.query('sceneLiveStates').collect(),
          sceneEntities: await ctx.db.query('sceneLiveEntities').collect(),
          sceneCommands: await ctx.db.query('sceneLiveCommands').collect(),
          occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
          receipts: await ctx.db.query('encounterRuleReceipts').collect()
        }))
      const before = await rows()
      await expect(
        value.owner.caller.run(async (ctx) => {
          let completed: SceneGeometryCommandResult
          if (privateCommit) completed = await ctx.runMutation(privateFinish, privateCommit)
          else if (response) completed = await ctx.runMutation(finish, response.request)
          else throw new Error('Passage publication input is unavailable.')
          expect(completed.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
          expect(await ctx.db.query('encounterRunActors').collect()).not.toEqual(before.actors)
          expect(await ctx.db.query('encounterRuns').collect()).not.toEqual(before.runs)
          expect(await ctx.db.query('sceneLiveStates').collect()).not.toEqual(before.scenes)
          expect(await ctx.db.query('sceneLiveEntities').collect()).not.toEqual(
            before.sceneEntities
          )
          expect(await ctx.db.query('sceneLiveCommands').collect()).not.toEqual(
            before.sceneCommands
          )
          expect(await ctx.db.query('encounterRuleReceipts').collect()).not.toEqual(before.receipts)
          throw new Error('Injected Passage final publication rollback')
        })
      ).rejects.toThrow('Injected Passage final publication rollback')
      expect(await rows()).toEqual(before)
      if (privateCommit)
        await expect(
          callLiveSessionRoute(
            privateMovementEnvironment,
            'fixture-access-token',
            'encounterMovementCommit',
            privateCommit
          )
        ).resolves.toMatchObject({ occurrence: { status: 'COMPLETE', pending: null } })
      else if (response)
        await expect(value.owner.caller.mutation(finish, response.request)).resolves.toMatchObject({
          occurrence: { status: 'COMPLETE', pending: null }
        })
      else throw new Error('Passage publication input is unavailable.')
      const after = await rows()
      const usedBefore = before.actors.reduce(
        (total, actor) =>
          total +
          Object.values(
            encounterRuleUsageSnapshot(
              encounterRunActorStateSchema.parse(JSON.parse(actor.stateJson))
            )
          ).reduce((sum, usage) => sum + usage, 0),
        0
      )
      const usedAfter = after.actors.reduce(
        (total, actor) =>
          total +
          Object.values(
            encounterRuleUsageSnapshot(
              encounterRunActorStateSchema.parse(JSON.parse(actor.stateJson))
            )
          ).reduce((sum, usage) => sum + usage, 0),
        0
      )
      expect(usedAfter).toBe(usedBefore + 1)
      if (privateCommit)
        await expect(
          callLiveSessionRoute(
            privateMovementEnvironment,
            'fixture-access-token',
            'encounterMovementCommit',
            privateCommit
          )
        ).resolves.toMatchObject({ replayed: true })
      else if (response)
        await expect(value.owner.caller.mutation(finish, response.request)).resolves.toMatchObject({
          replayed: true
        })
      else throw new Error('Passage publication input is unavailable.')
      expect(await rows()).toEqual(after)
    },
    120_000
  )

  it.each([
    ['tie', [20], [20]],
    ['failure', [1], [20]]
  ] as const)(
    'stops a %s passage at contact while consuming its allowance once',
    async (_, initiatorFaces, defenderFaces) => {
      const value = await setupPassageScene({ rolls: 'PROMPT' })
      await exhaustFixtureReaction(value)
      const { choice } = await issuePassage(value)
      const option = choice.options.find((entry) => entry.ruleKind === 'OVERRUN')
      if (!option) throw new Error('Expected an Overrun passage option.')
      const before = await value.base.t.run((ctx) =>
        ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) => q.eq('encounterId', value.base.run.id))
          .collect()
      )
      const selected = await respond(value, choice, {
        kind: 'PASSAGE_OPTION',
        optionId: option.optionId
      })
      const initiator = selected.result.occurrence?.pending
      if (!initiator || initiator.kind !== 'D20_EVIDENCE')
        throw new Error('Expected initiator d20 request.')
      const defender = await respond(value, initiator, {
        kind: 'ENTER_DICE',
        requestId: initiator.request.requestId,
        rawFaces: [...initiatorFaces]
      })
      const pending = defender.result.occurrence?.pending
      if (!pending || pending.kind !== 'D20_EVIDENCE')
        throw new Error('Expected defender d20 request.')
      const response = await respond(value, pending, {
        kind: 'ENTER_DICE',
        requestId: pending.request.requestId,
        rawFaces: [...defenderFaces]
      })
      expect(response.prepared.outcome.kind).toBe('TERMINAL')
      if (response.prepared.outcome.kind === 'TERMINAL')
        expect(response.prepared.outcome.result.terminalPosition).toEqual({ x: 250, y: 50 })
      expect(response.result.delta).toBeNull()
      const after = await value.base.t.run((ctx) =>
        ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) => q.eq('encounterId', value.base.run.id))
          .collect()
      )
      const usage = (actors: typeof after) =>
        actors.reduce(
          (total, actor) =>
            total +
            Object.values(
              encounterRuleUsageSnapshot(
                encounterRunActorStateSchema.parse(JSON.parse(actor.stateJson))
              )
            ).reduce((sum, value) => sum + value, 0),
          0
        )
      expect(usage(after)).toBe(usage(before) + 1)
      await expect(value.owner.caller.mutation(finish, response.request)).resolves.toMatchObject({
        replayed: true
      })
    },
    30_000
  )

  it('hides assisted Creature evidence from an unassigned player while the owner resolves both participants', async () => {
    const value = await setupPassageScene({ rolls: 'PROMPT' })
    await exhaustFixtureReaction(value)
    const { choice } = await issuePassage(value)
    expect(
      await value.player.caller.query(pendingRuleOccurrence, { encounterId: value.base.run.id })
    ).toBeNull()
    await expect(
      value.player.caller.mutation(beginResponse, {
        type: 'RESOLVE_RULE_OCCURRENCE',
        commandId: crypto.randomUUID(),
        encounterId: value.base.run.id,
        expectedVersion: choice.encounterVersion,
        occurrenceId: choice.occurrenceId,
        expectedOccurrenceVersion: choice.occurrenceVersion,
        correlationId: null,
        resolution: { kind: 'PASSAGE_DECLINE' }
      })
    ).rejects.toThrow('another controller')
    const option = choice.options.find((entry) => entry.ruleKind === 'OVERRUN')
    if (!option) throw new Error('Expected an Overrun passage option.')
    const initiator = await respond(value, choice, {
      kind: 'PASSAGE_OPTION',
      optionId: option.optionId
    })
    const first = initiator.result.occurrence?.pending
    if (!first || first.kind !== 'D20_EVIDENCE')
      throw new Error('Expected Creature initiator d20 request.')
    expect(
      await value.player.caller.query(pendingRuleOccurrence, { encounterId: value.base.run.id })
    ).toBeNull()
    await expect(
      value.player.caller.mutation(beginResponse, {
        type: 'RESOLVE_RULE_OCCURRENCE',
        commandId: crypto.randomUUID(),
        encounterId: value.base.run.id,
        expectedVersion: first.encounterVersion,
        occurrenceId: first.occurrenceId,
        expectedOccurrenceVersion: first.occurrenceVersion,
        correlationId: null,
        resolution: { kind: 'ENTER_DICE', requestId: first.request.requestId, rawFaces: [20] }
      })
    ).rejects.toThrow('another controller')
    const defender = await respond(value, first, {
      kind: 'ENTER_DICE',
      requestId: first.request.requestId,
      rawFaces: [20]
    })
    const second = defender.result.occurrence?.pending
    if (!second || second.kind !== 'D20_EVIDENCE')
      throw new Error('Expected Creature defender d20 request.')
    expect(
      await value.player.caller.query(pendingRuleOccurrence, { encounterId: value.base.run.id })
    ).toBeNull()
    await expect(
      value.player.caller.mutation(beginResponse, {
        type: 'RESOLVE_RULE_OCCURRENCE',
        commandId: crypto.randomUUID(),
        encounterId: value.base.run.id,
        expectedVersion: second.encounterVersion,
        occurrenceId: second.occurrenceId,
        expectedOccurrenceVersion: second.occurrenceVersion,
        correlationId: null,
        resolution: { kind: 'ENTER_DICE', requestId: second.request.requestId, rawFaces: [1] }
      })
    ).rejects.toThrow('another controller')
    const completed = await respond(value, second, {
      kind: 'ENTER_DICE',
      requestId: second.request.requestId,
      rawFaces: [1]
    })
    expect(completed.result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  }, 30_000)

  it('stops a successful passage at the sealed next hostile blocker without a second contest', async () => {
    const value = await setupPassageScene({ laterBlocker: true })
    await exhaustFixtureReaction(value)
    const { choice } = await issuePassage(value)
    vi.spyOn(rollRandom, 'nextRollInt').mockReturnValueOnce(19).mockReturnValueOnce(0)
    const issued = await value.base.t.run((ctx) =>
      ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_publicId', (q) => q.eq('id', choice.occurrenceId))
        .unique()
    )
    if (!issued?.pendingSnapshotJson) throw new Error('Issued passage choice is unavailable.')
    expect(
      JSON.parse(issued.pendingSnapshotJson).applicationContext.movement.nextPassageStop
    ).toMatchObject({
      contact: { x: 450, y: 50 }
    })
    const option = choice.options.find((entry) => entry.ruleKind === 'OVERRUN')
    if (!option) throw new Error('Expected an Overrun passage option.')
    const response = await respond(value, choice, {
      kind: 'PASSAGE_OPTION',
      optionId: option.optionId
    })
    expect(response.prepared.outcome.kind).toBe('TERMINAL')
    if (response.prepared.outcome.kind === 'TERMINAL')
      expect(response.prepared.outcome.result.terminalPosition).toEqual({ x: 450, y: 50 })
    expect(response.result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    expect(response.result.delta).toMatchObject({
      kind: 'TOKEN_MOVED',
      position: { x: 450, y: 50 }
    })
    const receipt = await value.base.t.run((ctx) =>
      ctx.db
        .query('encounterRuleReceipts')
        .withIndex('by_encounterId_commandId', (q) =>
          q.eq('encounterId', value.base.run.id).eq('commandId', response.command.commandId)
        )
        .unique()
    )
    if (!receipt) throw new Error('Passage terminal receipt is unavailable.')
    const [resolution] = JSON.parse(receipt.commandMetadataJson).resolutionCommands
    expect(resolution?.passageContest?.audit.terminalPosition).toEqual({ x: 450, y: 50 })
  }, 30_000)
})
