import { describe, expect, it } from 'vitest'

import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import {
  clearTurnLastMove,
  readTurnLastMove,
  recordTurnLastMove,
  recordTurnMovement
} from '../turnMovement.js'

const ENCOUNTER_ID = '00000000-0000-4000-8000-000000000001'
const ELK = '00000000-0000-4000-8000-000000000101'
const WOLF = '00000000-0000-4000-8000-000000000102'

const turn = (round: number, currentActorId: string | null) => ({
  id: ENCOUNTER_ID,
  status: 'ACTIVE' as const,
  round,
  currentActorId
})
const firstMove = { start: { x: 50, y: 50 }, end: { x: 250, y: 50 } }
const secondMove = { start: { x: 250, y: 50 }, end: { x: 250, y: 350 } }

function setup() {
  return { ctx: { db: createMemoryEncounterStore().store } }
}

/** The move's own `recordTurnMovement` creates the turn row the last move rides on. */
async function movedOnce(ctx: ReturnType<typeof setup>['ctx']) {
  const state = turn(1, ELK)
  await recordTurnMovement(ctx, { state, actorId: ELK, feet: 20, speedId: null })
  return state
}

describe('the per-turn last move record (D164)', () => {
  it('is empty before the actor moves', async () => {
    const { ctx } = setup()
    expect(await readTurnLastMove(ctx, { state: turn(1, ELK), actorId: ELK })).toBeNull()
  })

  it('holds the latest voluntary move, each one replacing the last', async () => {
    const { ctx } = setup()
    const state = await movedOnce(ctx)
    await recordTurnLastMove(ctx, { state, actorId: ELK, lastMove: firstMove })
    expect(await readTurnLastMove(ctx, { state, actorId: ELK })).toEqual(firstMove)
    await recordTurnLastMove(ctx, { state, actorId: ELK, lastMove: secondMove })
    expect(await readTurnLastMove(ctx, { state, actorId: ELK })).toEqual(secondMove)
  })

  it('is forgotten once the actor is displaced some other way', async () => {
    const { ctx } = setup()
    const state = await movedOnce(ctx)
    await recordTurnLastMove(ctx, { state, actorId: ELK, lastMove: firstMove })
    await clearTurnLastMove(ctx, { state, actorId: ELK })
    expect(await readTurnLastMove(ctx, { state, actorId: ELK })).toBeNull()
  })

  it('expires with the turn and stays with its actor', async () => {
    const { ctx } = setup()
    const state = await movedOnce(ctx)
    await recordTurnLastMove(ctx, { state, actorId: ELK, lastMove: firstMove })
    expect(await readTurnLastMove(ctx, { state: turn(2, ELK), actorId: ELK })).toBeNull()
    expect(await readTurnLastMove(ctx, { state: turn(1, WOLF), actorId: ELK })).toBeNull()
    expect(await readTurnLastMove(ctx, { state, actorId: WOLF })).toBeNull()
  })

  it('records and clears nothing for an actor without a turn record', async () => {
    const { ctx } = setup()
    const state = turn(1, ELK)
    await recordTurnLastMove(ctx, { state, actorId: ELK, lastMove: firstMove })
    await clearTurnLastMove(ctx, { state, actorId: ELK })
    expect(await readTurnLastMove(ctx, { state, actorId: ELK })).toBeNull()
  })
})
