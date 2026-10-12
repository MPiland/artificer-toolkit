import {
  characterActor,
  creatureFeature,
  currentSrdDefinition,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { encounterBasicActionId } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
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

const STEADY_ID = testUuid(0xf10)
const STEADY_EFFECT_ID = testUuid(0xf11)

/** A homebrew basic action on the same CHECK test as First Aid, against a harder DC of 15. */
const steadyDocument = {
  ...firstAidDefinition.document,
  id: STEADY_ID,
  effects: [
    {
      ...firstAidDefinition.document.effects[0]!,
      id: STEADY_EFFECT_ID,
      invocation: {
        ...firstAidDefinition.document.effects[0]!.invocation,
        check: {
          checks: { skillIds: [SRD_MEDICINE_SKILL_ID], abilityDefinitionIds: [] },
          dc: { kind: 'FIXED' as const, value: 15 }
        }
      }
    }
  ]
}
const steadyDefinition = currentSrdDefinition({
  ...firstAidDefinition,
  id: STEADY_ID,
  document: steadyDocument,
  checksum: checksumRuleDocument(steadyDocument)
})

describe('a homebrew basic action authored with the CHECK test, in the room', () => {
  async function useSteady(face: number) {
    const room = await actionRoom({
      autoRoll: 'BOTH',
      rolls: [draw(face)],
      characterPlay: { currentHitPoints: 0 },
      definitions: [steadyDefinition],
      actors: [medicWolf(), characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID })],
      ownerFeatureId: creatureFeature(biteWolf('ATTACK', { damage: 1, reachFeet: 5 }), 'Bite').id
    })
    const { answer } = await room.startAction(
      FIGHTER_ACTOR_ID,
      TOUCH_WITHOUT_SCENE,
      null,
      null,
      encounterBasicActionId(WOLF_ID, STEADY_ID, STEADY_EFFECT_ID),
      WOLF_ID
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    return settledCheck(room)
  }

  it('runs its outcome when the total reaches its own DC', async () => {
    expect((await useSteady(14)).outputs).toMatchObject([
      { check: { dc: 15 }, outcome: 'STABILIZED' }
    ])
  })

  it('runs no outcome and writes no effect when the total falls short, though First Aid’s DC 10 would pass', async () => {
    const { outputs } = await useSteady(10)
    expect(outputs).toMatchObject([
      { check: { dc: 15 }, d20: { selectedNatural: 10 }, outcome: 'FAILED', targetTransition: null }
    ])
  })
})

describe('a Creature feature authored with the CHECK test', () => {
  it('is refused, since only a basic action makes a check, and nothing is spent or written', async () => {
    const attack = biteWolf('ATTACK', { damage: 1, reachFeet: 5 })
    const checkWolf = creatureAuthoredDtoSchema.parse({
      ...attack,
      features: attack.features?.map((feature) =>
        feature.label !== 'Bite'
          ? feature
          : {
              ...feature,
              effects: feature.effects?.map((effect) => ({
                ...effect,
                invocation: {
                  ...effect.invocation,
                  triggerCode: 'CHECK' as const,
                  check: {
                    checks: { skillIds: [SRD_MEDICINE_SKILL_ID], abilityDefinitionIds: [] },
                    dc: { kind: 'FIXED' as const, value: 10 }
                  }
                },
                paths: effect.paths.map((path) => ({ ...path, pathCode: 'ON_CHECK_SUCCESS' }))
              }))
            }
      )
    })
    const room = await actionRoom({
      autoRoll: 'BOTH',
      rolls: [draw(20)],
      characterPlay: { currentHitPoints: 0 },
      actors: [
        srdCreatureActor({ id: WOLF_ID, creature: checkWolf }),
        characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID })
      ],
      ownerFeatureId: creatureFeature(checkWolf, 'Bite').id
    })
    const before = await room.version()
    const { answer } = await room.startAction(FIGHTER_ACTOR_ID, TOUCH_WITHOUT_SCENE)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(answer)).not.toContain('RULE_WARNINGS')
    expect(await room.version()).toBe(before)
    expect((await settledCheck(room)).outputs).toEqual([])
  })
})

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
