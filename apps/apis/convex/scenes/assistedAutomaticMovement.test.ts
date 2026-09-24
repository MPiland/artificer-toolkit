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
    if (!run) throw new Error('Assisted automatic Run is unavailable.')
    const state = encounterRunStateSchema.parse(JSON.parse(run.stateJson))
    const next = encounterRunStateSchema.parse({ ...state, automationMode: 'ASSISTED' })
    await ctx.db.patch(run._id, {
      stateJson: JSON.stringify(next),
      stateChecksum: checksumCanonicalJson(next)
    })
  })
}

async function actorChecksums(value: Awaited<ReturnType<typeof setupReactionMovementScene>>) {
  return value.base.t.run(async (ctx) =>
    (
      await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', value.base.run.id))
        .collect()
    ).map((actor) => actor.stateChecksum)
  )
}

it('converts an automatic selection into an assisted controller choice before TEST and OUTCOME evidence', async () => {
  const base = await setupCreatureReactionRun(null, false, false, 'AUTOMATIC', 'AUTOMATIC', {
    outcomeDice: true
  })
  await setAssisted(base)
  const value = await setupReactionMovementScene(base, [base.reactor, base.mover], [50])
  await value.owner.caller.mutation(observe, { saveId: value.saveId, characterRevisions: [] })
  const beforePause = await actorChecksums(value)
  expect((await value.owner.caller.mutation(prepare, value.request)).outcome.kind).toBe('PENDING')
  const initial = await value.owner.caller.mutation(finish, value.request)
  expect(await actorChecksums(value)).toEqual(beforePause)
  const choice = initial.occurrence?.pending
  if (!choice || choice.kind !== 'MOVEMENT_REACTION' || !choice.choice.options[0])
    throw new Error('Expected the automatic policy to issue an assisted movement choice.')
  const selectAction = command({
    encounterId: base.run.id,
    pending: choice,
    resolution: { kind: 'OPTION', optionId: choice.choice.options[0].optionId }
  })
  await expect(value.player.caller.mutation(begin, selectAction)).rejects.toThrow(
    'another controller'
  )
  const selected = await value.owner.caller.mutation(begin, selectAction)
  if (!selected || selected.kind !== 'READY') throw new Error('Expected selected action staging.')
  const testRequest = { ...value.request, saveId: selected.saveId }
  await value.owner.caller.mutation(observe, { saveId: selected.saveId, characterRevisions: [] })
  expect((await value.owner.caller.mutation(prepare, testRequest)).outcome.kind).toBe('PENDING')
  expect(await actorChecksums(value)).toEqual(beforePause)
  const testEvidence = (await value.owner.caller.mutation(finish, testRequest)).occurrence?.pending
  if (!testEvidence || testEvidence.kind !== 'D20_EVIDENCE')
    throw new Error('Expected assisted TEST evidence after selecting the issued action.')
  const enterTest = command({
    encounterId: base.run.id,
    pending: testEvidence,
    resolution: {
      kind: 'ENTER_DICE',
      requestId: testEvidence.request.requestId,
      rawFaces: [testEvidence.request.min]
    }
  })
  const testStage = await value.owner.caller.mutation(begin, enterTest)
  if (!testStage || testStage.kind !== 'READY') throw new Error('Expected TEST evidence staging.')
  const rolledRequest = { ...value.request, saveId: testStage.saveId }
  await value.owner.caller.mutation(observe, { saveId: testStage.saveId, characterRevisions: [] })
  expect((await value.owner.caller.mutation(prepare, rolledRequest)).outcome.kind).toBe('PENDING')
  const resistance = (await value.owner.caller.mutation(finish, rolledRequest)).occurrence?.pending
  expect(await actorChecksums(value)).toEqual(beforePause)
  if (!resistance || resistance.kind !== 'LEGENDARY_RESISTANCE_CHOICE')
    throw new Error('Expected the reaction consequence choice after TEST evidence.')
  const decline = await value.owner.caller.mutation(
    begin,
    command({
      encounterId: base.run.id,
      pending: resistance,
      resolution: { kind: 'DECLINE' }
    })
  )
  if (!decline || decline.kind !== 'READY')
    throw new Error('Expected consequence response staging.')
  let request = { ...value.request, saveId: decline.saveId }
  let complete: SceneGeometryCommandResult | null = null
  let outcomeEvidenceCount = 0
  for (let index = 0; index < 20; index++) {
    await value.owner.caller.mutation(observe, { saveId: request.saveId, characterRevisions: [] })
    expect((await value.owner.caller.mutation(prepare, request)).outcome.kind).toMatch(
      /PENDING|TERMINAL/
    )
    const result = await value.owner.caller.mutation(finish, request)
    if (result.occurrence?.status === 'COMPLETE') {
      complete = result
      break
    }
    const outcomeEvidence = result.occurrence?.pending
    if (!outcomeEvidence || outcomeEvidence.kind !== 'ACTION_OUTCOME_EVIDENCE')
      throw new Error('Expected assisted OUTCOME evidence.')
    expect(await actorChecksums(value)).toEqual(beforePause)
    outcomeEvidenceCount++
    const staged = await value.owner.caller.mutation(
      begin,
      command({
        encounterId: base.run.id,
        pending: outcomeEvidence,
        resolution: { kind: 'SYSTEM_ROLL', requestId: outcomeEvidence.request.requestId }
      })
    )
    if (!staged || staged.kind !== 'READY') throw new Error('Expected OUTCOME evidence staging.')
    request = { ...value.request, saveId: staged.saveId }
  }
  if (!complete) throw new Error('Assisted automatic reaction did not complete.')
  expect(outcomeEvidenceCount).toBeGreaterThan(0)
  expect(complete.delta).toMatchObject({ tokenId: value.moverTokenId, position: { x: 450, y: 50 } })
  await expect(value.owner.caller.mutation(finish, request)).resolves.toMatchObject({
    replayed: true
  })
  await expect(
    value.owner.caller.mutation(begin, {
      ...selectAction,
      commandId: crypto.randomUUID(),
      expectedOccurrenceVersion: selectAction.expectedOccurrenceVersion + 1
    })
  ).resolves.toBeNull()
}, 30_000)
