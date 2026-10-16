import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { describe, expect, it } from 'vitest'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import {
  encounterCommandResultDtoSchema,
  encounterPlayerProjectionDtoSchema
} from '@artificer-toolkit/schema/api/encounterData'
import { encounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { snapshotCreatureEquipmentLoadout } from '@artificer-toolkit/rules-runtime/encounterCreatureEquipmentSources'
import { SRD_BASIC_ACTION_DEFINITIONS } from '@artificer-toolkit/source-data/srd/basicActions.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_ACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { disarmInRoom, disarmRecords, nativeDisarmFixture } from '../../tests/fixtures/nativeDisarm'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import {
  checkpointLiveRoom,
  closeRoom,
  invalidateRoomInputs,
  queueRoomRolls,
  readRoomTimeline,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { api, internal } from '../_generated/api'
import { readCharacterRecord } from '../characters/stateDocuments'

type Base = Awaited<ReturnType<typeof nativeDisarmFixture>>
type Member = Base['owner']

/** The Run's rows once the room checkpoints. The room keeps receipts and command history until the Run ends (D85). */
async function records(base: Base) {
  await checkpointLiveRoom(base.campaign.id)
  return disarmRecords(base)
}

/** The pending decision Convex serves a member, current only after the room checkpoints. */
async function pendingFor(base: Base, member: Member) {
  await checkpointLiveRoom(base.campaign.id)
  return member.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
    encounterId: base.run.id
  })
}

async function projectionFor(base: Base, member: Member) {
  await checkpointLiveRoom(base.campaign.id)
  return member.caller.query(api.encounters.projectionReads.get, { encounterId: base.run.id })
}

/**
 * Whether the Disarm took the target's held item: a Creature's loadout entry is carried, a
 * Character's item unequipped. The contest's rolls and receipt stay in the room (D85) and post no
 * roll card, so the outcome shows in the checkpointed target.
 */
function heldItemDisarmed(base: Base, rows: Awaited<ReturnType<typeof disarmRecords>>) {
  if (base.target.kind === 'CREATURE')
    return (
      snapshotCreatureEquipmentLoadout(actorState(rows, base.target.id)).find(
        (item) => item.id === base.heldItemId
      )?.useState === 'CARRIED'
    )
  if (!rows.character) throw new Error('Missing Character records.')
  return !readCharacterRecord(rows.character).state.equipment.equipped.some(
    ({ itemId }) => itemId === base.heldItemId
  )
}

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
  const actor = records.actorStates.find((state) => state.id === actorId)
  if (!actor) throw new Error('Missing stored actor.')
  return actor
}

