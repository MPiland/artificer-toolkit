import { encounterStoredRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  EncounterCommandInputDto,
  EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import {
  domainRejection,
  playerControlFixture,
  setActorControllers,
  type PlayerControlFixture
} from '../../tests/fixtures/playerControl'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  closeRoom,
  executeInRoom,
  executeSheetInRoom,
  queueRoomRolls,
  readRoomRollCards,
  readRoomTimeline,
  useLocalRoomWorker,
  type RoomCaller
} from '../../tests/fixtures/localRoomWorker'
import {
  concentrationAction,
  concentrationRecords,
  seedConcentration,
  setupConcentration
} from '../../tests/fixtures/concentration'
import { api } from '../_generated/api'
import { readCharacterRecord } from '../characters/stateDocuments'

useLocalRoomWorker()

/**
 * Four gameplay journeys through the real room (V13.1) and their recovery after a reload (V13.2).
 * `closeRoom` ends the room's epoch with its store kept, so the next command opens a new epoch (D85).
 * A retry recognized only from the Run's replay index, after storage loss, cannot be driven here:
 * the harness has no way to empty one room's storage and keep serving it (`DELETE_ROOM` leaves the
 * instance answering 410, and a fresh Worker is private to `localRoomWorker.ts`), so the session
 * worker's `roomEncounterReplayIndex.test.ts` covers that path.
 */

type Member = { caller: RoomCaller }
/** What a journey's replay checks read: any fixture that holds a Run in a Campaign's room. */
type JourneyBase = Pick<PlayerControlFixture, 'campaign' | 'run' | 't'>
type D20Pending = Extract<PendingEncounterRuleOccurrenceSummaryDto, { kind: 'D20_EVIDENCE' }>
type Step = { member: Member; command: EncounterCommandInputDto; result: EncounterCommandResultDto }

const pendingRuleOccurrence = makeFunctionReference<
  'query',
  { encounterId: string },
  PendingEncounterRuleOccurrenceSummaryDto | null
>('encounters/pendingReads:pendingRuleOccurrence')

async function readPending(base: PlayerControlFixture, member: Member) {
  await checkpointLiveRoom(base.campaign.id)
  return member.caller.query(pendingRuleOccurrence, { encounterId: base.run.id })
}

async function d20Pending(base: PlayerControlFixture, member: Member): Promise<D20Pending> {
  const pending = await readPending(base, member)
  if (pending?.kind !== 'D20_EVIDENCE') throw new Error('Expected a d20 roll prompt.')
  return pending
}

/**
 * Every row of the Run Convex holds once the room checkpoints (the Run's history stays in the
 * room until it completes, D85), with its replay index: a replay must leave them unchanged.
 */
async function stored(base: JourneyBase) {
  await checkpointLiveRoom(base.campaign.id)
  const encounterId = base.run.id
  return base.t.run(async (ctx) => ({
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', encounterId))
      .unique(),
    actors: await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId))
      .collect(),
    occurrences: await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (q) => q.eq('encounterId', encounterId))
      .collect(),
    replayIndex: await ctx.db
      .query('encounterReplayIndex')
      .withIndex('by_campaignId_commandId', (q) => q.eq('campaignId', base.campaign.id))
      .collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect()
  }))
}

/** Runs a journey's steps in order through the room, recording each result. */
function journey() {
  const steps: Step[] = []
  return {
    steps,
    send: async (member: Member, command: EncounterCommandInputDto) => {
      const result = await executeInRoom(member.caller, { command })
      steps.push({ member, command, result })
      return result
    }
  }
}

/**
 * Every committed step leaves its replay-index row in Convex, and a release of the room changes
 * nothing Convex holds. Retried after the release, every step replays from the history the next
 * hydrate carries over: its own dice, evidence and occurrence over the Run's current projection,
 * with no roll and no write. A "Roll dice" replay returns only its evidence roll.
 */
