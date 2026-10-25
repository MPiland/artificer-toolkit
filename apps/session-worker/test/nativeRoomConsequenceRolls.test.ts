import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type { EncounterConsequenceRollOfferDto } from '@artificer-toolkit/schema/shared/consequenceRolls'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '@artificer-toolkit/source-data/srd/optionalCombat.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

const WOLF_ID = testUuid(0xc00)
const HERO_ID = testUuid(0xc01)
const CHARACTER_ID = testUuid(0xc02)

const bite = biteWolf('SAVE')
const injuries = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
  (definition) => definition.document.kind === 'INJURIES'
)
if (!injuries || injuries.document.parameters.kind !== 'INJURIES')
  throw new Error('Missing published Injuries.')
const injuryBands = injuries.document.parameters.bands

/** The offer an earlier command's damage left the GM: the room tests of that damage prove it. */
const offer: EncounterConsequenceRollOfferDto = {
  sourceCommandId: testUuid(0xc10),
  definitionId: injuries.id,
  label: injuries.label,
  triggers: [{ event: 'HIT_POINTS_ZERO' }],
  occurredAt: '2026-10-25T12:00:00.000Z'
}

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A Run with Injuries on whose Character holds one open offer; the room's d20 shows 1. */
function offerRoom() {
  return actionRoom({
    actors: [
      srdCreatureActor({ id: WOLF_ID, creature: bite }),
      {
        ...characterActor({ id: HERO_ID, characterId: CHARACTER_ID }),
        consequenceRollOffers: [offer]
      }
    ],
    ownerFeatureId: creatureFeature(bite, 'Bite').id,
    optionalCombatKinds: ['INJURIES'],
    rolls: [0]
  })
}
type Room = Awaited<ReturnType<typeof offerRoom>>

async function resolve(room: Room, decision: 'ACCEPT' | 'DECLINE') {
  return room.send({
    type: 'RESOLVE_CONSEQUENCE_ROLL_OFFER',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    actorId: HERO_ID,
    sourceCommandId: offer.sourceCommandId,
    definitionId: offer.definitionId,
    decision,
    visibility: 'PUBLIC'
  })
}

/** The receipt of the one resolve command the room holds (D85: Convex never sees it mid-Run). */
async function storedReceipt(room: Room) {
  const resolves = (await readRoomHistory(room.room.base.stub)).commands
    .filter(({ commandType }) => commandType === 'RESOLVE_CONSEQUENCE_ROLL_OFFER')
    .map(({ _id, _creationTime, ...row }) => encounterStoredRunCommandSchema.parse(row))
  expect(resolves).toHaveLength(1)
  const [resolved] = resolves
  if (resolved?.commandType !== 'RESOLVE_CONSEQUENCE_ROLL_OFFER') throw new Error('Unreachable.')
  return resolved.receipt
}

describe('Consequence roll receipts in the native room (ATTACK-15.1)', () => {
  it('keeps the accepted roll and the authored row it landed on', async () => {
    const room = await offerRoom()
    const answer = await resolve(room, 'ACCEPT')
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await storedReceipt(room)).toEqual({
      actorId: HERO_ID,
      offer,
      resolution: {
        decision: 'ACCEPT',
        dieFaces: 20,
        roll: 1,
        rowId: injuryBands.find((band) => band.minimum <= 1 && 1 <= band.maximum)!.outcome.id
      }
    })
  })

  it('keeps a declined offer with no roll', async () => {
    const room = await offerRoom()
    expect((await resolve(room, 'DECLINE')).type).toBe('COMMAND_COMMITTED')
    expect(await storedReceipt(room)).toEqual({
      actorId: HERO_ID,
      offer,
      resolution: { decision: 'DECLINE' }
    })
  })
})
