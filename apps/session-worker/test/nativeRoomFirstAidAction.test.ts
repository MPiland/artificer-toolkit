import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { encounterBasicActionId } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import { SRD_MEDICINE_SKILL_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { parseReceiptExecution, readRoomHistory } from './roomHistoryReads.js'

const WOLF_ID = testUuid(0xf00)
const FIGHTER_ACTOR_ID = testUuid(0xf01)
const FIGHTER_ID = testUuid(0xf02)
/** The hostile Wolf's touch cannot be measured in a room without a Scene, as for the Healer's Kit. */
const TOUCH_WITHOUT_SCENE = ['TARGET_DISPOSITION', 'TARGET_RANGE_UNCHECKED']
const firstAidDefinition = SRD_BASIC_ACTION_DEFINITIONS.find(
  ({ id }) => id === SRD_BASIC_ACTION_IDS.FIRST_AID
)
if (firstAidDefinition?.document.kind !== 'BASIC_ACTION')
  throw new Error('Missing First Aid fixture.')
const firstAidEffectId = firstAidDefinition.document.effects[0]!.id
/** The zero-based draw of a d20 that shows `face`. */
const draw = (face: number) => face - 1

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The helper Wolf, whose Wisdom (Medicine) total is +3. */
function medicWolf() {
  const wolf = srdCreatureActor({
    id: WOLF_ID,
    creature: biteWolf('ATTACK', { damage: 1, reachFeet: 5 })
  })
  if (typeof wolf.snapshot !== 'object' || wolf.snapshot === null || Array.isArray(wolf.snapshot))
    throw new Error('The fixture Creature snapshot must be an object.')
  const { ruleFacts } = wolf.snapshot
  if (typeof ruleFacts !== 'object' || ruleFacts === null || Array.isArray(ruleFacts))
    throw new Error('The fixture Creature carries rule facts.')
  return {
    ...wolf,
    snapshot: {
      ...wolf.snapshot,
      ruleFacts: { ...ruleFacts, checkTotals: { [SRD_MEDICINE_SKILL_ID]: 3 } }
    }
  }
}

/** The Wolf acts and gives First Aid to the Fighter, who is at the given hit points. */
function firstAidRoom(options: { currentHitPoints?: number; autoRoll: boolean; faces: number[] }) {
  return actionRoom({
    ...(options.autoRoll ? { autoRoll: 'BOTH' as const } : {}),
    rolls: options.faces.map(draw),
    characterPlay:
      options.currentHitPoints === undefined
        ? undefined
        : { currentHitPoints: options.currentHitPoints },
    actors: [medicWolf(), characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID })],
    ownerFeatureId: creatureFeature(biteWolf('ATTACK', { damage: 1, reachFeet: 5 }), 'Bite').id
  })
}

async function useFirstAid(
  room: Awaited<ReturnType<typeof firstAidRoom>>,
  acknowledgedWarnings: string[] = TOUCH_WITHOUT_SCENE
) {
  return room.startAction(
    FIGHTER_ACTOR_ID,
    acknowledgedWarnings,
    null,
    null,
    encounterBasicActionId(WOLF_ID, SRD_BASIC_ACTION_IDS.FIRST_AID, firstAidEffectId),
    WOLF_ID
  )
}

/** The one basic action check a Run settled: its stored rule execution and the occurrence state. */
async function settledCheck(room: Awaited<ReturnType<typeof firstAidRoom>>) {
  const history = await readRoomHistory(room.room.base.stub)
  const outputs = history.receipts.flatMap((receipt) => {
    const execution = parseReceiptExecution(receipt)
    return execution.status === 'COMPLETE' &&
      execution.applicationOutputs?.kind === 'BASIC_ACTION_CHECK'
      ? [execution.applicationOutputs]
      : []
  })
  return { outputs, occurrences: history.occurrences }
}

describe('First Aid, a System basic action with a check, in the room', () => {
  it('rolls for the helper who rolls automatically, and a roll that reaches the DC makes the dying target stable', async () => {
    const room = await firstAidRoom({ currentHitPoints: 0, autoRoll: true, faces: [20] })
    const { answer } = await useFirstAid(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const { outputs, occurrences } = await settledCheck(room)
    expect(outputs).toMatchObject([
      {
        helperActorId: WOLF_ID,
        targetActorId: FIGHTER_ACTOR_ID,
        check: { dc: 10 },
        d20: { selectedNatural: 20 },
        outcome: 'STABILIZED',
        targetTransition: {
          before: { currentHitPoints: 0, deathSaves: { stable: false } },
          after: { currentHitPoints: 0, deathSaves: { successes: 0, failures: 0, stable: true } }
        }
      }
    ])
    expect(occurrences.map((occurrence) => occurrence.state)).toEqual(['COMPLETED'])
  })

  it('changes nothing for the target when the roll misses the DC, though the Action is spent', async () => {
    const room = await firstAidRoom({ currentHitPoints: 0, autoRoll: true, faces: [1] })
    const before = await room.version()
    const { answer } = await useFirstAid(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await room.version()).toBe(before + 1)

    const { outputs } = await settledCheck(room)
    expect(outputs).toMatchObject([
      { d20: { selectedNatural: 1 }, outcome: 'FAILED', targetTransition: null }
    ])
  })

  it('waits for the helper’s d20 when they roll by hand, then settles the frozen check with it', async () => {
    const room = await firstAidRoom({ currentHitPoints: 0, autoRoll: false, faces: [] })
    const { answer } = await useFirstAid(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect((await settledCheck(room)).outputs).toEqual([])

    const decision = await room.pendingDecision()
    expect(decision.pending).toMatchObject({
      kind: 'D20_EVIDENCE',
      rollerActorId: WOLF_ID,
      trigger: { kind: 'BASIC_ACTION_CHECK', actionLabel: 'First Aid', dc: 10 }
    })
    if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a d20 request.')
    const settled = await room.resolve(decision, {
      kind: 'ENTER_DICE',
      requestId: decision.pending.request.requestId,
      rawFaces: [20],
      rollMode: decision.pending.request.rollMode
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')

    const { outputs, occurrences } = await settledCheck(room)
    expect(outputs).toMatchObject([
      { outcome: 'STABILIZED', targetTransition: { after: { deathSaves: { stable: true } } } }
    ])
    expect(occurrences.map((occurrence) => occurrence.state)).toEqual(['COMPLETED'])
  })

  it('warns, overridably, for a target that is not dying, and then rolls nothing', async () => {
    const room = await firstAidRoom({ autoRoll: true, faces: [20] })
    const refused = await useFirstAid(room)
    expect(refused.answer.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(refused.answer)).toContain('TARGET_NOT_DYING')

    const applied = await useFirstAid(room, [...TOUCH_WITHOUT_SCENE, 'TARGET_NOT_DYING'])
    expect(applied.answer.type, JSON.stringify(applied.answer)).toBe('COMMAND_COMMITTED')
    const { outputs, occurrences } = await settledCheck(room)
    expect(outputs).toEqual([])
    expect(occurrences).toEqual([])
  })
})
