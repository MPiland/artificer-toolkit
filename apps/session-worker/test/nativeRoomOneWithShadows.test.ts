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
import { runInDurableObject } from 'cloudflare:test'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { INVISIBLE_ID } from './endTriggerEffectSeed.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-31.T5n: One with Shadows makes its holder Invisible until it moves or takes an action,
 * bonus action or reaction (the dim-light requirement is the GM's call until SPELLS-31.T5n2).
 */

const HERO_ACTOR_ID = testUuid(0xe70)
const HERO_ID = testUuid(0xe71)
const OBSERVER_ID = testUuid(0xe72)

const invocation = srdBaselineContent.subjects.classes
  .find(({ label }) => label === 'Warlock')
  ?.features?.flatMap((feature) => feature.options ?? [])
  .find(({ label }) => label === 'One with Shadows')
if (!invocation?.id || !invocation.label)
  throw new Error('The SRD Warlock has no One with Shadows.')
// The room's Character is first level, so the invocation's level-5 requirement is lifted; the effect is the SRD's own.
const oneWithShadows = {
  ...invocation,
  id: invocation.id,
  label: invocation.label,
  restrictions: undefined,
  availableAtLevel: 1
}

const basicActionId = (basicId: string) => {
  const definition = SRD_BASIC_ACTION_DEFINITIONS.find(({ id }) => id === basicId)
  if (definition?.document.kind !== 'BASIC_ACTION') throw new Error('Missing basic action fixture.')
  return encounterBasicActionId(HERO_ACTOR_ID, basicId, definition.document.effects[0]!.id)
}
const dashActionId = basicActionId(SRD_BASIC_ACTION_IDS.DASH)
const hideActionId = basicActionId(SRD_BASIC_ACTION_IDS.HIDE)
/** A second action in the turn that turned invisible. */
const SECOND_ACTION_WARNINGS: EncounterRuleWarningCodeDto[] = [
  'TARGET_RANGE_UNCHECKED',
  'ACTION_ECONOMY_UNAVAILABLE'
]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The Warlock turns invisible; the room waits on its next command. */
async function invisibleRoom() {
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
    characterClassFeatures: [oneWithShadows],
    characterAction: (action) => action.label === oneWithShadows.label,
    rolls: [],
    fallbackRoll: 10
  })
  const { answer } = await fixture.startAction(HERO_ACTOR_ID)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  return fixture
}

/** The Warlock is a Character, so its effects are stored on the Character. */
const heldEffectCount = async (fixture: Awaited<ReturnType<typeof invisibleRoom>>) =>
  (await readRoomHistory(fixture.room.base.stub)).characterEffects.length

/** A Character holds its conditions in its play state. */
const isInvisible = (fixture: Awaited<ReturnType<typeof invisibleRoom>>) =>
  runInDurableObject(fixture.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === HERO_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return (readCharacterPlay(row).conditions ?? []).some(
      ({ conditionTypeId }) => conditionTypeId === INVISIBLE_ID
    )
  })

describe('a Warlock made invisible by One with Shadows (SPELLS-31.T5n)', () => {
  it('is invisible after the action that gave it', async () => {
    const fixture = await invisibleRoom()
    expect(await heldEffectCount(fixture)).toBe(1)
    expect(await isInvisible(fixture)).toBe(true)
  }, 90_000)

  it('stops being invisible when it moves', async () => {
    const fixture = await invisibleRoom()
    const moved = await fixture.room.move(
      [
        { x: 150, y: 150 },
        { x: 250, y: 150 }
      ],
      await fixture.version()
    )
    expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
    expect(await heldEffectCount(fixture)).toBe(0)
    expect(await isInvisible(fixture)).toBe(false)
  }, 90_000)

  it('stops being invisible when it takes another action', async () => {
    const fixture = await invisibleRoom()
    const { answer } = await fixture.startAction(
      HERO_ACTOR_ID,
      SECOND_ACTION_WARNINGS,
      null,
      null,
      dashActionId,
      HERO_ACTOR_ID
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await heldEffectCount(fixture)).toBe(0)
    expect(await isInvisible(fixture)).toBe(false)
  }, 90_000)

  // A check action plans no holder batch to release the condition an ending effect owns, so it is
  // refused instead of leaving the condition without an owner (SPELLS-31.T5n; the room logs the cause).
  it('stays invisible when the second action is a check, which is refused', async () => {
    const fixture = await invisibleRoom()
    const { answer } = await fixture.startAction(
      HERO_ACTOR_ID,
      SECOND_ACTION_WARNINGS,
      null,
      null,
      hideActionId,
      HERO_ACTOR_ID
    )
    expect(answer.type).toBe('COMMAND_REJECTED')
    expect(await heldEffectCount(fixture)).toBe(1)
    expect(await isInvisible(fixture)).toBe(true)
  }, 90_000)
})
