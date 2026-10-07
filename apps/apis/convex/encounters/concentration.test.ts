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
import { storeRunAutomationMode } from '../../tests/fixtures/playerControl'
import type { FixtureRolls } from '../../tests/fixtures/rollPreferences'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  executeInRoom,
  queueRoomRolls,
  readRoomRollCards,
  RoomCommandRefusal,
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
    request: { requestId: string; rollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE' }
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
  const command = response(fixture.run.id, pending, { rollId: rolled.evidenceRoll!.rollId })
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
  ).rejects.toThrow(RoomCommandRefusal)
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