async function expectReplayAcrossRelease(base: JourneyBase, steps: readonly Step[]) {
  const before = await stored(base)
  expect(before.replayIndex.map((row) => row.commandId)).toEqual(
    expect.arrayContaining(steps.map((step) => step.command.commandId))
  )
  const last = steps.at(-1)
  if (!last) throw new Error('A journey needs a step.')
  await closeRoom(base.campaign.id)
  for (const { member, command, result } of steps) {
    const replayed = await executeInRoom(member.caller, { command })
    expect(replayed).toMatchObject(
      command.type === 'ROLL_RULE_EVIDENCE'
        ? { roll: null, evidenceRoll: result.evidenceRoll, occurrence: null }
        : {
            roll: result.roll,
            evidenceRoll: result.evidenceRoll,
            occurrence: result.occurrence && { occurrenceId: result.occurrence.occurrenceId }
          }
    )
    expect(replayed.projection.version).toBe(last.result.projection.version)
  }
  expect(await executeInRoom(last.member.caller, { command: last.command })).toEqual(last.result)
  expect(await stored(base)).toEqual(before)
  // A command ID reused with other input is refused in the next epoch too, and writes nothing.
  const [first] = steps
  if (!first) throw new Error('A journey needs a step.')
  await closeRoom(base.campaign.id)
  await expect(
    domainRejection(
      executeInRoom(first.member.caller, {
        command: { ...first.command, expectedVersion: first.command.expectedVersion + 1 }
      })
    )
  ).resolves.toMatchObject({ reason: 'COMMAND_ID_REUSED' })
  expect(await stored(base)).toEqual(before)
}

function rollEvidence(base: PlayerControlFixture, pending: D20Pending): EncounterCommandInputDto {
  return {
    type: 'ROLL_RULE_EVIDENCE',
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: pending.encounterVersion,
    occurrenceId: pending.occurrenceId,
    expectedOccurrenceVersion: pending.occurrenceVersion,
    requestId: pending.request.requestId,
    rollMode: null
  }
}

function settle(
  base: PlayerControlFixture,
  pending: D20Pending,
  resolution: ResolveRuleOccurrenceInputDto['resolution']
): ResolveRuleOccurrenceInputDto {
  return {
    type: 'RESOLVE_RULE_OCCURRENCE',
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: pending.encounterVersion,
    correlationId: null,
    occurrenceId: pending.occurrenceId,
    expectedOccurrenceVersion: pending.occurrenceVersion,
    resolution
  }
}

async function runCommand(
  base: PlayerControlFixture,
  type: 'ADVANCE_TURN' | 'REVERT_LAST_ACTION'
): Promise<EncounterCommandInputDto> {
  return {
    type,
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: await base.version()
  }
}

function hitPoints(result: EncounterCommandResultDto, actorId: string) {
  const actor = result.projection.actors.find((candidate) => candidate.id === actorId)
  return actor && 'currentHitPoints' in actor ? actor.currentHitPoints : undefined
}

