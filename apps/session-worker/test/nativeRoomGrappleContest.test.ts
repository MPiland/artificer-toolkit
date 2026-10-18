import {
  creatureFeature,
  srdCondition,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { encounterBasicActionId } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import {
  SRD_ACROBATICS_SKILL_ID,
  SRD_ATHLETICS_SKILL_ID,
  SRD_MEDICINE_SKILL_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, withCheckTotals } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readActorConditionIds,
  readRoomHistory
} from './roomHistoryReads.js'

const GRAPPLER_ID = testUuid(0xa70)
const TARGET_ID = testUuid(0xa71)
const GRAPPLED = srdCondition('Grappled')
/** The hostile Wolf's touch cannot be measured in a room without a Scene. */
const TOUCH_WITHOUT_SCENE: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']
const grappleDefinition = SRD_BASIC_ACTION_DEFINITIONS.find(
  ({ id }) => id === SRD_BASIC_ACTION_IDS.GRAPPLE
)
if (grappleDefinition?.document.kind !== 'BASIC_ACTION') throw new Error('Missing Grapple fixture.')
const grappleEffectId = grappleDefinition.document.effects[0]!.id
const GRAPPLE_ACTION_ID = encounterBasicActionId(
  GRAPPLER_ID,
  SRD_BASIC_ACTION_IDS.GRAPPLE,
  grappleEffectId
)
/** The zero-based draw of a d20 that shows `face`. */
const draw = (face: number) => face - 1

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * The grappler Wolf (Athletics +5) grapples a Wolf with Athletics +0 and Acrobatics +2. The
 * grappler's d20 is drawn first, then the defender's.
 */
function grappleRoom(options: { autoRoll: boolean; faces?: number[] }) {
  return actionRoom({
    ...(options.autoRoll ? { autoRoll: 'BOTH' as const } : {}),
    rolls: (options.faces ?? []).map(draw),
    actors: [
      withCheckTotals(srdCreatureActor({ id: GRAPPLER_ID, creature: plainWolf }), {
        [SRD_ATHLETICS_SKILL_ID]: 5
      }),
      withCheckTotals(srdCreatureActor({ id: TARGET_ID, creature: plainWolf }), {
        [SRD_ATHLETICS_SKILL_ID]: 0,
        [SRD_ACROBATICS_SKILL_ID]: 2
      })
    ],
    ownerFeatureId: creatureFeature(plainWolf, 'Bite').id
  })
}

type GrappleRoom = Awaited<ReturnType<typeof grappleRoom>>

function grapple(room: GrappleRoom) {
  return room.startAction(
    TARGET_ID,
    TOUCH_WITHOUT_SCENE,
    null,
    null,
    GRAPPLE_ACTION_ID,
    GRAPPLER_ID
  )
}

/** The settled contest outputs and what the target now holds. */
async function settled(room: GrappleRoom) {
  const history = await readRoomHistory(room.room.base.stub)
  // The root action's receipt owns the output; a prompted roll's evidence receipts echo it.
  const outputs = history.receipts.flatMap((receipt) => {
    if (receipt.commandType !== 'RESOLVE_ACTION') return []
    const execution = parseReceiptExecution(receipt)
    return execution.status === 'COMPLETE' &&
      execution.applicationOutputs?.kind === 'CONTESTED_ACTION'
      ? [execution.applicationOutputs]
      : []
  })
  return {
    outputs,
    occurrences: history.occurrences.map(({ state }) => state),
    targetConditions: readActorConditionIds(history, TARGET_ID),
    targetEffects: history.activeEffects.filter(({ targetActorId }) => targetActorId === TARGET_ID)
  }
}

