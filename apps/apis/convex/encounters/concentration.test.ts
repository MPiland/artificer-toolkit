// @vitest-environment node
import { expect, it } from 'vitest'
import type { EncounterExecuteInput } from '@artificer-toolkit/schema/api/encounters'
import { encodeCharacterRecord } from '@artificer-toolkit/schema/projections/characterStoredState'
import {
  concentrationAction,
  concentrationRecords,
  seedConcentration,
  setupConcentration
} from '../../tests/fixtures/concentration'
import { api } from '../_generated/api'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import { createPartyPlayer } from '../../tests/fixtures/partyPlayer'
import { storeRunAutomationMode } from '../../tests/fixtures/playerControl'
import type { FixtureRolls } from '../../tests/fixtures/rollPreferences'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  executeInRoom,
  queueRoomRolls,
  readRoomRollCards,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()

async function roomFixture(rolls: FixtureRolls) {
  const fixture = await setupConcentration(rolls)
  const seeded = await seedConcentration(fixture)
  await attachFixtureRoom(fixture.t, fixture.campaign.id)
  return { fixture, seeded }
}

/** Convex rows once the room has checkpointed; the room's held receipts are not among them. */
async function records(fixture: Awaited<ReturnType<typeof setupConcentration>>) {
  await checkpointLiveRoom(fixture.campaign.id)
  return concentrationRecords(fixture)
}

async function pendingFor(
  fixture: Awaited<ReturnType<typeof setupConcentration>>,
  member: typeof fixture.owner
) {
  await checkpointLiveRoom(fixture.campaign.id)
  return member.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
    encounterId: fixture.run.id
  })
}

function response(
  encounterId: string,
  pending: {
    kind: 'D20_EVIDENCE'
    encounterVersion: number
    occurrenceId: string
    occurrenceVersion: number
    request: {
      requestId: string
      rollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'
      keep: 'FIRST' | 'HIGHER' | 'LOWER'
    }
  },
  answer: number | { rollId: string }
) {
  return {
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: pending.encounterVersion,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      correlationId: null,
      resolution:
        typeof answer === 'number'
          ? {
              kind: 'ENTER_DICE' as const,
              requestId: pending.request.requestId,
              rawFaces: pending.request.rollMode === 'NORMAL' ? [answer] : [answer, answer],
              rollMode: pending.request.rollMode
            }
          : {
              kind: 'SYSTEM_ROLL' as const,
              requestId: pending.request.requestId,
              rollId: answer.rollId
            }
    }
  } satisfies EncounterExecuteInput
}

