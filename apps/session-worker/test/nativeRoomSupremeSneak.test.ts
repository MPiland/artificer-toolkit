import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { encounterBasicActionId } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'

/**
 * SPELLS-31.T5n: Thief's Supreme Sneak gives a Stealth check advantage only while the turn's
 * movement stays within half the speed, read from the Run's movement rows when the check is made.
 */

const HERO_ACTOR_ID = testUuid(0xe60)
const HERO_ID = testUuid(0xe61)
const OBSERVER_ID = testUuid(0xe62)

const found = srdBaselineContent.subjects.classes
  .find(({ label }) => label === 'Thief')
  ?.features?.find(({ label }) => label === 'Supreme Sneak')
if (!found?.id || !found.label) throw new Error('The SRD Thief has no Supreme Sneak.')
const supremeSneak = { ...found, id: found.id, label: found.label, availableAtLevel: 1 }

const hideDefinition = SRD_BASIC_ACTION_DEFINITIONS.find(
  ({ id }) => id === SRD_BASIC_ACTION_IDS.HIDE
)
if (hideDefinition?.document.kind !== 'BASIC_ACTION') throw new Error('Missing Hide fixture.')
const hideActionId = encounterBasicActionId(
  HERO_ACTOR_ID,
  SRD_BASIC_ACTION_IDS.HIDE,
  hideDefinition.document.effects[0]!.id
)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The hero walks `squares` 5 ft squares east, then hides; the roll mode the Stealth check asks for. */
async function hideRollModeAfterWalking(squares: number) {
  const bite = biteWolf('ATTACK')
  const fixture = await actionRoom({
    actors: [
      characterActor({ id: HERO_ACTOR_ID, characterId: HERO_ID }),
      srdCreatureActor({ id: OBSERVER_ID, creature: bite, disposition: 'FRIENDLY' })
    ],
    positions: { [HERO_ACTOR_ID]: { x: 150, y: 150 }, [OBSERVER_ID]: { x: 150, y: 950 } },
    // The room's Character is first level; the grants are the SRD feature's own.
    characterClassFeatures: [supremeSneak],
    characterAction: () => true,
    rolls: [],
    fallbackRoll: 10
  })
  if (squares > 0) {
    const moved = await fixture.room.move([
      { x: 150, y: 150 },
      { x: 150 + squares * 100, y: 150 }
    ])
    expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
  }
  const { answer } = await fixture.startAction(
    HERO_ACTOR_ID,
    [],
    null,
    null,
    hideActionId,
    HERO_ACTOR_ID
  )
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const decision = await fixture.pendingDecision()
  if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a d20 request.')
  return decision.pending.request.rollMode
}

describe('a Thief hiding after moving (SPELLS-31.T5n, Supreme Sneak)', () => {
  it.each([
    [0, 'ADVANTAGE'],
    [3, 'ADVANTAGE'],
    [4, 'NORMAL']
  ] as const)(
    'after %i squares of a 30 ft speed the Stealth check is %s',
    async (squares, mode) => {
      expect(await hideRollModeAfterWalking(squares)).toBe(mode)
    },
    90_000
  )
})
