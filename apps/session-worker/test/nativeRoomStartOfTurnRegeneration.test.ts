import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { discoverEncounterFeatureActions } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { SRD, srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { spiritGuardians } from '@artificer-toolkit/source-data/srd/spells/spirit-guardians.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { hitPointsOf } from './placedZoneRoomReads.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-33 T4i1a: the Oni's Regeneration, a start-of-turn passive heal gated on at least 1 hit
 * point, runs as a rule-raised root after the ADVANCE_TURN that begins the Oni's turn, through the
 * public command of the real local room.
 */

const CASTER_ACTOR_ID = testUuid(0x2340)
const CASTER_ID = testUuid(0x2341)
const ONI_ID = testUuid(0x2342)
const WOUNDED = 40
const REGENERATION = 10

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const casterActor = {
  ...characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
  snapshot: { kind: 'CHARACTER' as const, id: CASTER_ID, systemId: srdSystemRecord.id }
}

/** The caster acts first; the Oni's turn begins when it advances. */
function onionRoom(currentHitPoints: number, defeated = false) {
  return actionRoom({
    actors: [
      casterActor,
      srdCreatureActor({
        id: ONI_ID,
        creature: srdByLabel(SRD.creatures, 'Oni'),
        currentHitPoints,
        defeated
      })
    ],
    characterSpellcasting: { spells: [spiritGuardians], prepared: [spiritGuardians.id] },
    characterAction: (action) => action.label === 'Spirit Guardians (3rd level)',
    autoRoll: 'EVERYONE',
    fallbackRoll: 1
  })
}

async function advance(room: Awaited<ReturnType<typeof onionRoom>>) {
  return room.send({
    type: 'ADVANCE_TURN',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })
}

describe('a room ADVANCE_TURN that begins a regenerating creature’s turn (SPELLS-33 T4i1a)', () => {
  it('heals a wounded Oni by 10 in a rule-raised root and replays exactly', async () => {
    const room = await onionRoom(WOUNDED)
    const answer = await advance(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const history = await readRoomHistory(room.room.base.stub)
    const [run] = history.runs
    expect(run && readRunState(run).currentActorId).toBe(ONI_ID)
    expect(await hitPointsOf(room, ONI_ID)).toBe(WOUNDED + REGENERATION)
  })

  it('heals nothing for an Oni with 0 hit points', async () => {
    const room = await onionRoom(0, true)
    const answer = await advance(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await hitPointsOf(room, ONI_ID)).toBe(0)
  })

  it('refuses a player-submitted action that names the trait, so it is never a free heal', async () => {
    const room = await onionRoom(WOUNDED)
    await advance(room)
    const oni = srdCreatureActor({ id: ONI_ID, creature: srdByLabel(SRD.creatures, 'Oni') })
    const { passiveStartOfTurnEffects } = discoverEncounterFeatureActions({
      actor: oni,
      conditionDefinitionIds: srdSystemRecord.conditionTypes.map(({ id }) => id),
      abilityDefinitions: (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))
    })
    const actionId = passiveStartOfTurnEffects[0]?.capability.actionId
    if (!actionId) throw new Error('The Oni has no start-of-turn trait.')
    const hitPoints = await hitPointsOf(room, ONI_ID)
    const answer = await room.send({
      type: 'RESOLVE_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version(),
      actorId: ONI_ID,
      actionId,
      target: { kind: 'ACTOR', actorId: ONI_ID },
      acceptedWieldConflict: null,
      acknowledgedWarnings: [],
      sceneContext: null
    })
    expect(answer).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'SOURCE_REQUIREMENTS_NOT_MET'
    })
    expect(await hitPointsOf(room, ONI_ID)).toBe(hitPoints)
  })
})
