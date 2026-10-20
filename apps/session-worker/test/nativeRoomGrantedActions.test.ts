import { runInDurableObject } from 'cloudflare:test'
import { encounterBasicActionId } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import { grantedActionId } from '@artificer-toolkit/rules-runtime/encounterGrantedActions'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import { expeditiousRetreat } from '@artificer-toolkit/source-data/srd/spells/expeditious-retreat.js'
import { haste } from '@artificer-toolkit/source-data/srd/spells/haste.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-4.T2lb (D160): the actions a held effect offers its holder, taken through the offer's own
 * activation and use count: Haste's extra action and Expeditious Retreat's Dash.
 */

const CHARACTER_ACTOR_ID = testUuid(0xb60)
const CHARACTER_ID = testUuid(0xb61)
const ALLY_ID = testUuid(0xb62)
const WOLF_ID = testUuid(0xb63)

/** No Scene measures the spell's range (D11). */
const RANGE: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const dashEffectId = (() => {
  const dash = SRD_BASIC_ACTION_DEFINITIONS.find(({ id }) => id === SRD_BASIC_ACTION_IDS.DASH)
  if (dash?.document.kind !== 'BASIC_ACTION') throw new Error('Missing the Dash basic action.')
  return dash.document.effects[0]!.id
})()

const dashOf = (actorId: string) =>
  encounterBasicActionId(actorId, SRD_BASIC_ACTION_IDS.DASH, dashEffectId)

function characterOf(spell: typeof haste) {
  return {
    ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
    snapshot: { kind: 'CHARACTER' as const, id: CHARACTER_ID, systemId: srdSystemRecord.id },
    spell
  }
}

/** The Character (first in the order) prepares `spell`; a friendly Wolf and a hostile Wolf follow. */
function spellRoom(spell: typeof haste) {
  const { spell: _spell, ...character } = characterOf(spell)
  return actionRoom({
    actors: [
      character,
      srdCreatureActor({ id: ALLY_ID, creature: biteWolf('ATTACK'), disposition: 'FRIENDLY' }),
      srdCreatureActor({ id: WOLF_ID, creature: biteWolf('ATTACK') })
    ],
    characterSpellcasting: { spells: [spell], prepared: [spell.id] },
    characterAction: (action) => action.label.startsWith(spell.label)
  })
}

type Room = Awaited<ReturnType<typeof spellRoom>>

/** The once-per-turn keys every actor has spent in the Run's turns, in the room's store. */
function spentTurnUses(room: Room) {
  return runInDurableObject(room.room.base.stub, async (_instance, context) =>
    new RoomEncounterStore(context.storage)
      .documents('encounterTurnMovements')
      .flatMap(({ usedOncePerTurn }) => usedOncePerTurn)
  )
}

async function takeDash(room: Room, actionId: string, actorId: string) {
  return room.startAction(actorId, [], null, null, actionId, actorId)
}

describe('room Haste’s additional action (SPELLS-4.T2lb)', () => {
  async function hastedAlly() {
    const room = await spellRoom(haste)
    const cast = await room.startAction(ALLY_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    const [held] = (await readRoomHistory(room.room.base.stub)).activeEffects.filter(
      ({ targetActorId }) => targetActorId === ALLY_ID
    )
    if (!held) throw new Error('The ally holds no Haste.')
    await room.advanceTurn()
    return { room, hasteId: held.id }
  }

  it('lets the holder Dash once a turn without spending its Action, and an undo gives the use back', async () => {
    const { room, hasteId } = await hastedAlly()
    const offered = grantedActionId(dashOf(ALLY_ID), hasteId, 0)

    const first = await takeDash(room, offered, ALLY_ID)
    expect(first.answer.type, JSON.stringify(first.answer)).toBe('COMMAND_COMMITTED')
    expect(await spentTurnUses(room)).toHaveLength(1)

    // The offer is one use a turn, whatever it is spent on.
    const second = await takeDash(room, offered, ALLY_ID)
    expect(second.answer.type, JSON.stringify(second.answer)).not.toBe('COMMAND_COMMITTED')

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await spentTurnUses(room)).toEqual([])

    const again = await takeDash(room, offered, ALLY_ID)
    expect(again.answer.type, JSON.stringify(again.answer)).toBe('COMMAND_COMMITTED')
  }, 120000)

  it('refuses an offer the holder no longer keeps', async () => {
    const { room } = await hastedAlly()
    const stale = grantedActionId(dashOf(ALLY_ID), testUuid(0xb6f), 0)

    const answer = await takeDash(room, stale, ALLY_ID)
    expect(answer.answer.type, JSON.stringify(answer.answer)).not.toBe('COMMAND_COMMITTED')
    expect(await spentTurnUses(room)).toEqual([])
  }, 120000)
})

describe('room Expeditious Retreat’s Dash (SPELLS-4.T2lb)', () => {
  it('lets the caster Dash as a Bonus Action on a later turn, spending no use', async () => {
    const room = await spellRoom(expeditiousRetreat)
    const cast = await room.startAction(CHARACTER_ACTOR_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    const [held] = (await readRoomHistory(room.room.base.stub)).activeEffects.filter(
      ({ targetActorId }) => targetActorId === CHARACTER_ACTOR_ID
    )
    const effectId =
      held?.id ??
      (await readRoomHistory(room.room.base.stub)).characterEffects.find(
        ({ characterId }) => characterId === CHARACTER_ID
      )?.id
    if (!effectId) throw new Error('The caster holds no Expeditious Retreat.')
    for (let turn = 0; turn < 3; turn += 1) await room.advanceTurn()

    const dash = await takeDash(
      room,
      grantedActionId(dashOf(CHARACTER_ACTOR_ID), effectId, 0),
      CHARACTER_ACTOR_ID
    )
    expect(dash.answer.type, JSON.stringify(dash.answer)).toBe('COMMAND_COMMITTED')
    expect(await spentTurnUses(room)).toEqual([])
  }, 120000)
})
