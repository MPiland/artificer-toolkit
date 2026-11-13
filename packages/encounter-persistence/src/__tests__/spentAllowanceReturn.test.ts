import { describe, expect, it } from 'vitest'
import {
  consumeEncounterActionEconomy,
  type EncounterActionEconomyConsumption
} from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import { creatureActor, testUuid } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { returnSpentActionEconomy } from '../spentAllowanceReturn.js'

/** QUALITY-18.T2b1: an undo returns an allowance to the record its refresh boundary keeps. */

const checksum = 'a'.repeat(64)
const allowance = (
  definitionId: string,
  turnSequence?: number
): EncounterActionEconomyConsumption => ({
  definitionId,
  definitionVersion: 1,
  definitionChecksum: checksum,
  maximum: 1,
  beforeUsed: 0,
  afterUsed: 1,
  ...(turnSequence !== undefined && { turnSequence })
})
const EACH_TURN = allowance(testUuid(0x8f01), 4)
const START_OF_TURN = allowance(testUuid(0x8f02))

const actor = creatureActor({ id: testUuid(0x8f03), snapshot: {} })
const spend = (consumption: EncounterActionEconomyConsumption, from = actor) =>
  consumeEncounterActionEconomy({ actor: from, consumption, overridden: false })

describe('returning a spent allowance', () => {
  it('returns an allowance spent for one turn to that turn’s record, leaving the prior row', () => {
    const spent = spend(EACH_TURN, spend(START_OF_TURN))
    expect(returnSpentActionEconomy(spent, EACH_TURN).resources).toEqual(
      spend(START_OF_TURN).resources
    )
    expect(returnSpentActionEconomy(spend(START_OF_TURN), START_OF_TURN).resources).toEqual(
      actor.resources
    )
  })

  it('refuses once the allowance was used again, or its turn has passed', () => {
    const refusal = (from: typeof actor) => {
      try {
        return returnSpentActionEconomy(from, EACH_TURN)
      } catch (error) {
        return error
      }
    }
    const changed = {
      data: {
        reason: 'REVERT_UNAVAILABLE',
        message: "The actor's action economy changed after this action; adjust manually."
      }
    }
    expect(refusal(actor)).toMatchObject(changed)
    // Spent on turn 4; a use recorded for turn 5 is another turn's, so turn 4's reads as lapsed.
    expect(refusal(spend({ ...EACH_TURN, turnSequence: 5 }, spend(EACH_TURN)))).toMatchObject(
      changed
    )
  })
})