// Contested-roll receipts live in the room's history: see apps/session-worker/test/nativeRoomDisarm.test.ts.
describe('room Disarm commands', () => {
  useLocalRoomWorker()

  it('lets the assigned Character initiator answer before handing the Creature defender request to the owner', async () => {
    const base = await nativeDisarmFixture('PROMPT', false, true)
    const before = await records(base)
    const started = await disarmInRoom(base.owner, base.command)
    const first = evidence(base, started, 20)
    await expect(pendingFor(base, base.player)).resolves.toEqual(started.occurrence?.pending)
    const pending = await records(base)
    expect(pending.actors).toEqual(before.actors)
    expect(pending.character).toEqual(before.character)
    expect(pending.pendingSnapshots[0]).toMatchObject({
      applicationContext: {
        initiatorUserId: base.owner.userId,
        contest: { initiatorControllerCharacterId: base.character.id }
      }
    })
    const answered = await disarmInRoom(base.player, first)
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
    await expect(pendingFor(base, base.player)).resolves.toBeNull()
    const defenderPending = await pendingFor(base, base.owner)
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
    const staged = await records(base)
    expect(staged.actors).toEqual(before.actors)
    expect(staged.character).toEqual(before.character)
    expect(staged.occurrences).toHaveLength(1)
    expect(staged.pendingSnapshots[0]).toMatchObject({
      applicationContext: {
        initiatorUserId: base.owner.userId,
        contest: { rollEvidence: { initiator: { rawFaces: [20] }, defender: null } }
      }
    })
    await expect(disarmInRoom(base.player, second)).rejects.toThrow()
    expect(await records(base)).toEqual(staged)
    const completed = await disarmInRoom(base.owner, second)
    expect(completed.occurrence).toMatchObject({ status: 'COMPLETE' })
    const after = await records(base)
    expect(heldItemDisarmed(base, before)).toBe(false)
    expect(heldItemDisarmed(base, after)).toBe(true)
    expect(after.character).toEqual(before.character)
    expect(after.characterReceipts).toEqual(before.characterReceipts)
    expect(
      encounterRuleUsageUsed(actorState(after, base.actor.id), SRD_ACTION_ALLOWANCE_DEFINITION_ID)
    ).toBe(1)
    // The room answers a retry of each settled command from its held history (D85).
    await expect(disarmInRoom(base.owner, base.command)).resolves.toEqual({
      ...started,
      projection: await projectionFor(base, base.owner)
    })
    await expect(disarmInRoom(base.player, first)).resolves.toEqual({
      ...answered,
      projection: await projectionFor(base, base.player)
    })
    await expect(disarmInRoom(base.owner, second)).resolves.toEqual(completed)
    expect(await records(base)).toEqual(after)
  }, 30000)

  it.each(['win', 'tie', 'loss'] as const)(
    'settles an Automatic %s, spending one ACTION and preserving unrelated items and ownership',
    async (outcome) => {
      const base = await nativeDisarmFixture()
      const before = await records(base)
      const sourceFace = 10
      const tiedTargetFace =
        sourceFace + base.contest.initiator.modifier - base.contest.defender.modifier
      const targetFace = tiedTargetFace + (outcome === 'win' ? -1 : outcome === 'loss' ? 1 : 0)
      await queueRoomRolls(base.campaign.id, { rolls: [sourceFace - 1, targetFace - 1] })
      const result = await disarmInRoom(base.owner, base.command)
      expect(result).toMatchObject({
        projection: { version: base.command.expectedVersion + 1 },
        occurrence: { status: 'COMPLETE' }
      })
      const after = await records(base)
      expect(heldItemDisarmed(base, after)).toBe(outcome === 'win')
      const targetBefore = actorState(before, base.target.id)
      const targetAfter = actorState(after, base.target.id)
      const loadout = snapshotCreatureEquipmentLoadout(targetBefore)
      expect(snapshotCreatureEquipmentLoadout(targetAfter)).toEqual(
        loadout.map((item) =>
          item.id === base.heldItemId && outcome === 'win' ? { ...item, useState: 'CARRIED' } : item
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
        encounterRuleUsageUsed(actorState(after, base.actor.id), SRD_ACTION_ALLOWANCE_DEFINITION_ID)
      ).toBe(1)
      expect(after.occurrences).toHaveLength(1)
      expect(after.occurrences[0]?.state).toBe('COMPLETED')
      const timeline = await readRoomTimeline(base.owner.caller, base.campaign.id)
      // A retry answers from the room's held history without rolling again.
      await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 0 })
      await expect(disarmInRoom(base.owner, base.command)).resolves.toEqual(result)
      expect(await records(base)).toEqual(after)
      expect(await readRoomTimeline(base.owner.caller, base.campaign.id)).toEqual(timeline)
      await expect(
        disarmInRoom(base.owner, {
          ...base.command,
          target: { kind: 'ACTOR', actorId: base.actor.id }
        })
      ).rejects.toThrow()
      await expect(
        disarmInRoom(base.owner, { ...base.command, commandId: crypto.randomUUID() })
      ).rejects.toThrow()
      expect(await records(base)).toEqual(after)
    },
    30000
  )

  it('changes only the selected Character item use state, retaining inventory and Character ownership', async () => {
    const base = await nativeDisarmFixture('AUTO_ROLL', true)
    const before = await records(base)
    await queueRoomRolls(base.campaign.id, { rolls: [19, 0] })
    await disarmInRoom(base.owner, base.command)
    const after = await records(base)
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
          equipped: beforeCharacter.state.equipment.equipped.filter(
            ({ itemId }) => itemId !== base.heldItemId
          )
        }
      }
    })
    expect(after.character.play.streamVersion).toBe(before.character.play.streamVersion + 1)
    expect(
      encounterRuleUsageUsed(actorState(after, base.actor.id), SRD_ACTION_ALLOWANCE_DEFINITION_ID)
    ).toBe(1)
  }, 30000)

  it.each([false, true])(
    'seals Assisted participants, hides wrong-player requests and accepts current defender evidence (Character target: %s)',
    async (characterTarget) => {
      const base = await nativeDisarmFixture('PROMPT', characterTarget)
      const before = await records(base)
      const started = await disarmInRoom(base.owner, base.command)
      const first = evidence(base, started, 20)
      const pending = await records(base)
      expect(pending.run).toEqual(before.run)
      expect(pending.actors).toEqual(before.actors)
      expect(pending.character).toEqual(before.character)
      expect(pending.occurrences).toHaveLength(1)
      expect(pending.pendingSnapshots[0]).toMatchObject({
        applicationContext: {
          kind: 'ENCOUNTER_ACTION',
          initiatorUserId: base.owner.userId,
          contest: { actionKind: 'DISARM' }
        }
      })
      await expect(disarmInRoom(base.owner, base.command)).resolves.toEqual(started)
      await expect(pendingFor(base, base.player)).resolves.toBeNull()
      await expect(disarmInRoom(base.player, first)).rejects.toThrow()
      await expect(
        disarmInRoom(base.owner, {
          ...first,
          resolution: {
            kind: 'SYSTEM_ROLL',
            requestId: 'stale-request',
            rollId: crypto.randomUUID()
          }
        })
      ).rejects.toThrow()
      expect(await records(base)).toEqual(pending)

      const next = await disarmInRoom(base.owner, first)
      expect(next.occurrence?.occurrenceId).toBe(started.occurrence?.occurrenceId)
      const second = evidence(base, next, 1)
      const staged = await records(base)
      expect(staged.run).toEqual(before.run)
      expect(staged.actors).toEqual(before.actors)
      expect(staged.character).toEqual(before.character)
      expect(staged.characterReceipts).toEqual(before.characterReceipts)
      expect(staged.pendingSnapshots[0]).toMatchObject({
        applicationContext: { initiatorUserId: base.owner.userId }
      })
      expect(staged.occurrences).toHaveLength(1)
      expect(second.resolution).not.toEqual(first.resolution)
      await expect(pendingFor(base, base.player)).resolves.toEqual(
        characterTarget ? next.occurrence?.pending : null
      )
      if (!characterTarget) await expect(disarmInRoom(base.player, second)).rejects.toThrow()
      await expect(
        disarmInRoom(base.owner, { ...first, commandId: crypto.randomUUID() })
      ).rejects.toThrow()
      expect(await records(base)).toEqual(staged)
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
        // Convex's scheduler sends the room this notice; convex-test runs none.
        await invalidateRoomInputs(base.campaign.id, ['CAMPAIGN'])
        await expect(pendingFor(base, base.player)).resolves.toBeNull()
        await expect(disarmInRoom(base.player, second)).rejects.toThrow()
        expect(await records(base)).toEqual(staged)
        await base.t.run(async (ctx) => {
          const { _id, _creationTime, ...restored } = assignment
          await ctx.db.insert('campaignCharacterAssignments', restored)
        })
        await invalidateRoomInputs(base.campaign.id, ['CAMPAIGN'])
      }
      const result = await disarmInRoom(responder, second)
      expect(result.occurrence).toMatchObject({
        status: 'COMPLETE'
      })
      const after = await records(base)
      expect(heldItemDisarmed(base, before)).toBe(false)
      expect(heldItemDisarmed(base, after)).toBe(true)
      expect(
        encounterRuleUsageUsed(actorState(after, base.actor.id), SRD_ACTION_ALLOWANCE_DEFINITION_ID)
      ).toBe(1)
      // The room answers a retry of each settled command from its held history (D85).
      await expect(disarmInRoom(responder, second)).resolves.toEqual(result)
      await expect(disarmInRoom(base.owner, first)).resolves.toEqual({
        ...next,
        projection: await projectionFor(base, base.owner)
      })
      await expect(disarmInRoom(base.owner, base.command)).resolves.toEqual({
        ...started,
        projection: await projectionFor(base, base.owner)
      })
      expect(await records(base)).toEqual(after)
    },
    30000
  )

  it("keeps the GM's auto-rolled d20 while the defending Character's player rolls their own (D19)", async () => {
    const base = await nativeDisarmFixture('PROMPT', true)
    await setAutoRollDice(base.t, base.owner.userId, true)
    // The room reads preferences when it hydrates; the fixture closed it, but the notice is cheap.
    await invalidateRoomInputs(base.campaign.id, ['PREFERENCES'])
    await queueRoomRolls(base.campaign.id, { rolls: [19] })
    const started = await disarmInRoom(base.owner, base.command)
    // The Creature initiator auto-rolled for the GM; the Character's own d20 waits on its player.
    expect(started.occurrence).toMatchObject({
      status: 'PENDING',
      pending: { kind: 'D20_EVIDENCE', rollerActorId: base.target.id }
    })
    const pending = await pendingFor(base, base.player)
    if (pending?.kind !== 'D20_EVIDENCE') throw new Error('Missing the defender request.')
    expect(pending.rollerActorId).toBe(base.target.id)
    const answered = await disarmInRoom(base.player, {
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
    // The GM's auto-rolled 20 beat the player's entered 1.
    expect(heldItemDisarmed(base, await records(base))).toBe(true)
  }, 30000)

  /** The Run's version as Convex holds it once the room checkpoints. */
  async function runVersion(base: Base) {
    const { run } = await records(base)
    if (!run) throw new Error('Missing Disarm Run.')
    return run.version
  }

  async function setCurrentActor(base: Base, actorId: string) {
    return disarmInRoom(base.owner, {
      type: 'SET_CURRENT_ACTOR',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: await runVersion(base),
      actorId
    })
  }

  /** The helper Helps the target through the real room, overriding Assisted mode's hostile-target warning. */
  async function help(base: Base, helperId: string, targetId: string) {
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: SRD_BASIC_ACTION_DEFINITIONS
    })
    await setCurrentActor(base, helperId)
    await checkpointLiveRoom(base.campaign.id)
    const choice = (
      await base.owner.caller.query(api.encounters.actionChoices.get, {
        encounterId: base.run.id,
        expectedVersion: await runVersion(base),
        actorId: helperId
      })
    )?.basicActionChoices.find((entry) => entry.label === 'Help')
    if (!choice) throw new Error('The helper is not offered Help.')
    await disarmInRoom(base.owner, {
      type: 'RESOLVE_ACTION',
      acceptedWieldConflict: null,
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: await runVersion(base),
      actorId: helperId,
      actionId: choice.id,
      target: { kind: 'ACTOR', actorId: targetId },
      optionalCombatIntent: null,
      sceneContext: null,
      acknowledgedWarnings: ['TARGET_DISPOSITION']
    })
  }

  /** The Active Effects the actor holds, as Convex stores them once the room checkpoints. */
  async function heldGrants(base: Base, actorId: string) {
    await checkpointLiveRoom(base.campaign.id)
    const actor = base.run.actors.find((entry) => entry.id === actorId)
    return base.t.run(async (ctx) =>
      actor?.kind === 'CHARACTER'
        ? ctx.db
            .query('characterActiveRuleEffects')
            .withIndex('by_characterId_id', (q) => q.eq('characterId', base.character.id))
            .collect()
        : ctx.db
            .query('encounterActiveRuleEffects')
            .withIndex('by_encounterId_targetActorId_id', (q) =>
              q.eq('encounterId', base.run.id).eq('targetActorId', actorId)
            )
            .collect()
    )
  }

  it('a Help gives the Disarm attack roll advantage, used once (Q11)', async () => {
    const base = await nativeDisarmFixture('PROMPT')
    const helper = base.run.actors.find((actor) => actor.kind === 'CHARACTER')
    if (!helper) throw new Error('Missing the Help fixture.')
    await help(base, helper.id, base.actor.id)
    expect(await heldGrants(base, base.actor.id)).toHaveLength(1)
    await setCurrentActor(base, base.actor.id)
    const command = {
      ...base.command,
      commandId: crypto.randomUUID(),
      expectedVersion: await runVersion(base)
    }
    const helped = { ...base, command }
    const started = await disarmInRoom(base.owner, command)
    await expect(pendingFor(base, base.owner)).resolves.toMatchObject({
      rollerActorId: base.actor.id,
      request: { rollMode: 'ADVANTAGE', derivedRollModeReasons: ['Help'] }
    })
    const answered = await disarmInRoom(base.owner, evidence(helped, started, 20))
    const defender = await pendingFor(base, base.owner)
    if (defender?.kind !== 'D20_EVIDENCE') throw new Error('Missing the defender request.')
    expect(defender.request.rollMode).toBe('NORMAL')
    await disarmInRoom(base.owner, evidence(helped, answered, 1))
    expect(await heldGrants(base, base.actor.id)).toHaveLength(0)
  }, 30000)

  it('a player rolls the believed mode against a Blinded target; the server holds the die and settles the true Advantage (ATTACK-10.4)', async () => {
    const base = await nativeDisarmFixture('PROMPT', false, true)
    const blinded = srdSystemRecord.conditionTypes.find((value) => value.code === 'BLINDED')
    if (!blinded) throw new Error('Missing Blinded condition fixture.')
    await disarmInRoom(base.owner, {
      type: 'UPDATE_ACTOR',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: await runVersion(base),
      actorId: base.target.id,
      conditions: [blinded.id]
    })
    await disarmInRoom(base.owner, {
      ...base.command,
      commandId: crypto.randomUUID(),
      expectedVersion: await runVersion(base)
    })

    // The player is shown what their own facts imply; the GM is shown the truth.
    const prompt = await pendingFor(base, base.player)
    if (prompt?.kind !== 'D20_EVIDENCE') throw new Error('Expected the player’s attack roll.')
    expect(prompt.request).toMatchObject({
      rollMode: 'NORMAL',
      derivedRollModeReasons: []
    })
    await expect(pendingFor(base, base.owner)).resolves.toMatchObject({
      kind: 'D20_EVIDENCE',
      request: {
        rollMode: 'ADVANTAGE',
        derivedRollModeReasons: ['Unseen attacker']
      }
    })

    const answer = (
      pending: {
        encounterVersion: number
        occurrenceId: string
        occurrenceVersion: number
        request: { requestId: string }
      },
      face: number
    ): ResolveRuleOccurrenceInputDto => ({
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: pending.encounterVersion,
      correlationId: null,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      resolution: {
        kind: 'ENTER_DICE',
        requestId: pending.request.requestId,
        rawFaces: [face],
        rollMode: 'NORMAL'
      }
    })
    // One Normal die is not enough for the true Advantage: the die is held and one more is asked.
    await disarmInRoom(base.player, answer(prompt, 9))
    const held = await pendingFor(base, base.player)
    if (held?.kind !== 'D20_EVIDENCE') throw new Error('Expected the held d20.')
    expect(held.request).toMatchObject({
      rollMode: 'NORMAL',
      heldD20: { faces: [9], caption: "Advantage: the target can't see you" }
    })
    const gmHeld = await pendingFor(base, base.owner)
    if (gmHeld?.kind !== 'D20_EVIDENCE') throw new Error('Expected the GM to see the held d20.')
    const gmReason = gmHeld.request.heldD20?.caption
    expect(gmReason).toEqual(expect.stringContaining("can't see"))
    expect(gmReason).not.toBe(held.request.heldD20?.caption)
    expect(JSON.stringify(held)).not.toContain(gmReason!)

    await disarmInRoom(base.player, answer(held, 15))
    const defender = await pendingFor(base, base.owner)
    if (defender?.kind !== 'D20_EVIDENCE') throw new Error('Missing the defender request.')
    expect(defender.request.heldD20).toBeUndefined()
    await disarmInRoom(base.owner, answer(defender, 1))
    expect(heldItemDisarmed(base, await records(base))).toBe(true)
  }, 30000)

  it('a Help on the defending Creature gives its Disarm check advantage, used once and not the attack (ATTACK-18)', async () => {
    const base = await nativeDisarmFixture('PROMPT')
    const helper = base.run.actors.find((actor) => actor.kind === 'CHARACTER')
    if (!helper) throw new Error('Missing the Help fixture.')
    await help(base, helper.id, base.target.id)
    expect(await heldGrants(base, base.target.id)).toHaveLength(1)
    await setCurrentActor(base, base.actor.id)
    const command = {
      ...base.command,
      commandId: crypto.randomUUID(),
      expectedVersion: await runVersion(base)
    }
    const helped = { ...base, command }
    const started = await disarmInRoom(base.owner, command)
    await expect(pendingFor(base, base.owner)).resolves.toMatchObject({
      rollerActorId: base.actor.id,
      request: { rollMode: 'NORMAL' }
    })
    const answered = await disarmInRoom(base.owner, evidence(helped, started, 20))
    await expect(pendingFor(base, base.owner)).resolves.toMatchObject({
      rollerActorId: base.target.id,
      request: { rollMode: 'ADVANTAGE', derivedRollModeReasons: ['Help'] }
    })
    await disarmInRoom(base.owner, evidence(helped, answered, 1))
    expect(await heldGrants(base, base.target.id)).toHaveLength(0)
  }, 30000)

  it('a Help on the defending Character gives its Disarm check advantage, used once (ATTACK-18)', async () => {
    const base = await nativeDisarmFixture('PROMPT', true)
    const helper = base.run.actors.find(
      (actor) => actor.kind === 'CREATURE' && actor.id !== base.actor.id
    )
    if (!helper) throw new Error('Missing the Help fixture.')
    await help(base, helper.id, base.target.id)
    expect(await heldGrants(base, base.target.id)).toHaveLength(1)
    await setCurrentActor(base, base.actor.id)
    await setAutoRollDice(base.t, base.owner.userId, true)
    await invalidateRoomInputs(base.campaign.id, ['PREFERENCES'])
    await queueRoomRolls(base.campaign.id, { rolls: [19] })
    const command = {
      ...base.command,
      commandId: crypto.randomUUID(),
      expectedVersion: await runVersion(base)
    }
    await disarmInRoom(base.owner, command)
    // The Creature initiator auto-rolled; the Character's own d20 waits on its player, helped.
    const pending = await pendingFor(base, base.player)
    if (pending?.kind !== 'D20_EVIDENCE') throw new Error('Missing the defender request.')
    expect(pending).toMatchObject({
      rollerActorId: base.target.id,
      request: { rollMode: 'ADVANTAGE', derivedRollModeReasons: ['Help'] }
    })
    // The Character's d20 settles the contest and uses the Help up.
    const answered = await disarmInRoom(base.player, {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: command.expectedVersion,
      correlationId: null,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      resolution: {
        kind: 'ENTER_DICE',
        requestId: pending.request.requestId,
        rawFaces: [10, 10],
        rollMode: pending.request.rollMode
      }
    })
    expect(answered.occurrence).toMatchObject({ status: 'COMPLETE' })
    expect(await heldGrants(base, base.target.id)).toHaveLength(0)
  }, 30000)

  it('refuses stale selections and changed pending participants without writes', async () => {
    const base = await nativeDisarmFixture()
    const before = await records(base)
    if (!base.command.optionalCombatIntent) throw new Error('Missing Disarm selection.')
    await expect(
      disarmInRoom(base.owner, {
        ...base.command,
        optionalCombatIntent: {
          ...base.command.optionalCombatIntent,
          selectionContract: '0'.repeat(64)
        }
      })
    ).rejects.toThrow()
    await expect(disarmInRoom(base.player, base.command)).rejects.toThrow()
    expect(await records(base)).toEqual(before)
    await closeRoom(base.campaign.id)

    const assisted = await nativeDisarmFixture('PROMPT', true)
    const result = await disarmInRoom(assisted.owner, assisted.command)
    const response = evidence(assisted, result, 20)
    await closeRoom(assisted.campaign.id)
    const staged = await records(assisted)
    for (const actorId of [assisted.actor.id, assisted.target.id]) {
      const row = staged.actors.find((actor) => actor.id === actorId)!
      const state = actorState(staged, actorId)
      const character = staged.character!
      // The room holds the Run; closed, the Convex write below is what the next command hydrates.
      await closeRoom(assisted.campaign.id)
      await assisted.t.run(async (ctx) => {
        if (state.kind === 'CHARACTER')
          await ctx.db.patch(character.play._id, {
            streamVersion: character.play.streamVersion + 1
          })
        else {
          const changed = { ...state, currentHitPoints: state.currentHitPoints - 1 }
          await writeRunActor({ db: createConvexEncounterStore(ctx) }, row._id, changed)
        }
      })
      const changed = await records(assisted)
      await expect(disarmInRoom(assisted.owner, response)).rejects.toThrow()
      expect(await records(assisted)).toEqual(changed)
      await closeRoom(assisted.campaign.id)
      await assisted.t.run(async (ctx) => {
        if (state.kind === 'CHARACTER')
          await ctx.db.patch(character.play._id, { streamVersion: character.play.streamVersion })
        else
          await ctx.db.patch(row._id, {
            stateJson: row.stateJson,
            stateChecksum: row.stateChecksum
          })
      })
      expect(await records(assisted)).toEqual(staged)
    }
  }, 30000)
})
