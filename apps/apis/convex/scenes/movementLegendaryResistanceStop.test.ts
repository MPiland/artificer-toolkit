import { expect, it, vi } from 'vitest'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import { setupCreatureReactionRun } from '../../tests/fixtures/movementReaction'
import { setupReactionMovementScene } from '../../tests/fixtures/automaticSceneMovement'
import {
  planMovementDecisionInRoom,
  planStagedMovementInRoom
} from '../../tests/fixtures/liveSessionWorker'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: () => 0 }))

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
    const root = await planStagedMovementInRoom(value.owner.caller, value.saveId)
    const initial = await root.publish()
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
    expect(reaction.option.candidate.contact).toEqual({ x: 200, y: 50 })
    expect(outcome.result.terminalPosition).toEqual(
      selection === 'USE' ? { x: 450, y: 50 } : reaction.option.candidate.contact
    )
    const completed = await publish()
    expect(completed.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    await expect(publish()).resolves.toMatchObject({ replayed: true })
  },
  30_000
)
