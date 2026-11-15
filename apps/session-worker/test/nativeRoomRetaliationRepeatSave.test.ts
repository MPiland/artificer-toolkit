import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { SRD, srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readActorHitPoints,
  readPendingActionDecision,
  readRoomHistory,
  type RoomHistory
} from './roomHistoryReads.js'

/**
 * QUALITY-14.T2e2b4 (D132, D167, D220): the zones a melee hit sets off against the attacker carry
 * their ends stage's damaged discovery into the attack's damage-save chain, which names the zone's
 * source as the damager, as the ends stage does. A Goblin the SRD Vampire charmed hits the
 * Remorhaz, whose Heated Body burns it, through the public RESOLVE_ACTION command of the real room.
 */

const VAMPIRE_ID = testUuid(0x2270)
const GOBLIN_ID = testUuid(0x2271)
const REMORHAZ_ID = testUuid(0x2272)

const vampire = srdByLabel(SRD.creatures, 'Vampire')
const goblin = srdByLabel(SRD.creatures, 'Goblin')
const remorhaz = srdByLabel(SRD.creatures, 'Remorhaz')

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const effectIds = (history: RoomHistory) => history.activeEffects.map((effect) => effect.id)

/** The repeat-save check outputs, one per check the Run settled. */
function repeatSaveChecks(history: RoomHistory) {
  return history.receipts.flatMap((receipt) => {
    const execution = parseReceiptExecution(receipt)
    return execution.status === 'COMPLETE' &&
      execution.applicationOutputs.kind === 'DAMAGE_SAVE_CHECK' &&
      execution.applicationOutputs.source === 'EFFECT_REPEAT_SAVE'
      ? [execution.applicationOutputs]
      : []
  })
}

/**
 * The dice the room rolls, in order (each raw value `v` shows face `v % sides + 1`): initiative puts
 * the Vampire, then the Goblin, then the Remorhaz; the Goblin fails the Charm's save; the scimitar
 * hits for 1 + 2; Heated Body burns for 3, so the Goblin lives; then any repeat save shows a 20.
 */
const ROLLS = [19, 9, 0, 0, 18, 0, 0, 0, 0, 19]

/**
 * The Encounter starts (placing the Remorhaz's Heated Body), the Vampire charms the Goblin beside it
 * and ends its turn, and the Goblin's scimitar hits the Remorhaz on its other side. The room rolls
 * every die. The room is left where the hit settled; the charm's effect id is returned.
 */
async function charmedGoblinHitsRemorhaz() {
  const room = await actionRoom({
    actors: [
      srdCreatureActor({ id: VAMPIRE_ID, creature: vampire, disposition: 'HOSTILE' }),
      srdCreatureActor({ id: GOBLIN_ID, creature: goblin, disposition: 'FRIENDLY' }),
      srdCreatureActor({ id: REMORHAZ_ID, creature: remorhaz, disposition: 'HOSTILE' })
    ],
    ownerFeatureId: creatureFeature(vampire, 'Charm').id,
    status: 'PREPARED',
    autoRoll: 'EVERYONE',
    rolls: ROLLS,
    fallbackRoll: 0
  })
  const start = await room.send({
    type: 'START',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })
  expect(start.type, JSON.stringify(start)).toBe('COMMAND_COMMITTED')
  const [vampireToken, goblinToken, remorhazToken] = room.room.scene.tokens
  if (!vampireToken || !goblinToken || !remorhazToken) {
    throw new Error('The Scene holds no tokens.')
  }
  const before = effectIds(await readRoomHistory(room.room.base.stub))
  const charmed = await room.startAction(GOBLIN_ID, [], {
    sceneId: room.room.scene.id,
    expectedSceneVersion: room.room.scene.version,
    sourceTokenId: vampireToken.id,
    targetTokenId: goblinToken.id
  })
  expect(charmed.answer.type, JSON.stringify(charmed.answer)).toBe('COMMAND_COMMITTED')
  const [charmId] = effectIds(await readRoomHistory(room.room.base.stub)).filter(
    (id) => !before.includes(id)
  )
  if (!charmId) throw new Error('The Charm placed no effect.')
  await room.advanceTurn()

  const goblinActor = srdCreatureActor({ id: GOBLIN_ID, creature: goblin })
  const attack = await room.startAction(
    REMORHAZ_ID,
    [],
    {
      sceneId: room.room.scene.id,
      expectedSceneVersion: room.room.scene.version,
      sourceTokenId: goblinToken.id,
      targetTokenId: remorhazToken.id
    },
    null,
    room.featureActionId(goblinActor, creatureFeature(goblin, 'Scimitar').id),
    GOBLIN_ID
  )
  expect(attack.answer.type, JSON.stringify(attack.answer)).toBe('COMMAND_COMMITTED')
  expect(readActorHitPoints(await readRoomHistory(room.room.base.stub), GOBLIN_ID)).toBe(4)
  return { room, charmId }
}

describe('melee retaliation damage repeat saves (QUALITY-14.T2e2b4, D132, D167, D220)', () => {
  it("owes the charmed attacker the Charm's repeat save: the Remorhaz is on the Vampire's side", async () => {
    const { room, charmId } = await charmedGoblinHitsRemorhaz()
    // Heated Body's damage is the Remorhaz's, so it meets the Charm's SOURCE_SIDE repeat trigger.
    const after = await readRoomHistory(room.room.base.stub)
    expect(repeatSaveChecks(after)).toMatchObject([
      {
        outcome: 'SAVE_SUCCESS',
        activeEffect: { id: charmId },
        application: { damagerActorId: REMORHAZ_ID, targetActorId: GOBLIN_ID }
      }
    ])
    expect(effectIds(after)).not.toContain(charmId)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })
})
