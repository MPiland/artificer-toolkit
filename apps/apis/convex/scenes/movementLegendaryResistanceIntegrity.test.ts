import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import type {
  SceneGeometryBeginResult,
  SceneGeometryCommandResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { movementRuleResolutionCommandDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { setupCreatureReactionRun } from '../../tests/fixtures/movementReaction'
import { setupReactionMovementScene } from '../../tests/fixtures/automaticSceneMovement'
import { evaluateSceneMovementActionResponse } from './movementActionResponse.helper'
import { assertMovementResolutionCurrent } from './movementResolutionDocuments'
import { readGeometrySave } from './geometryDocuments'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: () => 0 }))

type Request = ReturnType<typeof sceneSpatialPrepareInputSchema.parse>
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
const prepare = makeFunctionReference<'mutation', Request, SceneSpatialPreparation>(
  'scenes/spatialPreparation:prepare'
)
const finish = makeFunctionReference<'mutation', Request, SceneGeometryCommandResult>(
  'scenes/geometryCommands:finish'
)

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

async function gameplayRows(value: Awaited<ReturnType<typeof setupReactionMovementScene>>) {
  return value.base.t.run(async (ctx) => ({
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
      .unique(),
    actors: await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', value.base.run.id))
      .collect(),
    occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
    receipts: await ctx.db.query('encounterRuleReceipts').collect(),
    scenes: await ctx.db.query('sceneLiveStates').collect(),
    entities: await ctx.db.query('sceneLiveEntities').collect(),
    commands: await ctx.db.query('sceneLiveCommands').collect()
  }))
}

it('rejects a retained USE preparation forged over an actual DECLINE response without gameplay writes', async () => {
  const base = await setupCreatureReactionRun(null, false, false, 'CHOICE', 'CHOICE', {
    outcomeDice: true
  })
  const value = await setupReactionMovementScene(base, [base.reactor, base.mover], [50])

  await value.owner.caller.mutation(observe, { saveId: value.saveId, characterRevisions: [] })
  await value.owner.caller.mutation(prepare, value.request)
  const initial = await value.owner.caller.mutation(finish, value.request)
  const reactionChoice = initial.occurrence?.pending
  if (
    !reactionChoice ||
    reactionChoice.kind !== 'MOVEMENT_REACTION' ||
    !reactionChoice.choice.options[0]
  )
    throw new Error('Expected a movement reaction choice.')
  const selected = await value.owner.caller.mutation(
    begin,
    command({
      encounterId: base.run.id,
      pending: reactionChoice,
      resolution: { kind: 'OPTION', optionId: reactionChoice.choice.options[0].optionId }
    })
  )
  if (!selected || selected.kind !== 'READY') throw new Error('Expected selected reaction staging.')
  const selectedRequest = { ...value.request, saveId: selected.saveId }
  await value.owner.caller.mutation(observe, { saveId: selected.saveId, characterRevisions: [] })
  await value.owner.caller.mutation(prepare, selectedRequest)
  const resisted = await value.owner.caller.mutation(finish, selectedRequest)
  const resistanceChoice = resisted.occurrence?.pending
  if (!resistanceChoice || resistanceChoice.kind !== 'LEGENDARY_RESISTANCE_CHOICE')
    throw new Error('Expected a Legendary Resistance choice.')

  const declined = await value.owner.caller.mutation(
    begin,
    command({
      encounterId: base.run.id,
      pending: resistanceChoice,
      resolution: { kind: 'DECLINE' }
    })
  )
  if (!declined || declined.kind !== 'READY')
    throw new Error('Expected resistance decline staging.')
  const request = { ...value.request, saveId: declined.saveId }
  await value.owner.caller.mutation(observe, { saveId: declined.saveId, characterRevisions: [] })
  const originalPreparation = await value.owner.caller.mutation(prepare, request)

  await value.owner.caller.run(async (ctx) => {
    const { row, save } = await readGeometrySave(ctx, declined.saveId)
    const current = await assertMovementResolutionCurrent(ctx, save)
    const useOptionId =
      current.context.kind === 'ENCOUNTER_MOVEMENT_REACTION' &&
      current.context.phase.kind === 'LEGENDARY_RESISTANCE_CHOICE'
        ? current.context.phase.resistance.useOptionId
        : null
    if (!useOptionId) throw new Error('Expected Legendary Resistance USE option.')
    const alternate = {
      ...current.command,
      resolution: { kind: 'OPTION' as const, optionId: useOptionId }
    }
    const responseCommand = movementRuleResolutionCommandDtoSchema.parse({
      commandId: current.command.commandId,
      commandFingerprint: checksumCanonicalJson(alternate),
      actorUserId: current.userId,
      correlationId: current.command.correlationId,
      expectedOccurrenceVersion: current.command.expectedOccurrenceVersion,
      kind: alternate.resolution.kind,
      optionId: alternate.resolution.optionId
    })
    const evaluated = await evaluateSceneMovementActionResponse(ctx, {
      request,
      current: { ...current, command: alternate },
      responseCommand,
      occurredAt: originalPreparation.occurredAt
    })
    const alternatePreparation = {
      encounterId: current.state.id,
      expectedEncounterVersion: current.state.version,
      occurrenceId: current.occurrence.id,
      occurredAt: originalPreparation.occurredAt,
      outcome: evaluated.outcome
    }
    await ctx.db.patch(row._id, {
      spatialPreparationJson: JSON.stringify(alternatePreparation),
      spatialPreparationChecksum: checksumCanonicalJson(alternatePreparation)
    })
  })

  const before = await gameplayRows(value)
  await expect(value.owner.caller.mutation(finish, request)).rejects.toThrow(
    'does not match the issued response'
  )
  expect(await gameplayRows(value)).toEqual(before)
}, 30_000)
