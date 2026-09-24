import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import type {
  SceneGeometryBeginResult,
  SceneGeometryCommandResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { setupCreatureReactionRun } from '../../tests/fixtures/movementReaction'
import { setupReactionMovementScene } from '../../tests/fixtures/automaticSceneMovement'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: () => 0 }))

type Request = ReturnType<typeof sceneSpatialPrepareInputSchema.parse>
const prepare = makeFunctionReference<'mutation', Request, SceneSpatialPreparation>(
  'scenes/spatialPreparation:prepare'
)
const finish = makeFunctionReference<'mutation', Request, SceneGeometryCommandResult>(
  'scenes/geometryCommands:finish'
)
const begin = makeFunctionReference<
  'mutation',
  ResolveRuleOccurrenceInputDto,
  SceneGeometryBeginResult | null
>('scenes/movementResolutionStaging:begin')
const observe = makeFunctionReference<
  'mutation',
  { saveId: string; characterRevisions: [] },
  { saveId: string }
>('scenes/geometryStaging:observe')

function command(input: {
  encounterId: string
  pending: { encounterVersion: number; occurrenceId: string; occurrenceVersion: number }
  resolution: ResolveRuleOccurrenceInputDto['resolution']
}): ResolveRuleOccurrenceInputDto {
  return {
    type: 'RESOLVE_RULE_OCCURRENCE',
    commandId: crypto.randomUUID(),
    encounterId: input.encounterId,
    expectedVersion: input.pending.encounterVersion,
    occurrenceId: input.pending.occurrenceId,
    expectedOccurrenceVersion: input.pending.occurrenceVersion,
    correlationId: null,
    resolution: input.resolution
  }
}

async function setAssisted(base: Awaited<ReturnType<typeof setupCreatureReactionRun>>) {
  await base.t.run(async (ctx) => {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!run) throw new Error('Expected Scene LR Run.')
    const state = encounterRunStateSchema.parse(JSON.parse(run.stateJson))
    const next = encounterRunStateSchema.parse({ ...state, automationMode: 'ASSISTED' })
    await ctx.db.patch(run._id, {
      stateJson: JSON.stringify(next),
      stateChecksum: checksumCanonicalJson(next)
    })
  })
}

