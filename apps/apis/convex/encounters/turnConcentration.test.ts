// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { EncounterExecuteInput } from '@artificer-toolkit/schema/api/encounters'
import { encounterCommandResultDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import { encounterPlayerProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { api } from '../_generated/api'
import { readCharacterRow } from '../characters/stateDocuments'
import { consumeUserRateLimit } from '../lib/rateLimits'
import { seedConcentration } from '../../tests/fixtures/concentration'
import { turnConcentrationFixture } from '../../tests/fixtures/turnConcentration'
import { seedTurnSaveEffect } from '../../tests/fixtures/turnActiveEffectFixtures'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import {
  checkpointLiveRoom,
  closeRoom,
  executeInRoom,
  invalidateRoomInputs,
  queueRoomRolls,
  type RoomCaller,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

type Fixture = Awaited<ReturnType<typeof turnConcentrationFixture>>

/** The rows the room last published: it holds the Run and its receipts until it checkpoints (D85). */
async function records(base: Fixture) {
  await checkpointLiveRoom(base.campaign.id)
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
      .collect()
  }))
}

/** The Convex queries a member reads while the room holds the Run, after the room's checkpoint. */
async function pendingFor(base: Fixture, caller: RoomCaller) {
  await checkpointLiveRoom(base.campaign.id)
  return caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
    encounterId: base.run.id
  })
}

async function projectionFor(base: Fixture, caller: RoomCaller) {
  await checkpointLiveRoom(base.campaign.id)
  return caller.query(api.encounters.projectionReads.get, { encounterId: base.run.id })
}

/** Concentration checks the rules logged: TABLE chat rolls and the GM's private roll history. */
async function ruleCheckRolls(base: Fixture) {
  await checkpointLiveRoom(base.campaign.id)
  return base.t.run(async (ctx) => ({
    table: (await ctx.db.query('campaignConversationEntryPayloads').collect()).flatMap((payload) =>
      payload.roll?.ruleCheck?.kind === 'CONCENTRATION'
        ? [{ ...payload.roll, ruleCheck: payload.roll.ruleCheck }]
        : []
    ),
    gm: (
      await ctx.db
        .query('userRollHistory')
        .withIndex('by_userId_createdAt_id', (q) => q.eq('userId', base.owner.userId))
        .collect()
    ).flatMap((roll) =>
      roll.ruleCheck?.kind === 'CONCENTRATION' ? [{ ...roll, ruleCheck: roll.ruleCheck }] : []
    )
  }))
}

/** What `answer` did, with the Concentration roll cards it added to the table chat. */
async function withNewRuleChecks<T>(base: Fixture, answer: () => Promise<T>) {
  const seen = new Set((await ruleCheckRolls(base)).table.map((roll) => roll.id))
  const result = await answer()
  const added = (await ruleCheckRolls(base)).table
    .filter((roll) => !seen.has(roll.id))
    .map((roll) => roll.ruleCheck)
  return { result, added }
}

