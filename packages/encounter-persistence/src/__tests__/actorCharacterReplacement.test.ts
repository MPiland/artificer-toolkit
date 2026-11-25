import {
  characterActor,
  testUuid
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { describe, expect, it } from 'vitest'

import { selectRunCharacterSwaps } from '../actorCharacterReplacement.js'

const PLAYER = testUuid(0xa501)
const OTHER_PLAYER = testUuid(0xa502)
const ARIA = testUuid(0xa511)
const BORIN = testUuid(0xa512)
const CORA = testUuid(0xa513)
const DARA = testUuid(0xa514)
const ARIA_ACTOR = testUuid(0xa521)
const CORA_ACTOR = testUuid(0xa523)
const DARA_ACTOR = testUuid(0xa524)

const aria = characterActor({ id: ARIA_ACTOR, characterId: ARIA })
const cora = characterActor({ id: CORA_ACTOR, characterId: CORA })
const dara = characterActor({ id: DARA_ACTOR, characterId: DARA })
const frozen = {
  currentHitPoints: 5,
  maxHitPoints: 10,
  tempHitPoints: 0,
  conditions: [],
  deathSaves: { successes: 0, failures: 0, stable: false }
}

/** The player benched Aria for Borin; the other player keeps Cora active. */
const assignments = [
  { userId: PLAYER, characterId: ARIA, active: false },
  { userId: PLAYER, characterId: BORIN, active: true },
  { userId: OTHER_PLAYER, characterId: CORA, active: true }
]

describe('selectRunCharacterSwaps (D236)', () => {
  it("names a benched Character's actor and the owner's Active Character it becomes", () => {
    expect(selectRunCharacterSwaps([aria, cora], assignments)).toEqual([
      { actorId: ARIA_ACTOR, characterId: BORIN, userId: PLAYER }
    ])
  })

  it('swaps nothing while the Active Character already stands in the Run', () => {
    const borin = characterActor({ id: testUuid(0xa522), characterId: BORIN })
    expect(selectRunCharacterSwaps([aria, borin, cora], assignments)).toEqual([])
  })

  it('leaves a frozen actor as it stands', () => {
    const frozenAria = encounterRunActorStateSchema.parse({ ...aria, frozenState: frozen })
    expect(selectRunCharacterSwaps([frozenAria, cora], assignments)).toEqual([])
  })

  it("swaps only a player's first benched actor in the Run", () => {
    const benchedTwice = [...assignments, { userId: PLAYER, characterId: DARA, active: false }]
    expect(selectRunCharacterSwaps([dara, aria, cora], benchedTwice)).toEqual([
      { actorId: DARA_ACTOR, characterId: BORIN, userId: PLAYER }
    ])
  })

  it('swaps nothing for an actor whose Character no longer has an assignment', () => {
    expect(selectRunCharacterSwaps([dara, cora], assignments)).toEqual([])
  })
})
