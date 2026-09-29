import { describe, expect, it, vi } from 'vitest'
import type {
  ResolveEncounterActionInputDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  encounterCommandResultDtoSchema,
  encounterPlayerProjectionDtoSchema
} from '@artificer-toolkit/schema/api/encounterData'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { readEncounterReplayReceipt } from '@artificer-toolkit/encounter-persistence/replayReceipts'
import { encounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { snapshotCreatureEquipmentLoadout } from '@artificer-toolkit/rules-runtime/encounterCreatureEquipmentSources'
import { encounterBasicActionEffects } from '@artificer-toolkit/rules-runtime/encounterBasicActions'
import { SRD_BASIC_ACTION_DEFINITIONS } from '@artificer-toolkit/source-data/srd/basicActions.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_ACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { disarmInRoom, disarmRecords, nativeDisarmFixture } from '../../tests/fixtures/nativeDisarm'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { withRoomConvex } from '../../tests/fixtures/liveSessionWorker'
import { planNativeLiveDisarm } from '../../../session-worker/src/nativeDisarm'
import { api, internal } from '../_generated/api'
import { readCharacterRecord } from '../characters/stateDocuments'
import * as rollRandom from '../lib/rollRandom'

function evidence(
  base: Awaited<ReturnType<typeof nativeDisarmFixture>>,
  result: unknown,
  face: number
): ResolveRuleOccurrenceInputDto {
  const occurrence = encounterCommandResultDtoSchema.parse(result).occurrence
  const pending = occurrence?.pending
  if (occurrence?.status !== 'PENDING' || pending?.kind !== 'D20_EVIDENCE')
    throw new Error('Expected Disarm d20 evidence.')
  return {
    type: 'RESOLVE_RULE_OCCURRENCE',
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: base.command.expectedVersion,
    correlationId: null,
    occurrenceId: occurrence.occurrenceId,
    expectedOccurrenceVersion: occurrence.occurrenceVersion,
    resolution: {
      kind: 'ENTER_DICE',
      requestId: pending.request.requestId,
      rawFaces: pending.request.rollMode === 'NORMAL' ? [face] : [face, face],
      rollMode: pending.request.rollMode
    }
  }
}

function actorState(records: Awaited<ReturnType<typeof disarmRecords>>, actorId: string) {
  const row = records.actors.find((actor) => actor.id === actorId)
  if (!row) throw new Error('Missing stored actor.')
  return encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
}

function contestedOutput(records: Awaited<ReturnType<typeof disarmRecords>>) {
  const receipt = records.receipts
    .map((row) => storedRuleExecutionResultDtoSchema.parse(JSON.parse(row.resultJson)))
    .find(
      (result) =>
        result.status === 'COMPLETE' && result.applicationOutputs.kind === 'CONTESTED_ACTION'
    )
  if (receipt?.status !== 'COMPLETE' || receipt.applicationOutputs.kind !== 'CONTESTED_ACTION')
    throw new Error('Missing completed Disarm receipt.')
  return receipt.applicationOutputs
}

/**
 * A settled Disarm answer is no longer routable, so a lost acknowledgement's retry is shown at the
 * planner, which returns the stored result without rolling.
 */
function replayInRoom(
  base: Awaited<ReturnType<typeof nativeDisarmFixture>>,
  member: Awaited<ReturnType<typeof nativeDisarmFixture>>['player'],
  command: ResolveEncounterActionInputDto | ResolveRuleOccurrenceInputDto
) {
  return withRoomConvex(member.caller, ({ environment, accessToken, runtime }) =>
    planNativeLiveDisarm(
      environment,
      accessToken,
      {
        campaignId: base.campaign.id,
        authorityEpoch: base.authorityEpoch,
        expectedUserId: member.userId,
        expectedRole: member.userId === base.owner.userId ? 'OWNER' : 'PLAYER',
        encounterId: base.run.id,
        expectedVersion: command.expectedVersion
      },
      command,
      {
        runtime,
        random: () => {
          throw new Error('A replay must not roll.')
        }
      }
    )
  )
}

describe('room Disarm commands', () => {
  it('lets the assigned Character initiator answer before handing the Creature defender request to the owner', async () => {
    const base = await nativeDisarmFixture('PROMPT', false, true)
    const before = await disarmRecords(base)
    const started = await disarmInRoom(base, base.owner, base.command)
    const first = evidence(base, started, 20)
    await expect(
      base.player.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    ).resolves.toEqual(started.occurrence?.pending)
    const pending = await disarmRecords(base)
    expect(pending.actors).toEqual(before.actors)
    expect(pending.character).toEqual(before.character)
    expect(pending.commands).toEqual(before.commands)
    expect(pending.pendingSnapshots[0]).toMatchObject({
      applicationContext: {
        initiatorUserId: base.owner.userId,
        contest: { initiatorControllerCharacterId: base.character.id }
      }
    })
    const answered = await disarmInRoom(base, base.player, first)
    expect(answered.occurrence).toMatchObject({
      status: 'PENDING',
      occurrenceId: started.occurrence?.occurrenceId,
      pending: null
    })
    expect(encounterPlayerProjectionDtoSchema.parse(answered.projection)).toEqual(
      answered.projection
    )
    for (const actor of answered.projection.actors) {
      expect(actor).not.toHaveProperty('gmNotes')
      expect(actor).not.toHaveProperty('statBlock')
      expect(actor).not.toHaveProperty('resources')
      expect(actor).not.toHaveProperty('currentHitPoints')
      expect(actor.sourceRevision).toBeNull()
      if (actor.kind === 'CREATURE') expect(actor.sourceId).toBeNull()
    }
    await expect(
      base.player.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    ).resolves.toBeNull()
    const defenderPending = await base.owner.caller.query(
      api.encounters.pendingReads.pendingRuleOccurrence,
      { encounterId: base.run.id }
    )
    if (defenderPending?.kind !== 'D20_EVIDENCE')
      throw new Error('Missing Creature defender request.')
    const second: ResolveRuleOccurrenceInputDto = {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: base.command.expectedVersion,
      correlationId: null,
      occurrenceId: defenderPending.occurrenceId,
      expectedOccurrenceVersion: defenderPending.occurrenceVersion,
      resolution: {
        kind: 'ENTER_DICE',
        requestId: defenderPending.request.requestId,
        rawFaces: defenderPending.request.rollMode === 'NORMAL' ? [1] : [1, 1],
        rollMode: defenderPending.request.rollMode
      }
    }
    const staged = await disarmRecords(base)
    expect(staged.actors).toEqual(before.actors)
    expect(staged.character).toEqual(before.character)
    expect(staged.commands).toEqual(before.commands)
    expect(staged.occurrences).toHaveLength(1)
    expect(staged.pendingSnapshots[0]).toMatchObject({
      applicationContext: {
        initiatorUserId: base.owner.userId,
        contest: { rollEvidence: { initiator: { rawFaces: [20] }, defender: null } }
      }
    })
    await expect(disarmInRoom(base, base.player, second)).rejects.toThrow()
    expect(await disarmRecords(base)).toEqual(staged)
    const completed = await disarmInRoom(base, base.owner, second)
    expect(completed.occurrence).toMatchObject({ status: 'COMPLETE', outcome: null })
    const after = await disarmRecords(base)
    expect(contestedOutput(after)).toMatchObject({
      outcome: 'SOURCE_WIN',
      sourceRoll: { actorId: base.actor.id, rawFaces: [20] },
      targetRoll: { actorId: base.target.id, rawFaces: [1] }
    })
    expect(after.character).toEqual(before.character)
    expect(after.characterReceipts).toEqual(before.characterReceipts)
    expect(
      encounterRuleUsageUsed(actorState(after, base.actor.id), SRD_ACTION_ALLOWANCE_DEFINITION_ID)
    ).toBe(1)
    const root = after.commands.find((command) => command.commandId === base.command.commandId)
    if (root?.commandType !== 'RESOLVE_ACTION')
      throw new Error('Missing terminal Disarm root receipt.')
    expect(root).toMatchObject({ actorUserId: base.owner.userId })
    await expect(disarmInRoom(base, base.owner, base.command)).resolves.toEqual({
      evidenceRoll: null,
      ...readEncounterReplayReceipt(root),
      projection: await base.owner.caller.query(api.encounters.projectionReads.get, {
        encounterId: base.run.id
      })
    })
    await expect(replayInRoom(base, base.player, first)).resolves.toEqual({
      kind: 'REPLAY',
      result: {
        ...answered,
        projection: await base.player.caller.query(api.encounters.projectionReads.get, {
          encounterId: base.run.id
        })
      }
    })
    await expect(replayInRoom(base, base.owner, second)).resolves.toEqual({
      kind: 'REPLAY',
      result: completed
    })
    expect(await disarmRecords(base)).toEqual(after)
  }, 30000)

  it.each(['win', 'tie', 'loss'] as const)(
    'settles an Automatic %s, spending one ACTION and preserving unrelated items and ownership',
    async (outcome) => {
      const base = await nativeDisarmFixture()
      const before = await disarmRecords(base)
      const sourceFace = 10
      const tiedTargetFace =
        sourceFace + base.contest.initiator.modifier - base.contest.defender.modifier
      const targetFace = tiedTargetFace + (outcome === 'win' ? -1 : outcome === 'loss' ? 1 : 0)
      const random = vi
        .spyOn(rollRandom, 'nextRollInt')
        .mockReturnValueOnce(sourceFace - 1)
        .mockReturnValueOnce(targetFace - 1)
      try {
        const result = await disarmInRoom(base, base.owner, base.command)
        expect(result).toMatchObject({
          projection: { version: base.command.expectedVersion + 1 },
          occurrence: { status: 'COMPLETE', outcome: null }
        })
        const after = await disarmRecords(base)
        const output = contestedOutput(after)
        expect(output).toMatchObject({
          sourceActorId: base.actor.id,
          targetActorId: base.target.id,
          sourceRoll: {
            selectedNatural: sourceFace,
            total: sourceFace + base.contest.initiator.modifier
          },
          targetRoll: {
            selectedNatural: targetFace,
            total: targetFace + base.contest.defender.modifier
          },
          outcome: outcome === 'win' ? 'SOURCE_WIN' : 'TARGET_WIN_OR_TIE',
          actionEconomyTransition: {
            definitionId: SRD_ACTION_ALLOWANCE_DEFINITION_ID,
            beforeUsed: 0,
            afterUsed: 1
          }
        })
        expect(output.stateTransition).toMatchObject(
          outcome === 'win'
            ? {
                kind: 'ENCOUNTER_ACTOR_ITEM_USE_STATE',
                actorId: base.target.id,
                loadoutEntryId: base.heldItemId,
                fromState: 'HELD',
                toState: 'CARRIED'
              }
            : { kind: 'NONE' }
        )
        const targetBefore = actorState(before, base.target.id)
        const targetAfter = actorState(after, base.target.id)
        const loadout = snapshotCreatureEquipmentLoadout(targetBefore)
        expect(snapshotCreatureEquipmentLoadout(targetAfter)).toEqual(
          loadout.map((item) =>
            item.id === base.heldItemId && outcome === 'win'
              ? { ...item, useState: 'CARRIED' }
              : item
          )
        )
        expect({ ...targetAfter, snapshot: targetBefore.snapshot }).toEqual(targetBefore)
        expect(
          after.actors.filter((actor) => actor.id !== base.actor.id && actor.id !== base.target.id)
        ).toEqual(
          before.actors.filter((actor) => actor.id !== base.actor.id && actor.id !== base.target.id)
        )
        expect(after.character).toEqual(before.character)
        expect(after.characterReceipts).toEqual(before.characterReceipts)
        expect(
          encounterRuleUsageUsed(
            actorState(after, base.actor.id),
            SRD_ACTION_ALLOWANCE_DEFINITION_ID
          )
        ).toBe(1)
        expect(after.occurrences).toHaveLength(1)
        expect(after.occurrences[0]?.state).toBe('COMPLETED')
        expect(random).toHaveBeenCalledTimes(2)
        await expect(disarmInRoom(base, base.owner, base.command)).resolves.toEqual(result)
        expect(await disarmRecords(base)).toEqual(after)
        expect(random).toHaveBeenCalledTimes(2)
        await expect(
          disarmInRoom(base, base.owner, { ...base.command, targetActorId: base.actor.id })
        ).rejects.toThrow()
        await expect(
          disarmInRoom(base, base.owner, { ...base.command, commandId: crypto.randomUUID() })
        ).rejects.toThrow()
        expect(await disarmRecords(base)).toEqual(after)
      } finally {
        random.mockRestore()
      }
    },
    30000
  )

  it('changes only the selected Character item use state, retaining inventory and Character ownership', async () => {
    const base = await nativeDisarmFixture('AUTO_ROLL', true)
    const before = await disarmRecords(base)
    const random = vi
      .spyOn(rollRandom, 'nextRollInt')
      .mockReturnValueOnce(19)
      .mockReturnValueOnce(0)
    try {
      await disarmInRoom(base, base.owner, base.command)
    } finally {
      random.mockRestore()
    }
    const after = await disarmRecords(base)
    if (!before.character || !after.character) throw new Error('Missing Character records.')
    const beforeCharacter = readCharacterRecord(before.character)
    const afterCharacter = readCharacterRecord(after.character)
    expect(after.character.userId).toBe(before.character.userId)
    expect(afterCharacter).toEqual({
      ...beforeCharacter,
      state: {
        ...beforeCharacter.state,
        equipment: {
          ...beforeCharacter.state.equipment,
          equipped: beforeCharacter.state.equipment.equipped.filter((id) => id !== base.heldItemId)
        }
      }
    })
    expect(after.character.play.streamVersion).toBe(before.character.play.streamVersion + 1)
    expect(contestedOutput(after).stateTransition).toMatchObject({
      kind: 'CHARACTER_ITEM_USE_STATE',
      characterId: base.character.id,
      itemInstanceId: base.heldItemId,
      fromState: 'EQUIPPED',
      toState: 'CARRIED'
    })
    expect(
      encounterRuleUsageUsed(actorState(after, base.actor.id), SRD_ACTION_ALLOWANCE_DEFINITION_ID)
    ).toBe(1)
  }, 30000)

  it.each([false, true])(
    'seals Assisted participants, hides wrong-player requests and accepts current defender evidence (Character target: %s)',
    async (characterTarget) => {
      const base = await nativeDisarmFixture('PROMPT', characterTarget)
      const before = await disarmRecords(base)
      const started = await disarmInRoom(base, base.owner, base.command)
      const first = evidence(base, started, 20)
      const pending = await disarmRecords(base)
      expect(pending.run).toEqual(before.run)
      expect(pending.actors).toEqual(before.actors)
      expect(pending.character).toEqual(before.character)
      expect(pending.commands).toEqual(before.commands)
      expect(pending.occurrences).toHaveLength(1)
      expect(pending.pendingSnapshots[0]).toMatchObject({
        applicationContext: {
          kind: 'ENCOUNTER_ACTION',
          initiatorUserId: base.owner.userId,
          contest: { actionKind: 'DISARM' }
        }
      })
      await expect(disarmInRoom(base, base.owner, base.command)).resolves.toEqual(started)
      await expect(
        base.player.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
          encounterId: base.run.id
        })
      ).resolves.toBeNull()
      await expect(disarmInRoom(base, base.player, first)).rejects.toThrow()
      await expect(
        disarmInRoom(base, base.owner, {
          ...first,
          resolution: {
            kind: 'SYSTEM_ROLL',
            requestId: 'stale-request',
            rollId: crypto.randomUUID()
          }
        })
      ).rejects.toThrow()
      expect(await disarmRecords(base)).toEqual(pending)

      const next = await disarmInRoom(base, base.owner, first)
      expect(next.occurrence?.occurrenceId).toBe(started.occurrence?.occurrenceId)
      const second = evidence(base, next, 1)
      const staged = await disarmRecords(base)
      expect(staged.run).toEqual(before.run)
      expect(staged.actors).toEqual(before.actors)
      expect(staged.character).toEqual(before.character)
      expect(staged.commands).toEqual(before.commands)
      expect(staged.characterReceipts).toEqual(before.characterReceipts)
      expect(staged.pendingSnapshots[0]).toMatchObject({
        applicationContext: { initiatorUserId: base.owner.userId }
      })
      expect(staged.occurrences).toHaveLength(1)
      expect(second.resolution).not.toEqual(first.resolution)
      await expect(
        base.player.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
          encounterId: base.run.id
        })
      ).resolves.toEqual(characterTarget ? next.occurrence?.pending : null)
      if (!characterTarget) await expect(disarmInRoom(base, base.player, second)).rejects.toThrow()
      await expect(
        disarmInRoom(base, base.owner, { ...first, commandId: crypto.randomUUID() })
      ).rejects.toThrow()
      expect(await disarmRecords(base)).toEqual(staged)
      const responder = characterTarget ? base.player : base.owner
      if (characterTarget) {
        // An unassigned player no longer controls the defender, so the room refuses their d20.
        const assignment = await base.t.run(async (ctx) => {
          const row = await ctx.db
            .query('campaignCharacterAssignments')
            .withIndex('by_campaignId_userId', (q) =>
              q.eq('campaignId', base.campaign.id).eq('userId', base.player.userId)
            )
            .unique()
          if (!row) throw new Error('Missing Character assignment.')
          await ctx.db.delete(row._id)
          return row
        })
        await expect(
          base.player.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
            encounterId: base.run.id
          })
        ).resolves.toBeNull()
        await expect(disarmInRoom(base, base.player, second)).rejects.toThrow()
        expect(await disarmRecords(base)).toEqual(staged)
        await base.t.run(async (ctx) => {
          const { _id, _creationTime, ...restored } = assignment
          await ctx.db.insert('campaignCharacterAssignments', restored)
        })
      }
      const result = await disarmInRoom(base, responder, second)
      expect(result.occurrence).toMatchObject({
        status: 'COMPLETE',
        outcome: null
      })
      const after = await disarmRecords(base)
      expect(contestedOutput(after)).toMatchObject({
        outcome: 'SOURCE_WIN',
        sourceRoll: { requestNodeId: 'initiator_d20', selectedNatural: 20 },
        targetRoll: { requestNodeId: 'target_d20', selectedNatural: 1 }
      })
      expect(
        encounterRuleUsageUsed(actorState(after, base.actor.id), SRD_ACTION_ALLOWANCE_DEFINITION_ID)
      ).toBe(1)
      await expect(replayInRoom(base, responder, second)).resolves.toEqual({
        kind: 'REPLAY',
        result
      })
      await expect(replayInRoom(base, base.owner, first)).resolves.toEqual({
        kind: 'REPLAY',
        result: {
          ...next,
          projection: await base.owner.caller.query(api.encounters.projectionReads.get, {
            encounterId: base.run.id
          })
        }
      })
      const root = after.commands.find((command) => command.commandId === base.command.commandId)
      if (root?.commandType !== 'RESOLVE_ACTION')
        throw new Error('Missing terminal Disarm root receipt.')
      await expect(disarmInRoom(base, base.owner, base.command)).resolves.toEqual({
        evidenceRoll: null,
        ...readEncounterReplayReceipt(root),
        projection: await base.owner.caller.query(api.encounters.projectionReads.get, {
          encounterId: base.run.id
        })
      })
      expect(await disarmRecords(base)).toEqual(after)
    },
    30000
  )

  it("keeps the GM's auto-rolled d20 while the defending Character's player rolls their own (D19)", async () => {
    const base = await nativeDisarmFixture('PROMPT', true)
    await setAutoRollDice(base.t, base.owner.userId, true)
    const random = vi.spyOn(rollRandom, 'nextRollInt').mockReturnValueOnce(19)
    try {
      const started = await disarmInRoom(base, base.owner, base.command)
      // The Creature initiator auto-rolled for the GM; the Character's own d20 waits on its player.
      expect(started.occurrence).toMatchObject({
        status: 'PENDING',
        pending: { kind: 'D20_EVIDENCE', rollerActorId: base.target.id }
      })
      expect(random).toHaveBeenCalledTimes(1)
      const pending = await base.player.caller.query(
        api.encounters.pendingReads.pendingRuleOccurrence,
        { encounterId: base.run.id }
      )
      if (pending?.kind !== 'D20_EVIDENCE') throw new Error('Missing the defender request.')
      expect(pending.rollerActorId).toBe(base.target.id)
      const answered = await disarmInRoom(base, base.player, {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.command.expectedVersion,
        correlationId: null,
        occurrenceId: pending.occurrenceId,
        expectedOccurrenceVersion: pending.occurrenceVersion,
        resolution: {
          kind: 'ENTER_DICE',
          requestId: pending.request.requestId,
          rawFaces: pending.request.rollMode === 'NORMAL' ? [1] : [1, 1],
          rollMode: pending.request.rollMode
        }
      })
      expect(answered.occurrence).toMatchObject({ status: 'COMPLETE' })
      expect(contestedOutput(await disarmRecords(base))).toMatchObject({
        outcome: 'SOURCE_WIN',
        sourceRoll: { rawFaces: [20] },
        targetRoll: { rawFaces: [1] }
      })
    } finally {
      random.mockRestore()
    }
  }, 30000)

  it('a Help gives the Disarm attack roll advantage, used once (Q11)', async () => {
    const base = await nativeDisarmFixture('PROMPT')
    const helper = base.run.actors.find((actor) => actor.kind === 'CHARACTER')
    const help = SRD_BASIC_ACTION_DEFINITIONS.find((definition) => definition.label === 'Help')
    if (!helper || !help) throw new Error('Missing the Help fixture.')
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: SRD_BASIC_ACTION_DEFINITIONS
    })
    const version = async () => {
      const { run } = await disarmRecords(base)
      if (!run) throw new Error('Missing Disarm Run.')
      return run.version
    }
    const setCurrentActor = async (actorId: string) =>
      disarmInRoom(base, base.owner, {
        type: 'SET_CURRENT_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: await version(),
        actorId
      })
    await setCurrentActor(helper.id)
    // The Character helps an enemy Creature, which Assisted mode warns about first.
    await disarmInRoom(base, base.owner, {
      type: 'USE_BASIC_ACTION',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: await version(),
      actorId: helper.id,
      definitionId: help.id,
      allyActorId: base.actor.id,
      acknowledgedWarnings: ['TARGET_DISPOSITION']
    })
    await setCurrentActor(base.actor.id)
    const command = {
      ...base.command,
      commandId: crypto.randomUUID(),
      expectedVersion: await version()
    }
    const helped = { ...base, command }
    const started = await disarmInRoom(base, base.owner, command)
    await expect(
      base.owner.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    ).resolves.toMatchObject({
      rollerActorId: base.actor.id,
      request: { rollMode: 'ADVANTAGE', derivedRollModeReasons: ['Help'] }
    })
    const answered = await disarmInRoom(base, base.owner, evidence(helped, started, 20))
    const defender = await base.owner.caller.query(
      api.encounters.pendingReads.pendingRuleOccurrence,
      { encounterId: base.run.id }
    )
    if (defender?.kind !== 'D20_EVIDENCE') throw new Error('Missing the defender request.')
    expect(defender.request.rollMode).toBe('NORMAL')
    await disarmInRoom(base, base.owner, evidence(helped, answered, 1))
    expect(encounterBasicActionEffects(actorState(await disarmRecords(base), helper.id))).toEqual(
      []
    )
  }, 30000)

  it('refuses stale selections and changed pending participants without writes', async () => {
    const base = await nativeDisarmFixture()
    const before = await disarmRecords(base)
    if (!base.command.optionalCombatIntent) throw new Error('Missing Disarm selection.')
    await expect(
      disarmInRoom(base, base.owner, {
        ...base.command,
        optionalCombatIntent: {
          ...base.command.optionalCombatIntent,
          selectionContract: '0'.repeat(64)
        }
      })
    ).rejects.toThrow()
    await expect(disarmInRoom(base, base.player, base.command)).rejects.toThrow()
    expect(await disarmRecords(base)).toEqual(before)

    const assisted = await nativeDisarmFixture('PROMPT', true)
    const result = await disarmInRoom(assisted, assisted.owner, assisted.command)
    const response = evidence(assisted, result, 20)
    const staged = await disarmRecords(assisted)
    for (const actorId of [assisted.actor.id, assisted.target.id]) {
      const row = staged.actors.find((actor) => actor.id === actorId)!
      const state = actorState(staged, actorId)
      const character = staged.character!
      await assisted.t.run(async (ctx) => {
        if (state.kind === 'CHARACTER')
          await ctx.db.patch(character.play._id, {
            streamVersion: character.play.streamVersion + 1
          })
        else {
          const changed = { ...state, currentHitPoints: state.currentHitPoints - 1 }
          await writeRunActor(ctx, row._id, changed)
        }
      })
      const changed = await disarmRecords(assisted)
      await expect(disarmInRoom(assisted, assisted.owner, response)).rejects.toThrow()
      expect(await disarmRecords(assisted)).toEqual(changed)
      await assisted.t.run(async (ctx) => {
        if (state.kind === 'CHARACTER')
          await ctx.db.patch(character.play._id, { streamVersion: character.play.streamVersion })
        else
          await ctx.db.patch(row._id, {
            stateJson: row.stateJson,
            stateChecksum: row.stateChecksum
          })
      })
      expect(await disarmRecords(assisted)).toEqual(staged)
    }
  }, 30000)
})
