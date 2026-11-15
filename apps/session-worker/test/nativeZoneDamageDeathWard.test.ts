import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { plannedTimedCondition } from '@artificer-toolkit/rules-runtime/testing/plannedTimedCondition'
import { chainLightning } from '@artificer-toolkit/source-data/srd/spells/chain-lightning.js'
import { cloudkill } from '@artificer-toolkit/source-data/srd/spells/cloudkill.js'
import { deathWard } from '@artificer-toolkit/source-data/srd/spells/death-ward.js'
import { dominateBeast } from '@artificer-toolkit/source-data/srd/spells/dominate-beast.js'
import { spikeGrowth } from '@artificer-toolkit/source-data/srd/spells/spike-growth.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { takeDamagedRaises } from './damagedRaiseRecorder.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { hitPointsOf, readZones, walkerMoves } from './placedZoneRoomReads.js'
import { parseReceiptExecution, readRoomHistory } from './roomHistoryReads.js'

vi.mock('@artificer-toolkit/rules-runtime/events/encounterEventHooks', async (importOriginal) =>
  (await import('./damagedRaiseRecorder.js')).recordingDamagedRaises(importOriginal)
)
// The rooms load their modules again, so they meet the recording discovery (damagedRaiseRecorder.ts).
vi.resetModules()

/**
 * QUALITY-14.T2e2f6 (D132, D220): zone damage that reaches a creature settles it even when an
 * interception leaves its state as it was. A Wolf at 1 hit point holds the SRD Death Ward; the
 * zone's damage would drop it to 0, so the ward keeps it at 1 and spends, and the Wolf's damage
 * raises its DAMAGED(AFTER): the SRD Dominate Beast it holds owes its repeat save. Both hold whether
 * the zone meets the Wolf as it moves or at its turn start.
 */

const CASTER_ACTOR_ID = testUuid(0xf60)
const CASTER_ID = testUuid(0xf61)
const WOLF_ID = testUuid(0xf62)
const WARD_ID = testUuid(0xf63)
const DOMINATE_ID = testUuid(0xf64)
const ZONE_CENTER = { x: 600, y: 600 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * The Character casts `castLabel` at its turn; the Wolf, at 1 hit point, holding a Death Ward and
 * charmed by the Character's Dominate Beast, stands at the zone's center. Every die shows a 1: each
 * save fails and each damage die is a 1.
 */
function wardedWolfRoom(spells: SpellAuthored[], castLabel: string) {
  const [deathWardEffect] = deathWard.effects ?? []
  if (!deathWardEffect) throw new Error('The SRD Death Ward has no effect.')
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
        snapshot: { kind: 'CHARACTER' as const, id: CASTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf, currentHitPoints: 1 })
    ],
    positions: { [WOLF_ID]: ZONE_CENTER },
    characterSpellcasting: { spells, prepared: [spells[0]!.id] },
    characterAction: (action) => action.label === castLabel,
    autoRoll: 'EVERYONE',
    fallbackRoll: 0,
    seed: async ({ effects, encounterId, occurredAt }) => {
      const ward = plannedModifierGrant({
        encounterId,
        sourceActorId: CASTER_ACTOR_ID,
        holderActorId: WOLF_ID,
        lifecycle: {},
        effect: deathWardEffect,
        sourceLabel: deathWard.label
      })
      await effects.create({
        id: WARD_ID,
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: WOLF_ID },
        definition: ward.definition,
        lifecycle: { ...ward.lifecycle, remainingUses: 1 },
        occurredAt
      })
      const dominated = plannedTimedCondition({
        encounterId,
        sourceActorId: CASTER_ACTOR_ID,
        holderActorId: WOLF_ID,
        spell: dominateBeast,
        lifetimeScope: 'ENCOUNTER'
      })
      await effects.create({
        id: DOMINATE_ID,
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: WOLF_ID },
        definition: dominated.definition,
        lifecycle: dominated.lifecycle,
        occurredAt
      })
    }
  })
}

type Room = Awaited<ReturnType<typeof wardedWolfRoom>>

async function castAtTheCenter(room: Room) {
  const { answer } = await room.startAreaAction(ZONE_CENTER)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  expect(await readZones(room)).toHaveLength(1)
}

async function wardHeld(room: Room) {
  const { activeEffects } = await readRoomHistory(room.room.base.stub)
  return activeEffects.some(({ id }) => id === WARD_ID)
}

/** The Dominate Beast repeat saves the room's receipts hold. */
async function dominateSaves(room: Room) {
  return (await readRoomHistory(room.room.base.stub)).receipts.flatMap((receipt) => {
    const result = parseReceiptExecution(receipt)
    return result.status === 'COMPLETE' &&
      result.applicationOutputs.kind === 'DAMAGE_SAVE_CHECK' &&
      result.applicationOutputs.source === 'EFFECT_REPEAT_SAVE' &&
      result.applicationOutputs.activeEffect.id === DOMINATE_ID
      ? [result.applicationOutputs.outcome]
      : []
  })
}

describe('zone damage a Death Ward holds off a moving Wolf’s hit points (QUALITY-14.T2e2f6)', () => {
  it('settles the Wolf’s Spike Growth step: the ward spends and its damage owes the repeat save', async () => {
    const room = await wardedWolfRoom([spikeGrowth], 'Spike Growth (2nd level)')
    await castAtTheCenter(room)
    await room.advanceTurn()

    takeDamagedRaises()
    const walk = await walkerMoves(room, [
      ZONE_CENTER,
      { x: ZONE_CENTER.x + 100, y: ZONE_CENTER.y }
    ])

    expect(walk.executions).toMatchObject([
      { applications: [expect.objectContaining({ kind: 'DAMAGE', resolvedAmount: 2 })] }
    ])
    expect(await hitPointsOf(room, WOLF_ID)).toBe(1)
    expect(await wardHeld(room)).toBe(false)
    expect(takeDamagedRaises().room).toEqual([WOLF_ID])
    expect(await dominateSaves(room)).toEqual(['SAVE_FAILURE'])
  }, 120000)
})

describe('zone damage a Death Ward holds off a Wolf’s hit points at its turn start (QUALITY-14.T2e2f6)', () => {
  it('settles the Wolf’s Cloudkill damage: the ward spends and its damage owes the repeat save', async () => {
    const room = await wardedWolfRoom([cloudkill, chainLightning], 'Cloudkill (5th level)')
    await castAtTheCenter(room)

    // The caster's turn ends outside the area; the Wolf's turn starts in it.
    takeDamagedRaises()
    const command = {
      type: 'ADVANCE_TURN',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    }
    const answer = await room.send(command)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const receipt = (await readRoomHistory(room.room.base.stub)).receipts.find(
      (candidate) => candidate.commandId === command.commandId
    )
    if (!receipt) throw new Error('The turn left no receipt.')
    const result = parseReceiptExecution(receipt)
    expect(result).toMatchObject({
      incomingZoneEffects: {
        kind: 'EXECUTED',
        executions: [
          {
            candidate: { candidate: { targetActorId: WOLF_ID } },
            applications: [expect.objectContaining({ kind: 'DAMAGE', resolvedAmount: 5 })]
          }
        ]
      }
    })
    expect(await hitPointsOf(room, WOLF_ID)).toBe(1)
    expect(await wardHeld(room)).toBe(false)
    expect(takeDamagedRaises().room).toEqual([WOLF_ID])
    expect(await dominateSaves(room)).toEqual(['SAVE_FAILURE'])
  }, 120000)
})
