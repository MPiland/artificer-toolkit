// @vitest-environment node
import { expect, it, vi } from 'vitest'
import type { EncounterExecuteInput } from '@artificer-toolkit/schema/api/encounters'
import { encodeCharacterRecord } from '@artificer-toolkit/schema/projections/characterStoredState'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import {
  concentrationAction,
  concentrationRecords,
  seedConcentration,
  setupConcentration
} from '../../tests/fixtures/concentration'
import { api } from '../_generated/api'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import { storeRunAutomationMode } from '../../tests/fixtures/playerControl'
import {
  executeInRoom,
  expectRedactedRoomRefusal,
  replayInRoom,
  RoomCommandRefusal
} from '../../tests/fixtures/liveSessionWorker'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: vi.fn(() => 19) }))

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
  const fixture = await setupConcentration('PROMPT')
  const seeded = await seedConcentration(fixture)
  const root = concentrationAction(fixture)
  const before = await concentrationRecords(fixture)
  const parent = await executeInRoom(fixture.owner.caller, {
    command: root
  })
  expect(parent.occurrence?.status).toBe('COMPLETE')
  const staged = await concentrationRecords(fixture)
  expect(staged.character?.play.streamVersion).toBe(before.character!.play.streamVersion + 1)
  expect(staged.states.map((state) => state.id)).toContain(seeded.state.id)
  const pending = await fixture.owner.caller.query(
    api.encounters.pendingReads.pendingRuleOccurrence,
    {
      encounterId: fixture.run.id
    }
  )
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
  const random = await import('../lib/rollRandom')
  vi.mocked(random.nextRollInt).mockClear()
  await expect(executeInRoom(fixture.owner.caller, colliding)).rejects.toThrow()
  expect(vi.mocked(random.nextRollInt)).not.toHaveBeenCalled()
  expect(await concentrationRecords(fixture)).toEqual(staged)
  expect(await concentrationRecords(fixture)).toEqual(staged)
  const settled = await executeInRoom(fixture.owner.caller, command)
  expect(settled.occurrence).toMatchObject({ status: 'COMPLETE', outcome: 'SAVE_SUCCESS' })
  const after = await concentrationRecords(fixture)
  expect(after.run?.version).toBe(staged.run?.version)
  expect(after.states.map((state) => state.id)).toContain(seeded.state.id)
  expect(after.effects.map((effect) => effect.id)).toEqual(
    expect.arrayContaining([seeded.dependent.id, seeded.independent.id])
  )
  expect(after.character).toEqual(staged.character)
  const parentReceipt = after.receipts.find((receipt) => receipt.commandId === root.commandId)
  if (!parentReceipt) throw new Error('Parent action receipt is unavailable.')
  const parentExecution = storedRuleExecutionResultDtoSchema.parse(
    JSON.parse(parentReceipt.resultJson)
  )
  if (parentExecution.status !== 'COMPLETE') throw new Error('Parent action did not complete.')
  expect(parentExecution.applicationOutputs.kind).toBe('CHARACTER_MECHANICS_BATCH')
  expect(await replayInRoom(fixture.owner.caller, command)).toEqual(settled)
  expect(await replayInRoom(fixture.owner.caller, { command: root })).toEqual(parent)
  expect(await concentrationRecords(fixture)).toEqual(after)
}, 60_000)

it('raises no concentration prompt in a Manual Run, where the damaging action is refused whole', async () => {
  const fixture = await setupConcentration('PROMPT')
  const seeded = await seedConcentration(fixture)
  await storeRunAutomationMode(fixture.t, fixture.run.id, 'MANUAL')
  const before = await concentrationRecords(fixture)
  await expect(
    executeInRoom(fixture.owner.caller, {
      command: concentrationAction(fixture)
    })
  ).rejects.toThrow(RoomCommandRefusal)
  expect(await concentrationRecords(fixture)).toEqual(before)
  expect(before.states.map((state) => state.id)).toContain(seeded.state.id)
  for (const member of [fixture.owner, fixture.player])
    expect(
      await member.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: fixture.run.id
      })
    ).toBeNull()
}, 60_000)

it('does not create a concentration child when finalized applied damage is zero', async () => {
  const fixture = await setupConcentration('PROMPT')
  const seeded = await seedConcentration(fixture)
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
  const before = await concentrationRecords(fixture)
  await executeInRoom(fixture.owner.caller, {
    command: concentrationAction(fixture)
  })
  expect(
    await fixture.owner.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
      encounterId: fixture.run.id
    })
  ).toBeNull()
  const after = await concentrationRecords(fixture)
  expect(after.states.map((state) => state.id)).toContain(seeded.state.id)
  expect(after.completed.length).toBe(before.completed.length + 1)
  expect(
    after.receipts
      .map((receipt) => storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson)))
      .some(
        (receipt) =>
          receipt.status === 'COMPLETE' && receipt.applicationOutputs.kind === 'CONCENTRATION_CHECK'
      )
  ).toBe(false)
}, 60_000)

