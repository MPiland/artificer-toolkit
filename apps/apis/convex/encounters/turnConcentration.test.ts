import { readReceiptHeaders } from '../lib/receiptLedgers'
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { EncounterExecuteInput } from '@artificer-toolkit/schema/api/encounters'
import { encounterCommandResultDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import { encounterPlayerProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { api } from '../_generated/api'
import { readCharacterRow } from '../characters/stateDocuments'
import * as rollRandom from '../lib/rollRandom'
import { consumeUserRateLimit } from '../lib/rateLimits'
import { seedConcentration } from '../../tests/fixtures/concentration'
import { turnConcentrationFixture } from '../../tests/fixtures/turnConcentration'
import { seedTurnSaveEffect } from '../../tests/fixtures/turnActiveEffectFixtures'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { executeInRoom, replayInRoom, readEncounterHistory } from '../../tests/fixtures/liveSessionWorker'

type Fixture = Awaited<ReturnType<typeof turnConcentrationFixture>>

async function records(base: Fixture) {
  const characterIds = [base.character.id, base.targetCharacter.id]
  return base.t.run(async (ctx) => ({
    receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (query) => query.eq('id', base.run.id))
      .unique(),
    actors: await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (query) => query.eq('encounterId', base.run.id))
      .collect(),
    characters: await Promise.all(characterIds.map((id) => readCharacterRow(ctx, id))),
    effects: (
      await Promise.all(
        characterIds.map((id) =>
          ctx.db
            .query('characterActiveRuleEffects')
            .withIndex('by_characterId_createdOrdinal_id', (query) => query.eq('characterId', id))
            .collect()
        )
      )
    ).flat(),
    states: await ctx.db
      .query('encounterMaintainedEffectStates')
      .withIndex('by_encounter_owner_definition_order', (query) =>
        query.eq('encounterId', base.run.id)
      )
      .collect(),
    occurrences: await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (query) => query.eq('encounterId', base.run.id))
      .collect(),
    receipts: await (await readEncounterHistory(ctx))
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (query) => query.eq('encounterId', base.run.id))
      .collect()
  }))
}

/** Concentration checks the rules logged: TABLE chat rolls and the GM's private roll history. */
async function ruleCheckRolls(base: Fixture) {
  return base.t.run(async (ctx) => ({
    table: (await ctx.db.query('campaignConversationEntryPayloads').collect()).flatMap((payload) =>
      payload.roll?.ruleCheck ? [payload.roll] : []
    ),
    gm: (
      await ctx.db
        .query('userRollHistory')
        .withIndex('by_userId_createdAt_id', (q) => q.eq('userId', base.owner.userId))
        .collect()
    ).filter((roll) => roll.ruleCheck)
  }))
}
function response(
  encounterId: string,
  pending: {
    encounterVersion: number
    occurrenceId: string
    occurrenceVersion: number
    request: { requestId: string; rollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE' }
  },
  face: number,
  appRollId?: string
): EncounterExecuteInput {
  return {
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: pending.encounterVersion,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      correlationId: null,
      resolution: appRollId
        ? { kind: 'SYSTEM_ROLL', requestId: pending.request.requestId, rollId: appRollId }
        : {
            kind: 'ENTER_DICE',
            requestId: pending.request.requestId,
            rawFaces: [face],
            rollMode: pending.request.rollMode
          }
    }
  }
}

async function start(base: Fixture, preferredActorId?: string) {
  const command: EncounterExecuteInput = {
    command: {
      type: 'START',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: base.run.version
    }
  }
  const initial = await executeInRoom(base.owner.caller, command)
  let result = initial
  while (result.occurrence?.status === 'PENDING') {
    const pending = result.occurrence.pending
    if (
      !pending ||
      (pending.kind !== 'INITIATIVE_EVIDENCE' &&
        pending.kind !== 'D20_EVIDENCE' &&
        pending.kind !== 'INITIATIVE_ORDER')
    )
      throw new Error(
        `Expected only initiative evidence while starting the turn fixture: ${pending?.kind}.`
      )
    const resolution =
      pending.kind === 'INITIATIVE_EVIDENCE'
        ? { kind: 'ENTER_INTEGER' as const, requestId: pending.request.requestId, value: 10 }
        : pending.kind === 'D20_EVIDENCE'
          ? {
              kind: 'ENTER_DICE' as const,
              requestId: pending.request.requestId,
              rawFaces: [10],
              rollMode: pending.request.rollMode
            }
          : {
              kind: 'INITIATIVE_ENTITY' as const,
              requestId: pending.requestId,
              entityId:
                pending.optionIds.find((optionId) => optionId === preferredActorId) ??
                pending.optionIds[0]!
            }
    result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: pending.encounterVersion,
        occurrenceId: pending.occurrenceId,
        expectedOccurrenceVersion: pending.occurrenceVersion,
        correlationId: null,
        resolution
      }
    })
  }
  return { result: encounterCommandResultDtoSchema.parse(result), initial, command }
}

