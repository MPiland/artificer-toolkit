import { encounterBasicActionId } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import { grantedActionId } from '@artificer-toolkit/rules-runtime/encounterGrantedActions'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import type { ClassFeature } from '../src/testing/srdCharacterSource.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'

/**
 * SPELLS-31.T4l1 (D160, D188): a Character's passive feature whose grant has no duration offers its
 * basic actions on every turn, as a Creature trait does. A Rogue's Cunning Action Disengages as a
 * Bonus Action through the real RESOLVE_ACTION command of the local room.
 */

const ROGUE_ACTOR_ID = testUuid(0xe80)
const ROGUE_ID = testUuid(0xe81)
const WOLF_ID = testUuid(0xe82)

const cunningAction: ClassFeature = (() => {
  const found = srdBaselineContent.subjects.classes
    .find(({ label }) => label === 'Rogue')
    ?.features?.find(({ label }) => label === 'Cunning Action')
  if (!found) throw new Error('The SRD Rogue has no Cunning Action.')
  return { ...structuredClone(found), availableAtLevel: 1 }
})()

/** The basic action `basicActionId` the actor takes through Cunning Action's offer. */
function throughCunningAction(basicActionId: string) {
  const definition = SRD_BASIC_ACTION_DEFINITIONS.find(({ id }) => id === basicActionId)
  if (definition?.document.kind !== 'BASIC_ACTION') throw new Error('Missing basic action.')
  return grantedActionId(
    encounterBasicActionId(ROGUE_ACTOR_ID, basicActionId, definition.document.effects[0]!.id),
    cunningAction.effects![0]!.id,
    0
  )
}

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

describe('room Rogue Cunning Action (SPELLS-31.T4l1)', () => {
  it('lets the Rogue Disengage as a Bonus Action on each of its turns', async () => {
    const offered = throughCunningAction(SRD_BASIC_ACTION_IDS.DISENGAGE)
    const room = await actionRoom({
      actors: [
        characterActor({ id: ROGUE_ACTOR_ID, characterId: ROGUE_ID }),
        srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
      ],
      characterClassFeatures: [cunningAction],
      // The room offers the Rogue Disengage through Cunning Action.
      characterAction: ({ id }) => id === offered
    })
    const take = (actionId: string) =>
      room.startAction(ROGUE_ACTOR_ID, [], null, null, actionId, ROGUE_ACTOR_ID)

    const first = await take(offered)
    expect(first.answer.type, JSON.stringify(first.answer)).toBe('COMMAND_COMMITTED')
    // The offer charges the turn's Bonus Action, which is now spent.
    const dash = await take(throughCunningAction(SRD_BASIC_ACTION_IDS.DASH))
    expect(dash.answer.type, JSON.stringify(dash.answer)).not.toBe('COMMAND_COMMITTED')

    for (let turn = 0; turn < 2; turn += 1) await room.advanceTurn()
    const next = await take(offered)
    expect(next.answer.type, JSON.stringify(next.answer)).toBe('COMMAND_COMMITTED')
  }, 120000)
})
