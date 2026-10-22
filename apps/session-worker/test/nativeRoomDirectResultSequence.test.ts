import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { lesserRestoration } from '@artificer-toolkit/source-data/srd/spells/lesser-restoration.js'
import { longstrider } from '@artificer-toolkit/source-data/srd/spells/longstrider.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorConditionIds, readRoomHistory } from './roomHistoryReads.js'

/**
 * RULES-2.T6h: one action ends the chosen effect and then grants a timed modifier, in authored
 * order, in one undoable command.
 */

const CASTER_ACTOR_ID = testUuid(0x8c0)
const CASTER_ID = testUuid(0x8c1)
const WOLF_ID = testUuid(0x8c2)
const RANGE: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']
const POISONED = srdSystemRecord.conditionTypes.find(({ code }) => code === 'POISONED')!.id

/** Lesser Restoration's END_EFFECTS followed by Longstrider's hour-long speed grant. */
const restoreAndQuicken: SpellAuthored = (() => {
  const spell = structuredClone(lesserRestoration)
  const effect = spell.effects?.[0]
  const path = effect?.paths?.[0]
  const grantPath = longstrider.effects?.[0]?.paths?.[0]
  if (path?.selectionKind !== 'FIXED' || grantPath?.selectionKind !== 'FIXED')
    throw new Error('Both spells author a fixed path.')
  path.groupType = 'SEQUENTIAL'
  path.resultBlock = {
    ...path.resultBlock,
    resultKind: 'SEQUENCE',
    duration: grantPath.resultBlock.duration,
    outcomes: [...path.resultBlock.outcomes, ...structuredClone(grantPath.resultBlock.outcomes)]
  }
  return { ...spell, id: testUuid(0x8c3), label: 'Restore and Quicken' }
})()

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

async function room() {
  const seed = seedModifierGrant({
    sourceActorId: WOLF_ID,
    holderActorId: WOLF_ID,
    lifecycle: {},
    ownedConditionId: POISONED
  })
  return actionRoom({
    actors: [
      characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf, conditionIds: [POISONED] })
    ],
    characterSpellcasting: { spells: [restoreAndQuicken], prepared: [restoreAndQuicken.id] },
    characterAction: (action) => action.label.startsWith(restoreAndQuicken.label),
    seed
  })
}

const held = async (fixture: Awaited<ReturnType<typeof room>>) => {
  const history = await readRoomHistory(fixture.room.base.stub)
  return {
    effectIds: history.activeEffects.map(({ id }) => id).sort(),
    conditionIds: [...readActorConditionIds(history, WOLF_ID)].sort()
  }
}

describe('a cast with several direct results in the room (RULES-2.T6h)', () => {
  it('ends the held effect, then grants the timed modifier, and one undo restores both', async () => {
    const fixture = await room()
    const before = await held(fixture)
    expect(before.effectIds).toHaveLength(1)

    const answer = await fixture.send({
      type: 'RESOLVE_ACTION',
      acceptedWieldConflict: null,
      acknowledgedWarnings: RANGE,
      encounterId: fixture.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await fixture.version(),
      actorId: CASTER_ACTOR_ID,
      target: { kind: 'ACTOR', actorId: WOLF_ID },
      actionId: fixture.actionId,
      optionalCombatIntent: null,
      sceneContext: null
    })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const after = await held(fixture)
    expect(after.effectIds).toHaveLength(1)
    expect(after.effectIds).not.toEqual(before.effectIds)
    expect(after.conditionIds).toEqual([])

    const undone = await fixture.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: fixture.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await fixture.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await held(fixture)).toEqual(before)
  })
})