async function prepareTurn(base: Fixture) {
  const { result: started } = await start(base)
  const currentActorId = started.projection.currentActorId
  const a = [base.sourceActor, base.targetActor].find((actor) => actor.id === currentActorId)
  const b = [base.sourceActor, base.targetActor].find((actor) => actor.id !== currentActorId)
  if (!a || !b || !a.sourceId || !b.sourceId)
    throw new Error('Expected two ordered Character turns.')
  const characterFor = (actorId: string) =>
    actorId === base.sourceActor.id
      ? { character: base.character, controller: base.player }
      : { character: base.targetCharacter, controller: base.targetController }
  const aOwner = characterFor(a.id)
  const bOwner = characterFor(b.id)
  const turnBase = { ...base, run: { ...base.run, actors: [a, b] } }
  const nextBase = { ...base, run: { ...base.run, actors: [b, a] } }
  const aConcentration = await seedConcentration({
    t: base.t,
    run: base.run,
    target: a,
    character: aOwner.character
  })
  const bConcentration = await seedConcentration({
    t: base.t,
    run: base.run,
    target: b,
    character: bOwner.character
  })
  const outgoingFirst = await seedTurnSaveEffect(turnBase, {
    stage: 'END_OF_TURN',
    ticks: 2,
    damage: 1
  })
  const outgoingSecond = await seedTurnSaveEffect(turnBase, {
    stage: 'END_OF_TURN',
    ticks: 2,
    damage: 1
  })
  const incoming = await seedTurnSaveEffect(nextBase, {
    stage: 'START_OF_TURN',
    ticks: 2,
    damage: 1
  })
  const advance: EncounterExecuteInput = {
    command: {
      type: 'ADVANCE_TURN',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: started.projection.version
    }
  }
  return {
    started,
    a,
    b,
    aOwner,
    bOwner,
    aConcentration,
    bConcentration,
    outgoingFirst,
    outgoingSecond,
    incoming,
    advance
  }
}

async function finishTurnEffects(base: Fixture, command: EncounterExecuteInput) {
  const initial = await executeInRoom(base.owner.caller, command)
  let result = initial
  const responses: EncounterExecuteInput[] = []
  while (result.occurrence?.status === 'PENDING') {
    const pending = result.occurrence.pending
    if (!pending || pending.kind !== 'D20_EVIDENCE')
      throw new Error('Expected original turn-effect evidence before concentration.')
    const input = response(base.run.id, pending, 1)
    responses.push(input)
    result = await executeInRoom(base.owner.caller, input)
  }
  return { result: encounterCommandResultDtoSchema.parse(result), initial, responses }
}