describe('Encounter journeys through the room (V13.1)', () => {
  it('a GM action with no roll, then a turn advance', async () => {
    const base = await playerControlFixture()
    const { steps, send } = journey()
    const bitten = await send(base.owner, await base.bite(base.companion.id, base.enemy.id))
    expect(hitPoints(bitten, base.enemy.id)).toBeLessThan(base.enemy.currentHitPoints)
    const advanced = await send(base.owner, await runCommand(base, 'ADVANCE_TURN'))
    expect(advanced.projection.currentActorId).toBe(base.character.id)
    await expectReplayAcrossRelease(base, steps)
  }, 120000)

  it('a player attack whose controller enters the roll', async () => {
    const base = await playerControlFixture({ bite: 'ATTACK', promptRolls: true })
    await setActorControllers(base, base.companion.id, [base.other.userId])
    const { steps, send } = journey()
    await send(base.other, await base.bite(base.companion.id, base.enemy.id))
    const pending = await d20Pending(base, base.other)
    const settled = await send(
      base.other,
      settle(base, pending, {
        kind: 'ENTER_DICE',
        requestId: pending.request.requestId,
        rawFaces: [3, 18],
        rollMode: 'ADVANTAGE'
      })
    )
    expect(settled.occurrence?.status ?? 'COMPLETE').toBe('COMPLETE')
    await expectReplayAcrossRelease(base, steps)
  }, 120000)

  it('a player action whose enemy save the GM rolls twice and settles', async () => {
    const base = await playerControlFixture({ bite: 'SAVE', promptRolls: true })
    await setActorControllers(base, base.companion.id, [base.other.userId])
    const { steps, send } = journey()
    await send(base.other, await base.bite(base.companion.id, base.enemy.id))
    const pending = await d20Pending(base, base.owner)
    await send(base.owner, rollEvidence(base, pending))
    const latest = await send(base.owner, rollEvidence(base, pending))
    if (!latest.evidenceRoll) throw new Error('Expected an app roll.')
    const settled = await send(
      base.owner,
      settle(base, pending, {
        kind: 'SYSTEM_ROLL',
        requestId: pending.request.requestId,
        rollId: latest.evidenceRoll.rollId
      })
    )
    expect(settled.occurrence?.status ?? 'COMPLETE').toBe('COMPLETE')
    await expectReplayAcrossRelease(base, steps)
  }, 120000)

  it('a GM undo of an action, then the action again', async () => {
    const base = await playerControlFixture()
    const { steps, send } = journey()
    await send(base.owner, await base.bite(base.companion.id, base.enemy.id))
    const undone = await send(base.owner, await runCommand(base, 'REVERT_LAST_ACTION'))
    expect(hitPoints(undone, base.enemy.id)).toBe(base.enemy.currentHitPoints)
    const again = await send(base.owner, await base.bite(base.companion.id, base.enemy.id))
    expect(hitPoints(again, base.enemy.id)).toBeLessThan(base.enemy.currentHitPoints)
    await expectReplayAcrossRelease(base, steps)
  }, 120000)

  it('a player\'s "Do it anyway" on bendable warnings, the GM\'s override badge, then a GM undo (ADR 0034)', async () => {
    const base = await playerControlFixture()
    await setActorControllers(base, base.companion.id, [base.other.userId])
    const { steps, send } = journey()
    // The Bite targets another creature, so biting itself is a bendable disposition warning.
    const atSelf = await base.bite(base.companion.id, base.companion.id)
    const before = await stored(base)
    await expect(
      domainRejection(executeInRoom(base.other.caller, { command: atSelf }))
    ).resolves.toEqual({
      code: 'DOMAIN_REJECTED',
      reason: 'RULE_WARNINGS',
      message: 'This action breaks a rule. Do it anyway?',
      warnings: [{ code: 'TARGET_DISPOSITION', message: 'This action targets another creature.' }]
    })
    expect(await stored(base)).toEqual(before)

    const overridden = await send(base.other, {
      ...atSelf,
      commandId: crypto.randomUUID(),
      acknowledgedWarnings: ['TARGET_DISPOSITION']
    })
    expect(overridden.projection.version).toBe(atSelf.expectedVersion + 1)
    const timeline = await readRoomTimeline(base.owner.caller, base.campaign.id)
    expect(
      timeline.find((entry) => entry.version === overridden.projection.version)?.ruleOverrides
    ).toEqual([{ code: 'TARGET_DISPOSITION', message: 'This action targets another creature.' }])

    // The Action is spent, so a second Bite warns too, and writes nothing until acknowledged.
    const second = await base.bite(base.companion.id, base.enemy.id)
    const afterOverride = await stored(base)
    await expect(
      domainRejection(executeInRoom(base.other.caller, { command: second }))
    ).resolves.toMatchObject({
      reason: 'RULE_WARNINGS',
      warnings: [{ code: 'ACTION_ECONOMY_UNAVAILABLE' }]
    })
    expect(await stored(base)).toEqual(afterOverride)

    // The GM undoes the override; the Action comes back, so the Bite at the enemy needs no override.
    await send(base.owner, await runCommand(base, 'REVERT_LAST_ACTION'))
    const bite = await base.bite(base.companion.id, base.enemy.id)
    const bitten = await send(base.other, bite)
    expect(bitten.projection.version).toBe(bite.expectedVersion + 1)
    // The player sees no enemy hit points, so the damage shows in the enemy's stored state.
    const enemy = (await stored(base)).actors.find((actor) => actor.id === base.enemy.id)
    const enemyState =
      enemy && encounterStoredRunActorStateSchema.parse(JSON.parse(enemy.stateJson))
    if (!enemyState || !('currentHitPoints' in enemyState))
      throw new Error('Missing the stored enemy health.')
    expect(enemyState.currentHitPoints).toBeLessThan(base.enemy.currentHitPoints)
    await expectReplayAcrossRelease(base, steps)
  }, 120000)
})

