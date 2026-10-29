import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import type { PathLifecycleAuthored } from '@artificer-toolkit/shared/authored'
import { antitoxinVial } from '@artificer-toolkit/source-data/srd/equipment/antitoxin-vial.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

const FIGHTER_ACTOR_ID = testUuid(0xf10)
const FIGHTER_ID = testUuid(0xf11)
const BITER_ID = testUuid(0xf12)
const TARGET_ID = testUuid(0xf13)

/** No Scene measures the vial's touch range (D11). */
const RANGE: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The real SRD Antitoxin, its grant lasting one round and carrying `lifecycle`. */
function shortGrantVial(lifecycle: PathLifecycleAuthored): typeof antitoxinVial {
  return {
    ...antitoxinVial,
    effects: antitoxinVial.effects?.map((effect) => ({
      ...effect,
      paths: effect.paths.map((path) =>
        path.selectionKind !== 'FIXED'
          ? path
          : {
              ...path,
              resultBlock: {
                ...path.resultBlock,
                duration: path.resultBlock.duration && {
                  ...path.resultBlock.duration,
                  durationKind: 'ROUND' as const,
                  amount: 1
                },
                lifecycle: { ...path.resultBlock.lifecycle, ...lifecycle }
              }
            }
      )
    }))
  }
}

/** The Fighter (first in the order) holds `vial`; the biter then the target follow. */
async function grantRoom(vial: typeof antitoxinVial) {
  const biter = biteWolf('ATTACK')
  const biterActor = srdCreatureActor({ id: BITER_ID, creature: biter })
  const room = await actionRoom({
    autoRoll: 'GAME_MASTER',
    rolls: [18],
    actors: [
      {
        ...characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
        // Initiative reads the Character's frozen identity, which a turn change checks.
        snapshot: { kind: 'CHARACTER', id: FIGHTER_ID, systemId: srdSystemRecord.id }
      },
      biterActor,
      srdCreatureActor({ id: TARGET_ID, creature: biteWolf('ATTACK') })
    ],
    characterEquipment: [vial],
    characterAction: (action) => action.label === vial.label
  })
  return { room, biteActionId: room.featureActionId(biterActor, creatureFeature(biter, 'Bite').id) }
}

type Fixture = Awaited<ReturnType<typeof grantRoom>>

const activeEffects = async (fixture: Fixture) =>
  (await readRoomHistory(fixture.room.room.base.stub)).activeEffects

async function useVial(fixture: Fixture, targetId: string) {
  const used = await fixture.room.startAction(targetId, RANGE)
  expect(used.answer.type, JSON.stringify(used.answer)).toBe('COMMAND_COMMITTED')
}

describe('a grant anchored to its source’s turn (SPELLS-5.4)', () => {
  it('lasts until the source’s next start of turn, whoever holds it, and not before', async () => {
    const fixture = await grantRoom(
      shortGrantVial({ turnAnchor: { actor: 'SOURCE', boundary: 'START_OF_TURN' } })
    )
    await useVial(fixture, TARGET_ID)
    expect(await activeEffects(fixture)).toMatchObject([{ targetActorId: TARGET_ID }])

    // The biter's turn, then the holder's own turn: the source has not come round yet.
    await fixture.room.advanceTurn()
    await fixture.room.advanceTurn()
    expect(await activeEffects(fixture)).toHaveLength(1)

    // The round wraps to the source, and the grant ends as its turn starts.
    await fixture.room.advanceTurn()
    expect(await activeEffects(fixture)).toHaveLength(0)
  })
})

describe('a grant used up by the holder’s attack roll (SPELLS-5.4)', () => {
  it('is deleted by the holder’s attack and restored by the GM’s undo', async () => {
    const fixture = await grantRoom(
      shortGrantVial({
        endTriggers: [{ event: 'LIFECYCLE', timing: 'CONSUME', code: 'ON_ATTACK_ROLL' }]
      })
    )
    await useVial(fixture, BITER_ID)
    const [granted] = await activeEffects(fixture)
    expect(granted).toMatchObject({ targetActorId: BITER_ID })
    await fixture.room.advanceTurn()

    const bite = await fixture.room.startAction(
      FIGHTER_ACTOR_ID,
      [],
      null,
      null,
      fixture.biteActionId,
      BITER_ID
    )
    expect(bite.answer.type, JSON.stringify(bite.answer)).toBe('COMMAND_COMMITTED')
    expect(await activeEffects(fixture)).toEqual([])

    const undone = await fixture.room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: fixture.room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await fixture.room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await activeEffects(fixture)).toMatchObject([
      { id: granted?.id, targetActorId: BITER_ID }
    ])
  })
})
