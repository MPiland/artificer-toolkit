import { expect, it, vi } from 'vitest'
import { makeFunctionReference } from 'convex/server'
import type {
  EncounterExecuteInput,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterCommandResultDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import type {
  SceneGeometryBeginResult,
  SceneGeometryCommandResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import {
  setupCreatureReactionRun,
  reactionRecords
} from '../../tests/fixtures/movementReactionEffects'
import { setupReactionMovementScene } from '../../tests/fixtures/automaticSceneMovement'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { readEncounterActorConditionState } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  encounterRunStateSchema,
  encounterRunActorStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { api, internal } from '../_generated/api'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: (maximum: number) => maximum - 1 }))

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

async function setAssisted(base: Awaited<ReturnType<typeof setupCreatureReactionRun>>) {
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!row) throw new Error('Movement reaction Run missing.')
    const state = encounterRunStateSchema.parse(JSON.parse(row.stateJson))
    const next = encounterRunStateSchema.parse({ ...state, automationMode: 'ASSISTED' })
    await ctx.db.patch(row._id, {
      stateJson: JSON.stringify(next),
      stateChecksum: checksumCanonicalJson(next)
    })
  })
}

async function effects(base: Awaited<ReturnType<typeof setupCreatureReactionRun>>) {
  return base.t.run((ctx) =>
    ctx.db
      .query('encounterActiveRuleEffects')
      .withIndex('by_encounterId_targetActorId_id', (q) => q.eq('encounterId', base.run.id))
      .take(16)
  )
}

async function publish(
  scene: Awaited<ReturnType<typeof setupReactionMovementScene>>,
  request: Request
) {
  await scene.owner.caller.mutation(observe, { saveId: request.saveId, characterRevisions: [] })
  const prepared = await scene.owner.caller.mutation(prepare, request)
  const result = await scene.owner.caller.mutation(finish, request)
  return { prepared, result }
}

function resolution(
  encounterId: string,
  pending: { encounterVersion: number; occurrenceId: string; occurrenceVersion: number },
  value: ResolveRuleOccurrenceInputDto['resolution']
): ResolveRuleOccurrenceInputDto {
  return {
    type: 'RESOLVE_RULE_OCCURRENCE',
    commandId: crypto.randomUUID(),
    encounterId,
    expectedVersion: pending.encounterVersion,
    occurrenceId: pending.occurrenceId,
    expectedOccurrenceVersion: pending.occurrenceVersion,
    correlationId: null,
    resolution: value
  }
}

function moverConditionIds(stateJson: string) {
  const actor = encounterRunActorStateSchema.parse(JSON.parse(stateJson))
  if (actor.kind === 'CHARACTER') throw new Error('Expected a non-Character movement target.')
  return readEncounterActorConditionState(actor.conditions).ids
}

function diceResponse(encounterId: string, input: unknown, face: number): EncounterExecuteInput {
  const result = encounterCommandResultDtoSchema.parse(input)
  const pending = result.occurrence?.pending
  if (!pending || pending.kind !== 'D20_EVIDENCE' || !pending.request)
    throw new Error('Expected repeated condition save evidence.')
  return {
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: result.projection.version,
      correlationId: null,
      occurrenceId: result.occurrence!.occurrenceId,
      expectedOccurrenceVersion: result.occurrence!.occurrenceVersion,
      resolution: {
        kind: 'ENTER_DICE',
        requestId: pending.request.requestId,
        rawFaces: pending.request.rollMode === 'NORMAL' ? [face] : [face, face]
      }
    }
  }
}

