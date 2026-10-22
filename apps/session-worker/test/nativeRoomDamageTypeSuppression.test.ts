import { runInDurableObject } from 'cloudflare:test'
import { SRD, srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { afterEach, describe, expect, it } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, fireballWolf } from './actionRoomFixture.js'
import { answerAllSaves } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { hitPointsOf } from './placedZoneRoomReads.js'
import { readPendingActionDecision } from './roomHistoryReads.js'

/**
 * SPELLS-33 T4i1b2: a creature whose regeneration a damage type suppresses takes that damage in a
 * real command, and the room's start-of-turn trait then regenerates or not, turn by turn.
 */

const CASTER_ID = testUuid(0x2360)
const HOLDER_ID = testUuid(0x2361)

afterEach(() => {
  closeTrackedSockets()
})

/**
 * The caster acts first and its area (a Constitution save, which neither holder passes on a 1)
 * hits the holder at the point; the holder's turn is next. A defeated creature loses its turn
 * (D63), so a holder at 0 hit points never reaches its start-of-turn trait in a room.
 */
function regeneratingRoom(
  damage: 'RADIANT' | 'FIRE',
  creatureLabel: 'Vampire' | 'Vampire Spawn' | 'Troll',
  currentHitPoints: number
) {
  const caster = fireballWolf(damage, 'CONSTITUTION')
  return actionRoom({
    actors: [
      srdCreatureActor({ id: CASTER_ID, creature: caster }),
      srdCreatureActor({
        id: HOLDER_ID,
        creature: srdByLabel(SRD.creatures, creatureLabel),
        currentHitPoints
      })
    ],
    ownerFeatureId: caster.features?.find((feature) => feature.label === 'Bite')?.id
  })
}

async function advance(room: Awaited<ReturnType<typeof regeneratingRoom>>) {
  const answer = await room.send({
    type: 'ADVANCE_TURN',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  // A Vampire's turn end offers its Legendary Actions; the holder declines each window.
  for (;;) {
    const window = await runInDurableObject(room.room.base.stub, async (_instance, context) => {
      const store = new RoomEncounterStore(context.storage)
      return {
        encounterVersion: store.documents('encounterRuns')[0]!.version,
        occurrence: store
          .documents('encounterRuleOccurrences')
          .find((candidate) => candidate.state === 'PENDING')
      }
    })
    if (!window.occurrence) return
    const declined = await room.send({
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: window.encounterVersion,
      correlationId: null,
      occurrenceId: window.occurrence.id,
      expectedOccurrenceVersion: window.occurrence.version,
      resolution: { kind: 'DECLINE' }
    })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
  }
}

/** The caster's area hits the holder, who fails its save and takes 1 damage. */
async function hitHolder(room: Awaited<ReturnType<typeof regeneratingRoom>>) {
  await room.startAreaAction({ x: 50, y: 150 })
  for (;;) {
    await answerAllSaves(room)
    const decision = await readPendingActionDecision(room.room.base.stub)
    if (!decision) return
    if (decision.pending.kind !== 'AREA_SAVES' || decision.pending.legendaryResistance.length === 0)
      throw new Error(`The area action is still pending: ${decision.pending.kind}.`)
    const declined = await room.send(
      room.resolveCommand(decision, {
        kind: 'AREA_LEGENDARY_RESISTANCE',
        actorId: HOLDER_ID,
        decision: { kind: 'DECLINE' }
      })
    )
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
  }
}

describe('damage-type suppression of start-of-turn regeneration in a room (SPELLS-33 T4i1b2)', () => {
  it('a wounded Vampire Spawn does not regenerate on the turn after radiant damage, and does on the next', async () => {
    const room = await regeneratingRoom('RADIANT', 'Vampire Spawn', 60)
    await hitHolder(room)
    const afterHit = await hitPointsOf(room, HOLDER_ID)
    expect(afterHit).toBeLessThan(60)

    await advance(room)
    expect(await hitPointsOf(room, HOLDER_ID)).toBe(afterHit)

    await advance(room)
    await advance(room)
    expect(await hitPointsOf(room, HOLDER_ID)).toBe((afterHit ?? 0) + 10)
  })

  it('a wounded Vampire, whose legendary actions the turn offers, regenerates 20 once radiant damage stops', async () => {
    const room = await regeneratingRoom('RADIANT', 'Vampire', 100)
    await hitHolder(room)
    const afterHit = await hitPointsOf(room, HOLDER_ID)
    expect(afterHit).toBeLessThan(100)

    await advance(room)
    expect(await hitPointsOf(room, HOLDER_ID)).toBe(afterHit)

    await advance(room)
    await advance(room)
    expect(await hitPointsOf(room, HOLDER_ID)).toBe((afterHit ?? 0) + 20)
  })

  it('a Troll does not regenerate on the turn after fire damage, and does on the next', async () => {
    const room = await regeneratingRoom('FIRE', 'Troll', 60)
    await hitHolder(room)
    const afterHit = await hitPointsOf(room, HOLDER_ID)

    await advance(room)
    expect(await hitPointsOf(room, HOLDER_ID)).toBe(afterHit)

    await advance(room)
    await advance(room)
    expect(await hitPointsOf(room, HOLDER_ID)).toBe((afterHit ?? 0) + 10)
  })
})
