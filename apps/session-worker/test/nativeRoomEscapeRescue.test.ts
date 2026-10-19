import {
  creatureFeature,
  creatureRuleFacts,
  srdCondition,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { encounterRuleUsageSnapshot } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { escapeGrappleEffectDefinition } from '@artificer-toolkit/rules-runtime/testing/escapeGrappleEffectFixture'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { SRD_ATHLETICS_SKILL_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { parseReceiptExecution, readRoomHistory } from './roomHistoryReads.js'

/**
 * ATTACK-7.9: when a grapple's escape allows it, another creature within reach of the held creature
 * spends its own Action on the escape check and frees it. The effect's authored options carry the
 * permission; nothing here names a creature.
 */

const RESCUER_ID = testUuid(0xe40)
const HELD_ID = testUuid(0xe41)
const GRAPPLER_ID = testUuid(0xe42)
const EFFECT_ID = testUuid(0xe43)
const ATHLETICS = SRD_ATHLETICS_SKILL_ID
const DC = 13
const GRAPPLED = srdCondition('Grappled')
/** The zero-based draw of a d20 that shows `face`. */
const draw = (face: number) => face - 1
const ENCOUNTER_COMMAND_FAILED = 'Live Session Encounter command failed in the room.'

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The ally's Athletics total is exactly +4, so a natural 9 reaches the DC. */
function rescuerWolf() {
  const wolf = srdCreatureActor({ id: RESCUER_ID, creature: plainWolf, disposition: 'FRIENDLY' })
  if (typeof wolf.snapshot !== 'object' || wolf.snapshot === null || Array.isArray(wolf.snapshot))
    throw new Error('The fixture Creature snapshot must be an object.')
  return {
    ...wolf,
    snapshot: {
      ...wolf.snapshot,
      ruleFacts: {
        ...creatureRuleFacts({
          STRENGTH: 14,
          DEXTERITY: 10,
          CONSTITUTION: 10,
          INTELLIGENCE: 10,
          WISDOM: 10,
          CHARISMA: 10
        }),
        checkTotals: { [ATHLETICS]: 4 }
      }
    }
  }
}

const NEAR = { x: 150, y: 150 }
const HELD_AT = { x: 250, y: 150 }
const GRAPPLER_AT = { x: 450, y: 150 }
const FAR = { x: 850, y: 150 }

function rescueRoom(options: {
  faces?: number[]
  actorKinds?: ('TARGET' | 'CREATURE_WITHIN_REACH')[]
  rescuerAt?: { x: number; y: number }
  /** The grappler holds the turn instead of the ally. */
  grapplerActs?: boolean
}) {
  const rescuer = rescuerWolf()
  const held = srdCreatureActor({
    id: HELD_ID,
    creature: plainWolf,
    disposition: 'FRIENDLY',
    conditionIds: [GRAPPLED]
  })
  const grappler = srdCreatureActor({ id: GRAPPLER_ID, creature: plainWolf })
  return actionRoom({
    autoRoll: 'BOTH',
    rolls: (options.faces ?? []).map(draw),
    ownerFeatureId: creatureFeature(plainWolf, 'Bite').id,
    actors: options.grapplerActs ? [grappler, rescuer, held] : [rescuer, held, grappler],
    positions: {
      [RESCUER_ID]: options.rescuerAt ?? NEAR,
      [HELD_ID]: HELD_AT,
      [GRAPPLER_ID]: GRAPPLER_AT
    },
    seed: async ({ effects, encounterId, occurredAt }) => {
      await effects.create({
        id: EFFECT_ID,
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: HELD_ID },
        lifecycle: { schemaVersion: 1, remainingTicks: null },
        definition: escapeGrappleEffectDefinition({
          encounterId,
          grapplerId: GRAPPLER_ID,
          conditionIds: [GRAPPLED],
          dc: DC,
          actorKinds: options.actorKinds ?? ['TARGET', 'CREATURE_WITHIN_REACH']
        }),
        occurredAt
      })
    }
  })
}

type RescueRoom = Awaited<ReturnType<typeof rescueRoom>>

async function free(room: RescueRoom, input: { actorId?: string; heldActorId?: string } = {}) {
  return room.send({
    type: 'ESCAPE',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    actorId: input.actorId ?? RESCUER_ID,
    heldActorId: input.heldActorId ?? HELD_ID,
    activeEffectId: EFFECT_ID,
    checkDefinitionId: ATHLETICS,
    acknowledgedWarnings: []
  })
}

/** A refusal the rules make: the member is told only that it could not complete, so read the log. */
async function refusedFree(room: RescueRoom, input?: Parameters<typeof free>[1]) {
  const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const answer = await free(room, input)
  return {
    answer,
    causes: logged.mock.calls
      .filter(([message]) => message === ENCOUNTER_COMMAND_FAILED)
      .map(([, error]) => (error instanceof Error ? error.message : error))
  }
}

async function rescueState(room: RescueRoom) {
  const history = await readRoomHistory(room.room.base.stub)
  const outputs = history.receipts.flatMap((receipt) => {
    const execution = parseReceiptExecution(receipt)
    return execution.status === 'COMPLETE' && execution.applicationOutputs?.kind === 'ESCAPE_CHECK'
      ? [execution.applicationOutputs]
      : []
  })
  const creature = (actorId: string) => {
    const row = history.actors.find((actor) => actor.id === actorId)
    if (!row) throw new Error('The actor left the Run.')
    const actor = readStoredRunActor(row)
    if (actor.kind === 'CHARACTER')
      throw new Error('A Character keeps its conditions on its Sheet.')
    return actor
  }
  const spent = (actorId: string) =>
    Object.values(encounterRuleUsageSnapshot(creature(actorId))).reduce(
      (sum, used) => sum + used,
      0
    )
  return {
    outputs,
    effectIds: history.activeEffects.map((effect) => effect.id),
    heldConditions: z.array(z.string()).parse(creature(HELD_ID).conditions).sort(),
    rescuerSpent: spent(RESCUER_ID),
    heldSpent: spent(HELD_ID)
  }
}

describe('an ally within reach frees a held creature (ATTACK-7.9), in the room', () => {
  it('rolls the ally’s own check on its own Action, and a total that reaches the DC frees the held creature', async () => {
    const room = await rescueRoom({ faces: [9] })
    const answer = await free(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const state = await rescueState(room)
    expect(state.outputs).toMatchObject([
      {
        actorId: RESCUER_ID,
        heldActorId: HELD_ID,
        activeEffectId: EFFECT_ID,
        d20: { selectedNatural: 9, total: 13 },
        outcome: 'ESCAPED',
        removedConditionIds: [GRAPPLED]
      }
    ])
    expect(state.effectIds).toEqual([])
    expect(state.heldConditions).toEqual([])
    expect(state.rescuerSpent).toBe(1)
    expect(state.heldSpent).toBe(0)
  })

  it('keeps the hold when the total misses the DC, though the ally’s Action is spent, and undo returns it', async () => {
    const room = await rescueRoom({ faces: [8] })
    expect((await free(room)).type).toBe('COMMAND_COMMITTED')
    const failed = await rescueState(room)
    expect(failed.outputs).toMatchObject([{ outcome: 'FAILED', removedConditionIds: [] }])
    expect(failed.effectIds).toEqual([EFFECT_ID])
    expect(failed.rescuerSpent).toBe(1)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    const state = await rescueState(room)
    expect(state.rescuerSpent).toBe(0)
    expect(state.effectIds).toEqual([EFFECT_ID])
  })

  it('refuses to undo a rescue that freed the held creature', async () => {
    const room = await rescueRoom({ faces: [20] })
    expect((await free(room)).type).toBe('COMMAND_COMMITTED')
    const refused = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(refused).toMatchObject({ type: 'COMMAND_REJECTED' })
    expect((await rescueState(room)).effectIds).toEqual([])
  })

  it('refuses an ally beyond the hold’s reach, and rolls and spends nothing', async () => {
    const room = await rescueRoom({ faces: [20], rescuerAt: FAR })
    const { answer, causes } = await refusedFree(room)
    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', code: 'UNAVAILABLE' })
    expect(causes).toEqual(['The creature cannot free that creature from this effect.'])
    const state = await rescueState(room)
    expect(state.outputs).toEqual([])
    expect(state.rescuerSpent).toBe(0)
  })

  it('refuses when the effect is not on the named held creature', async () => {
    const room = await rescueRoom({ faces: [20] })
    const { answer, causes } = await refusedFree(room, { heldActorId: GRAPPLER_ID })
    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', code: 'UNAVAILABLE' })
    expect(causes).toEqual(['The creature cannot free that creature from this effect.'])
    expect((await rescueState(room)).effectIds).toEqual([EFFECT_ID])
  })

  it('refuses when the escape does not allow a creature within reach', async () => {
    const room = await rescueRoom({ faces: [20], actorKinds: ['TARGET'] })
    const { answer } = await refusedFree(room)
    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', code: 'UNAVAILABLE' })
    expect((await rescueState(room)).effectIds).toEqual([EFFECT_ID])
  })

  it('refuses the hold’s own source freeing what it holds', async () => {
    const room = await rescueRoom({ faces: [20], grapplerActs: true })
    const { answer } = await refusedFree(room, { actorId: GRAPPLER_ID })
    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', code: 'UNAVAILABLE' })
    expect((await rescueState(room)).effectIds).toEqual([EFFECT_ID])
  })

  it('offers the ally the rescue only while it is within reach and the escape allows it', async () => {
    const near = await rescueRoom({})
    expect((await near.actionChoices()).escapes).toMatchObject([
      { heldActorId: HELD_ID, activeEffectId: EFFECT_ID, dc: DC, actionCost: 'ACTION' }
    ])
    expect((await (await rescueRoom({ rescuerAt: FAR })).actionChoices()).escapes).toEqual([])
    expect((await (await rescueRoom({ actorKinds: ['TARGET'] })).actionChoices()).escapes).toEqual(
      []
    )
  })
})