describe('turn damage concentration ordering', () => {
  it('retains an Assisted success between failures that advance the Run twice', async () => {
    const base = await turnConcentrationFixture('PROMPT')
    const prepared = await prepareTurn(base)
    await seedTurnSaveEffect(
      { ...base, run: { ...base.run, actors: [prepared.b, prepared.a] } },
      {
        stage: 'START_OF_TURN',
        ticks: 2,
        damage: 1
      }
    )
    const { result: parent, responses } = await finishTurnEffects(base, prepared.advance)
    expect(responses).toHaveLength(4)
    const before = await records(base)
    const completed: Array<{
      caller: typeof base.owner.caller
      input: EncounterExecuteInput
      result: ReturnType<typeof encounterCommandResultDtoSchema.parse>
    }> = []
    for (const check of [
      {
        caller: prepared.aOwner.controller.caller,
        face: 1,
        versionDelta: 0,
        outcome: 'SAVE_FAILURE'
      },
      {
        caller: prepared.bOwner.controller.caller,
        face: 20,
        versionDelta: 1,
        outcome: 'SAVE_SUCCESS'
      },
      {
        caller: prepared.bOwner.controller.caller,
        face: 1,
        versionDelta: 1,
        outcome: 'SAVE_FAILURE'
      }
    ]) {
      const pending = await check.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
      if (!pending || pending.kind !== 'D20_EVIDENCE')
        throw new Error('Expected the next controller concentration check.')
      expect(pending.encounterVersion).toBe(parent.projection.version + check.versionDelta)
      const input = response(base.run.id, pending, check.face)
      const result = encounterCommandResultDtoSchema.parse(await executeInRoom(check.caller, input))
      expect(result.occurrence).toMatchObject({ status: 'COMPLETE', outcome: check.outcome })
      completed.push({ caller: check.caller, input, result })
    }
    const terminal = await records(base)
    expect(terminal.run?.version).toBe(parent.projection.version + 2)
    expect(terminal.occurrences.filter((occurrence) => occurrence.state === 'PENDING')).toEqual([])
    expect(terminal.states.map((state) => state.id)).not.toContain(prepared.aConcentration.state.id)
    expect(terminal.states.map((state) => state.id)).not.toContain(prepared.bConcentration.state.id)
    const parentReceipt = (snapshot: typeof terminal) =>
      snapshot.receipts.find((receipt) => receipt.commandId === prepared.advance.command.commandId)
    expect(parentReceipt(before)).toBeDefined()
    expect(parentReceipt(terminal)).toEqual(parentReceipt(before))
    for (const check of completed) {
      await expect(replayInRoom(check.caller, check.input)).resolves.toEqual({
        ...check.result,
        projection: await check.caller.query(api.encounters.projectionReads.get, {
          encounterId: base.run.id
        })
      })
    }
    await expect(replayInRoom(base.owner.caller, responses.at(-1)!)).resolves.toEqual({
      ...parent,
      projection: await base.owner.caller.query(api.encounters.projectionReads.get, {
        encounterId: base.run.id
      })
    })
    expect(await records(base)).toEqual(terminal)
  }, 60_000)

  it("routes a Character's turn-effect save to that Character's controller", async () => {
    const base = await turnConcentrationFixture('PROMPT')
    const prepared = await prepareTurn(base)
    const paused = await executeInRoom(base.owner.caller, prepared.advance)
    const pending = paused.occurrence?.pending
    if (paused.occurrence?.status !== 'PENDING' || pending?.kind !== 'D20_EVIDENCE')
      throw new Error('Expected the outgoing turn-effect save.')
    expect(pending.rollerActorId).toBe(prepared.a.id)
    const read = (caller: typeof base.owner.caller) =>
      caller.query(api.encounters.pendingReads.pendingRuleOccurrence, { encounterId: base.run.id })
    await expect(read(prepared.bOwner.controller.caller)).resolves.toBeNull()
    await expect(read(prepared.aOwner.controller.caller)).resolves.toMatchObject({
      occurrenceId: pending.occurrenceId,
      rollerActorId: prepared.a.id
    })
    const answer = response(base.run.id, pending, 1)
    const before = await records(base)
    await expect(executeInRoom(prepared.bOwner.controller.caller, answer)).rejects.toThrow()
    expect(await records(base)).toEqual(before)
    const answered = await executeInRoom(prepared.aOwner.controller.caller, answer)
    expect(encounterPlayerProjectionDtoSchema.safeParse(answered.projection).success).toBe(true)
    await expect(replayInRoom(prepared.aOwner.controller.caller, answer)).resolves.toEqual(answered)
  }, 60_000)

  it('settles Automatic Concentration after a positive incoming START damage batch', async () => {
    const base = await turnConcentrationFixture('AUTO_ROLL')
    const seeded = await seedConcentration({
      t: base.t,
      run: base.run,
      target: base.sourceActor,
      character: base.character
    })
    await seedTurnSaveEffect(
      { ...base, run: { ...base.run, actors: [base.sourceActor, base.targetActor] } },
      { stage: 'START_OF_TURN', ticks: 2, damage: 1 }
    )
    const random = vi.spyOn(rollRandom, 'nextRollInt').mockReturnValue(19)
    try {
      const before = await records(base)
      const { result, initial, command } = await start(base, base.sourceActor.id)
      expect(result).toMatchObject({
        projection: { currentActorId: base.sourceActor.id },
        occurrence: { status: 'COMPLETE' }
      })
      const after = await records(base)
      const parent = after.receipts
        .filter((receipt) => receipt.commandId === command.command.commandId)
        .map((receipt) => storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson)))
      expect(parent).toMatchObject([
        { status: 'BATCH_COMPLETE', batchKind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS' }
      ])
      const children = after.receipts
        .map((receipt) => storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson)))
        .flatMap((receipt) =>
          'applicationOutputs' in receipt &&
          receipt.status === 'COMPLETE' &&
          receipt.applicationOutputs.kind === 'CONCENTRATION_CHECK'
            ? [receipt.applicationOutputs]
            : []
        )
      expect(children).toMatchObject([
        {
          outcome: 'SAVE_SUCCESS',
          application: { targetActorId: base.sourceActor.id, appliedAmount: 1 }
        }
      ])
      expect(after.states.map((state) => state.id)).toContain(seeded.state.id)
      expect(after.run?.version).toBe(before.run!.version + 1)
      random.mockClear()
      await expect(replayInRoom(base.owner.caller, command)).resolves.toEqual({
        ...initial,
        projection: result.projection
      })
      expect(random).not.toHaveBeenCalled()
      expect(await records(base)).toEqual(after)
    } finally {
      random.mockRestore()
    }
  }, 60_000)

  it('settles Automatic owner checks in damage order and skips only the failed state remainder', async () => {
    const base = await turnConcentrationFixture('AUTO_ROLL')
    const random = vi.spyOn(rollRandom, 'nextRollInt').mockReturnValue(19)
    try {
      const prepared = await prepareTurn(base)
      const before = await records(base)
      random.mockReset()
      for (const value of [0, 0, 0, 0, 19]) random.mockReturnValueOnce(value)
      const result = await executeInRoom(base.owner.caller, prepared.advance)
      expect(result.occurrence?.status).toBe('COMPLETE')
      const after = await records(base)
      const children = after.receipts
        .map((receipt) => storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson)))
        .flatMap((receipt) =>
          'applicationOutputs' in receipt &&
          receipt.status === 'COMPLETE' &&
          receipt.applicationOutputs.kind === 'CONCENTRATION_CHECK'
            ? [receipt.applicationOutputs]
            : []
        )
      children.sort((left, right) => left.application.ordinal - right.application.ordinal)
      expect(children.map((child) => child.application.ordinal)).toEqual([0, 2])
      expect(children.map((child) => child.outcome)).toEqual(['SAVE_FAILURE', 'SAVE_SUCCESS'])
      expect(children.map((child) => child.application.targetActorId)).toEqual([
        prepared.a.id,
        prepared.b.id
      ])
      expect(new Set(children.map((child) => child.application.ordinal)).size).toBe(2)
      expect(after.states.map((state) => state.id)).not.toContain(prepared.aConcentration.state.id)
      expect(after.states.map((state) => state.id)).toContain(prepared.bConcentration.state.id)
      expect(after.effects.map((effect) => effect.id)).toEqual(
        expect.arrayContaining([
          prepared.aConcentration.independent.id,
          prepared.bConcentration.dependent.id,
          prepared.bConcentration.independent.id
        ])
      )
      expect(after.effects.map((effect) => effect.id)).not.toContain(
        prepared.aConcentration.dependent.id
      )
      expect(after.run?.version).toBe(before.run!.version + 1)
      random.mockClear()
      await expect(replayInRoom(base.owner.caller, prepared.advance)).resolves.toEqual(result)
      expect(random).not.toHaveBeenCalled()
      expect(await records(base)).toEqual(after)
    } finally {
      random.mockRestore()
    }
  }, 60_000)

  it('publishes one Assisted concentration at a time after the immutable parent turn', async () => {
    const base = await turnConcentrationFixture('PROMPT')
    const prepared = await prepareTurn(base)
    const { result: parent, initial, responses } = await finishTurnEffects(base, prepared.advance)
    expect(parent.occurrence?.status).toBe('COMPLETE')
    expect(responses).toHaveLength(3)
    const afterParent = await records(base)
    expect(afterParent.occurrences.filter((row) => row.state === 'PENDING')).toHaveLength(1)
    const parentReceipt = afterParent.receipts.find(
      (receipt) => receipt.commandId === prepared.advance.command.commandId
    )
    if (!parentReceipt) throw new Error('Missing immutable ADVANCE_TURN receipt.')
    const first = await prepared.aOwner.controller.caller.query(
      api.encounters.pendingReads.pendingRuleOccurrence,
      { encounterId: base.run.id }
    )
    if (!first || first.kind !== 'D20_EVIDENCE')
      throw new Error('Current Character controller cannot discover concentration.')
    await expect(
      prepared.bOwner.controller.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    ).resolves.toBeNull()
    const unauthorized = response(base.run.id, first, 1, crypto.randomUUID())
    const random = vi.spyOn(rollRandom, 'nextRollInt')
    try {
      await expect(executeInRoom(prepared.bOwner.controller.caller, unauthorized)).rejects.toThrow()
      expect(random).not.toHaveBeenCalled()
      expect(await records(base)).toEqual(afterParent)
    } finally {
      random.mockRestore()
    }
    const firstResponse = response(base.run.id, first, 1)
    const failed = await executeInRoom(prepared.aOwner.controller.caller, firstResponse)
    expect(failed.occurrence).toMatchObject({ status: 'COMPLETE', outcome: 'SAVE_FAILURE' })
    const afterFailure = await records(base)
    expect(afterFailure.run?.version).toBe(afterParent.run!.version + 1)
    expect(
      afterFailure.receipts.find(
        (receipt) => receipt.commandId === prepared.advance.command.commandId
      )?.resultJson
    ).toBe(parentReceipt.resultJson)
    const finalTurnResponse = responses.at(-1)
    if (!finalTurnResponse) throw new Error('Missing final turn-effect response.')
    await expect(replayInRoom(base.owner.caller, finalTurnResponse)).resolves.toEqual({
      ...parent,
      projection: await base.owner.caller.query(api.encounters.projectionReads.get, {
        encounterId: base.run.id
      })
    })
    expect(await records(base)).toEqual(afterFailure)
    const second = await prepared.bOwner.controller.caller.query(
      api.encounters.pendingReads.pendingRuleOccurrence,
      { encounterId: base.run.id }
    )
    if (!second || second.kind !== 'D20_EVIDENCE')
      throw new Error('Second Character controller cannot discover concentration.')
    expect(afterFailure.occurrences.filter((row) => row.state === 'PENDING')).toHaveLength(1)
    await expect(
      prepared.aOwner.controller.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    ).resolves.toBeNull()
    const secondResponse = response(base.run.id, second, 20)
    const success = await executeInRoom(prepared.bOwner.controller.caller, secondResponse)
    expect(success.occurrence).toMatchObject({ status: 'COMPLETE', outcome: 'SAVE_SUCCESS' })
    const terminal = await records(base)
    expect(terminal.run?.version).toBe(afterFailure.run!.version)
    await expect(replayInRoom(prepared.aOwner.controller.caller, firstResponse)).resolves.toEqual(
      failed
    )
    await expect(replayInRoom(prepared.bOwner.controller.caller, secondResponse)).resolves.toEqual(
      success
    )
    await expect(replayInRoom(base.owner.caller, prepared.advance)).resolves.toEqual({
      ...initial,
      projection: await base.owner.caller.query(api.encounters.projectionReads.get, {
        encounterId: base.run.id
      })
    })
    expect(await records(base)).toEqual(terminal)
  }, 60_000)

  it('settles auto-roll checks in the answering commit and stops at the first manual one', async () => {
    const base = await turnConcentrationFixture('PROMPT')
    const prepared = await prepareTurn(base)
    const { result: parent } = await finishTurnEffects(base, prepared.advance)
    const first = await prepared.aOwner.controller.caller.query(
      api.encounters.pendingReads.pendingRuleOccurrence,
      { encounterId: base.run.id }
    )
    if (!first || first.kind !== 'D20_EVIDENCE')
      throw new Error('Missing first turn concentration decision.')
    // The first controller now auto-rolls, so their remaining check settles with this answer.
    await setAutoRollDice(base.t, prepared.aOwner.controller.userId, true)
    const firstResponse = response(base.run.id, first, 20)
    const random = vi.spyOn(rollRandom, 'nextRollInt').mockReturnValue(0)
    const answered = await executeInRoom(prepared.aOwner.controller.caller, firstResponse).finally(
      () => random.mockRestore()
    )
    expect(answered.occurrence).toMatchObject({ status: 'COMPLETE', outcome: 'SAVE_SUCCESS' })
    const afterFirst = await records(base)
    // The auto-rolled failure advances the Run once, inside the answering commit.
    expect(afterFirst.run?.version).toBe(parent.projection.version + 1)
    const sibling = afterFirst.receipts.find(
      (receipt) =>
        receipt.commandType === 'CONCENTRATION_CHECK' &&
        receipt.correlationId === first.occurrenceId
    )
    if (!sibling) throw new Error('Missing the auto-rolled concentration receipt.')
    expect(sibling.encounterVersion).toBe(parent.projection.version + 1)
    expect(storedRuleExecutionResultDtoSchema.parse(JSON.parse(sibling.resultJson))).toMatchObject({
      applicationOutputs: { outcome: 'SAVE_FAILURE', application: { targetActorId: prepared.a.id } }
    })
    // The manual controller's check is the first that prompts, so the chain stops there.
    const second = await prepared.bOwner.controller.caller.query(
      api.encounters.pendingReads.pendingRuleOccurrence,
      { encounterId: base.run.id }
    )
    if (!second || second.kind !== 'D20_EVIDENCE')
      throw new Error('Missing the manual controller concentration decision.')
    expect(second).toMatchObject({
      rollerActorId: prepared.b.id,
      encounterVersion: parent.projection.version + 1
    })
    const secondResponse = response(base.run.id, second, 20)
    const success = await executeInRoom(prepared.bOwner.controller.caller, secondResponse)
    expect(success.occurrence).toMatchObject({ status: 'COMPLETE', outcome: 'SAVE_SUCCESS' })
    const terminal = await records(base)
    expect(terminal.run?.version).toBe(parent.projection.version + 1)
    expect(terminal.occurrences.filter((row) => row.state === 'PENDING')).toEqual([])
    await expect(replayInRoom(prepared.aOwner.controller.caller, firstResponse)).resolves.toEqual(
      answered
    )
    await expect(replayInRoom(prepared.bOwner.controller.caller, secondResponse)).resolves.toEqual(
      success
    )
    expect(await records(base)).toEqual(terminal)
    // Answered and automatic checks each get one entry, and replays add none.
    const logged = await ruleCheckRolls(base)
    expect(logged.table.map((roll) => [roll.ruleCheck?.actorId, roll.ruleCheck?.outcome])).toEqual(
      expect.arrayContaining([
        [prepared.a.id, 'KEPT'],
        [prepared.a.id, 'LOST'],
        [prepared.b.id, 'KEPT']
      ])
    )
    expect(logged.table).toHaveLength(3)
    expect(new Set(logged.table.map((roll) => roll.id)).size).toBe(3)
  }, 60_000)

  it('settles every remaining check in the answering commit when each controller auto-rolls', async () => {
    const base = await turnConcentrationFixture('PROMPT')
    const prepared = await prepareTurn(base)
    const { result: parent } = await finishTurnEffects(base, prepared.advance)
    const first = await prepared.aOwner.controller.caller.query(
      api.encounters.pendingReads.pendingRuleOccurrence,
      { encounterId: base.run.id }
    )
    if (!first || first.kind !== 'D20_EVIDENCE')
      throw new Error('Missing first turn concentration decision.')
    await setAutoRollDice(base.t, prepared.bOwner.controller.userId, true)
    const firstResponse = response(base.run.id, first, 1)
    const random = vi.spyOn(rollRandom, 'nextRollInt').mockReturnValue(19)
    const answered = await executeInRoom(prepared.aOwner.controller.caller, firstResponse).finally(
      () => random.mockRestore()
    )
    expect(answered.occurrence).toMatchObject({ status: 'COMPLETE', outcome: 'SAVE_FAILURE' })
    const terminal = await records(base)
    expect(terminal.run?.version).toBe(parent.projection.version + 1)
    expect(terminal.occurrences.filter((row) => row.state === 'PENDING')).toEqual([])
    const sibling = terminal.receipts.find(
      (receipt) =>
        receipt.commandType === 'CONCENTRATION_CHECK' &&
        receipt.correlationId === first.occurrenceId
    )
    if (!sibling) throw new Error('Missing the auto-rolled concentration receipt.')
    expect(storedRuleExecutionResultDtoSchema.parse(JSON.parse(sibling.resultJson))).toMatchObject({
      applicationOutputs: {
        outcome: 'SAVE_SUCCESS',
        nextOccurrenceId: null,
        application: { targetActorId: prepared.b.id }
      }
    })
    await expect(replayInRoom(prepared.aOwner.controller.caller, firstResponse)).resolves.toEqual(
      answered
    )
    expect(await records(base)).toEqual(terminal)
  }, 60_000)
  it('logs each automatic Concentration check once in a GM turn without spending the chat limit', async () => {
    const base = await turnConcentrationFixture('AUTO_ROLL')
    const random = vi.spyOn(rollRandom, 'nextRollInt').mockReturnValue(19)
    try {
      const prepared = await prepareTurn(base)
      // Exhaust the GM's chat limit: the rules' entries must not spend it.
      for (let message = 0; message < 30; message += 1)
        await base.t.run((ctx) =>
          consumeUserRateLimit(ctx, 'campaignConversation', base.owner.userId)
        )
      random.mockReset()
      for (const value of [0, 0, 0, 0, 19]) random.mockReturnValueOnce(value)
      const result = await executeInRoom(base.owner.caller, prepared.advance)
      expect(result.occurrence?.status).toBe('COMPLETE')
      const logged = await ruleCheckRolls(base)
      expect(logged.gm).toEqual([])
      expect(logged.table).toHaveLength(2)
      expect(new Set(logged.table.map((roll) => roll.id)).size).toBe(2)
      expect(
        logged.table
          .map((roll) => roll.ruleCheck)
          .sort((left, right) => (left!.outcome < right!.outcome ? 1 : -1))
      ).toEqual([
        {
          kind: 'CONCENTRATION',
          actorId: prepared.a.id,
          actorLabel: prepared.a.label,
          // The fixture's damage type is not in the System vocabulary, so it has no name.
          damage: { amount: 1, typeLabel: null },
          sourceLabel: 'Turn saving throw damage',
          dc: 10,
          faces: [1],
          modifier: expect.any(Number),
          total: expect.any(Number),
          outcome: 'LOST'
        },
        {
          kind: 'CONCENTRATION',
          actorId: prepared.b.id,
          actorLabel: prepared.b.label,
          // The fixture's damage type is not in the System vocabulary, so it has no name.
          damage: { amount: 1, typeLabel: null },
          sourceLabel: 'Turn saving throw damage',
          dc: 10,
          faces: [20],
          modifier: expect.any(Number),
          total: expect.any(Number),
          outcome: 'KEPT'
        }
      ])
      for (const roll of logged.table) expect(roll.characterLabel).toBe(roll.ruleCheck?.actorLabel)
      await expect(replayInRoom(base.owner.caller, prepared.advance)).resolves.toEqual(result)
      expect(await ruleCheckRolls(base)).toEqual(logged)
    } finally {
      random.mockRestore()
    }
  }, 60_000)

  it("files a hidden actor's Concentration check with the GM only", async () => {
    const base = await turnConcentrationFixture('AUTO_ROLL')
    const random = vi.spyOn(rollRandom, 'nextRollInt').mockReturnValue(19)
    try {
      const prepared = await prepareTurn(base)
      const hidden = await executeInRoom(base.owner.caller, {
        command: {
          type: 'UPDATE_ACTOR',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: prepared.started.projection.version,
          actorId: prepared.b.id,
          public: false
        }
      })
      random.mockReset()
      for (const value of [0, 0, 0, 0, 19]) random.mockReturnValueOnce(value)
      await executeInRoom(base.owner.caller, {
        command: {
          type: 'ADVANCE_TURN',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: hidden.projection.version
        }
      })
      const logged = await ruleCheckRolls(base)
      expect(logged.table.map((roll) => roll.ruleCheck?.actorId)).toEqual([prepared.a.id])
      expect(logged.gm.map((roll) => roll.ruleCheck?.actorId)).toEqual([prepared.b.id])
      expect(logged.gm[0]?.gmCampaignRoll).toEqual({
        campaignId: base.campaign.id,
        creature: { encounterId: expect.any(String), actorId: prepared.b.id },
        revealedAt: null,
        noticedAt: null
      })
    } finally {
      random.mockRestore()
    }
  }, 60_000)
})
