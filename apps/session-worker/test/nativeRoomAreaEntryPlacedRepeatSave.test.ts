import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedTimedCondition } from '@artificer-toolkit/rules-runtime/testing/plannedTimedCondition'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { hideousLaughter } from '@artificer-toolkit/source-data/srd/spells/hideous-laughter.js'
import { prismaticSpray } from '@artificer-toolkit/source-data/srd/spells/prismatic-spray.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { answerAllSaves, vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readPendingActionDecision,
  readRoomHistory,
  type RoomHistory
} from './roomHistoryReads.js'

/**
 * QUALITY-14.T2e2b2 (D167): an area places each creature's effect under that creature's entry
 * occurrence, not the area's own. An effect the area placed was not on its holder when the area's
 * damage landed, so it owes no repeat save against that damage; an effect the holder already carried
 * does. The room and persistence both leave out the effects the area's entries placed, at the first
 * plan and when the chain resumes, or the commit refuses the room's chain.
 */

const CASTER_ID = testUuid(0x9e0)
const CHARACTER_ID = testUuid(0x9e1)
const STRUCK_TWICE_ID = testUuid(0x9e2)
const LAUGHING_ID = testUuid(0x9e3)
const LAUGHTER_EFFECT_ID = testUuid(0x9e4)

const RESTRAINED = srdSystemRecord.conditionTypes.find(({ code }) => code === 'RESTRAINED')?.id

/** The origin on the east edge of the caster's token, and a point east of it. */
const EAST = { origin: { x: 200, y: 150 }, toward: { x: 800, y: 150 } }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * A homebrew Prismatic Spray: each damaging ray deals a fixed 3, and the indigo ray restrains for up
 * to a minute until the creature makes its Constitution save, repeated at the end of each of its
 * turns and each time it takes damage. (Violet keeps its own one-time save; it is never rolled here.)
 */
function damageRepeatingSpray(): SpellAuthored {
  const spell = structuredClone(prismaticSpray)
  for (const path of spell.effects?.[0]?.paths ?? []) {
    if (!('rows' in path)) throw new Error('Prismatic Spray resolves by a roll table.')
    for (const row of path.rows) {
      if (row.resolutionKind !== 'RESULT') continue
      if (
        row.resultBlock.outcomes.some(
          (outcome) =>
            outcome.effectKind === 'FOLLOW_UP_SAVE' && outcome.timing === 'TARGET_TURN_END'
        )
      )
        row.resultBlock.duration = {
          id: '00000000-0000-4000-8000-0000000009e6',
          durationKind: 'ROUND' as const,
          amount: 10
        }
      row.resultBlock.outcomes = row.resultBlock.outcomes.map((outcome) =>
        outcome.effectKind === 'DAMAGE'
          ? {
              id: outcome.id,
              effectKind: 'DAMAGE' as const,
              damageTypeId: outcome.damageTypeId,
              ...(outcome.amountKind && { amountKind: outcome.amountKind }),
              scalingKind: 'NONE' as const,
              valueKind: 'FIXED' as const,
              amount: 3
            }
          : outcome.effectKind === 'FOLLOW_UP_SAVE' && outcome.timing === 'TARGET_TURN_END'
            ? {
                ...outcome,
                attempts: { kind: 'ONCE' as const, repeatOnFailure: true },
                onFailure: { kind: 'CONTINUE' as const },
                repeatTriggers: [{ kind: 'DAMAGE_TAKEN' as const, by: 'ANYONE' as const }]
              }
            : outcome
      )
    }
  }
  return {
    ...spell,
    id: '00000000-0000-4000-8000-0000000009e5',
    label: 'Searing Spray'
  }
}

function repeatSaveEffectIds(history: RoomHistory) {
  return history.receipts.flatMap((receipt) => {
    const execution = parseReceiptExecution(receipt)
    return execution.status === 'COMPLETE' &&
      execution.applicationOutputs.kind === 'DAMAGE_SAVE_CHECK' &&
      execution.applicationOutputs.source === 'EFFECT_REPEAT_SAVE'
      ? [execution.applicationOutputs.activeEffect.id]
      : []
  })
}

describe('an area whose ray places an effect that repeats on damage (QUALITY-14.T2e2b2)', () => {
  it('owes no repeat save for the effect its own entry placed, only for the one a holder already carried', async () => {
    const spray = damageRepeatingSpray()
    // The table dice roll themselves, zero-based, in the order the Wolves' rays settle: the first
    // Wolf's d8 lands on 8 and its rerolls on red and indigo; the laughing Wolf's on red.
    const room = await actionRoom({
      rolls: [7, 0, 5, 0],
      actors: [
        {
          ...characterActor({ id: CASTER_ID, characterId: CHARACTER_ID }),
          snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
        },
        srdCreatureActor({ id: STRUCK_TWICE_ID, creature: plainWolf }),
        srdCreatureActor({ id: LAUGHING_ID, creature: plainWolf })
      ],
      characterSpellcasting: { spells: [spray], prepared: [spray.id] },
      characterPlay: { classLevel: 17 },
      characterAction: (action) => action.label.startsWith(spray.label),
      seed: async ({ effects, encounterId, occurredAt }) => {
        const planned = plannedTimedCondition({
          encounterId,
          sourceActorId: CASTER_ID,
          holderActorId: LAUGHING_ID,
          spell: hideousLaughter,
          lifetimeScope: 'ENCOUNTER'
        })
        await effects.create({
          id: LAUGHTER_EFFECT_ID,
          owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: LAUGHING_ID },
          definition: planned.definition,
          lifecycle: planned.lifecycle,
          occurredAt
        })
      }
    })
    const { answer } = await room.startDirectedAreaAction(EAST.origin, EAST.toward)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    await answerAllSaves(room)

    // The Wolf struck twice took the red ray's damage and is restrained by its indigo ray's effect,
    // placed by its own entry in the same command.
    const settled = await readRoomHistory(room.room.base.stub)
    const vitals = (id: string) => vitalsOf(settled).find((entry) => entry.id === id)
    expect(
      ((vitals(STRUCK_TWICE_ID)?.conditions ?? []) as { conditionTypeId: string }[]).map(
        ({ conditionTypeId }) => conditionTypeId
      )
    ).toEqual([RESTRAINED])
    const placed = settled.activeEffects.filter(({ id }) => id !== LAUGHTER_EFFECT_ID)
    expect(placed.map(({ targetActorId }) => targetActorId)).toEqual([STRUCK_TWICE_ID])

    // The one repeat save the damage owes: the Laughter the other Wolf held before the spray.
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a repeat save.')
    const { rollerActorId, request } = decision.pending
    expect(rollerActorId).toBe(LAUGHING_ID)
    const resolved = await room.resolve(decision, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: [1, 1],
      rollMode: request.rollMode
    })
    expect(resolved.type, JSON.stringify(resolved)).toBe('COMMAND_COMMITTED')

    const after = await readRoomHistory(room.room.base.stub)
    expect(repeatSaveEffectIds(after)).toEqual([LAUGHTER_EFFECT_ID])
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(after.activeEffects.map(({ id }) => id).sort()).toEqual(
      [LAUGHTER_EFFECT_ID, ...placed.map(({ id }) => id)].sort()
    )
  }, 120000)
})