describe('Concentration ends without a check (D95)', () => {
  it("a player's concentrating Character knocked to 0 by the GM's Creature loses it, with no roll", async () => {
    const base = await setupConcentration('AUTO_ROLL')
    const seeded = await seedConcentration({ ...base, characterHitPoints: 1 })
    await attachFixtureRoom(base.t, base.campaign.id)
    const { steps, send } = journey()
    const hit = await send(base.owner, concentrationAction(base))
    expect(hit.occurrence?.status ?? 'COMPLETE').toBe('COMPLETE')
    expect(hit.roll).toBeNull()

    await checkpointLiveRoom(base.campaign.id)
    const settled = await concentrationRecords(base)
    expect(settled.states.map((state) => state.id)).not.toContain(seeded.state.id)
    expect(settled.effects.map((effect) => effect.id)).not.toContain(seeded.dependent.id)
    expect(settled.effects.map((effect) => effect.id)).toContain(seeded.independent.id)
    const chat = await base.player.caller.query(api.campaigns.chat.list, {
      campaignId: base.campaign.id,
      room: 'TABLE',
      limit: 100
    })
    expect(
      chat.entries.filter((entry) => entry.body?.endsWith('loses Concentration.'))
    ).toHaveLength(1)
    await expectReplayAcrossRelease(base, steps)
  }, 120000)

  /** One Concentration end with no check: the slot and its dependents gone, no roll, one table entry. */
  async function expectEndedWithoutCheck(
    base: Awaited<ReturnType<typeof setupConcentration>>,
    seeded: Awaited<ReturnType<typeof seedConcentration>>
  ) {
    await checkpointLiveRoom(base.campaign.id)
    const settled = await concentrationRecords(base)
    expect(settled.states.map((state) => state.id)).not.toContain(seeded.state.id)
    expect(settled.effects.map((effect) => effect.id)).not.toContain(seeded.dependent.id)
    expect(settled.effects.map((effect) => effect.id)).toContain(seeded.independent.id)
    // No check is rolled for the lost Concentration, and none is waiting.
    expect(settled.pending).toEqual([])
    expect(await readRoomRollCards(base.player.caller, base.campaign.id)).toEqual([])
    const chat = await base.player.caller.query(api.campaigns.chat.list, {
      campaignId: base.campaign.id,
      room: 'TABLE',
      limit: 100
    })
    expect(
      chat.entries.filter((entry) => entry.body?.endsWith('loses Concentration.'))
    ).toHaveLength(1)
    return settled
  }

  it('a player who marks their concentrating Character Paralyzed on the Sheet loses it, with no roll', async () => {
    const base = await setupConcentration('AUTO_ROLL')
    const seeded = await seedConcentration(base)
    await attachFixtureRoom(base.t, base.campaign.id)
    const paralyzed = srdSystemRecord.conditionTypes.find(
      (condition) => condition.code === 'PARALYZED'
    )
    if (!paralyzed) throw new Error('The SRD Paralyzed condition is unavailable.')
    const before = (await concentrationRecords(base)).character
    if (!before) throw new Error('Missing the concentrating Character.')

    await executeSheetInRoom(base.player.caller, {
      scope: 'CHARACTER_SHEET',
      characterId: base.character.id,
      encounterId: base.run.id,
      command: {
        type: 'ADD_CONDITION',
        conditionTypeId: paralyzed.id,
        commandId: crypto.randomUUID(),
        expectedVersion: before.play.streamVersion
      }
    })

    const settled = await expectEndedWithoutCheck(base, seeded)
    // The Sheet edit and the Concentration cleanup land as one stream version.
    expect(settled.character?.play.streamVersion).toBe(before.play.streamVersion + 1)
    expect(
      readCharacterRecord(settled.character!).state.conditions?.map(
        (condition) => condition.conditionTypeId
      )
    ).toContain(paralyzed.id)
  }, 120000)

  it("a player's concentrating Character the GM drops to 0 hit points through the actor edit loses it, with no roll", async () => {
    const base = await setupConcentration('AUTO_ROLL')
    const seeded = await seedConcentration({ ...base, characterHitPoints: 4 })
    await attachFixtureRoom(base.t, base.campaign.id)
    const before = (await concentrationRecords(base)).character
    if (!before) throw new Error('Missing the concentrating Character.')
    const { send } = journey()

    const edited = await send(base.owner, {
      type: 'UPDATE_ACTOR',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: base.run.version,
      actorId: base.target.id,
      characterCommand: {
        type: 'ADJUST_HIT_POINTS',
        mode: 'DAMAGE',
        amount: 4,
        commandId: crypto.randomUUID(),
        expectedVersion: before.play.streamVersion
      }
    })

    expect(edited.roll).toBeNull()
    const settled = await expectEndedWithoutCheck(base, seeded)
    expect(settled.character?.play.streamVersion).toBe(before.play.streamVersion + 1)
  }, 120000)
})

