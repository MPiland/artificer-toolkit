import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import { api } from '../_generated/api'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import type {
  SceneGeometryBeginResult,
  SceneGeometryCommandResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { setupAutomaticSceneMovement } from '../../tests/fixtures/automaticSceneMovement'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: () => 0 }))

type Request = ReturnType<typeof sceneSpatialPrepareInputSchema.parse>
const prepare = makeFunctionReference<'mutation', Request, SceneSpatialPreparation>(
  'scenes/spatialPreparation:prepare'
)
const finish = makeFunctionReference<'mutation', Request, SceneGeometryCommandResult>(
  'scenes/geometryCommands:finish'
)
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

it.each(['DECLINE', 'OPTION'] as const)(
  'continues %s into an automatic reaction at the next contact and replays without writes',
  async (selection) => {
    const value = await setupAutomaticSceneMovement({
      policies: ['CHOICE', 'AUTOMATIC'],
      reactorPositions: [50, 150],
      path: [
        { x: 150, y: 50 },
        { x: 450, y: 50 }
      ]
    })
    const snapshot = () =>
      value.base.t.run(async (ctx) => ({
        runs: await ctx.db.query('encounterRuns').collect(),
        actors: await ctx.db.query('encounterRunActors').collect(),
        occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
        receipts: await ctx.db.query('encounterRuleReceipts').collect(),
        commands: await ctx.db.query('encounterRunCommands').collect(),
        scenes: await ctx.db.query('campaignScenes').collect(),
        entities: await ctx.db.query('sceneLiveEntities').collect(),
        sceneCommands: await ctx.db.query('sceneLiveCommands').collect()
      }))
    await value.owner.caller.mutation(observe, { saveId: value.saveId, characterRevisions: [] })
    await value.owner.caller.mutation(prepare, value.request)
    const initial = await value.owner.caller.mutation(finish, value.request)
    const choice = initial.occurrence?.pending
    if (!choice || choice.kind !== 'MOVEMENT_REACTION' || !choice.choice.options[0])
      throw new Error('Expected the authored first controller choice.')
    const command: ResolveRuleOccurrenceInputDto = {
      type: 'RESOLVE_RULE_OCCURRENCE',
      commandId: crypto.randomUUID(),
      encounterId: value.base.run.id,
      expectedVersion: choice.encounterVersion,
      occurrenceId: choice.occurrenceId,
      expectedOccurrenceVersion: choice.occurrenceVersion,
      correlationId: null,
      resolution:
        selection === 'DECLINE'
          ? { kind: 'DECLINE' }
          : { kind: 'OPTION', optionId: choice.choice.options[0].optionId }
    }
    const started = await value.owner.caller.mutation(beginResponse, command)
    if (!started || started.kind !== 'READY') throw new Error('Expected response geometry staging.')
    const request = { ...value.request, saveId: started.saveId }
    await value.owner.caller.mutation(observe, { saveId: started.saveId, characterRevisions: [] })
    const before = await snapshot()
    const prepared = await value.owner.caller.mutation(prepare, request)
    expect(await snapshot()).toEqual(before)
    if (prepared.outcome.kind !== 'TERMINAL')
      throw new Error('Expected the automatic suffix to complete.')
    const reactions = prepared.outcome.result.reactionExecutions
    expect(reactions).toHaveLength(selection === 'DECLINE' ? 1 : 2)
    expect(reactions.at(-1)?.option.candidate.reactorActorId).toBe(
      value.base.additionalReactorActor!.id
    )
    expect(reactions.every((entry) => entry.sourceCommandId === command.commandId)).toBe(true)
    expect(prepared.outcome.result.terminalPosition).toEqual({ x: 450, y: 50 })
    const result = await value.owner.caller.mutation(finish, request)
    expect(result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    const after = await snapshot()
    expect(after.runs[0]!.version).toBe(before.runs[0]!.version + 1)
    expect(after.commands.length).toBe(before.commands.length + 1)
    await expect(value.owner.caller.mutation(finish, request)).resolves.toMatchObject({
      replayed: true
    })
    await expect(value.owner.caller.mutation(finish, value.request)).resolves.toMatchObject({
      occurrence: { status: 'COMPLETE' }
    })
    expect(await snapshot()).toEqual(after)
    expect(
      after.receipts.filter((receipt) => receipt.occurrenceId === choice.occurrenceId).length
    ).toBeGreaterThan(1)
    await expect(
      value.owner.caller.mutation(api.encounters.commands.execute, {
        command: { ...command, commandId: crypto.randomUUID() }
      })
    ).rejects.toThrow('Rule occurrence is unavailable.')
    expect(await snapshot()).toEqual(after)
  },
  30_000
)

it.each(['DECLINE', 'OPTION'] as const)(
  'commits a crossed prefix once before %s and preserves it through the next choice',
  async (selection) => {
    const value = await setupAutomaticSceneMovement({
      policies: ['CHOICE', 'CHOICE'],
      reactorPositions: [150, 150],
      path: [
        { x: 150, y: 50 },
        { x: 450, y: 50 }
      ]
    })
    const effect = await seedSpatialEffect(
      { ...value.base, sceneId: value.sceneId },
      { x: 275, y: 50 },
      5
    )
    const effects = () =>
      value.base.t.run((ctx) =>
        ctx.db
          .query('encounterSpatialRuleEffects')
          .withIndex('by_encounterId_sceneId_id', (q) =>
            q.eq('encounterId', value.base.run.id).eq('sceneId', value.sceneId)
          )
          .collect()
      )
    await value.owner.caller.mutation(observe, { saveId: value.saveId, characterRevisions: [] })
    const prepared = await value.owner.caller.mutation(prepare, value.request)
    expect(prepared.outcome.kind).toBe('PENDING')
    const initial = await value.owner.caller.mutation(finish, value.request)
    const choice = initial.occurrence?.pending
    if (!choice || choice.kind !== 'MOVEMENT_REACTION' || !choice.choice.options[0])
      throw new Error('Expected first mixed movement choice.')
    expect((await effects()).find((entry) => entry.id === effect.id)).toBeUndefined()
    const command: ResolveRuleOccurrenceInputDto = {
      type: 'RESOLVE_RULE_OCCURRENCE',
      commandId: crypto.randomUUID(),
      encounterId: value.base.run.id,
      expectedVersion: choice.encounterVersion,
      occurrenceId: choice.occurrenceId,
      expectedOccurrenceVersion: choice.occurrenceVersion,
      correlationId: null,
      resolution:
        selection === 'DECLINE'
          ? { kind: 'DECLINE' }
          : { kind: 'OPTION', optionId: choice.choice.options[0].optionId }
    }
    const staged = await value.owner.caller.mutation(beginResponse, command)
    if (!staged || staged.kind !== 'READY') throw new Error('Expected mixed response staging.')
    const request = { ...value.request, saveId: staged.saveId }
    await value.owner.caller.mutation(observe, { saveId: request.saveId, characterRevisions: [] })
    const responsePrepared = await value.owner.caller.mutation(prepare, request)
    expect(responsePrepared.outcome.kind).toBe('PENDING')
    const next = await value.owner.caller.mutation(finish, request)
    const nextChoice = next.occurrence?.pending
    if (!nextChoice || nextChoice.kind !== 'MOVEMENT_REACTION')
      throw new Error('Expected the second mixed movement choice.')
    expect((await effects()).find((entry) => entry.id === effect.id)).toBeUndefined()
    await expect(value.owner.caller.mutation(finish, request)).resolves.toMatchObject({
      replayed: true
    })
    const terminalCommand: ResolveRuleOccurrenceInputDto = {
      type: 'RESOLVE_RULE_OCCURRENCE',
      commandId: crypto.randomUUID(),
      encounterId: value.base.run.id,
      expectedVersion: nextChoice.encounterVersion,
      occurrenceId: nextChoice.occurrenceId,
      expectedOccurrenceVersion: nextChoice.occurrenceVersion,
      correlationId: null,
      resolution: { kind: 'DECLINE' }
    }
    const terminalStage = await value.owner.caller.mutation(beginResponse, terminalCommand)
    if (!terminalStage || terminalStage.kind !== 'READY')
      throw new Error('Expected terminal mixed response staging.')
    const terminalRequest = { ...value.request, saveId: terminalStage.saveId }
    await value.owner.caller.mutation(observe, {
      saveId: terminalRequest.saveId,
      characterRevisions: []
    })
    expect((await value.owner.caller.mutation(prepare, terminalRequest)).outcome.kind).toBe(
      'TERMINAL'
    )
    const terminal = await value.owner.caller.mutation(finish, terminalRequest)
    expect(terminal.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    expect((await effects()).find((entry) => entry.id === effect.id)).toBeUndefined()
    await expect(value.owner.caller.mutation(finish, terminalRequest)).resolves.toMatchObject({
      replayed: true,
      occurrence: { status: 'COMPLETE', pending: null }
    })
    if (initial.delta?.kind !== 'TOKEN_MOVED')
      throw new Error('Expected a committed first segment.')
    expect(initial.delta.position).not.toEqual(value.rootInput.path[0])
    const mechanics = () =>
      value.base.t.run(async (ctx) => ({
        runs: await ctx.db.query('encounterRuns').collect(),
        actors: await ctx.db.query('encounterRunActors').collect(),
        characters: await ctx.db.query('characters').collect(),
        occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
        receipts: await ctx.db.query('encounterRuleReceipts').collect(),
        commands: await ctx.db.query('encounterRunCommands').collect()
      }))
    const beforeUndo = await mechanics()
    const undoInput = {
      input: {
        type: 'UNDO_LAST_SCENE_MOVE' as const,
        sceneId: value.sceneId,
        commandId: crypto.randomUUID(),
        expectedSceneVersion: terminal.version
      }
    }
    const undone = await value.owner.caller.action(api.scenes.undo.execute, undoInput)
    expect(undone).toMatchObject({
      version: terminal.version + 1,
      delta: { position: initial.delta.position, undoneCommandId: terminalCommand.commandId }
    })
    expect(await mechanics()).toEqual(beforeUndo)
    await expect(value.owner.caller.action(api.scenes.undo.execute, undoInput)).resolves.toEqual({
      ...undone,
      replayed: true
    })
    expect(await mechanics()).toEqual(beforeUndo)
  },
  30_000
)
