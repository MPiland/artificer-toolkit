import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  plannedModifierGrant,
  sourceSightSaveAuthoredEffect
} from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, fireballWolf } from './actionRoomFixture.js'
import { areaReceipts } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingAreaForViewer, readRoomHistory, readRoomRollCards } from './roomHistoryReads.js'

/**
 * A save that a Character's own sight of the effect's source governs (Barbarian Danger Sense) shows
 * the roller what they believe, settles in what is true, and keeps the hidden fact off the player's
 * side (ATTACK-10.5, D100).
 */

const CASTER_ID = testUuid(0x900)
const HOLDER_ID = testUuid(0x901)
const GRANT_ID = testUuid(0x902)
const ORIGIN = { x: 50, y: 150 }
const BITE_ID = fireballWolf().features?.find((feature) => feature.label === 'Bite')?.id
/** Between the origin and the holder, so the holder believes it sees the origin but cannot. */
const wall = {
  kind: 'WALL' as const,
  id: testUuid(0x903),
  a: { x: 200, y: -500 },
  b: { x: 200, y: 500 },
  blocksLight: true,
  blocksMovement: true
}

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A caster and a holder whose Dex-save advantage needs sight of the source; the holder's player rolls. */
function sightSaveRoom(options: { walled: boolean }) {
  return actionRoom({
    ...(options.walled ? { sceneOverrides: { barriers: [wall] } } : {}),
    // These tests are about source sight; the wall's cover has its own proof.
    automaticCover: false,
    playerControlledActorIds: [HOLDER_ID],
    actors: [
      srdCreatureActor({ id: CASTER_ID, creature: fireballWolf() }),
      srdCreatureActor({ id: HOLDER_ID, creature: plainWolf })
    ],
    ownerFeatureId: BITE_ID,
    seed: async ({ effects, encounterId, occurredAt }) => {
      const grant = plannedModifierGrant({
        encounterId,
        sourceActorId: HOLDER_ID,
        holderActorId: HOLDER_ID,
        lifecycle: {},
        effect: sourceSightSaveAuthoredEffect()
      })
      await effects.create({
        id: GRANT_ID,
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: HOLDER_ID },
        lifecycle: grant.lifecycle,
        definition: grant.definition,
        occurredAt
      })
    }
  })
}
type Room = Awaited<ReturnType<typeof sightSaveRoom>>

const holderPrompt = async (room: Room) => {
  const view = await readPendingAreaForViewer(room.room.base.stub, {
    isOwner: false,
    controlledActorIds: new Set([HOLDER_ID])
  })
  const save = view?.saves.find(({ actorId }) => actorId === HOLDER_ID)
  if (!save) throw new Error('The holder has no pending save.')
  return save.request
}

async function gmSave(room: Room, actorId: string) {
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
  const save = decision.pending.saves.find((entry) => entry.actorId === actorId)
  if (!save) throw new Error('The creature has no pending save.')
  return { decision, request: save.request }
}

/** The caster saves as the GM, then the holder's player enters `faces` with the mode their prompt shows. */
async function settleHolderSave(room: Room, faces: number[]) {
  const caster = await gmSave(room, CASTER_ID)
  const casterAnswer = await room.send(
    room.resolveCommand(caster.decision, {
      kind: 'ENTER_DICE',
      requestId: caster.request.requestId,
      rawFaces: [1],
      rollMode: caster.request.rollMode
    })
  )
  expect(casterAnswer.type, JSON.stringify(casterAnswer)).toBe('COMMAND_COMMITTED')

  const holder = await gmSave(room, HOLDER_ID)
  const shown = await holderPrompt(room)
  const answer = await room.sendAsPlayer(
    room.resolveCommand(holder.decision, {
      kind: 'ENTER_DICE',
      requestId: shown.requestId,
      rawFaces: faces,
      rollMode: shown.rollMode
    })
  )
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const settled = areaReceipts(await readRoomHistory(room.room.base.stub)).children.find(
    ({ outputs }) =>
      outputs.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH' && outputs.targetActorId === HOLDER_ID
  )
  if (settled?.outputs.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH' || !settled.outputs.d20)
    throw new Error('The holder’s save left no d20.')
  return settled.outputs.d20
}

describe('a save whose advantage needs the holder to see the effect’s source', () => {
  it('prompts and settles with advantage when the holder sees the area’s origin', async () => {
    const room = await sightSaveRoom({ walled: false })
    expect((await room.startAreaAction(ORIGIN)).answer.type).toBe('COMMAND_COMMITTED')
    expect(await holderPrompt(room)).toMatchObject({ rollMode: 'ADVANTAGE' })
    expect((await gmSave(room, HOLDER_ID)).request).toMatchObject({ rollMode: 'ADVANTAGE' })

    const d20 = await settleHolderSave(room, [4, 17])
    expect(d20).toMatchObject({ rollMode: 'ADVANTAGE', rawFaces: [4, 17], selectedNatural: 17 })
    expect(d20.modeAdjustment).toBeUndefined()
  })

  it('shows the roller advantage but settles normally when a wall hides the origin from the holder', async () => {
    const room = await sightSaveRoom({ walled: true })
    expect((await room.startAreaAction(ORIGIN)).answer.type).toBe('COMMAND_COMMITTED')
    // The player believes they see the origin; the GM's prompt carries the true mode.
    expect(await holderPrompt(room)).toMatchObject({ rollMode: 'ADVANTAGE' })
    expect((await gmSave(room, HOLDER_ID)).request).toMatchObject({ rollMode: 'NORMAL' })

    const d20 = await settleHolderSave(room, [4, 17])
    expect(d20).toMatchObject({ rollMode: 'NORMAL', derivedRollMode: 'NORMAL', selectedNatural: 4 })
    expect(d20.modeAdjustment).toMatchObject({
      rolledMode: 'ADVANTAGE',
      rolledFaces: [4, 17],
      playerCaption: 'Advantage no longer applies to this save',
      gmReason: expect.stringContaining("can't see")
    })
  })

  it('keeps the specific reason off every player-visible surface', async () => {
    const room = await sightSaveRoom({ walled: true })
    await room.startAreaAction(ORIGIN)
    const playerPrompt = JSON.stringify(await holderPrompt(room))
    const d20 = await settleHolderSave(room, [4, 17])
    const gmReason = d20.modeAdjustment?.gmReason
    if (!gmReason) throw new Error('The settled save carries no GM reason.')

    expect(playerPrompt).not.toContain(gmReason)
    const tableCards = (await readRoomRollCards(room.room.base.stub)).filter(
      (card) => card.audience === 'TABLE'
    )
    expect(JSON.stringify(tableCards)).not.toContain(gmReason)
  })
})
