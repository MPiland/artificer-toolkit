import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { LiveSessionEncounterRulesResponse } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { encounterInitiativeRoundStateDtoSchema } from '@artificer-toolkit/schema/shared/initiativeState'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { readNativeLiveHasNotTakenTurn } from '../src/nativeTurnUses.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'

const ASSASSIN_ID = testUuid(0xf10)
const TARGET_ID = testUuid(0xf11)
const NOW = '2026-10-20T00:00:00.000Z'

const assassin = (() => {
  const creature = srdBaselineContent.subjects.creatures.find(({ label }) => label === 'Assassin')
  if (!creature) throw new Error('The SRD has no Assassin.')
  return creature
})()

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The roll mode of the Assassin's Shortsword on the Wolf; the Assassin has the first turn. */
async function shortswordRollMode() {
  const room = await actionRoom({
    actors: [
      srdCreatureActor({ id: ASSASSIN_ID, creature: assassin }),
      srdCreatureActor({ id: TARGET_ID, creature: plainWolf })
    ],
    ownerFeatureId: creatureFeature(assassin, 'Shortsword').id
  })
  const { answer } = await room.startAction(TARGET_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the attack roll.')
  return decision.pending.request.rollMode
}

describe('Assassinate authored as attack roll advantage, in the room (SPELLS-33.T6d3b)', () => {
  it('rolls the attack with advantage against a target whose first turn is still to come', async () => {
    expect(await shortswordRollMode()).toBe('ADVANTAGE')
  })
})

const initiativeResponse = (
  round: number,
  statuses: Record<string, 'READY' | 'ACTIVE' | 'ACTED'>
): LiveSessionEncounterRulesResponse => ({
  kind: 'INITIATIVE_ROUND',
  revisions: [],
  state: encounterInitiativeRoundStateDtoSchema.parse({
    round: {
      encounterId: testUuid(0xf12),
      round,
      procedure: 'MANUAL',
      cadence: 'ENCOUNTER_START',
      status: 'ACTIVE',
      policySnapshotChecksum: null,
      nextTurnOrderOrdinal: Object.keys(statuses).length,
      version: 0,
      createdAt: NOW,
      updatedAt: NOW
    },
    sides: [],
    participants: Object.entries(statuses).map(([actorId, status], turnOrderOrdinal) => ({
      encounterId: testUuid(0xf12),
      round,
      actorId,
      sideId: testUuid(0xf13),
      status,
      initiativeScore: null,
      evaluation: { occurrenceId: null, resultChecksum: null },
      tie: { occurrenceId: null, resultChecksum: null },
      declaration: null,
      declarationChecksum: null,
      turnOrderOrdinal,
      version: 0,
      createdAt: NOW,
      updatedAt: NOW
    }))
  })
})

describe('whether an actor has yet to take a turn, from the Encounter initiative (SPELLS-33.T6d3b)', () => {
  const read = (response: LiveSessionEncounterRulesResponse | null, actorId = TARGET_ID) =>
    readNativeLiveHasNotTakenTurn(async (request) => {
      expect(request).toEqual({ kind: 'INITIATIVE_ROUND' })
      return response ?? { kind: 'INITIATIVE_ROUND', revisions: [], state: null }
    }, actorId)

  it('holds for an actor still READY in the first round', async () => {
    expect(
      await read(initiativeResponse(1, { [ASSASSIN_ID]: 'ACTIVE', [TARGET_ID]: 'READY' }))
    ).toBe(true)
  })

  it('does not hold for an actor that has acted or is acting in the first round', async () => {
    const response = initiativeResponse(1, { [TARGET_ID]: 'ACTED', [ASSASSIN_ID]: 'ACTIVE' })
    expect(await read(response)).toBe(false)
    expect(await read(response, ASSASSIN_ID)).toBe(false)
  })

  it('does not hold in a later round, when every actor has had a turn', async () => {
    expect(
      await read(initiativeResponse(2, { [ASSASSIN_ID]: 'ACTIVE', [TARGET_ID]: 'READY' }))
    ).toBe(false)
  })

  it('does not hold for an actor outside the initiative or an Encounter without one', async () => {
    expect(await read(initiativeResponse(1, { [ASSASSIN_ID]: 'ACTIVE' }))).toBe(false)
    expect(await read(null)).toBe(false)
  })
})
