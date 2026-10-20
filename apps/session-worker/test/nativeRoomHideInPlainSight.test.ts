import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { encounterBasicActionId } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-31.T5n: Hide in Plain Sight is a Stealth bonus that lasts until its holder moves or takes
 * an action, bonus action or reaction (the 1 minute of camouflage is not modelled).
 */

const HERO_ACTOR_ID = testUuid(0xe70)
const HERO_ID = testUuid(0xe71)
const OBSERVER_ID = testUuid(0xe72)

const found = srdBaselineContent.subjects.classes
  .find(({ label }) => label === 'Ranger')
  ?.features?.find(({ label }) => label === 'Hide in Plain Sight')
if (!found?.id || !found.label) throw new Error('The SRD Ranger has no Hide in Plain Sight.')
const hideInPlainSight = { ...found, id: found.id, label: found.label, availableAtLevel: 1 }

const hideDefinition = SRD_BASIC_ACTION_DEFINITIONS.find(
  ({ id }) => id === SRD_BASIC_ACTION_IDS.HIDE
)
if (hideDefinition?.document.kind !== 'BASIC_ACTION') throw new Error('Missing Hide fixture.')
const hideActionId = encounterBasicActionId(
  HERO_ACTOR_ID,
  SRD_BASIC_ACTION_IDS.HIDE,
  hideDefinition.document.effects[0]!.id
)
/** Hiding is a second action in the turn that camouflaged. */
const SECOND_ACTION_WARNINGS: EncounterRuleWarningCodeDto[] = [
  'TARGET_RANGE_UNCHECKED',
  'ACTION_ECONOMY_UNAVAILABLE'
]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The Ranger camouflages itself; the room waits on the Ranger's next command. */
async function camouflagedRoom() {
  const fixture = await actionRoom({
    actors: [
      characterActor({ id: HERO_ACTOR_ID, characterId: HERO_ID }),
      srdCreatureActor({
        id: OBSERVER_ID,
        creature: biteWolf('ATTACK'),
        disposition: 'FRIENDLY'
      })
    ],
    positions: { [HERO_ACTOR_ID]: { x: 150, y: 150 }, [OBSERVER_ID]: { x: 150, y: 950 } },
    // The room's Character is first level; the grants are the SRD feature's own.
    characterClassFeatures: [hideInPlainSight],
    characterAction: (action) => action.label === hideInPlainSight.label,
    rolls: [],
    fallbackRoll: 10
  })
  const { answer } = await fixture.startAction(HERO_ACTOR_ID)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  return fixture
}

/** The Ranger is a Character, so its effects are stored on the Character. */
const heldEffectCount = async (fixture: Awaited<ReturnType<typeof camouflagedRoom>>) =>
  (await readRoomHistory(fixture.room.base.stub)).characterEffects.length

describe('a Ranger camouflaged by Hide in Plain Sight (SPELLS-31.T5n)', () => {
  it('holds the bonus after the action that gave it', async () => {
    expect(await heldEffectCount(await camouflagedRoom())).toBe(1)
  }, 90_000)

  it('loses it when it moves', async () => {
    const fixture = await camouflagedRoom()
    const moved = await fixture.room.move(
      [
        { x: 150, y: 150 },
        { x: 250, y: 150 }
      ],
      await fixture.version()
    )
    expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
    expect(await heldEffectCount(fixture)).toBe(0)
  }, 90_000)

  it('loses it when it takes another action', async () => {
    const fixture = await camouflagedRoom()
    const { answer } = await fixture.startAction(
      HERO_ACTOR_ID,
      SECOND_ACTION_WARNINGS,
      null,
      null,
      hideActionId,
      HERO_ACTOR_ID
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await heldEffectCount(fixture)).toBe(0)
  }, 90_000)
})
