import { describe, expect, it } from 'vitest'

import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import {
  consumeTurnTeleportAllowance,
  readTurnTeleportAllowances,
  recordTurnMovement,
  recordTurnTeleportAllowance,
  removeTurnTeleportAllowance,
  restoreTurnTeleportAllowance
} from '../turnMovement.js'

const ENCOUNTER_ID = '00000000-0000-4000-8000-000000000001'
const actor = (index: number) =>
  `00000000-0000-4000-8000-0000000001${String(index).padStart(2, '0')}`
const WIZARD = actor(1)
const WOLF = actor(2)
const MISTY_STEP_CAST = '00000000-0000-4000-8000-0000000003a1'
const DIMENSION_DOOR_CAST = '00000000-0000-4000-8000-0000000003a2'
const MOVE = '00000000-0000-4000-8000-0000000003b1'
const OTHER_MOVE = '00000000-0000-4000-8000-0000000003b2'

const turn = (round: number, currentActorId: string | null, status = 'ACTIVE' as const) => ({
  id: ENCOUNTER_ID,
  status,
  round,
  currentActorId
})

const mistyStep = {
  castCommandId: MISTY_STEP_CAST,
  maxFeet: 30,
  destinationKind: 'VISIBLE' as const
}
const dimensionDoor = {
  castCommandId: DIMENSION_DOOR_CAST,
  maxFeet: 500,
  destinationKind: 'SPECIFIED_POINT' as const
}

function setup() {
  const { store, documents } = createMemoryEncounterStore()
  return { ctx: { db: store }, rows: () => documents('encounterTurnMovements') }
}