function response(
  encounterId: string,
  pending: {
    encounterVersion: number
    occurrenceId: string
    occurrenceVersion: number
    request: {
      requestId: string
      rollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'
      keep: 'FIRST' | 'HIGHER' | 'LOWER'
    }
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
  // The room holds the started Run: release it before seeding Convex rows beneath it.
  await closeRoom(base.campaign.id)
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
  useLocalRoomWorker()

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
        outcome: 'LOST'
      },
      {
        caller: prepared.bOwner.controller.caller,
        face: 20,
        versionDelta: 1,
        outcome: 'KEPT'
      },
      {
        caller: prepared.bOwner.controller.caller,
        face: 1,
        versionDelta: 1,
        outcome: 'LOST'
      }
    ]) {
      const pending = await pendingFor(base, check.caller)
      if (!pending || pending.kind !== 'D20_EVIDENCE')
        throw new Error('Expected the next controller concentration check.')
      expect(pending.encounterVersion).toBe(parent.projection.version + check.versionDelta)
      const input = response(base.run.id, pending, check.face)
      const { result, added } = await withNewRuleChecks(base, async () =>
        encounterCommandResultDtoSchema.parse(await executeInRoom(check.caller, input))
      )
      expect(result.occurrence).toMatchObject({ status: 'COMPLETE' })
      expect(added).toContainEqual(
        expect.objectContaining({
          actorId: pending.rollerActorId,
          faces: [check.face],
          outcome: check.outcome
        })
      )
      completed.push({ caller: check.caller, input, result })
    }
    const terminal = await records(base)
    expect(terminal.run?.version).toBe(parent.projection.version + 2)
    expect(terminal.occurrences.filter((occurrence) => occurrence.state === 'PENDING')).toEqual([])
    expect(terminal.states.map((state) => state.id)).not.toContain(prepared.aConcentration.state.id)
    expect(terminal.states.map((state) => state.id)).not.toContain(prepared.bConcentration.state.id)
    // The parent turn's immutable receipt stays in the room: its replay answers with the same result.
    for (const check of completed) {
      await expect(executeInRoom(check.caller, check.input)).resolves.toEqual({
        ...check.result,
        projection: await projectionFor(base, check.caller)
      })
    }
    await expect(executeInRoom(base.owner.caller, responses.at(-1)!)).resolves.toEqual({
      ...parent,
      projection: await projectionFor(base, base.owner.caller)
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
    await expect(pendingFor(base, prepared.bOwner.controller.caller)).resolves.toBeNull()
    await expect(pendingFor(base, prepared.aOwner.controller.caller)).resolves.toMatchObject({
      occurrenceId: pending.occurrenceId,
      rollerActorId: prepared.a.id
    })
    const answer = response(base.run.id, pending, 1)
    const before = await records(base)
    await expect(executeInRoom(prepared.bOwner.controller.caller, answer)).rejects.toThrow()
    expect(await records(base)).toEqual(before)
    const answered = await executeInRoom(prepared.aOwner.controller.caller, answer)
    expect(encounterPlayerProjectionDtoSchema.safeParse(answered.projection).success).toBe(true)
    await expect(executeInRoom(prepared.aOwner.controller.caller, answer)).resolves.toEqual({
      ...answered,
      projection: await projectionFor(base, prepared.aOwner.controller.caller)
    })
  }, 60_000)

  it('settles Automatic Concentration after a positive incoming START damage batch', async () => {
    const base = await turnConcentrationFixture('AUTO_ROLL')
    // The fixture's REMOVE_ACTOR leaves the room holding the Run: release it before seeding Convex.
    await closeRoom(base.campaign.id)
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
    await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 19 })
    const before = await records(base)
    const { result, initial, command } = await start(base, base.sourceActor.id)
    expect(result).toMatchObject({
      projection: { currentActorId: base.sourceActor.id },
      occurrence: { status: 'COMPLETE' }
    })
    const after = await records(base)
    // The BATCH_COMPLETE parent and CONCENTRATION_CHECK child receipts stay in the room; the
    // child's outcome is the member-visible roll card (receipt shape: encounterConcentration.test.ts).
    const logged = await ruleCheckRolls(base)
    expect(logged.table.map((roll) => [roll.ruleCheck?.actorId, roll.ruleCheck?.outcome])).toEqual([
      [base.sourceActor.id, 'KEPT']
    ])
    expect(after.states.map((state) => state.id)).toContain(seeded.state.id)
    expect(after.run?.version).toBe(before.run!.version + 1)
    await expect(executeInRoom(base.owner.caller, command)).resolves.toEqual({
      ...initial,
      projection: result.projection
    })
    // The replay rolls nothing: no new roll card and no other change.
    expect(await ruleCheckRolls(base)).toEqual(logged)
    expect(await records(base)).toEqual(after)
  }, 60_000)

  it('settles Automatic owner checks in damage order and skips only the failed state remainder', async () => {
    const base = await turnConcentrationFixture('AUTO_ROLL')
    await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 19 })
    const prepared = await prepareTurn(base)
    const before = await records(base)
    await queueRoomRolls(base.campaign.id, { rolls: [0, 0, 0, 0, 19] })
    const result = await executeInRoom(base.owner.caller, prepared.advance)
    expect(result.occurrence?.status).toBe('COMPLETE')
    const after = await records(base)
    // The per-check receipts (damage ordinals 0 and 2) stay in the room: each check's outcome is
    // its roll card (ordinal cases: encounterConcentration.test.ts), and the rows below are the effects.
    const logged = await ruleCheckRolls(base)
    expect(
      new Map(logged.table.map((roll) => [roll.ruleCheck?.actorId, roll.ruleCheck?.outcome]))
    ).toEqual(
      new Map([
        [prepared.a.id, 'LOST'],
        [prepared.b.id, 'KEPT']
      ])
    )
    expect(logged.table).toHaveLength(2)
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
    await expect(executeInRoom(base.owner.caller, prepared.advance)).resolves.toEqual({
      ...result,
      projection: await projectionFor(base, base.owner.caller)
    })
    expect(await ruleCheckRolls(base)).toEqual(logged)
    expect(await records(base)).toEqual(after)
  }, 60_000)

  it('publishes one Assisted concentration at a time after the immutable parent turn', async () => {
    const base = await turnConcentrationFixture('PROMPT')
    const prepared = await prepareTurn(base)
    const { result: parent, initial, responses } = await finishTurnEffects(base, prepared.advance)
    expect(parent.occurrence?.status).toBe('COMPLETE')
    expect(responses).toHaveLength(3)
    const afterParent = await records(base)
    expect(afterParent.occurrences.filter((row) => row.state === 'PENDING')).toHaveLength(1)
    const first = await pendingFor(base, prepared.aOwner.controller.caller)
    if (!first || first.kind !== 'D20_EVIDENCE')
      throw new Error('Current Character controller cannot discover concentration.')
    await expect(pendingFor(base, prepared.bOwner.controller.caller)).resolves.toBeNull()
    const unauthorized = response(base.run.id, first, 1, crypto.randomUUID())
    await expect(executeInRoom(prepared.bOwner.controller.caller, unauthorized)).rejects.toThrow()
    expect(await records(base)).toEqual(afterParent)
    const firstResponse = response(base.run.id, first, 1)
    const { result: failed, added: failedChecks } = await withNewRuleChecks(base, () =>
      executeInRoom(prepared.aOwner.controller.caller, firstResponse)
    )
    expect(failed.occurrence).toMatchObject({ status: 'COMPLETE' })
    expect(failedChecks).toContainEqual(
      expect.objectContaining({ actorId: first.rollerActorId, faces: [1], outcome: 'LOST' })
    )
    const afterFailure = await records(base)
    expect(afterFailure.run?.version).toBe(afterParent.run!.version + 1)
    // The immutable parent receipt is held by the room: its replay still answers the parent result.
    const finalTurnResponse = responses.at(-1)
    if (!finalTurnResponse) throw new Error('Missing final turn-effect response.')
    await expect(executeInRoom(base.owner.caller, finalTurnResponse)).resolves.toEqual({
      ...parent,
      projection: await projectionFor(base, base.owner.caller)
    })
    expect(await records(base)).toEqual(afterFailure)
    const second = await pendingFor(base, prepared.bOwner.controller.caller)
    if (!second || second.kind !== 'D20_EVIDENCE')
      throw new Error('Second Character controller cannot discover concentration.')
    expect(afterFailure.occurrences.filter((row) => row.state === 'PENDING')).toHaveLength(1)
    await expect(pendingFor(base, prepared.aOwner.controller.caller)).resolves.toBeNull()
    const secondResponse = response(base.run.id, second, 20)
    const { result: success, added: keptChecks } = await withNewRuleChecks(base, () =>
      executeInRoom(prepared.bOwner.controller.caller, secondResponse)
    )
    expect(success.occurrence).toMatchObject({ status: 'COMPLETE' })
    expect(keptChecks).toContainEqual(
      expect.objectContaining({ actorId: second.rollerActorId, faces: [20], outcome: 'KEPT' })
    )
    const terminal = await records(base)
    expect(terminal.run?.version).toBe(afterFailure.run!.version)
    await expect(executeInRoom(prepared.aOwner.controller.caller, firstResponse)).resolves.toEqual({
      ...failed,
      projection: await projectionFor(base, prepared.aOwner.controller.caller)
    })
    await expect(executeInRoom(prepared.bOwner.controller.caller, secondResponse)).resolves.toEqual(
      {
        ...success,
        projection: await projectionFor(base, prepared.bOwner.controller.caller)
      }
    )
    await expect(executeInRoom(base.owner.caller, prepared.advance)).resolves.toEqual({
      ...initial,
      projection: await projectionFor(base, base.owner.caller)
    })
    expect(await records(base)).toEqual(terminal)
  }, 60_000)

  it('settles auto-roll checks in the answering commit and stops at the first manual one', async () => {
    const base = await turnConcentrationFixture('PROMPT')
    const prepared = await prepareTurn(base)
    const { result: parent } = await finishTurnEffects(base, prepared.advance)
    const first = await pendingFor(base, prepared.aOwner.controller.caller)
    if (!first || first.kind !== 'D20_EVIDENCE')
      throw new Error('Missing first turn concentration decision.')
    // The first controller now auto-rolls, so their remaining check settles with this answer.
    await setAutoRollDice(base.t, prepared.aOwner.controller.userId, true)
    await invalidateRoomInputs(base.campaign.id, ['PREFERENCES'])
    const firstResponse = response(base.run.id, first, 20)
    await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 0 })
    const { result: answered, added: answeredChecks } = await withNewRuleChecks(base, () =>
      executeInRoom(prepared.aOwner.controller.caller, firstResponse)
    )
    expect(answered.occurrence).toMatchObject({ status: 'COMPLETE' })
    expect(answeredChecks).toContainEqual(
      expect.objectContaining({ actorId: first.rollerActorId, faces: [20], outcome: 'KEPT' })
    )
    const afterFirst = await records(base)
    // The auto-rolled failure advances the Run once, inside the answering commit. Its
    // CONCENTRATION_CHECK receipt stays in the room: the roll cards below show its outcome.
    expect(afterFirst.run?.version).toBe(parent.projection.version + 1)
    // The manual controller's check is the first that prompts, so the chain stops there.
    const second = await pendingFor(base, prepared.bOwner.controller.caller)
    if (!second || second.kind !== 'D20_EVIDENCE')
      throw new Error('Missing the manual controller concentration decision.')
    expect(second).toMatchObject({
      rollerActorId: prepared.b.id,
      encounterVersion: parent.projection.version + 1
    })
    const secondResponse = response(base.run.id, second, 20)
    const { result: success, added: keptChecks } = await withNewRuleChecks(base, () =>
      executeInRoom(prepared.bOwner.controller.caller, secondResponse)
    )
    expect(success.occurrence).toMatchObject({ status: 'COMPLETE' })
    expect(keptChecks).toContainEqual(
      expect.objectContaining({ actorId: second.rollerActorId, faces: [20], outcome: 'KEPT' })
    )
    const terminal = await records(base)
    expect(terminal.run?.version).toBe(parent.projection.version + 1)
    expect(terminal.occurrences.filter((row) => row.state === 'PENDING')).toEqual([])
    await expect(executeInRoom(prepared.aOwner.controller.caller, firstResponse)).resolves.toEqual({
      ...answered,
      projection: await projectionFor(base, prepared.aOwner.controller.caller)
    })
    await expect(executeInRoom(prepared.bOwner.controller.caller, secondResponse)).resolves.toEqual(
      {
        ...success,
        projection: await projectionFor(base, prepared.bOwner.controller.caller)
      }
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
    const first = await pendingFor(base, prepared.aOwner.controller.caller)
    if (!first || first.kind !== 'D20_EVIDENCE')
      throw new Error('Missing first turn concentration decision.')
    await setAutoRollDice(base.t, prepared.bOwner.controller.userId, true)
    await invalidateRoomInputs(base.campaign.id, ['PREFERENCES'])
    const firstResponse = response(base.run.id, first, 1)
    await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 19 })
    const { result: answered, added: answeredChecks } = await withNewRuleChecks(base, () =>
      executeInRoom(prepared.aOwner.controller.caller, firstResponse)
    )
    expect(answered.occurrence).toMatchObject({ status: 'COMPLETE' })
    expect(answeredChecks).toContainEqual(
      expect.objectContaining({ actorId: first.rollerActorId, faces: [1], outcome: 'LOST' })
    )
    const terminal = await records(base)
    expect(terminal.run?.version).toBe(parent.projection.version + 1)
    expect(terminal.occurrences.filter((row) => row.state === 'PENDING')).toEqual([])
    // The auto-rolled sibling receipt (SAVE_SUCCESS, no next occurrence) stays in the room; its
    // outcome is the second Character's KEPT roll card (receipt shape: encounterConcentration.test.ts).
    const logged = await ruleCheckRolls(base)
    expect(
      new Map(logged.table.map((roll) => [roll.ruleCheck?.actorId, roll.ruleCheck?.outcome]))
    ).toEqual(
      new Map([
        [prepared.a.id, 'LOST'],
        [prepared.b.id, 'KEPT']
      ])
    )
    await expect(executeInRoom(prepared.aOwner.controller.caller, firstResponse)).resolves.toEqual({
      ...answered,
      projection: await projectionFor(base, prepared.aOwner.controller.caller)
    })
    expect(await records(base)).toEqual(terminal)
  }, 60_000)

  it('logs each automatic Concentration check once in a GM turn without spending the chat limit', async () => {
    const base = await turnConcentrationFixture('AUTO_ROLL')
    await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 19 })
    const prepared = await prepareTurn(base)
    // Exhaust the GM's chat limit: the rules' entries must not spend it.
    for (let message = 0; message < 30; message += 1)
      await base.t.run((ctx) =>
        consumeUserRateLimit(ctx, 'campaignConversation', base.owner.userId)
      )
    await queueRoomRolls(base.campaign.id, { rolls: [0, 0, 0, 0, 19] })
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
    await expect(executeInRoom(base.owner.caller, prepared.advance)).resolves.toEqual({
      ...result,
      projection: await projectionFor(base, base.owner.caller)
    })
    expect(await ruleCheckRolls(base)).toEqual(logged)
  }, 60_000)

  it("files a hidden actor's Concentration check with the GM only", async () => {
    const base = await turnConcentrationFixture('AUTO_ROLL')
    await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 19 })
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
    await queueRoomRolls(base.campaign.id, { rolls: [0, 0, 0, 0, 19] })
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
  }, 60_000)
})
