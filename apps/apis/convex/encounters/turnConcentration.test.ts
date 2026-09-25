// @vitest-environment node
import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type {
  EncounterCommandResultDto,
  EncounterExecuteInput
} from '@artificer-toolkit/schema/api/encounters'
import { encounterCommandResultDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import {
  createPlatformRulesRuntime,
  deriveRulesContinuationKey
} from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { api, internal } from '../_generated/api'
import * as rollRandom from '../lib/rollRandom'
import { seedConcentration } from '../../tests/fixtures/concentration'
import { turnConcentrationFixture } from '../../tests/fixtures/turnConcentration'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { seedTurnSaveEffect } from '../../tests/fixtures/turnActiveEffectFixtures'
import {
  commitNativeLiveConcentrationResponse,
  planNativeLiveConcentrationResponse
} from '../../../session-worker/src/nativeConcentrationResponse'
import { planNativeLiveEncounterTurn } from '../../../session-worker/src/nativeEncounterTurn'
import { callLiveSessionRoute } from '../../../session-worker/src/liveSessionRoutes'
import {
  insertActiveLiveAuthority,
  stubLiveSessionFetch,
  workerEnvironment
} from '../../tests/fixtures/liveSessionWorker'

type Fixture = Awaited<ReturnType<typeof turnConcentrationFixture>>

async function records(base: Fixture) {
  const characterIds = [base.character.id, base.targetCharacter.id]
  return base.t.run(async (ctx) => ({
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (query) => query.eq('id', base.run.id))
      .unique(),
    actors: await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (query) => query.eq('encounterId', base.run.id))
      .collect(),
    characters: await Promise.all(
      characterIds.map((id) =>
        ctx.db
          .query('characters')
          .withIndex('by_publicId', (query) => query.eq('id', id))
          .unique()
      )
    ),
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
    receipts: await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (query) => query.eq('encounterId', base.run.id))
      .collect()
  }))
}