it('pauses an Assisted concentration child and settles success without cleanup', async () => {
  const { fixture, seeded } = await roomFixture('PROMPT')
  const root = concentrationAction(fixture)
  const before = await records(fixture)
  const parent = await executeInRoom(fixture.owner.caller, {
    command: root
  })
  expect(parent.occurrence?.status).toBe('COMPLETE')
  const staged = await records(fixture)
  expect(staged.character?.play.streamVersion).toBe(before.character!.play.streamVersion + 1)
  expect(staged.states.map((state) => state.id)).toContain(seeded.state.id)
  const pending = await pendingFor(fixture, fixture.owner)
  expect(pending).toMatchObject({
    kind: 'D20_EVIDENCE',
    request: { min: 1, max: 20, rollMode: 'NORMAL' },
    allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
  })
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Expected discoverable concentration child.')
  // App rolls post to the table chat, which needs a username.
  await fixture.owner.caller.mutation(api.account.updateProfile, {
    username: 'ConcentrationGm',
    bio: null
  })
  await queueRoomRolls(fixture.campaign.id, { rolls: [], repeat: 19 })
  const rolled = await executeInRoom(fixture.owner.caller, {
    command: {
      type: 'ROLL_RULE_EVIDENCE',
      encounterId: fixture.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: pending.encounterVersion,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      requestId: pending.request.requestId,
      rollMode: pending.request.rollMode
    }
  })
  expect(rolled.evidenceRoll).toMatchObject({ faces: [20], value: 20 })
  const command = response(fixture.run.id, pending, {
    rollId: rolled.evidenceRoll!.rollId
  })
  const pendingRow = staged.pending[0]
  if (!pendingRow) throw new Error('Expected stored concentration child.')
  const colliding = {
    command: { ...command.command, commandId: pendingRow.rootCommandId }
  } satisfies EncounterExecuteInput
  const rollCards = (await readRoomRollCards(fixture.owner.caller, fixture.campaign.id)).length
  await expect(executeInRoom(fixture.owner.caller, colliding)).rejects.toThrow()
  // The refused command rolled nothing: no further roll card reached the table.
  expect(await readRoomRollCards(fixture.owner.caller, fixture.campaign.id)).toHaveLength(rollCards)
  expect(await records(fixture)).toEqual(staged)
  const settled = await executeInRoom(fixture.owner.caller, command)
  expect(settled.occurrence).toMatchObject({ status: 'COMPLETE' })
  // The save's outcome is the Concentration roll card of the roll the owner answered with.
  expect(await readRoomRollCards(fixture.owner.caller, fixture.campaign.id)).toContainEqual(
    expect.objectContaining({
      ruleCheck: expect.objectContaining({
        kind: 'CONCENTRATION',
        actorId: pending.rollerActorId,
        faces: rolled.evidenceRoll!.faces,
        outcome: 'KEPT'
      })
    })
  )
  const after = await records(fixture)
  expect(after.run?.version).toBe(staged.run?.version)
  expect(after.states.map((state) => state.id)).toContain(seeded.state.id)
  expect(after.effects.map((effect) => effect.id)).toEqual(
    expect.arrayContaining([seeded.dependent.id, seeded.independent.id])
  )
  expect(after.character).toEqual(staged.character)
  // A retry is answered from the room's held history, without a new write.
  expect(await executeInRoom(fixture.owner.caller, command)).toEqual(settled)
  expect(await executeInRoom(fixture.owner.caller, { command: root })).toEqual(parent)
  expect(await records(fixture)).toEqual(after)
}, 60_000)

it('raises no concentration prompt in a Manual Run, where the damaging action is refused whole', async () => {
  const { fixture, seeded } = await roomFixture('PROMPT')
  await storeRunAutomationMode(fixture.t, fixture.run.id, 'MANUAL')
  const before = await records(fixture)
  await expect(
    executeInRoom(fixture.owner.caller, {
      command: concentrationAction(fixture)
    })
  ).rejects.toMatchObject({
    data: { code: 'DOMAIN_REJECTED', reason: 'ASSISTED_ONLY' }
  })
  expect(await records(fixture)).toEqual(before)
  expect(before.states.map((state) => state.id)).toContain(seeded.state.id)
  for (const member of [fixture.owner, fixture.player])
    expect(await pendingFor(fixture, member)).toBeNull()
}, 60_000)

it('does not create a concentration child when finalized applied damage is zero', async () => {
  const { fixture, seeded } = await roomFixture('PROMPT')
  await fixture.t.run(async (ctx) => {
    const characterRow = await readCharacterRow(ctx, fixture.character.id)
    if (!characterRow) throw new Error('Concentration target is unavailable.')
    const character = readCharacterRecord(characterRow)
    const encoded = encodeCharacterRecord(characterRow, {
      document: {
        ...character,
        state: {
          ...character.state,
          hitpoints: { ...character.state.hitpoints, current: 0 }
        }
      },
      streamVersion: characterRow.play.streamVersion,
      updatedAt: characterRow.updatedAt
    })
    await ctx.db.patch(characterRow.play._id, {
      state: encoded.play.state,
      checksum: encoded.play.checksum
    })
  })
  const settled = await executeInRoom(fixture.owner.caller, {
    command: concentrationAction(fixture)
  })
  // No concentration child was raised: the action completed and nothing is waiting on a roll.
  expect(settled.occurrence?.status).toBe('COMPLETE')
  expect(await pendingFor(fixture, fixture.owner)).toBeNull()
  const after = await records(fixture)
  expect(after.states.map((state) => state.id)).toContain(seeded.state.id)
}, 60_000)

