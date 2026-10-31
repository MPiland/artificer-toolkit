import { describe, expect, it } from 'vitest'

import { rollSummonInitiative } from '../encounterSummonInitiative.js'
import { createSrdRulesRuntime } from '../testing/dnd5eSrdEncounter.js'
import { initiativePolicySnapshot } from '../testing/initiativePolicySnapshot.js'
import { creatureActor, creatureEncounter } from './encounterCreatureAction.js'
import { scriptedDice } from './encounterInitiativeFixtures.js'

/**
 * SPELLS-35.T5 (D200): a summon authored to roll its own initiative rolls it through the Run's pinned
 * policy graph as it arrives, in one `1dN` face the room posts as its Initiative card.
 */

const OCCURRENCE_ID = '00000000-0000-4000-8000-00000000f035'
const owner = creatureActor({ id: crypto.randomUUID(), label: 'Owner', features: [] })
const familiar = {
  ...creatureActor({ id: crypto.randomUUID(), label: 'Familiar', features: [] }),
  owner: { ownerActorId: owner.id, turnTiming: 'OWN_INITIATIVE' as const }
}

function runWith(policy: ReturnType<typeof initiativePolicySnapshot> | null) {
  const { state } = creatureEncounter([owner])
  return {
    ...state,
    initiativePolicySnapshot: policy?.snapshot ?? null,
    initiativePolicySnapshotChecksum: policy?.checksum ?? null
  }
}

const actorRoll = initiativePolicySnapshot({ procedure: 'ACTOR_ROLL', cadence: 'ENCOUNTER_START' })

function roll(
  state: ReturnType<typeof runWith>,
  actor: typeof familiar | typeof owner,
  dice = scriptedDice([13])
) {
  return rollSummonInitiative({
    state,
    actor,
    runtime: createSrdRulesRuntime(),
    occurrenceId: OCCURRENCE_ID,
    integerSource: dice.next
  })
}

describe('rollSummonInitiative (SPELLS-35.T5)', () => {
  it('rolls one d20 through the policy graph and returns its face and modifier', async () => {
    const dice = scriptedDice([13])
    const rolled = await roll(runWith(actorRoll), familiar, dice)

    expect(dice.requests).toEqual([{ min: 1, max: 20 }])
    expect(rolled).toMatchObject({ sides: 20, face: 13 })
    expect(Number.isInteger(rolled?.modifier)).toBe(true)
  })

  it('rolls nothing for an actor that takes no roll of its own', async () => {
    const dice = scriptedDice([13])
    const sameTurn = { ...familiar, owner: { ownerActorId: owner.id } }

    expect(await roll(runWith(actorRoll), sameTurn, dice)).toBeNull()
    expect(await roll(runWith(actorRoll), owner, dice)).toBeNull()
    expect(dice.remaining()).toBe(1)
  })

  it('rolls nothing in a Run with no policy snapshot or one that is not an actor roll', async () => {
    const dice = scriptedDice([13])
    const declared = initiativePolicySnapshot({
      procedure: 'DECLARED_ACTION_ROLL',
      cadence: 'EACH_ROUND'
    })

    expect(await roll(runWith(null), familiar, dice)).toBeNull()
    expect(await roll(runWith(declared), familiar, dice)).toBeNull()
    expect(dice.remaining()).toBe(1)
  })

  it('rolls nothing in a Run that has not started: the summon then rolls with the start cohort', async () => {
    const dice = scriptedDice([13])

    expect(await roll({ ...runWith(actorRoll), status: 'PREPARED' }, familiar, dice)).toBeNull()
    expect(dice.remaining()).toBe(1)
  })
})