describe('A Creature that holds Concentration makes the check (SPELLS-9.2)', () => {
  it("the GM's Creature, hit by another Creature, rolls its Constitution save for the GM and loses its spell on a failure", async () => {
    const base = await setupConcentration('AUTO_ROLL', undefined, 'CREATURE')
    const seeded = await seedConcentration({ ...base, creatureHolder: true })
    await attachFixtureRoom(base.t, base.campaign.id)
    await queueRoomRolls(base.campaign.id, { rolls: [0] })
    const { steps, send } = journey()

    const hit = await send(base.owner, concentrationAction(base))
    expect(hit.occurrence?.status ?? 'COMPLETE').toBe('COMPLETE')

    // The GM's auto-roll settled the check in the same commit: nothing waits, and it failed.
    await checkpointLiveRoom(base.campaign.id)
    const settled = await concentrationRecords(base)
    expect(settled.pending).toEqual([])
    expect(settled.states.map((state) => state.id)).not.toContain(seeded.state.id)
    expect(settled.actorEffects.map((effect) => effect.id)).toEqual([seeded.independent.id])
    expect(await readRoomRollCards(base.owner.caller, base.campaign.id)).toContainEqual(
      expect.objectContaining({
        ruleCheck: expect.objectContaining({
          kind: 'CONCENTRATION',
          actorId: base.target.id,
          outcome: 'LOST'
        })
      })
    )
    await expectReplayAcrossRelease(base, steps)
  }, 120000)
})

describe('Encounter recovery after a reload (V13.2)', () => {
  it('keeps refusals, privacy, authority and GM undo across a release', async () => {
    const base = await playerControlFixture({ bite: 'SAVE', promptRolls: true })
    await setActorControllers(base, base.companion.id, [base.other.userId])
    const start = await base.bite(base.companion.id, base.enemy.id)
    await executeInRoom(base.other.caller, { command: start })
    await closeRoom(base.campaign.id)

    // A new action waits for the pending save, and the reloaded room keeps that save the GM's.
    const before = await stored(base)
    await expect(
      domainRejection(
        executeInRoom(base.other.caller, { command: { ...start, commandId: crypto.randomUUID() } })
      )
    ).resolves.toMatchObject({ reason: 'PENDING_DECISION' })
    for (const member of [base.other, base.player])
      await expect(readPending(base, member)).resolves.toBeNull()
    const pending = await d20Pending(base, base.owner)
    for (const member of [base.other, base.player])
      await expect(
        domainRejection(executeInRoom(member.caller, { command: rollEvidence(base, pending) }))
      ).resolves.toMatchObject({ reason: 'DECISION_NOT_PENDING' })
    expect(await stored(base)).toEqual(before)

    const rolled = await executeInRoom(base.owner.caller, { command: rollEvidence(base, pending) })
    if (!rolled.evidenceRoll) throw new Error('Expected an app roll.')
    await executeInRoom(base.owner.caller, {
      command: settle(base, pending, {
        kind: 'SYSTEM_ROLL',
        requestId: pending.request.requestId,
        rollId: rolled.evidenceRoll.rollId
      })
    })
    await closeRoom(base.campaign.id)
    const settledState = await stored(base)
    await expect(
      domainRejection(
        executeInRoom(base.other.caller, { command: { ...start, commandId: crypto.randomUUID() } })
      )
    ).resolves.toMatchObject({ reason: 'VERSION_STALE' })
    expect(await stored(base)).toEqual(settledState)

    // Only the GM undoes. The release kept the room's history of the Run, so the GM's undo is available.
    const undo = await runCommand(base, 'REVERT_LAST_ACTION')
    await expect(executeInRoom(base.other.caller, { command: undo })).rejects.toThrow()
    expect(await stored(base)).toEqual(settledState)
    const undone = await executeInRoom(base.owner.caller, { command: undo })
    expect(hitPoints(undone, base.enemy.id)).toBe(base.enemy.currentHitPoints)
  }, 120000)
})