it.each([
  { face: 20, outcome: 'SAVE_SUCCESS' as const, cleanup: false },
  { face: 1, outcome: 'SAVE_FAILURE' as const, cleanup: true }
])(
  'settles Automatic concentration atomically for $outcome',
  async ({ face, cleanup }) => {
    const { fixture, seeded } = await roomFixture('AUTO_ROLL')
    const root = concentrationAction(fixture)
    // The attack's own d20 is not rolled here (the action is a damaging feature), so the first
    // roll the room draws is the concentration save.
    await queueRoomRolls(fixture.campaign.id, { rolls: [face - 1] })
    const settled = await executeInRoom(fixture.owner.caller, {
      command: root
    })
    expect(settled.occurrence?.status).toBe('COMPLETE')
    expect(await pendingFor(fixture, fixture.owner)).toBeNull()
    const after = await records(fixture)
    expect(after.states.some((state) => state.id === seeded.state.id)).toBe(!cleanup)
    expect(after.effects.some((effect) => effect.id === seeded.dependent.id)).toBe(!cleanup)
    expect(after.effects.map((effect) => effect.id)).toContain(seeded.independent.id)
    // A retry is answered from the room's held history, without a new write.
    expect(await executeInRoom(fixture.owner.caller, { command: root })).toEqual(settled)
    expect(await records(fixture)).toEqual(after)
  },
  60_000
)

it('cleans the exact concentration state on failure and preserves an independent condition', async () => {
  const { fixture, seeded } = await roomFixture('PROMPT')
  const parent = await executeInRoom(fixture.owner.caller, {
    command: concentrationAction(fixture)
  })
  expect(parent.occurrence?.status).toBe('COMPLETE')
  const staged = await records(fixture)
  const pending = await pendingFor(fixture, fixture.player)
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Assigned target controller cannot discover concentration.')
  const command = response(fixture.run.id, pending, 1)
  const malformed = structuredClone(command)
  if (malformed.command.resolution.kind !== 'ENTER_DICE')
    throw new Error('Expected physical concentration evidence.')
  malformed.command.resolution.rawFaces = [0]
  await expect(executeInRoom(fixture.player.caller, malformed)).rejects.toThrow()
  expect(await records(fixture)).toEqual(staged)
  const settled = await executeInRoom(fixture.player.caller, command)
  expect(settled.occurrence).toMatchObject({ status: 'COMPLETE' })
  // The save's outcome is the Concentration roll card of the die the target's controller entered.
  expect(await readRoomRollCards(fixture.player.caller, fixture.campaign.id)).toContainEqual(
    expect.objectContaining({
      ruleCheck: expect.objectContaining({
        kind: 'CONCENTRATION',
        actorId: pending.rollerActorId,
        faces: [1],
        outcome: 'LOST'
      })
    })
  )
  const after = await records(fixture)
  expect(after.run?.version).toBe(staged.run!.version + 1)
  expect(after.character?.play.streamVersion).toBe(staged.character!.play.streamVersion + 1)
  expect(after.states.map((state) => state.id)).not.toContain(seeded.state.id)
  expect(after.effects.map((effect) => effect.id)).toEqual([seeded.independent.id])
  const character = readCharacterRecord(after.character!)
  expect(character.state.conditions?.map((condition) => condition.conditionTypeId)).toEqual([
    seeded.poisoned.id
  ])
}, 60_000)

/** A second Creature holds the Concentration (a dependent and an independent effect on its own actor). */
async function creatureHolderFixture(rolls: FixtureRolls) {
  const fixture = await setupConcentration(rolls, undefined, 'CREATURE')
  const seeded = await seedConcentration({ ...fixture, creatureHolder: true })
  await attachFixtureRoom(fixture.t, fixture.campaign.id)
  return { fixture, seeded }
}

