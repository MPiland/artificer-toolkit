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
import { SRD_STEALTH_SKILL_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import type { ClassFeature } from '../src/testing/srdCharacterSource.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomRollCards } from './roomHistoryReads.js'

/**
 * SPELLS-31.T5c: Reliable Talent floors a Character's check at 10 in the room only when the check
 * adds the Character's proficiency bonus, and the roll card names the feature.
 */

const HERO_ACTOR_ID = testUuid(0xe70)
const HERO_ID = testUuid(0xe71)
const OBSERVER_ID = testUuid(0xe72)

function srdFeature(
  owners: readonly { label: string; features?: readonly ClassFeature[] }[],
  owner: string,
  label: string
): ClassFeature {
  const found = owners
    .find((entry) => entry.label === owner)
    ?.features?.find((entry) => entry.label === label)
  if (!found) throw new Error(`The SRD ${owner} has no ${label}.`)
  return { ...structuredClone(found), availableAtLevel: 1 }
}

const reliableTalent = srdFeature(srdBaselineContent.subjects.classes, 'Rogue', 'Reliable Talent')
/** Menacing's own skill grant, pointed at Stealth so the Hide check adds proficiency. */
const stealthProficiency = (() => {
  const menacing = srdFeature(srdBaselineContent.subjects.races, 'Half-Orc', 'Menacing')
  const [grant] = menacing.grants?.proficiencies ?? []
  if (grant?.proficiencyKind !== 'SKILL' || !('skillIds' in grant))
    throw new Error('Menacing must grant a skill proficiency.')
  return {
    ...menacing,
    id: testUuid(0xe73),
    label: 'Stealth Training',
    grants: { proficiencies: [{ ...grant, id: testUuid(0xe74), skillIds: [SRD_STEALTH_SKILL_ID] }] }
  }
})()

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

/** The hero hides and the GM enters `face` for its Stealth check; the room's roll card. */
async function hideWith(features: readonly ClassFeature[], face: number) {
  const fixture = await actionRoom({
    actors: [
      characterActor({ id: HERO_ACTOR_ID, characterId: HERO_ID }),
      srdCreatureActor({ id: OBSERVER_ID, creature: biteWolf('ATTACK'), disposition: 'FRIENDLY' })
    ],
    positions: { [HERO_ACTOR_ID]: { x: 150, y: 150 }, [OBSERVER_ID]: { x: 150, y: 950 } },
    characterClassFeatures: features,
    characterAction: () => true,
    rolls: []
  })
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
  const { request } = decision.pending
  const resolved = await fixture.resolve(decision, {
    kind: 'ENTER_DICE',
    requestId: request.requestId,
    rawFaces: request.rollMode === 'NORMAL' ? [face] : [face, face],
    rollMode: request.rollMode
  })
  expect(resolved.type, JSON.stringify(resolved)).toBe('COMMAND_COMMITTED')
  const [card] = await readRoomRollCards(fixture.room.base.stub)
  return card
}

describe('a Character with Reliable Talent hiding (SPELLS-31.T5c)', () => {
  it('counts a d20 of 1 as 10 on a proficient Stealth check, under Reliable Talent', async () => {
    const card = await hideWith([reliableTalent, stealthProficiency], 1)
    expect(card?.roll.ruleCheck).toEqual({
      kind: 'D20_MINIMUM_ROLL',
      amount: 10,
      label: 'Reliable Talent'
    })
  }, 90_000)

  it('leaves a Stealth check without proficiency as rolled', async () => {
    const card = await hideWith([reliableTalent], 1)
    expect(card?.roll.ruleCheck).toBeUndefined()
  }, 90_000)
})
