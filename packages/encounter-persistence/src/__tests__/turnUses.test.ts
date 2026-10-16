import { describe, expect, it } from 'vitest'

import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import {
  readTurnUses,
  recordTurnSpeedBonus,
  restoreTurnUses,
  spendTurnUses
} from '../turnMovement.js'

const ENCOUNTER_ID = '00000000-0000-4000-8000-000000000001'
const actor = (index: number) =>
  `00000000-0000-4000-8000-0000000001${String(index).padStart(2, '0')}`
const ROGUE = actor(1)
const WOLF = actor(2)
const SNEAK = '00000000-0000-4000-8000-0000000002a1'
const OTHER = '00000000-0000-4000-8000-0000000002a2'

const turn = (round: number, currentActorId: string | null, status = 'ACTIVE' as const) => ({
  id: ENCOUNTER_ID,
  status,
  round,
  currentActorId
})

function setup() {
  const { store, documents } = createMemoryEncounterStore()
  return { ctx: { db: store }, rows: () => documents('encounterTurnMovements') }
}

describe('the per-turn once-per-turn record', () => {
  it('starts empty and holds the keys spent this turn, sorted', async () => {
    const { ctx } = setup()
    const state = turn(1, WOLF)
    expect(await readTurnUses(ctx, { state, actorId: ROGUE })).toEqual([])
    await spendTurnUses(ctx, { state, actorId: ROGUE, keys: [OTHER] })
    await spendTurnUses(ctx, { state, actorId: ROGUE, keys: [SNEAK] })
    expect(await readTurnUses(ctx, { state, actorId: ROGUE })).toEqual([SNEAK, OTHER])
  })

  it('reports the turn it spent in, for the command record’s undo', async () => {
    const { ctx } = setup()
    expect(
      await spendTurnUses(ctx, { state: turn(3, WOLF), actorId: ROGUE, keys: [SNEAK] })
    ).toEqual({ round: 3, turnActorId: WOLF, keys: [SNEAK] })
  })

  it('writes nothing when no key was spent', async () => {
    const { ctx, rows } = setup()
    expect(await spendTurnUses(ctx, { state: turn(1, WOLF), actorId: ROGUE, keys: [] })).toBeNull()
    expect(rows()).toEqual([])
  })

  it('refuses a key the turn already spent', async () => {
    const { ctx } = setup()
    const state = turn(1, WOLF)
    await spendTurnUses(ctx, { state, actorId: ROGUE, keys: [SNEAK] })
    await expect(spendTurnUses(ctx, { state, actorId: ROGUE, keys: [SNEAK] })).rejects.toThrow(
      'already spent'
    )
  })

  it('renews on every turn: another round, another turn actor, another holder', async () => {
    const { ctx } = setup()
    await spendTurnUses(ctx, { state: turn(1, WOLF), actorId: ROGUE, keys: [SNEAK] })
    expect(await readTurnUses(ctx, { state: turn(2, WOLF), actorId: ROGUE })).toEqual([])
    expect(await readTurnUses(ctx, { state: turn(1, ROGUE), actorId: ROGUE })).toEqual([])
    expect(await readTurnUses(ctx, { state: turn(1, WOLF), actorId: WOLF })).toEqual([])
    expect(await readTurnUses(ctx, { state: turn(1, WOLF), actorId: ROGUE })).toEqual([SNEAK])
  })

  it('keeps a spent use when the same turn records movement or a speed bonus', async () => {
    const { ctx, rows } = setup()
    const state = turn(1, WOLF)
    await spendTurnUses(ctx, { state, actorId: ROGUE, keys: [SNEAK] })
    await recordTurnSpeedBonus(ctx, { state, actorId: ROGUE })
    expect(rows()).toHaveLength(1)
    expect(await readTurnUses(ctx, { state, actorId: ROGUE })).toEqual([SNEAK])
  })

  it('has no record between turns and refuses nothing', async () => {
    const { ctx } = setup()
    const between = turn(1, null)
    expect(await readTurnUses(ctx, { state: between, actorId: ROGUE })).toEqual([])
    expect(await spendTurnUses(ctx, { state: between, actorId: ROGUE, keys: [SNEAK] })).toBeNull()
  })

  it('gives a use back, and only the uses given back', async () => {
    const { ctx } = setup()
    const state = turn(1, WOLF)
    await spendTurnUses(ctx, { state, actorId: ROGUE, keys: [SNEAK, OTHER] })
    await restoreTurnUses(ctx, {
      encounterId: ENCOUNTER_ID,
      round: 1,
      turnActorId: WOLF,
      actorId: ROGUE,
      keys: [SNEAK]
    })
    expect(await readTurnUses(ctx, { state, actorId: ROGUE })).toEqual([OTHER])
  })

  it('refuses to give back a use that was never spent', async () => {
    const { ctx } = setup()
    await expect(
      restoreTurnUses(ctx, {
        encounterId: ENCOUNTER_ID,
        round: 1,
        turnActorId: WOLF,
        actorId: ROGUE,
        keys: [SNEAK]
      })
    ).rejects.toThrow('unavailable')
  })
})