describe('the per-turn teleport allowance record', () => {
  it('starts empty and holds the allowances the turn’s casts granted', async () => {
    const { ctx } = setup()
    const state = turn(1, WIZARD)
    expect(await readTurnTeleportAllowances(ctx, { state, actorId: WIZARD })).toEqual([])
    await recordTurnTeleportAllowance(ctx, { state, actorId: WIZARD, ...mistyStep })
    await recordTurnTeleportAllowance(ctx, { state, actorId: WIZARD, ...dimensionDoor })
    expect(await readTurnTeleportAllowances(ctx, { state, actorId: WIZARD })).toEqual([
      { ...mistyStep, consumedByCommandId: null },
      { ...dimensionDoor, consumedByCommandId: null }
    ])
  })

  it('reports the turn it recorded in, for the command record’s undo', async () => {
    const { ctx } = setup()
    expect(
      await recordTurnTeleportAllowance(ctx, {
        state: turn(3, WIZARD),
        actorId: WIZARD,
        ...mistyStep
      })
    ).toEqual({ round: 3, turnActorId: WIZARD })
  })

  it('expires with the turn: another round, turn actor or holder reads none', async () => {
    const { ctx } = setup()
    await recordTurnTeleportAllowance(ctx, {
      state: turn(1, WIZARD),
      actorId: WIZARD,
      ...mistyStep
    })
    expect(
      await readTurnTeleportAllowances(ctx, { state: turn(2, WIZARD), actorId: WIZARD })
    ).toEqual([])
    expect(
      await readTurnTeleportAllowances(ctx, { state: turn(1, WOLF), actorId: WIZARD })
    ).toEqual([])
    expect(
      await readTurnTeleportAllowances(ctx, { state: turn(1, WIZARD), actorId: WOLF })
    ).toEqual([])
  })

  it('has no record between turns and records nothing', async () => {
    const { ctx, rows } = setup()
    const between = turn(1, null)
    expect(await readTurnTeleportAllowances(ctx, { state: between, actorId: WIZARD })).toEqual([])
    expect(
      await recordTurnTeleportAllowance(ctx, { state: between, actorId: WIZARD, ...mistyStep })
    ).toBeNull()
    expect(rows()).toEqual([])
  })

  it('shares the turn row with walking and keeps the allowance across it', async () => {
    const { ctx, rows } = setup()
    const state = turn(1, WIZARD)
    await recordTurnTeleportAllowance(ctx, { state, actorId: WIZARD, ...mistyStep })
    await recordTurnMovement(ctx, { state, actorId: WIZARD, feet: 10, speedId: null })
    expect(rows()).toHaveLength(1)
    expect(await readTurnTeleportAllowances(ctx, { state, actorId: WIZARD })).toEqual([
      { ...mistyStep, consumedByCommandId: null }
    ])
  })

  it('consumes the named allowance once and refuses a second consumption', async () => {
    const { ctx } = setup()
    const state = turn(1, WIZARD)
    await recordTurnTeleportAllowance(ctx, { state, actorId: WIZARD, ...mistyStep })
    await recordTurnTeleportAllowance(ctx, { state, actorId: WIZARD, ...dimensionDoor })
    await consumeTurnTeleportAllowance(ctx, {
      state,
      actorId: WIZARD,
      castCommandId: MISTY_STEP_CAST,
      commandId: MOVE
    })
    expect(await readTurnTeleportAllowances(ctx, { state, actorId: WIZARD })).toEqual([
      { ...mistyStep, consumedByCommandId: MOVE },
      { ...dimensionDoor, consumedByCommandId: null }
    ])
    await expect(
      consumeTurnTeleportAllowance(ctx, {
        state,
        actorId: WIZARD,
        castCommandId: MISTY_STEP_CAST,
        commandId: OTHER_MOVE
      })
    ).rejects.toThrow('unavailable')
  })

  it('lets a GM move consume any unconsumed allowance, and none when there is none', async () => {
    const { ctx } = setup()
    const state = turn(1, WIZARD)
    expect(
      await consumeTurnTeleportAllowance(ctx, {
        state,
        actorId: WIZARD,
        castCommandId: null,
        commandId: MOVE
      })
    ).toBeNull()
    await recordTurnTeleportAllowance(ctx, { state, actorId: WIZARD, ...dimensionDoor })
    expect(
      await consumeTurnTeleportAllowance(ctx, {
        state,
        actorId: WIZARD,
        castCommandId: null,
        commandId: MOVE
      })
    ).toEqual({ castCommandId: DIMENSION_DOOR_CAST })
    expect(
      await consumeTurnTeleportAllowance(ctx, {
        state,
        actorId: WIZARD,
        castCommandId: null,
        commandId: OTHER_MOVE
      })
    ).toBeNull()
  })

  it('gives a consumed allowance back when its move is undone, and only that move’s', async () => {
    const { ctx } = setup()
    const state = turn(1, WIZARD)
    await recordTurnTeleportAllowance(ctx, { state, actorId: WIZARD, ...mistyStep })
    await recordTurnTeleportAllowance(ctx, { state, actorId: WIZARD, ...dimensionDoor })
    await consumeTurnTeleportAllowance(ctx, {
      state,
      actorId: WIZARD,
      castCommandId: MISTY_STEP_CAST,
      commandId: MOVE
    })
    await consumeTurnTeleportAllowance(ctx, {
      state,
      actorId: WIZARD,
      castCommandId: DIMENSION_DOOR_CAST,
      commandId: OTHER_MOVE
    })
    await restoreTurnTeleportAllowance(ctx, { state, commandId: MOVE })
    expect(await readTurnTeleportAllowances(ctx, { state, actorId: WIZARD })).toEqual([
      { ...mistyStep, consumedByCommandId: null },
      { ...dimensionDoor, consumedByCommandId: OTHER_MOVE }
    ])
  })

  it('has nothing to give back once the turn expired or the move consumed nothing', async () => {
    const { ctx } = setup()
    await expect(
      restoreTurnTeleportAllowance(ctx, { state: turn(1, WIZARD), commandId: MOVE })
    ).resolves.toBeUndefined()
    await recordTurnTeleportAllowance(ctx, {
      state: turn(1, WIZARD),
      actorId: WIZARD,
      ...mistyStep
    })
    await consumeTurnTeleportAllowance(ctx, {
      state: turn(1, WIZARD),
      actorId: WIZARD,
      castCommandId: MISTY_STEP_CAST,
      commandId: MOVE
    })
    await restoreTurnTeleportAllowance(ctx, { state: turn(2, WIZARD), commandId: MOVE })
    expect(
      await readTurnTeleportAllowances(ctx, { state: turn(1, WIZARD), actorId: WIZARD })
    ).toEqual([{ ...mistyStep, consumedByCommandId: MOVE }])
  })

  it('makes room for a fifth teleport by dropping the oldest spent one, and refuses a fifth unspent', async () => {
    const { ctx } = setup()
    const state = turn(1, WIZARD)
    const cast = (index: number) => ({
      ...mistyStep,
      castCommandId: `00000000-0000-4000-8000-0000000004${String(index).padStart(2, '0')}`
    })
    for (const index of [1, 2, 3, 4])
      await recordTurnTeleportAllowance(ctx, { state, actorId: WIZARD, ...cast(index) })
    await expect(
      recordTurnTeleportAllowance(ctx, { state, actorId: WIZARD, ...cast(5) })
    ).rejects.toThrow()
    await consumeTurnTeleportAllowance(ctx, {
      state,
      actorId: WIZARD,
      castCommandId: cast(2).castCommandId,
      commandId: MOVE
    })
    await recordTurnTeleportAllowance(ctx, { state, actorId: WIZARD, ...cast(5) })
    expect(
      (await readTurnTeleportAllowances(ctx, { state, actorId: WIZARD })).map(
        ({ castCommandId }) => castCommandId
      )
    ).toEqual([1, 3, 4, 5].map((index) => cast(index).castCommandId))
  })

  it('removes an allowance its cast’s undo takes back', async () => {
    const { ctx } = setup()
    const state = turn(1, WIZARD)
    await recordTurnTeleportAllowance(ctx, { state, actorId: WIZARD, ...mistyStep })
    await recordTurnTeleportAllowance(ctx, { state, actorId: WIZARD, ...dimensionDoor })
    await removeTurnTeleportAllowance(ctx, {
      encounterId: ENCOUNTER_ID,
      round: 1,
      turnActorId: WIZARD,
      actorId: WIZARD,
      castCommandId: MISTY_STEP_CAST
    })
    expect(await readTurnTeleportAllowances(ctx, { state, actorId: WIZARD })).toEqual([
      { ...dimensionDoor, consumedByCommandId: null }
    ])
  })

  it('refuses to remove an allowance a move already consumed, or one never recorded', async () => {
    const { ctx } = setup()
    const state = turn(1, WIZARD)
    const removal = {
      encounterId: ENCOUNTER_ID,
      round: 1,
      turnActorId: WIZARD,
      actorId: WIZARD,
      castCommandId: MISTY_STEP_CAST
    }
    await expect(removeTurnTeleportAllowance(ctx, removal)).rejects.toThrow('unavailable')
    await recordTurnTeleportAllowance(ctx, { state, actorId: WIZARD, ...mistyStep })
    await consumeTurnTeleportAllowance(ctx, {
      state,
      actorId: WIZARD,
      castCommandId: MISTY_STEP_CAST,
      commandId: MOVE
    })
    await expect(removeTurnTeleportAllowance(ctx, removal)).rejects.toThrow('unavailable')
  })
})