describe('Encounter history stays in the room (D85)', () => {
  it('keeps the timeline and a pending decision across a reload mid-Run', async () => {
    const base = await playerControlFixture({ bite: 'ATTACK', promptRolls: true })
    await setActorControllers(base, base.companion.id, [base.other.userId])
    const start = await base.bite(base.companion.id, base.enemy.id)
    const started = await executeInRoom(base.other.caller, { command: start })
    const pending = await d20Pending(base, base.other)
    await closeRoom(base.campaign.id)
    await expect(d20Pending(base, base.other)).resolves.toEqual(pending)
    // The reloaded room still holds the command's history, so a retry replays it.
    await expect(executeInRoom(base.other.caller, { command: start })).resolves.toMatchObject({
      occurrence: started.occurrence && { occurrenceId: started.occurrence.occurrenceId }
    })
    const settled = await executeInRoom(base.other.caller, {
      command: settle(base, pending, {
        kind: 'ENTER_DICE',
        requestId: pending.request.requestId,
        rawFaces: [3, 18],
        rollMode: 'ADVANTAGE'
      })
    })
    expect(settled.occurrence?.status ?? 'COMPLETE').toBe('COMPLETE')
  }, 120000)

  it('lets the GM complete the Run after a release with a pending decision', async () => {
    const base = await playerControlFixture({ bite: 'ATTACK', promptRolls: true })
    await setActorControllers(base, base.companion.id, [base.other.userId])
    await executeInRoom(base.other.caller, {
      command: await base.bite(base.companion.id, base.enemy.id)
    })
    const pending = await d20Pending(base, base.other)
    await closeRoom(base.campaign.id)
    await expect(d20Pending(base, base.other)).resolves.toEqual(pending)
    const complete = async () => ({
      type: 'COMPLETE' as const,
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: await base.version()
    })
    // As before the release, an open decision blocks COMPLETE until the GM settles or voids it.
    await expect(
      domainRejection(executeInRoom(base.owner.caller, { command: await complete() }))
    ).resolves.toMatchObject({ reason: 'PENDING_DECISION' })
    await executeInRoom(base.owner.caller, {
      command: {
        type: 'VOID_RULE_OCCURRENCE',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: pending.encounterVersion,
        occurrenceId: pending.occurrenceId,
        expectedOccurrenceVersion: pending.occurrenceVersion
      }
    })
    const completed = await executeInRoom(base.owner.caller, { command: await complete() })
    expect(completed.projection.status).toBe('COMPLETED')
  }, 120000)

  it('persists roll cards once, with stable ids, across two flushes', async () => {
    const base = await playerControlFixture()
    const rollCardIds = async () => {
      await checkpointLiveRoom(base.campaign.id)
      return base.t.run(async (ctx) =>
        (await ctx.db.query('campaignConversationEntryPayloads').collect())
          .filter((payload) => payload.roll !== null)
          .map((payload) => payload.entryId)
          .sort()
      )
    }
    await executeInRoom(base.owner.caller, {
      command: await base.bite(base.companion.id, base.enemy.id)
    })
    const first = await rollCardIds()
    expect(first.length).toBeGreaterThan(0)
    await executeInRoom(base.owner.caller, { command: await runCommand(base, 'ADVANCE_TURN') })
    expect(await rollCardIds()).toEqual(first)
    expect(new Set(first).size).toBe(first.length)
  }, 120000)

  it('leaves no history or replay index in Convex once the Run completes', async () => {
    const base = await playerControlFixture()
    const replayIndex = async () => {
      await checkpointLiveRoom(base.campaign.id)
      return (await stored(base)).replayIndex.filter((row) => row.encounterId === base.run.id)
    }
    await executeInRoom(base.owner.caller, {
      command: await base.bite(base.companion.id, base.enemy.id)
    })
    expect(await replayIndex()).not.toEqual([])
    await executeInRoom(base.owner.caller, {
      command: {
        type: 'COMPLETE',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: await base.version()
      }
    })
    expect(await replayIndex()).toEqual([])
    const rows = await base.t.run(async (ctx) => {
      const encounterId = base.run.id
      const ofRun = <Row extends { encounterId: string }>(all: Row[]) =>
        all.filter((row) => row.encounterId === encounterId)
      return [
        ...ofRun(await ctx.db.query('encounterRunCommands').collect()),
        ...ofRun(await ctx.db.query('encounterRuleReceipts').collect())
      ]
    })
    expect(rows).toEqual([])
  }, 120000)
})
