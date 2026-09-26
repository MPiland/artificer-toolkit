import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { SceneGeometryCommandResult } from '@artificer-toolkit/schema/api/sceneGeometry'
import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { setupCreatureReactionRun } from '../../tests/fixtures/movementReaction'
import { setupReactionMovementScene } from '../../tests/fixtures/automaticSceneMovement'
import { planMovementDecisionInRoom } from '../../tests/fixtures/liveSessionWorker'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: () => 0 }))

type Request = ReturnType<typeof sceneSpatialPrepareInputSchema.parse>
const prepare = makeFunctionReference<'mutation', Request, SceneSpatialPreparation>(
  'scenes/spatialPreparation:prepare'
)
const finish = makeFunctionReference<'mutation', Request, SceneGeometryCommandResult>(
  'scenes/geometryCommands:finish'
)
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

it.each(['USE', 'DECLINE'] as const)(
  'applies authored failed-save STOP after Scene LR %s',
  async (selection) => {
    const base = await setupCreatureReactionRun(null, false, false, 'CHOICE', 'CHOICE', {
      outcomeDice: true,
      stopOnFailedSave: true
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
      throw new Error('Expected issued Scene reaction choice.')
    const resisted = await (
      await planMovementDecisionInRoom(
        value.owner.caller,
        command({
          encounterId: base.run.id,
          pending: reactionChoice,
          resolution: { kind: 'OPTION', optionId: reactionChoice.choice.options[0].optionId }
        })
      )
    ).publish()
    const resistance = resisted.occurrence?.pending
    if (!resistance || resistance.kind !== 'LEGENDARY_RESISTANCE_CHOICE')
      throw new Error('Expected issued Scene LR choice.')
    const { outcome, publish } = await planMovementDecisionInRoom(
      value.owner.caller,
      command({
        encounterId: base.run.id,
        pending: resistance,
        resolution:
          selection === 'USE'
            ? { kind: 'OPTION', optionId: resistance.options[0]!.optionId }
            : { kind: 'DECLINE' }
      })
    )
    expect(outcome?.kind).toBe('TERMINAL')
    if (outcome?.kind !== 'TERMINAL') throw new Error('Expected LR to complete Scene movement.')
    expect(outcome.result.reactionExecutions).toHaveLength(1)
    const reaction = outcome.result.reactionExecutions[0]!
    expect(reaction.option.binding.movementInterruption).toEqual({
      kind: 'STOP',
      whenResultPath: 'ON_SAVE_FAIL'
    })
    expect(reaction.phaseReceipts?.[0]?.execution.outputs.resultPath).toBe('ON_SAVE_FAIL')
    expect(reaction.legendaryResistance?.use).toBe(selection === 'USE')
    expect(reaction.application).toMatchObject({
      targetFeatureResourceConsumption:
        selection === 'USE' ? expect.objectContaining({ beforeUsed: 0, afterUsed: 1 }) : null
    })
    expect(reaction.option.candidate.contact).toEqual({ x: 300, y: 50 })
    expect(outcome.result.terminalPosition).toEqual(
      selection === 'USE' ? { x: 450, y: 50 } : reaction.option.candidate.contact
    )
    const completed = await publish()
    expect(completed.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    await expect(publish()).resolves.toMatchObject({ replayed: true })
  },
  30_000
)
