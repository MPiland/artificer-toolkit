import { describe, expect, it } from 'vitest'
import { readTestActor } from '../../tests/fixtures/storedActors'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { encounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { snapshotStatBlock } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { snapshotCreatureEquipmentLoadout } from '@artificer-toolkit/rules-runtime/encounterCreatureEquipmentSources'
import {
  contestDefenderPolicy,
  executeEncounterOptionalContestAction
} from '@artificer-toolkit/rules-runtime/encounterOptionalContestActionExecution'
import { prepareEncounterContestPendingContext } from '@artificer-toolkit/rules-runtime/encounterContestPendingContext'
import { SRD_ACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { disarmRecords, nativeDisarmFixture } from '../../tests/fixtures/nativeDisarm'
import { srdPrintedArmorClass, srdWolf } from '../../tests/fixtures/srdCreatures'
import { createRulesRuntime } from '../../tests/fixtures/rulesRuntime'
import { prepareStoredDisarm } from '../../tests/fixtures/nativeDisarm'
import { readCharacterRecord } from '../characters/stateDocuments'
import { useLocalRoomWorker } from '../../tests/fixtures/localRoomWorker'
import { settleContest } from './actionContestSettlement'

useLocalRoomWorker()

async function settle(
  base: Awaited<ReturnType<typeof nativeDisarmFixture>>,
  outcome: 'win' | 'tie' | 'loss',
  abort = false
) {
  return base.owner.caller.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!row) throw new Error('Missing Disarm Run.')
    const state = encounterRunStateSchema.parse(JSON.parse(row.stateJson))
    const actorRows = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id))
      .collect()
    const actors = await Promise.all(actorRows.map((actor) => readTestActor(ctx, actor)))
    const actor = actors.find((value) => value.id === base.actor.id)
    const target = actors.find((value) => value.id === base.target.id)
    if (!actor || !target) throw new Error('Missing Disarm participants.')
    const preparation = await prepareStoredDisarm(ctx, {
      state,
      actors,
      actor,
      target,
      command: base.command,
      campaignOwnerUserId: base.owner.userId
    })
    const {
      checkDefinitionId,
      label: _label,
      ...defender
    } = contestDefenderPolicy(preparation.contest.defender, null)
    const sourceFace = 10
    const targetFace =
      sourceFace +
      preparation.contest.initiator.modifier -
      defender.modifier +
      (outcome === 'win' ? -1 : outcome === 'loss' ? 1 : 0)
    const faces = [sourceFace, targetFace][Symbol.iterator]()
    const occurrenceId = crypto.randomUUID()
    const execution = await executeEncounterOptionalContestAction({
      autoRoll: {
        [preparation.contest.initiator.actorId]: true,
        [preparation.contest.defender.actorId]: true
      },
      published: preparation.graph.published,
      initiator: { ...preparation.contest.initiator, requestNodeId: 'initiator_d20' },
      defender: { ...defender, requestNodeId: 'target_d20' },
      occurrenceId,
      runtime: createRulesRuntime(ctx, base.owner.userId),
      rollD20: () => {
        const face = faces.next().value
        if (face === undefined) throw new Error('Unexpected extra contest roll.')
        return face
      }
    })
    if (execution.kind !== 'COMPLETE') throw new Error('Automatic contest did not complete.')
    expect(faces.next().done).toBe(true)
    const contest = prepareEncounterContestPendingContext({
      ...preparation.contest,
      rollEvidence: {
        initiator: {
          requestId: preparation.contest.initiator.requestNodeId,
          rawFaces: [...execution.initiator.rawFaces]
        },
        defender: {
          requestId: preparation.contest.defender.requestNodeId,
          rawFaces: [...execution.defender.rawFaces],
          checkDefinitionId
        }
      }
    })
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', state.campaignId))
      .unique()
    if (!campaign) throw new Error('Missing Disarm Campaign.')
    const settled = await settleContest(ctx, {
      state,
      campaign,
      actors: [actor, target],
      actor,
      target,
      contest,
      createdEffect: null,
      plannedStateTransition: { kind: 'NONE' },
      forcedMovements: [],
      applyMechanics: () => {
        throw new Error('A Disarm applies no target mechanics.')
      },
      rolls: execution,
      actionEconomy: preparation.actionEconomy,
      occurrenceId,
      commandId: base.command.commandId,
      sourceCommandId: base.command.commandId,
      sourceApplications: [],
      userId: base.owner.userId,
      occurredAt: new Date().toISOString()
    })
    expect(settled.applicationOutputs).toMatchObject({
      sealedContextChecksum: checksumRuleDocument(contest),
      sourceRoll: {
        selectedNatural: sourceFace,
        total: sourceFace + preparation.contest.initiator.modifier
      },
      targetRoll: { selectedNatural: targetFace, total: targetFace + defender.modifier },
      outcome: outcome === 'win' ? 'SOURCE_WIN' : 'TARGET_WIN_OR_TIE',
      actionEconomyTransition: {
        definitionId: SRD_ACTION_ALLOWANCE_DEFINITION_ID,
        beforeUsed: 0,
        afterUsed: 1
      }
    })
    if (abort) throw new Error('rollback direct Disarm settlement')
    return settled
  })
}

function actorState(records: Awaited<ReturnType<typeof disarmRecords>>, actorId: string) {
  const actor = records.actorStates.find((value) => value.id === actorId)
  if (!actor) throw new Error('Missing stored actor.')
  return actor
}