it.each([
  { face: 20, outcome: 'SAVE_SUCCESS' as const, cleanup: false },
  { face: 1, outcome: 'SAVE_FAILURE' as const, cleanup: true }
])(
  'settles a Creature holder’s automatic Concentration check atomically for $outcome',
  async ({ face, cleanup }) => {
    const { fixture, seeded } = await creatureHolderFixture('AUTO_ROLL')
    const root = concentrationAction(fixture)
    await queueRoomRolls(fixture.campaign.id, { rolls: [face - 1] })
    const settled = await executeInRoom(fixture.owner.caller, {
      command: root
    })
    expect(settled.occurrence?.status).toBe('COMPLETE')
    expect(await pendingFor(fixture, fixture.owner)).toBeNull()
    const after = await records(fixture)
    expect(after.states.some((state) => state.id === seeded.state.id)).toBe(!cleanup)
    expect(after.actorEffects.map((effect) => effect.id).sort()).toEqual(
      (cleanup ? [seeded.independent.id] : [seeded.dependent.id, seeded.independent.id]).sort()
    )
    // A retry is answered from the room's held history, without a new write.
    expect(await executeInRoom(fixture.owner.caller, { command: root })).toEqual(settled)
    expect(await records(fixture)).toEqual(after)
  },
  60_000
)

it('keeps a hidden Creature holder’s check card for the GM and the player who controls it (ATTACK-17.6)', async () => {
  const fixture = await setupConcentration('AUTO_ROLL', undefined, 'CREATURE')
  await seedConcentration({ ...fixture, creatureHolder: true })
  const other = await createPartyPlayer(fixture.t, fixture.campaign)
  await other.join()
  await attachFixtureRoom(fixture.t, fixture.campaign.id)
  // The holder is hidden from the table (D62) and its save is the player's to roll.
  await executeInRoom(fixture.owner.caller, {
    command: {
      type: 'UPDATE_ACTOR',
      encounterId: fixture.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: (await concentrationRecords(fixture)).run!.version,
      actorId: fixture.target.id,
      public: false,
      controllerUserIds: [fixture.player.userId]
    }
  })
  await queueRoomRolls(fixture.campaign.id, { rolls: [0] })
  const settled = await executeInRoom(fixture.owner.caller, {
    command: concentrationAction(fixture, (await records(fixture)).run!.version)
  })
  expect(settled.occurrence?.status).toBe('COMPLETE')
  await checkpointLiveRoom(fixture.campaign.id)
  const [gmCard] = await fixture.owner.caller.query(api.rolls.history, {})
  const playerCards = await fixture.player.caller.query(api.rolls.history, {})
  expect(gmCard).toMatchObject({
    gmCampaignRoll: {
      creature: { actorId: fixture.target.id },
      revealedAt: null
    }
  })
  expect(playerCards).toEqual([expect.objectContaining({ id: gmCard!.id, gmCampaignRoll: null })])
  expect(await other.caller.query(api.rolls.history, {})).toEqual([])
  // Nothing reached the table's chat.
  expect(await readRoomRollCards(fixture.owner.caller, fixture.campaign.id)).not.toContainEqual(
    expect.objectContaining({ id: gmCard!.id })
  )
}, 60_000)

it('pauses a Creature holder’s Concentration check for the GM and settles the answer', async () => {
  const { fixture, seeded } = await creatureHolderFixture('PROMPT')
  const parent = await executeInRoom(fixture.owner.caller, {
    command: concentrationAction(fixture)
  })
  expect(parent.occurrence?.status).toBe('COMPLETE')
  expect(await pendingFor(fixture, fixture.player)).toBeNull()
  const pending = await pendingFor(fixture, fixture.owner)
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Expected the GM to discover the Creature’s concentration check.')
  expect(pending.rollerActorId).toBe(fixture.target.id)
  const settled = await executeInRoom(fixture.owner.caller, response(fixture.run.id, pending, 1))
  expect(settled.occurrence).toMatchObject({ status: 'COMPLETE' })
  const after = await records(fixture)
  expect(after.states.map((state) => state.id)).not.toContain(seeded.state.id)
  expect(after.actorEffects.map((effect) => effect.id)).toEqual([seeded.independent.id])
}, 60_000)