function response(
  encounterId: string,
  pending: {
    encounterVersion: number
    occurrenceId: string
    occurrenceVersion: number
    request: { requestId: string }
  },
  face: number,
  system = false
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
      resolution: system
        ? { kind: 'SYSTEM_ROLL', requestId: pending.request.requestId }
        : { kind: 'ENTER_DICE', requestId: pending.request.requestId, rawFaces: [face] }
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
  let result = await base.owner.caller.mutation(internal.encounters.commands.execute, command)
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
          ? { kind: 'ENTER_DICE' as const, requestId: pending.request.requestId, rawFaces: [10] }
          : {
              kind: 'INITIATIVE_ENTITY' as const,
              requestId: pending.requestId,
              entityId:
                pending.optionIds.find((optionId) => optionId === preferredActorId) ??
                pending.optionIds[0]!
            }
    result = await base.owner.caller.mutation(internal.encounters.commands.execute, {
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
  return { result: encounterCommandResultDtoSchema.parse(result), command }
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
  let result = await base.owner.caller.mutation(internal.encounters.commands.execute, command)
  const responses: EncounterExecuteInput[] = []
  while (result.occurrence?.status === 'PENDING') {
    const pending = result.occurrence.pending
    if (!pending || pending.kind !== 'D20_EVIDENCE')
      throw new Error('Expected original turn-effect evidence before concentration.')
    const input = response(base.run.id, pending, 1)
    responses.push(input)
    result = await base.owner.caller.action(internal.encounters.commandActions.execute, input)
  }
  return { result: encounterCommandResultDtoSchema.parse(result), responses }
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
      const result = encounterCommandResultDtoSchema.parse(
        await check.caller.action(internal.encounters.commandActions.execute, input)
      )
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
      await expect(
        check.caller.action(internal.encounters.commandActions.execute, check.input)
      ).resolves.toEqual(check.result)
    }
    await expect(
      base.owner.caller.action(internal.encounters.commandActions.execute, responses.at(-1)!)
    ).resolves.toEqual(parent)
    expect(await records(base)).toEqual(terminal)
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
      const { result, command } = await start(base, base.sourceActor.id)
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
      await expect(
        base.owner.caller.mutation(internal.encounters.commands.execute, command)
      ).resolves.toEqual(result)
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
      const result = await base.owner.caller.mutation(
        internal.encounters.commands.execute,
        prepared.advance
      )
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
      await expect(
        base.owner.caller.mutation(internal.encounters.commands.execute, prepared.advance)
      ).resolves.toEqual(result)
      expect(random).not.toHaveBeenCalled()
      expect(await records(base)).toEqual(after)
    } finally {
      random.mockRestore()
    }
  }, 60_000)

  it('publishes one Assisted concentration at a time after the immutable parent turn', async () => {
    const base = await turnConcentrationFixture('PROMPT')
    const prepared = await prepareTurn(base)
    const { result: parent, responses } = await finishTurnEffects(base, prepared.advance)
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
    const unauthorized = response(base.run.id, first, 1, true)
    const random = vi.spyOn(rollRandom, 'nextRollInt')
    try {
      await expect(
        prepared.bOwner.controller.caller.action(
          internal.encounters.commandActions.execute,
          unauthorized
        )
      ).rejects.toThrow()
      expect(random).not.toHaveBeenCalled()
      expect(await records(base)).toEqual(afterParent)
    } finally {
      random.mockRestore()
    }
    const firstResponse = response(base.run.id, first, 1)
    const rollback = makeFunctionReference<
      'action',
      {
        ownerUserId: string
        campaignId: string
        encounterId: string
        operation: { kind: 'COMMAND'; input: EncounterExecuteInput }
      },
      { rolledBack: true }
    >('encounters/developmentLifecycle:verifyRollback')
    await expect(
      base.owner.caller.action(rollback, {
        ownerUserId: base.owner.userId,
        campaignId: base.campaign.id,
        encounterId: base.run.id,
        operation: { kind: 'COMMAND', input: firstResponse }
      })
    ).resolves.toEqual({ rolledBack: true })
    expect(await records(base)).toEqual(afterParent)
    const failed = await prepared.aOwner.controller.caller.action(
      internal.encounters.commandActions.execute,
      firstResponse
    )
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
    await expect(
      base.owner.caller.action(internal.encounters.commandActions.execute, finalTurnResponse)
    ).resolves.toEqual(parent)
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
    const success = await prepared.bOwner.controller.caller.action(
      internal.encounters.commandActions.execute,
      secondResponse
    )
    expect(success.occurrence).toMatchObject({ status: 'COMPLETE', outcome: 'SAVE_SUCCESS' })
    const terminal = await records(base)
    expect(terminal.run?.version).toBe(afterFailure.run!.version)
    await expect(
      prepared.aOwner.controller.caller.action(
        internal.encounters.commandActions.execute,
        firstResponse
      )
    ).resolves.toEqual(failed)
    await expect(
      prepared.bOwner.controller.caller.action(
        internal.encounters.commandActions.execute,
        secondResponse
      )
    ).resolves.toEqual(success)
    await expect(
      base.owner.caller.mutation(internal.encounters.commands.execute, prepared.advance)
    ).resolves.toEqual(parent)
    expect(await records(base)).toEqual(terminal)
  }, 60_000)

  it('commits ordered Assisted turn concentration children through the live Worker', async () => {
    const workerSecret = 'turn-concentration-worker-test-secret-at-least-32-bytes'
    const authSecret = 'turn-concentration-continuation-test-secret-at-least-32-bytes'
    vi.stubEnv('LIVE_SESSION_WORKER_SECRET', workerSecret)
    vi.stubEnv('BETTER_AUTH_SECRET', authSecret)
    try {
      const base = await turnConcentrationFixture('PROMPT')
      // Each concentration response rolls later siblings with the responder's preference.
      for (const controller of [base.player, base.targetController])
        await setAutoRollDice(base.t, controller.userId, false)
      const prepared = await prepareTurn(base)
      const { result: parent, responses } = await finishTurnEffects(base, prepared.advance)
      expect(parent.occurrence?.status).toBe('COMPLETE')
      expect(responses).toHaveLength(3)
      const afterParent = await records(base)
      const parentReceipt = afterParent.receipts.find(
        (receipt) => receipt.commandId === prepared.advance.command.commandId
      )
      if (!parentReceipt) throw new Error('Missing immutable turn receipt.')
      const authorityEpoch = crypto.randomUUID()
      await base.t.run((ctx) =>
        insertActiveLiveAuthority(ctx, {
          campaignId: base.campaign.id,
          epoch: authorityEpoch,
          createdAt: base.campaign.createdAt
        })
      )
      const environment = workerEnvironment(workerSecret)
      const runtime = createPlatformRulesRuntime({
        continuationIntegrityKey: await deriveRulesContinuationKey(
          process.env.RULES_CONTINUATION_SECRET
        ),
        definitions: {
          async requireCurrent() {
            throw new Error('Sealed turn concentration graph must be supplied by capture.')
          }
        }
      })
      const executeChild = async (
        controller: typeof prepared.aOwner.controller,
        pending: {
          encounterVersion: number
          occurrenceId: string
          occurrenceVersion: number
          request: { requestId: string }
        },
        face: number
      ) => {
        stubLiveSessionFetch((pathname, init) => controller.caller.fetch(pathname, init))
        const command = response(base.run.id, pending, face).command
        if (command.type !== 'RESOLVE_RULE_OCCURRENCE')
          throw new Error('Expected concentration response command.')
        const scope = {
          campaignId: base.campaign.id,
          authorityEpoch,
          expectedUserId: controller.userId,
          expectedRole: 'PLAYER' as const,
          encounterId: base.run.id,
          expectedVersion: pending.encounterVersion
        }
        const plan = await planNativeLiveConcentrationResponse(
          environment,
          'fixture-access-token',
          scope,
          command,
          {
            runtime,
            random: () => {
              throw new Error('Entered concentration dice must not reroll.')
            }
          }
        )
        if (plan.kind !== 'PLANNED') throw new Error('Expected planned concentration response.')
        const result = await commitNativeLiveConcentrationResponse(
          environment,
          'fixture-access-token',
          plan
        )
        return { scope, command, plan, result }
      }
      const first = await prepared.aOwner.controller.caller.query(
        api.encounters.pendingReads.pendingRuleOccurrence,
        { encounterId: base.run.id }
      )
      if (!first || first.kind !== 'D20_EVIDENCE')
        throw new Error('Missing first turn concentration decision.')
      const firstChild = await executeChild(prepared.aOwner.controller, first, 1)
      expect(firstChild.result.occurrence).toMatchObject({
        status: 'COMPLETE',
        outcome: 'SAVE_FAILURE'
      })
      const afterFirst = await records(base)
      expect(afterFirst.occurrences.filter((row) => row.state === 'PENDING')).toHaveLength(1)
      const second = await prepared.bOwner.controller.caller.query(
        api.encounters.pendingReads.pendingRuleOccurrence,
        { encounterId: base.run.id }
      )
      if (!second || second.kind !== 'D20_EVIDENCE')
        throw new Error('Missing next Character concentration decision.')
      const secondChild = await executeChild(prepared.bOwner.controller, second, 20)
      expect(secondChild.result.occurrence).toMatchObject({
        status: 'COMPLETE',
        outcome: 'SAVE_SUCCESS'
      })
      const afterSecond = await records(base)
      expect(afterSecond.occurrences.filter((row) => row.state === 'PENDING')).toHaveLength(0)
      const childOutputs = afterSecond.receipts
        .map((receipt) => storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson)))
        .flatMap((receipt) =>
          receipt.status === 'COMPLETE' && receipt.applicationOutputs.kind === 'CONCENTRATION_CHECK'
            ? [receipt.applicationOutputs]
            : []
        )
        .sort((left, right) => left.application.ordinal - right.application.ordinal)
      expect(childOutputs.map((child) => child.application.ordinal)).toEqual([0, 2])
      expect(childOutputs.map((child) => child.outcome)).toEqual(['SAVE_FAILURE', 'SAVE_SUCCESS'])
      expect(
        afterSecond.receipts.find(
          (receipt) => receipt.commandId === prepared.advance.command.commandId
        )?.resultJson
      ).toBe(parentReceipt.resultJson)
      expect(afterSecond.run?.version).toBe(afterParent.run!.version + 1)
      for (const child of [firstChild, secondChild]) {
        const controller =
          child === firstChild ? prepared.aOwner.controller : prepared.bOwner.controller
        stubLiveSessionFetch((pathname, init) => controller.caller.fetch(pathname, init))
        const replay = await planNativeLiveConcentrationResponse(
          environment,
          'fixture-access-token',
          child.scope,
          child.command,
          {
            runtime,
            random: () => {
              throw new Error('Replay must not reroll.')
            }
          }
        )
        expect(replay).toEqual({ kind: 'REPLAY', result: child.result })
        expect(
          await commitNativeLiveConcentrationResponse(
            environment,
            'fixture-access-token',
            child.plan
          )
        ).toEqual(child.result)
      }
      expect(await records(base)).toEqual(afterSecond)
    } finally {
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
    }
  }, 60_000)
})