it.each([
  { face: 20, outcome: 'SAVE_SUCCESS' as const, cleanup: false },
  { face: 1, outcome: 'SAVE_FAILURE' as const, cleanup: true }
])(
  'settles Automatic concentration atomically for $outcome',
  async ({ face, cleanup }) => {
    const fixture = await setupConcentration('AUTO_ROLL')
    const seeded = await seedConcentration(fixture)
    const root = concentrationAction(fixture)
    const before = await concentrationRecords(fixture)
    const random = await import('../lib/rollRandom')
    expect(await concentrationRecords(fixture)).toEqual(before)
    vi.mocked(random.nextRollInt).mockReturnValueOnce(face - 1)
    const settled = await executeInRoom(fixture.owner.caller, {
      command: root
    })
    expect(settled.occurrence?.status).toBe('COMPLETE')
    expect(
      await fixture.owner.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: fixture.run.id
      })
    ).toBeNull()
    const after = await concentrationRecords(fixture)
    expect(after.states.some((state) => state.id === seeded.state.id)).toBe(!cleanup)
    expect(after.effects.some((effect) => effect.id === seeded.dependent.id)).toBe(!cleanup)
    expect(after.effects.map((effect) => effect.id)).toContain(seeded.independent.id)
    const concentrationReceipt = after.receipts
      .map((receipt) => storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson)))
      .find(
        (receipt) =>
          receipt.status === 'COMPLETE' && receipt.applicationOutputs.kind === 'CONCENTRATION_CHECK'
      )
    expect(concentrationReceipt).toMatchObject({
      applicationOutputs: { outcome: cleanup ? 'SAVE_FAILURE' : 'SAVE_SUCCESS' }
    })
    vi.mocked(random.nextRollInt).mockClear()
    expect(await replayInRoom(fixture.owner.caller, { command: root })).toEqual(settled)
    expect(await concentrationRecords(fixture)).toEqual(after)
  },
  60_000
)

it('cleans the exact concentration state on failure and preserves an independent condition', async () => {
  const fixture = await setupConcentration('PROMPT')
  const seeded = await seedConcentration(fixture)
  const parent = await executeInRoom(fixture.owner.caller, {
    command: concentrationAction(fixture)
  })
  expect(parent.occurrence?.status).toBe('COMPLETE')
  const staged = await concentrationRecords(fixture)
  const pending = await fixture.player.caller.query(
    api.encounters.pendingReads.pendingRuleOccurrence,
    {
      encounterId: fixture.run.id
    }
  )
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Assigned target controller cannot discover concentration.')
  const command = response(fixture.run.id, pending, 1)
  const malformed = structuredClone(command)
  if (malformed.command.resolution.kind !== 'ENTER_DICE')
    throw new Error('Expected physical concentration evidence.')
  malformed.command.resolution.rawFaces = [0]
  await expect(executeInRoom(fixture.player.caller, malformed)).rejects.toThrow()
  const priorStateVersion = await fixture.t.run(async (ctx) => {
    const state = await ctx.db
      .query('encounterMaintainedEffectStates')
      .withIndex('by_encounterId_id', (query) =>
        query.eq('encounterId', fixture.run.id).eq('id', seeded.state.id)
      )
      .unique()
    if (!state) throw new Error('Concentration state is unavailable.')
    await ctx.db.patch(state._id, { version: state.version + 1 })
    return state.version
  })
  await expectRedactedRoomRefusal(executeInRoom(fixture.player.caller, command), /stale|unavailable/)
  await fixture.t.run(async (ctx) => {
    const state = await ctx.db
      .query('encounterMaintainedEffectStates')
      .withIndex('by_encounterId_id', (query) =>
        query.eq('encounterId', fixture.run.id).eq('id', seeded.state.id)
      )
      .unique()
    if (!state) throw new Error('Concentration state is unavailable.')
    await ctx.db.patch(state._id, { version: priorStateVersion })
  })
  expect(await concentrationRecords(fixture)).toEqual(staged)
  const settled = await executeInRoom(fixture.player.caller, command)
  expect(settled.occurrence).toMatchObject({ status: 'COMPLETE', outcome: 'SAVE_FAILURE' })
  const after = await concentrationRecords(fixture)
  expect(after.run?.version).toBe(staged.run!.version + 1)
  expect(after.character?.play.streamVersion).toBe(staged.character!.play.streamVersion + 1)
  expect(after.states.map((state) => state.id)).not.toContain(seeded.state.id)
  expect(after.effects.map((effect) => effect.id)).toEqual([seeded.independent.id])
  const character = readCharacterRecord(after.character!)
  expect(character.state.conditions?.map((condition) => condition.conditionTypeId)).toEqual([
    seeded.poisoned.id
  ])
}, 60_000)