describe('Grapple, a basic action contested by the target, in the room (ATTACK-7 AC 7.1)', () => {
  it('holds a target the grappler beats: the target is Grappled by a hold effect', async () => {
    // The grappler rolls 12 (+5 = 17); the defender auto-takes Acrobatics +2 and rolls 10 (12).
    const room = await grappleRoom({ autoRoll: true, faces: [12, 10] })
    const { answer } = await grapple(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const { outputs, occurrences, targetConditions, targetEffects } = await settled(room)
    expect(outputs).toMatchObject([
      {
        sourceActorId: GRAPPLER_ID,
        targetActorId: TARGET_ID,
        policy: null,
        sourceRoll: { actorId: GRAPPLER_ID, selectedNatural: 12, modifier: 5, total: 17 },
        targetRoll: { actorId: TARGET_ID, selectedNatural: 10, modifier: 2, total: 12 },
        outcome: 'SOURCE_WIN',
        stateTransition: { kind: 'ACTOR_RELATIONSHIP', appliedConditionIds: [GRAPPLED] }
      }
    ])
    expect(occurrences).toEqual(['COMPLETED'])
    expect(targetConditions).toContain(GRAPPLED)
    expect(targetEffects).toHaveLength(1)
    const [output] = outputs
    if (output?.stateTransition.kind !== 'ACTOR_RELATIONSHIP')
      throw new Error('Expected the hold effect.')
    expect(targetEffects[0]!.id).toBe(output.stateTransition.createdEffect.activeEffectId)
  })

  it('holds nothing when the defender ties, yet the grappler’s attack is spent', async () => {
    // 7 + 5 = 12 against the defender's 10 + 2 = 12: a tie goes to the defender.
    const room = await grappleRoom({ autoRoll: true, faces: [7, 10, 20, 1] })
    const { answer } = await grapple(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const { outputs, targetConditions, targetEffects } = await settled(room)
    expect(outputs).toMatchObject([
      { outcome: 'TARGET_WIN_OR_TIE', stateTransition: { kind: 'NONE' } }
    ])
    expect(targetConditions).not.toContain(GRAPPLED)
    expect(targetEffects).toEqual([])

    const again = await grapple(room)
    expect(again.answer.type, JSON.stringify(again.answer)).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(again.answer)).toContain('ACTION_ECONOMY_UNAVAILABLE')
  })

  it('asks the grappler, then lets the defender pick a sealed check and roll it in one answer', async () => {
    const room = await grappleRoom({ autoRoll: false })
    const { answer } = await grapple(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const initiator = await room.pendingDecision()
    if (initiator.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the grappler’s roll.')
    expect(initiator.pending.rollerActorId).toBe(GRAPPLER_ID)
    const first = await room.resolve(initiator, {
      kind: 'ENTER_DICE',
      requestId: initiator.pending.request.requestId,
      rawFaces: [8],
      rollMode: 'NORMAL'
    })
    expect(first.type, JSON.stringify(first)).toBe('COMMAND_COMMITTED')

    const defender = await room.pendingDecision()
    if (defender.pending.kind !== 'CONTEST_CHECK') throw new Error('Expected the defender’s check.')
    expect(defender.occurrence.id).toBe(initiator.occurrence.id)
    expect(defender.pending).toMatchObject({
      rollerActorId: TARGET_ID,
      actionLabel: 'Grapple',
      checks: [
        { checkDefinitionId: SRD_ACROBATICS_SKILL_ID, rollMode: 'NORMAL' },
        { checkDefinitionId: SRD_ATHLETICS_SKILL_ID, rollMode: 'NORMAL' }
      ]
    })
    const { requestId } = defender.pending
    const roll = { kind: 'ENTER_DICE', requestId, rawFaces: [13], rollMode: 'NORMAL' }

    const unsealed = await room.resolve(defender, {
      kind: 'CONTEST_CHECK',
      requestId,
      checkDefinitionId: SRD_MEDICINE_SKILL_ID,
      roll
    })
    expect(unsealed.type, JSON.stringify(unsealed)).toBe('COMMAND_REJECTED')

    // Athletics: 13 + 0 = 13 against the grappler's 8 + 5 = 13, a tie the defender wins.
    const second = await room.resolve(defender, {
      kind: 'CONTEST_CHECK',
      requestId,
      checkDefinitionId: SRD_ATHLETICS_SKILL_ID,
      roll
    })
    expect(second.type, JSON.stringify(second)).toBe('COMMAND_COMMITTED')
    const { outputs, occurrences, targetConditions } = await settled(room)
    expect(outputs).toMatchObject([
      {
        sourceRoll: { total: 13 },
        targetRoll: { selectedNatural: 13, modifier: 0, total: 13 },
        outcome: 'TARGET_WIN_OR_TIE'
      }
    ])
    expect(occurrences).toEqual(['COMPLETED'])
    expect(targetConditions).not.toContain(GRAPPLED)
  })
})