it.each(['USE', 'DECLINE'] as const)(
  'settles Scene Legendary Resistance %s once and retains spatial history at STOP',
  async (selection) => {
    const base = await setupCreatureReactionRun(null, false, false, 'CHOICE', 'CHOICE', {
      outcomeDice: true,
      stopOnFailedSave: true
    })
    const value = await setupReactionMovementScene(
      base,
      [base.reactor, base.mover],
      [50],
      [
        { x: 150, y: 50 },
        { x: 600, y: 50 }
      ]
    )
    const prefix = await seedSpatialEffect(
      { ...base, sceneId: value.sceneId },
      { x: 275, y: 50 },
      5
    )
    const suffix = await seedSpatialEffect(
      { ...base, sceneId: value.sceneId },
      { x: 475, y: 50 },
      5
    )
    await value.owner.caller.mutation(observe, { saveId: value.saveId, characterRevisions: [] })
    await value.owner.caller.mutation(prepare, value.request)
    const initial = await value.owner.caller.mutation(finish, value.request)
    const choice = initial.occurrence?.pending
    if (!choice || choice.kind !== 'MOVEMENT_REACTION' || !choice.choice.options[0])
      throw new Error('Expected a movement reaction choice.')
    const selected = await value.owner.caller.mutation(
      begin,
      command({
        encounterId: base.run.id,
        pending: choice,
        resolution: { kind: 'OPTION', optionId: choice.choice.options[0].optionId }
      })
    )
    if (!selected || selected.kind !== 'READY')
      throw new Error('Expected selected reaction staging.')
    const selectedRequest = { ...value.request, saveId: selected.saveId }
    await value.owner.caller.mutation(observe, { saveId: selected.saveId, characterRevisions: [] })
    await value.owner.caller.mutation(prepare, selectedRequest)
    const resisted = await value.owner.caller.mutation(finish, selectedRequest)
    const pending = resisted.occurrence?.pending
    if (!pending || pending.kind !== 'LEGENDARY_RESISTANCE_CHOICE')
      throw new Error('Expected a Legendary Resistance choice.')
    const resistanceCommand = command({
      encounterId: base.run.id,
      pending,
      resolution:
        selection === 'USE'
          ? { kind: 'OPTION', optionId: pending.options[0]!.optionId }
          : { kind: 'DECLINE' }
    })
    await expect(value.player.caller.mutation(begin, resistanceCommand)).rejects.toThrow(
      'another controller'
    )
    const resolved = await value.owner.caller.mutation(begin, resistanceCommand)
    if (!resolved || resolved.kind !== 'READY')
      throw new Error('Expected resistance response staging.')
    const request = { ...value.request, saveId: resolved.saveId }
    await value.owner.caller.mutation(observe, { saveId: resolved.saveId, characterRevisions: [] })
    const prepared = await value.owner.caller.mutation(prepare, request)
    expect(prepared.outcome.kind).toBe('TERMINAL')
    if (prepared.outcome.kind !== 'TERMINAL' || prepared.outcome.result.status !== 'BATCH_COMPLETE')
      throw new Error('Expected cumulative spatial history at the terminal reaction.')
    expect(
      prepared.outcome.result.executions.map((entry) => entry.candidate.candidate.effectId)
    ).toEqual(selection === 'USE' ? [prefix.id, suffix.id] : [prefix.id])
    const reactionDistance =
      prepared.outcome.result.reactionExecutions[0]!.option.candidate.pathDistance
    expect(prepared.outcome.result.executions[0]!.candidate.candidate.pathDistance).toBeLessThan(
      reactionDistance
    )
    if (selection === 'DECLINE')
      expect(prepared.outcome.result.terminalPosition).toEqual({ x: 300, y: 50 })
    const completed = await value.owner.caller.mutation(finish, request)
    expect(completed.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    const remaining = await value.owner.caller.run((ctx) =>
      ctx.db
        .query('encounterSpatialRuleEffects')
        .withIndex('by_encounterId_sceneId_id', (q) =>
          q.eq('encounterId', base.run.id).eq('sceneId', value.sceneId)
        )
        .collect()
    )
    expect(remaining.map((entry) => entry.id)).toEqual(selection === 'USE' ? [] : [suffix.id])
    await expect(value.owner.caller.mutation(finish, request)).resolves.toMatchObject({
      replayed: true
    })
  },
  30_000
)

it('issues and settles Legendary Resistance for an automatic Scene reaction', async () => {
  const base = await setupCreatureReactionRun(null, false, false, 'AUTOMATIC', 'AUTOMATIC', true)
  const value = await setupReactionMovementScene(base, [base.reactor, base.mover], [50])
  await value.owner.caller.mutation(observe, { saveId: value.saveId, characterRevisions: [] })
  const prepared = await value.owner.caller.mutation(prepare, value.request)
  expect(prepared.outcome.kind).toBe('PENDING')
  const issued = await value.owner.caller.mutation(finish, value.request)
  const pending = issued.occurrence?.pending
  if (!pending || pending.kind !== 'LEGENDARY_RESISTANCE_CHOICE' || !pending.options[0])
    throw new Error('Expected an automatic Legendary Resistance choice.')
  const staged = await value.owner.caller.mutation(
    begin,
    command({
      encounterId: base.run.id,
      pending,
      resolution: { kind: 'OPTION', optionId: pending.options[0].optionId }
    })
  )
  if (!staged || staged.kind !== 'READY') throw new Error('Expected automatic resistance staging.')
  const request = { ...value.request, saveId: staged.saveId }
  await value.owner.caller.mutation(observe, { saveId: staged.saveId, characterRevisions: [] })
  expect((await value.owner.caller.mutation(prepare, request)).outcome.kind).toBe('TERMINAL')
  await expect(value.owner.caller.mutation(finish, request)).resolves.toMatchObject({
    occurrence: { status: 'COMPLETE', pending: null }
  })
}, 30_000)

it('retains assisted TEST evidence before issuing Legendary Resistance', async () => {
  const base = await setupCreatureReactionRun(null, false, false, 'CHOICE', 'CHOICE', {
    outcomeDice: true
  })
  await setAssisted(base)
  const value = await setupReactionMovementScene(base, [base.reactor, base.mover], [50])
  await value.owner.caller.mutation(observe, { saveId: value.saveId, characterRevisions: [] })
  await value.owner.caller.mutation(prepare, value.request)
  const initial = await value.owner.caller.mutation(finish, value.request)
  const choice = initial.occurrence?.pending
  if (!choice || choice.kind !== 'MOVEMENT_REACTION' || !choice.choice.options[0])
    throw new Error('Expected reaction choice.')
  const selected = await value.owner.caller.mutation(
    begin,
    command({
      encounterId: base.run.id,
      pending: choice,
      resolution: { kind: 'OPTION', optionId: choice.choice.options[0].optionId }
    })
  )
  if (!selected || selected.kind !== 'READY') throw new Error('Expected selected staging.')
  const request = { ...value.request, saveId: selected.saveId }
  await value.owner.caller.mutation(observe, { saveId: selected.saveId, characterRevisions: [] })
  expect((await value.owner.caller.mutation(prepare, request)).outcome.kind).toBe('PENDING')
  const evidence = (await value.owner.caller.mutation(finish, request)).occurrence?.pending
  if (!evidence || evidence.kind !== 'D20_EVIDENCE')
    throw new Error('Expected assisted TEST evidence.')
  const rolled = await value.owner.caller.mutation(
    begin,
    command({
      encounterId: base.run.id,
      pending: evidence,
      resolution: {
        kind: 'ENTER_DICE',
        requestId: evidence.request.requestId,
        rawFaces: [evidence.request.min]
      }
    })
  )
  if (!rolled || rolled.kind !== 'READY') throw new Error('Expected TEST staging.')
  const rolledRequest = { ...value.request, saveId: rolled.saveId }
  await value.owner.caller.mutation(observe, { saveId: rolled.saveId, characterRevisions: [] })
  expect((await value.owner.caller.mutation(prepare, rolledRequest)).outcome.kind).toBe('PENDING')
  const resistance = (await value.owner.caller.mutation(finish, rolledRequest)).occurrence?.pending
  if (!resistance || resistance.kind !== 'LEGENDARY_RESISTANCE_CHOICE')
    throw new Error('Expected Legendary Resistance choice.')
  const declined = await value.owner.caller.mutation(
    begin,
    command({
      encounterId: base.run.id,
      pending: resistance,
      resolution: { kind: 'DECLINE' }
    })
  )
  if (!declined || declined.kind !== 'READY')
    throw new Error('Expected resistance decline staging.')
  let replayRequest = { ...value.request, saveId: declined.saveId }
  let outcomeRequests = 0
  for (let index = 0; ; index++) {
    expect(index).toBeLessThan(20)
    await value.owner.caller.mutation(observe, {
      saveId: replayRequest.saveId,
      characterRevisions: []
    })
    const outcome = await value.owner.caller.mutation(prepare, replayRequest)
    expect(['PENDING', 'TERMINAL']).toContain(outcome.outcome.kind)
    const completed = await value.owner.caller.mutation(finish, replayRequest)
    if (completed.occurrence?.status === 'COMPLETE') {
      expect(outcomeRequests).toBeGreaterThan(0)
      await expect(value.owner.caller.mutation(finish, replayRequest)).resolves.toMatchObject({
        replayed: true
      })
      break
    }
    const pending = completed.occurrence?.pending
    if (!pending || pending.kind !== 'ACTION_OUTCOME_EVIDENCE')
      throw new Error('Expected assisted OUTCOME evidence.')
    outcomeRequests++
    const staged = await value.owner.caller.mutation(
      begin,
      command({
        encounterId: base.run.id,
        pending,
        resolution: { kind: 'SYSTEM_ROLL', requestId: pending.request.requestId }
      })
    )
    if (!staged || staged.kind !== 'READY') throw new Error('Expected OUTCOME staging.')
    replayRequest = { ...value.request, saveId: staged.saveId }
  }
}, 30_000)