describe('native Disarm preparation and settlement transactions', () => {
  it.each([false, true])(
    'settles only the selected held item and rolls back every write (Character target: %s)',
    async (characterTarget) => {
      const base = await nativeDisarmFixture('AUTO_ROLL', characterTarget)
      const before = await disarmRecords(base)
      await expect(settle(base, 'win', true)).rejects.toThrow('rollback direct Disarm settlement')
      expect(await disarmRecords(base)).toEqual(before)
      const settled = await settle(base, 'win')
      const after = await disarmRecords(base)
      expect(settled.applicationOutputs.stateTransition).toMatchObject(
        characterTarget
          ? {
              kind: 'CHARACTER_ITEM_USE_STATE',
              characterId: base.character.id,
              itemInstanceId: base.heldItemId,
              fromState: 'EQUIPPED',
              toState: 'CARRIED'
            }
          : {
              kind: 'ENCOUNTER_ACTOR_ITEM_USE_STATE',
              actorId: base.target.id,
              loadoutEntryId: base.heldItemId,
              fromState: 'MAIN_HAND',
              toState: 'CARRIED'
            }
      )
      const sourceBefore = actorState(before, base.actor.id)
      const sourceAfter = actorState(after, base.actor.id)
      expect(encounterRuleUsageUsed(sourceAfter, SRD_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(1)
      expect({ ...sourceAfter, resources: sourceBefore.resources }).toEqual(sourceBefore)
      expect(
        after.actors.filter((actor) => actor.id !== base.actor.id && actor.id !== base.target.id)
      ).toEqual(
        before.actors.filter((actor) => actor.id !== base.actor.id && actor.id !== base.target.id)
      )
      if (characterTarget) {
        if (!before.character || !after.character) throw new Error('Missing Character records.')
        const prior = readCharacterRecord(before.character)
        const current = readCharacterRecord(after.character)
        expect(after.character.userId).toBe(before.character.userId)
        expect(after.character.play.streamVersion).toBe(before.character.play.streamVersion + 1)
        expect(current).toEqual({
          ...prior,
          state: {
            ...prior.state,
            equipment: {
              ...prior.state.equipment,
              equipped: prior.state.equipment.equipped.filter(
                ({ itemId }) => itemId !== base.heldItemId
              )
            }
          }
        })
        // Encounter commands write no Character receipts (ADR 0035 Amendment 22, D88).
        expect(after.characterReceipts).toEqual(before.characterReceipts)
        expect(actorState(after, base.target.id)).toEqual(actorState(before, base.target.id))
      } else {
        const prior = actorState(before, base.target.id)
        const current = actorState(after, base.target.id)
        const loadout = snapshotCreatureEquipmentLoadout(prior)
        if (
          typeof prior.snapshot !== 'object' ||
          prior.snapshot === null ||
          Array.isArray(prior.snapshot)
        )
          throw new Error('Missing Creature snapshot.')
        expect(snapshotCreatureEquipmentLoadout(current)).toEqual(
          loadout.map((item) =>
            item.id === base.heldItemId ? { ...item, useState: 'CARRIED' } : item
          )
        )
        expect(current).toEqual({
          ...prior,
          snapshot: {
            ...prior.snapshot,
            equipmentLoadoutOverride: snapshotCreatureEquipmentLoadout(current)
          }
        })
        expect(after.character).toEqual(before.character)
        expect(after.characterReceipts).toEqual(before.characterReceipts)
      }
      expect(after.run).toEqual(before.run)
      expect(after.commands).toEqual(before.commands)
      expect(after.occurrences).toEqual(before.occurrences)
      expect(after.receipts).toEqual(before.receipts)
    },
    30000
  )

  it('lowers a Creature target armor class when a won Disarm takes its shield', async () => {
    const base = await nativeDisarmFixture('AUTO_ROLL', false, false, true)
    const wolfArmorClass = srdPrintedArmorClass(srdWolf)
    const shieldBonus = 2
    const before = actorState(await disarmRecords(base), base.target.id)
    expect(snapshotStatBlock(before)?.armorClass).toBe(wolfArmorClass + shieldBonus)
    const settled = await settle(base, 'win')
    expect(settled.applicationOutputs.stateTransition).toMatchObject({
      kind: 'ENCOUNTER_ACTOR_ITEM_USE_STATE',
      loadoutEntryId: base.heldItemId,
      fromState: 'OFF_HAND',
      toState: 'CARRIED'
    })
    const after = actorState(await disarmRecords(base), base.target.id)
    expect(snapshotStatBlock(after)?.armorClass).toBe(wolfArmorClass)
  }, 30000)

  it.each(['tie', 'loss'] as const)(
    'spends one ACTION on a %s and leaves the held target item intact',
    async (outcome) => {
      const base = await nativeDisarmFixture()
      const before = await disarmRecords(base)
      const settled = await settle(base, outcome)
      const after = await disarmRecords(base)
      expect(settled.applicationOutputs.stateTransition).toEqual({ kind: 'NONE' })
      expect(
        encounterRuleUsageUsed(actorState(after, base.actor.id), SRD_ACTION_ALLOWANCE_DEFINITION_ID)
      ).toBe(1)
      expect(after.actors.filter((actor) => actor.id !== base.actor.id)).toEqual(
        before.actors.filter((actor) => actor.id !== base.actor.id)
      )
      expect(after.character).toEqual(before.character)
      expect(after.characterReceipts).toEqual(before.characterReceipts)
      expect(after.run).toEqual(before.run)
      expect(after.commands).toEqual(before.commands)
      expect(after.occurrences).toEqual(before.occurrences)
      expect(after.receipts).toEqual(before.receipts)
    },
    30000
  )
})