it('publishes a real repeated-save condition from an Automatic Scene reaction', async () => {
  const base = await setupCreatureReactionRun(null, true, false, 'AUTOMATIC')
  const scene = await setupReactionMovementScene(base, [base.reactor, base.mover], [50])
  const before = await reactionRecords(base.t, base.run.id)
  const published = await publish(scene, scene.request)

  expect(published.prepared.outcome.kind).toBe('TERMINAL')
  expect(published.result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  const created = await effects(base)
  expect(created).toHaveLength(1)
  expect(created[0]).toMatchObject({
    encounterId: base.run.id,
    targetActorId: base.mover.id
  })
  const actor = (await reactionRecords(base.t, base.run.id)).actors.find(
    (entry) => entry.id === base.mover.id
  )
  if (!actor) throw new Error('Movement reaction target missing.')
  expect(moverConditionIds(actor.stateJson)).not.toEqual([])
  expect(before.actors).not.toEqual((await reactionRecords(base.t, base.run.id)).actors)
}, 30_000)

it('keeps an Assisted reaction inert until entered dice, then replays one created effect', async () => {
  const base = await setupCreatureReactionRun(null, true, false, 'AUTOMATIC')
  const frightened = srdSystemRecord.conditionTypes.find(
    (condition) => condition.code === 'FRIGHTENED'
  )
  if (!frightened) throw new Error('Expected the System Frightened condition.')
  await setAssisted(base)
  const scene = await setupReactionMovementScene(base, [base.reactor, base.mover], [50])
  await scene.owner.caller.mutation(observe, {
    saveId: scene.request.saveId,
    characterRevisions: []
  })
  const before = await reactionRecords(base.t, base.run.id)
  const prepared = await scene.owner.caller.mutation(prepare, scene.request)
  expect(prepared.outcome.kind).toBe('PENDING')
  expect(await reactionRecords(base.t, base.run.id)).toEqual(before)
  expect(await effects(base)).toEqual([])

  const pendingResult = await scene.owner.caller.mutation(finish, scene.request)
  const choice = pendingResult.occurrence?.pending
  if (!choice || choice.kind !== 'MOVEMENT_REACTION' || !choice.choice.options[0])
    throw new Error('Expected the assisted movement reaction choice.')
  expect(await effects(base)).toEqual([])
  const stale = resolution(base.run.id, choice, {
    kind: 'OPTION',
    optionId: choice.choice.options[0].optionId
  })
  await expect(
    scene.owner.caller.mutation(begin, { ...stale, expectedVersion: stale.expectedVersion - 1 })
  ).rejects.toThrow()
  expect(await effects(base)).toEqual([])

  const response = resolution(base.run.id, choice, {
    kind: 'OPTION',
    optionId: choice.choice.options[0].optionId
  })
  const started = await scene.owner.caller.mutation(begin, response)
  if (!started || started.kind !== 'READY') throw new Error('Expected staged assisted response.')
  const reactionRequest = { ...scene.request, saveId: started.saveId }
  const attack = await publish(scene, reactionRequest)
  const attackPending = attack.result.occurrence?.pending
  if (!attackPending || attackPending.kind !== 'D20_EVIDENCE')
    throw new Error('Expected assisted reaction attack evidence.')
  expect(await effects(base)).toEqual([])
  const attackStarted = await scene.owner.caller.mutation(
    begin,
    resolution(base.run.id, attackPending, {
      kind: 'ENTER_DICE',
      requestId: attackPending.request.requestId,
      rawFaces: [20]
    })
  )
  if (!attackStarted || attackStarted.kind !== 'READY')
    throw new Error('Expected staged attack evidence.')
  const saveRequest = { ...scene.request, saveId: attackStarted.saveId }
  const outcome = await publish(scene, saveRequest)
  const outcomePending = outcome.result.occurrence?.pending
  if (!outcomePending || outcomePending.kind !== 'ACTION_OUTCOME_EVIDENCE')
    throw new Error('Expected assisted reaction outcome evidence.')
  const outcomeStarted = await scene.owner.caller.mutation(
    begin,
    resolution(base.run.id, outcomePending, {
      kind: 'SYSTEM_ROLL',
      requestId: outcomePending.request.requestId
    })
  )
  if (!outcomeStarted || outcomeStarted.kind !== 'READY')
    throw new Error('Expected staged outcome evidence.')
  let request = { ...scene.request, saveId: outcomeStarted.saveId }
  let completed: Awaited<ReturnType<typeof publish>> | null = null
  for (let step = 0; step < 10; step++) {
    const current = await publish(scene, request)
    if (current.prepared.outcome.kind === 'TERMINAL') {
      completed = current
      break
    }
    const pending = current.result.occurrence?.pending
    if (!pending || (pending.kind !== 'D20_EVIDENCE' && pending.kind !== 'ACTION_OUTCOME_EVIDENCE'))
      throw new Error('Expected assisted immediate reaction evidence.')
    const next = await scene.owner.caller.mutation(
      begin,
      resolution(
        base.run.id,
        pending,
        pending.kind === 'D20_EVIDENCE'
          ? {
              kind: 'ENTER_DICE',
              requestId: pending.request.requestId,
              rawFaces: pending.request.rollMode === 'NORMAL' ? [1] : [1, 1]
            }
          : { kind: 'SYSTEM_ROLL', requestId: pending.request.requestId }
      )
    )
    if (!next || next.kind !== 'READY')
      throw new Error('Expected staged immediate reaction evidence.')
    request = { ...scene.request, saveId: next.saveId }
  }
  if (!completed) throw new Error('Assisted immediate reaction did not complete.')
  expect(completed.prepared.outcome.kind).toBe('TERMINAL')
  expect(completed.result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  expect(await effects(base)).toHaveLength(1)
  const settled = await reactionRecords(base.t, base.run.id)
  await expect(scene.owner.caller.mutation(finish, request)).resolves.toMatchObject({
    replayed: true
  })
  expect(await reactionRecords(base.t, base.run.id)).toEqual(settled)
  expect(await effects(base)).toHaveLength(1)

  let projection = await scene.owner.caller.query(api.encounters.projectionReads.get, {
    encounterId: base.run.id
  })
  let targetTurns = 0
  for (let advances = 0; advances < 12 && targetTurns < 2; advances++) {
    const advanced = await scene.owner.caller.mutation(internal.encounters.commands.execute, {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: projection.version
      }
    })
    if (projection.currentActorId !== base.mover.id) {
      projection = advanced.projection
      continue
    }
    const resolved = await scene.owner.caller.action(
      internal.encounters.commandActions.execute,
      diceResponse(base.run.id, advanced, 20)
    )
    projection = resolved.projection
    targetTurns += 1
    if (targetTurns === 1) {
      expect(await effects(base)).toMatchObject([
        { lifecycle: { schemaVersion: 1, remainingTicks: 1 } }
      ])
      const target = (await reactionRecords(base.t, base.run.id)).actors.find(
        (actor) => actor.id === base.mover.id
      )
      if (!target) throw new Error('Expiry target actor missing.')
      expect(moverConditionIds(target.stateJson)).toContain(frightened.id)
    }
  }
  expect(targetTurns).toBe(2)
  expect(await effects(base)).toEqual([])
  const expiredTarget = (await reactionRecords(base.t, base.run.id)).actors.find(
    (actor) => actor.id === base.mover.id
  )
  if (!expiredTarget) throw new Error('Expired target actor missing.')
  expect(moverConditionIds(expiredTarget.stateJson)).not.toContain(frightened.id)
}, 30_000)
