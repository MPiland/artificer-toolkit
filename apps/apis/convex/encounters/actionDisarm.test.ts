import { describe, expect, it, vi } from 'vitest'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import {
  encounterCommandResultDtoSchema,
  encounterPlayerProjectionDtoSchema
} from '@artificer-toolkit/schema/api/encounterData'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { encounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { snapshotCreatureEquipmentLoadout } from '@artificer-toolkit/rules-runtime/encounterCreatureEquipmentSources'
import { SRD_ACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { disarmRecords, nativeDisarmFixture } from '../../tests/fixtures/nativeDisarm'
import { api } from '../_generated/api'
import * as rollRandom from '../lib/rollRandom'

function evidence(
  base: Awaited<ReturnType<typeof nativeDisarmFixture>>,
  result: unknown,
  face: number | 'SYSTEM_ROLL'
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
    resolution:
      face === 'SYSTEM_ROLL'
        ? { kind: 'SYSTEM_ROLL', requestId: pending.request.requestId }
        : {
            kind: 'ENTER_DICE',
            requestId: pending.request.requestId,
            rawFaces: pending.request.rollMode === 'NORMAL' ? [face] : [face, face]
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

describe('native public Disarm commands', () => {
  it('lets the assigned Character initiator answer before handing the Creature defender request to the owner', async () => {
    const base = await nativeDisarmFixture('ASSISTED', false, true)
    const before = await disarmRecords(base)
    await expect(
      base.player.caller.mutation(api.encounters.commands.execute, { command: base.command })
    ).rejects.toThrow()
    expect(await disarmRecords(base)).toEqual(before)
    const started = await base.owner.caller.mutation(api.encounters.commands.execute, {
      command: base.command
    })
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
    expect(JSON.parse(pending.occurrences[0]!.pendingSnapshotJson!)).toMatchObject({
      applicationContext: {
        initiatorUserId: base.owner.userId,
        contest: { initiatorControllerCharacterId: base.character.id }
      }
    })
    const answered = await base.player.caller.mutation(api.encounters.commands.execute, {
      command: first
    })
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
        rawFaces: defenderPending.request.rollMode === 'NORMAL' ? [1] : [1, 1]
      }
    }
    const staged = await disarmRecords(base)
    expect(staged.actors).toEqual(before.actors)
    expect(staged.character).toEqual(before.character)
    expect(staged.commands).toEqual(before.commands)
    expect(staged.occurrences).toHaveLength(1)
    expect(JSON.parse(staged.occurrences[0]!.pendingSnapshotJson!)).toMatchObject({
      applicationContext: {
        initiatorUserId: base.owner.userId,
        contest: { rollEvidence: { initiator: { rawFaces: [20] }, defender: null } }
      }
    })
    await expect(
      base.player.caller.mutation(api.encounters.commands.execute, { command: second })
    ).rejects.toThrow()
    expect(await disarmRecords(base)).toEqual(staged)
    const completed = await base.owner.caller.mutation(api.encounters.commands.execute, {
      command: second
    })
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
    await expect(
      base.owner.caller.mutation(api.encounters.commands.execute, { command: base.command })
    ).resolves.toEqual(encounterCommandResultDtoSchema.parse(JSON.parse(root.resultJson)))
    await expect(
      base.player.caller.mutation(api.encounters.commands.execute, { command: first })
    ).resolves.toEqual(answered)
    await expect(
      base.owner.caller.mutation(api.encounters.commands.execute, { command: second })
    ).resolves.toEqual(completed)
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
        const input = { command: base.command }
        const result = await base.owner.caller.mutation(api.encounters.commands.execute, input)
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
        await expect(
          base.owner.caller.mutation(api.encounters.commands.execute, input)
        ).resolves.toEqual(result)
        expect(await disarmRecords(base)).toEqual(after)
        expect(random).toHaveBeenCalledTimes(2)
        await expect(
          base.owner.caller.mutation(api.encounters.commands.execute, {
            command: { ...base.command, targetActorId: base.actor.id }
          })
        ).rejects.toThrow()
        await expect(
          base.owner.caller.mutation(api.encounters.commands.execute, {
            command: { ...base.command, commandId: crypto.randomUUID() }
          })
        ).rejects.toThrow()
        expect(await disarmRecords(base)).toEqual(after)
      } finally {
        random.mockRestore()
      }
    },
    30000
  )

  it('changes only the selected Character item use state, retaining inventory and Character ownership', async () => {
    const base = await nativeDisarmFixture('AUTOMATIC', true)
    const before = await disarmRecords(base)
    const random = vi
      .spyOn(rollRandom, 'nextRollInt')
      .mockReturnValueOnce(19)
      .mockReturnValueOnce(0)
    try {
      await base.owner.caller.mutation(api.encounters.commands.execute, {
        command: base.command
      })
    } finally {
      random.mockRestore()
    }
    const after = await disarmRecords(base)
    if (!before.character || !after.character) throw new Error('Missing Character records.')
    const beforeCharacter = characterAuthoredDtoSchema.parse(
      JSON.parse(before.character.documentJson)
    )
    const afterCharacter = characterAuthoredDtoSchema.parse(
      JSON.parse(after.character.documentJson)
    )
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
    expect(after.character.streamVersion).toBe(before.character.streamVersion + 1)
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
      const base = await nativeDisarmFixture('ASSISTED', characterTarget)
      const before = await disarmRecords(base)
      const started = await base.owner.caller.mutation(api.encounters.commands.execute, {
        command: base.command
      })
      const first = evidence(base, started, 20)
      const pending = await disarmRecords(base)
      expect(pending.run).toEqual(before.run)
      expect(pending.actors).toEqual(before.actors)
      expect(pending.character).toEqual(before.character)
      expect(pending.commands).toEqual(before.commands)
      expect(pending.occurrences).toHaveLength(1)
      expect(JSON.parse(pending.occurrences[0]!.pendingSnapshotJson!)).toMatchObject({
        applicationContext: {
          kind: 'ENCOUNTER_ACTION',
          initiatorUserId: base.owner.userId,
          contest: { actionKind: 'DISARM' }
        }
      })
      await expect(
        base.owner.caller.mutation(api.encounters.commands.execute, {
          command: base.command
        })
      ).resolves.toEqual(started)
      await expect(
        base.player.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
          encounterId: base.run.id
        })
      ).resolves.toBeNull()
      await expect(
        base.player.caller.mutation(api.encounters.commands.execute, {
          command: first
        })
      ).rejects.toThrow()
      await expect(
        base.owner.caller.mutation(api.encounters.commands.execute, {
          command: {
            ...first,
            resolution: { kind: 'SYSTEM_ROLL', requestId: 'stale-request' }
          }
        })
      ).rejects.toThrow()
      expect(await disarmRecords(base)).toEqual(pending)

      const next = await base.owner.caller.mutation(api.encounters.commands.execute, {
        command: first
      })
      expect(next.occurrence?.occurrenceId).toBe(started.occurrence?.occurrenceId)
      const second = evidence(base, next, characterTarget ? 1 : 'SYSTEM_ROLL')
      const staged = await disarmRecords(base)
      expect(staged.run).toEqual(before.run)
      expect(staged.actors).toEqual(before.actors)
      expect(staged.character).toEqual(before.character)
      expect(staged.commands).toEqual(before.commands)
      expect(staged.characterReceipts).toEqual(before.characterReceipts)
      expect(JSON.parse(staged.occurrences[0]!.pendingSnapshotJson!)).toMatchObject({
        applicationContext: { initiatorUserId: base.owner.userId }
      })
      expect(staged.occurrences).toHaveLength(1)
      expect(second.resolution).not.toEqual(first.resolution)
      await expect(
        base.player.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
          encounterId: base.run.id
        })
      ).resolves.toEqual(characterTarget ? next.occurrence?.pending : null)
      if (!characterTarget)
        await expect(
          base.player.caller.mutation(api.encounters.commands.execute, {
            command: second
          })
        ).rejects.toThrow()
      await expect(
        base.owner.caller.mutation(api.encounters.commands.execute, {
          command: { ...first, commandId: crypto.randomUUID() }
        })
      ).rejects.toThrow()
      expect(await disarmRecords(base)).toEqual(staged)
      const responder = characterTarget ? base.player : base.owner
      if (characterTarget) {
        await expect(
          base.player.caller.run(async (ctx) => {
            const assignment = await ctx.db
              .query('campaignCharacterAssignments')
              .withIndex('by_campaignId_userId', (q) =>
                q.eq('campaignId', base.campaign.id).eq('userId', base.player.userId)
              )
              .unique()
            if (!assignment) throw new Error('Missing Character assignment.')
            await ctx.db.delete(assignment._id)
            await expect(
              ctx.runQuery(api.encounters.pendingReads.pendingRuleOccurrence, {
                encounterId: base.run.id
              })
            ).resolves.toBeNull()
            await expect(
              ctx.runMutation(api.encounters.commands.execute, { command: second })
            ).rejects.toThrow()
            throw new Error('restore Character assignment')
          })
        ).rejects.toThrow('restore Character assignment')
        expect(await disarmRecords(base)).toEqual(staged)
      }
      const random = vi.spyOn(rollRandom, 'nextRollInt').mockReturnValue(0)
      try {
        await expect(
          responder.caller.run(async (ctx) => {
            await ctx.runMutation(api.encounters.commands.execute, {
              command: second
            })
            throw new Error('rollback terminal Disarm')
          })
        ).rejects.toThrow('rollback terminal Disarm')
        expect(await disarmRecords(base)).toEqual(staged)
        const result = await responder.caller.mutation(api.encounters.commands.execute, {
          command: second
        })
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
          encounterRuleUsageUsed(
            actorState(after, base.actor.id),
            SRD_ACTION_ALLOWANCE_DEFINITION_ID
          )
        ).toBe(1)
        await expect(
          responder.caller.mutation(api.encounters.commands.execute, {
            command: second
          })
        ).resolves.toEqual(result)
        await expect(
          base.owner.caller.mutation(api.encounters.commands.execute, {
            command: first
          })
        ).resolves.toEqual(next)
        const root = after.commands.find((command) => command.commandId === base.command.commandId)
        if (root?.commandType !== 'RESOLVE_ACTION')
          throw new Error('Missing terminal Disarm root receipt.')
        await expect(
          base.owner.caller.mutation(api.encounters.commands.execute, {
            command: base.command
          })
        ).resolves.toEqual(encounterCommandResultDtoSchema.parse(JSON.parse(root.resultJson)))
        expect(await disarmRecords(base)).toEqual(after)
      } finally {
        random.mockRestore()
      }
    },
    30000
  )

  it('rolls back all Automatic writes and refuses stale selections and changed pending participants atomically', async () => {
    const base = await nativeDisarmFixture()
    const before = await disarmRecords(base)
    const random = vi
      .spyOn(rollRandom, 'nextRollInt')
      .mockReturnValueOnce(19)
      .mockReturnValueOnce(0)
    try {
      await expect(
        base.owner.caller.run(async (ctx) => {
          await ctx.runMutation(api.encounters.commands.execute, {
            command: base.command
          })
          throw new Error('rollback Automatic Disarm')
        })
      ).rejects.toThrow('rollback Automatic Disarm')
    } finally {
      random.mockRestore()
    }
    expect(await disarmRecords(base)).toEqual(before)
    if (!base.command.optionalCombatIntent) throw new Error('Missing Disarm selection.')
    await expect(
      base.owner.caller.mutation(api.encounters.commands.execute, {
        command: {
          ...base.command,
          optionalCombatIntent: {
            ...base.command.optionalCombatIntent,
            selectionContract: '0'.repeat(64)
          }
        }
      })
    ).rejects.toThrow()
    await expect(
      base.player.caller.mutation(api.encounters.commands.execute, {
        command: base.command
      })
    ).rejects.toThrow()
    expect(await disarmRecords(base)).toEqual(before)

    const assisted = await nativeDisarmFixture('ASSISTED', true)
    const result = await assisted.owner.caller.mutation(api.encounters.commands.execute, {
      command: assisted.command
    })
    const response = evidence(assisted, result, 20)
    const staged = await disarmRecords(assisted)
    for (const actorId of [assisted.actor.id, assisted.target.id]) {
      await expect(
        assisted.owner.caller.run(async (ctx) => {
          const row = staged.actors.find((actor) => actor.id === actorId)!
          const state = actorState(staged, actorId)
          const changed = {
            ...state,
            currentHitPoints: (state.currentHitPoints ?? 1) - 1
          }
          await ctx.db.patch(row._id, {
            stateJson: JSON.stringify(changed),
            stateChecksum: checksumCanonicalJson(changed)
          })
          await expect(
            ctx.runMutation(api.encounters.commands.execute, {
              command: response
            })
          ).rejects.toThrow()
          throw new Error('restore participant')
        })
      ).rejects.toThrow('restore participant')
      expect(await disarmRecords(assisted)).toEqual(staged)
    }
  }, 30000)
})