it('commits ordered Automatic turn concentration through the private DO terminal and rolls back a late child mismatch', async () => {
  const workerSecret = 'turn-concentration-terminal-test-secret-at-least-32-bytes'
  const authSecret = 'turn-concentration-terminal-auth-secret-at-least-32-bytes'
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', workerSecret)
  vi.stubEnv('BETTER_AUTH_SECRET', authSecret)
  try {
    const base = await turnConcentrationFixture('AUTO_ROLL')
    const prepared = await prepareTurn(base)
    if (prepared.advance.command.type !== 'ADVANCE_TURN')
      throw new Error('Expected an ADVANCE_TURN command.')
    const before = await records(base)
    const authorityEpoch = crypto.randomUUID()
    await base.t.run((ctx) =>
      insertActiveLiveAuthority(ctx, {
        campaignId: base.campaign.id,
        epoch: authorityEpoch,
        createdAt: base.campaign.createdAt
      })
    )
    const environment = workerEnvironment(workerSecret)
    stubLiveSessionFetch((pathname, init) => {
      if (
        pathname !== '/live-sessions/encounter-rules' &&
        pathname !== '/live-sessions/encounter-turn' &&
        pathname !== '/live-sessions/character-rules'
      )
        throw new Error(`Unexpected private turn request: ${pathname}`)
      if (new Headers(init?.headers).get('authorization') !== 'Bearer fixture-access-token')
        throw new Error('Missing private turn bearer token.')
      if (new Headers(init?.headers).get('x-artificer-live-session-secret') !== workerSecret)
        throw new Error('Missing private turn secret.')
      return base.owner.caller.fetch(pathname, init)
    })
    const runtime = createPlatformRulesRuntime({
      continuationIntegrityKey: await deriveRulesContinuationKey(
        process.env.RULES_CONTINUATION_SECRET
      ),
      definitions: {
        async requireCurrent() {
          throw new Error('Turn concentration definitions must use private capture.')
        }
      }
    })
    const rolls = [0, 0, 0, 0, 19]
    const planned = await planNativeLiveEncounterTurn(
      environment,
      'fixture-access-token',
      {
        campaignId: base.campaign.id,
        authorityEpoch,
        expectedUserId: base.owner.userId,
        expectedRole: 'OWNER',
        encounterId: base.run.id,
        expectedVersion: prepared.advance.command.expectedVersion
      },
      prepared.advance.command,
      {
        runtime,
        random: (maximum) => {
          const value = rolls.shift()
          if (value === undefined || value >= maximum)
            throw new Error('Unexpected Automatic turn die.')
          return value
        }
      }
    )
    if (planned.kind !== 'PLANNED' || planned.prepared.kind !== 'COMPLETE' || !planned.terminal)
      throw new Error('Expected complete private turn with concentration.')
    expect(planned.terminal.concentration).toHaveLength(2)
    expect(await records(base)).toEqual(before)

    const nativeRolls = vi.spyOn(rollRandom, 'nextRollInt')
    for (const value of [0, 0, 0, 0, 19]) nativeRolls.mockReturnValueOnce(value)
    const previews: EncounterCommandResultDto[] = []
    try {
      await expect(
        base.owner.caller.run(async (ctx) => {
          previews.push(
            encounterCommandResultDtoSchema.parse(
              await ctx.runMutation(internal.encounters.commands.execute, prepared.advance)
            )
          )
          throw new Error('Roll back native concentration preview.')
        })
      ).rejects.toThrow('Roll back native concentration preview.')
    } finally {
      nativeRolls.mockRestore()
    }
    const native = previews[0]
    if (!native) throw new Error('Missing native concentration preview.')
    expect(await records(base)).toEqual(before)

    const lastIndex = planned.terminal.concentration.length - 1
    const altered = {
      ...planned.terminal,
      concentration: planned.terminal.concentration.map((child, index) =>
        index === lastIndex ? { ...child, fingerprint: '0'.repeat(64) } : child
      )
    }
    const rejected = await base.owner.caller.fetch('/live-sessions/encounter-turn', {
      method: 'POST',
      headers: { 'x-artificer-live-session-secret': workerSecret },
      body: JSON.stringify(altered)
    })
    expect(rejected.status).toBe(409)
    expect(await records(base)).toEqual(before)

    const result = await callLiveSessionRoute(
      environment,
      'fixture-access-token',
      'encounterTurnCommit',
      planned.terminal
    )
    expect(result.projection).toMatchObject({
      status: native.projection.status,
      round: native.projection.round,
      currentActorId: native.projection.currentActorId,
      version: native.projection.version,
      actors: native.projection.actors
    })
    const after = await records(base)
    const children = after.receipts
      .map((receipt) => storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson)))
      .flatMap((receipt) =>
        receipt.status === 'COMPLETE' && receipt.applicationOutputs.kind === 'CONCENTRATION_CHECK'
          ? [receipt.applicationOutputs]
          : []
      )
      .sort((left, right) => left.application.ordinal - right.application.ordinal)
    expect(children.map((child) => child.application.ordinal)).toEqual([0, 2])
    expect(children.map((child) => child.outcome)).toEqual(['SAVE_FAILURE', 'SAVE_SUCCESS'])
    expect(children.map((child) => child.application.targetActorId)).toEqual([
      prepared.a.id,
      prepared.b.id
    ])
    expect(after.states.map((state) => state.id)).not.toContain(prepared.aConcentration.state.id)
    expect(after.states.map((state) => state.id)).toContain(prepared.bConcentration.state.id)
    expect(after.effects.map((effect) => effect.id)).not.toContain(
      prepared.aConcentration.dependent.id
    )
    expect(after.effects.map((effect) => effect.id)).toContain(prepared.bConcentration.dependent.id)
  } finally {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  }
}, 60_000)
