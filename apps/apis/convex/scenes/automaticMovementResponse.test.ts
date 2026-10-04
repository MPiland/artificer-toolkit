import { expect, it, vi } from 'vitest'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import {
  setupAutomaticSceneMovement,
  useMovementReactions
} from '../../tests/fixtures/automaticSceneMovement'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'
import {
  executeInRoom,
  planMovementDecisionInRoom,
  planMovementInRoom,
  readEncounterHistory
} from '../../tests/fixtures/liveSessionWorker'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: () => 0 }))

it.each(['DECLINE', 'OPTION'] as const)(
  'continues %s into a used automatic reaction at the next contact',
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
        receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
        receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
        receipts: await (await readEncounterHistory(ctx)).query('encounterRuleReceipts').collect(),
        commands: await (await readEncounterHistory(ctx)).query('encounterRunCommands').collect(),
        scenes: await ctx.db.query('campaignScenes').collect(),
        entities: await ctx.db.query('sceneLiveEntities').collect(),
        sceneCommands: await ctx.db.query('sceneLiveCommands').collect()
      }))
    const root = await planMovementInRoom(value.owner.caller, value.rootInput)
    const initial = await root.publish()
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
    // Assisted play offers the next authored automatic reaction as Use/Decline; the GM uses it.
    const used = await useMovementReactions(
      value,
      10,
      await planMovementDecisionInRoom(value.owner.caller, command)
    )
    const { prepared } = used
    const before = await snapshot()
    if (prepared.outcome.kind !== 'TERMINAL')
      throw new Error('Expected the automatic suffix to complete.')
    const reactions = prepared.outcome.result.reactionExecutions
    expect(reactions).toHaveLength(selection === 'DECLINE' ? 1 : 2)
    expect(reactions.at(-1)?.option.candidate.reactorActorId).toBe(
      value.base.additionalReactorActor!.id
    )
    expect(reactions.map((entry) => entry.sourceCommandId)).toEqual(
      selection === 'DECLINE'
        ? [used.responseCommandId]
        : [command.commandId, used.responseCommandId]
    )
    expect(prepared.outcome.result.terminalPosition).toEqual({ x: 450, y: 50 })
    const result = await used.publish()
    expect(result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    const after = await snapshot()
    expect(after.runs[0]!.version).toBe(before.runs[0]!.version + 1)
    expect(after.commands.length).toBe(before.commands.length + 1)
    expect(
      after.receipts.filter((receipt) => receipt.occurrenceId === choice.occurrenceId).length
    ).toBeGreaterThan(1)
    // A fresh answer to the settled decision is stale (D78).
    await expect(
      executeInRoom(value.owner.caller, {
        command: { ...command, commandId: crypto.randomUUID() }
      })
    ).rejects.toMatchObject({ data: { reason: 'VERSION_STALE' } })
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
    const prepared = await planMovementInRoom(value.owner.caller, value.rootInput)
    expect(prepared.outcome.kind).toBe('PENDING')
    const initial = await prepared.publish()
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
    const request = await planMovementDecisionInRoom(value.owner.caller, command)
    const responsePrepared = { outcome: request.outcome }
    expect(responsePrepared.outcome.kind).toBe('PENDING')
    const next = await request.publish()
    const nextChoice = next.occurrence?.pending
    if (!nextChoice || nextChoice.kind !== 'MOVEMENT_REACTION')
      throw new Error('Expected the second mixed movement choice.')
    expect((await effects()).find((entry) => entry.id === effect.id)).toBeUndefined()
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
    const terminalRequest = await planMovementDecisionInRoom(value.owner.caller, terminalCommand)
    expect(terminalRequest.outcome.kind).toBe('TERMINAL')
    const terminal = await terminalRequest.publish()
    expect(terminal.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    expect((await effects()).find((entry) => entry.id === effect.id)).toBeUndefined()
    if (initial.delta?.kind !== 'TOKEN_MOVED')
      throw new Error('Expected a committed first segment.')
    expect(initial.delta.position).not.toEqual(value.rootInput.path[0])
  },
  30_000
)
