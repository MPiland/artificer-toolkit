import {
  creatureFeature,
  currentSrdDefinition,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { encounterBasicActionId } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import {
  SRD_ACROBATICS_SKILL_ID,
  SRD_ATHLETICS_SKILL_ID,
  SRD_DAMAGE_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, withCheckTotals } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { parseReceiptExecution, readActorHitPoints, readRoomHistory } from './roomHistoryReads.js'

const TACKLER_ID = testUuid(0xa90)
const TARGET_ID = testUuid(0xa91)
const TACKLE_ID = testUuid(0xa92)
const TACKLE_EFFECT_ID = testUuid(0xa93)
const BLUDGEONING_ID = SRD_DAMAGE_TYPES.find(({ code }) => code === 'BLUDGEONING')!.id
/** The hostile Wolf's touch cannot be measured in a room without a Scene. */
const TOUCH_WITHOUT_SCENE: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']
const TACKLE_ACTION_ID = encounterBasicActionId(TACKLER_ID, TACKLE_ID, TACKLE_EFFECT_ID)
/** The zero-based draw of a die that shows `face`. */
const draw = (face: number) => face - 1

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * A homebrew Tackle: the SRD Grapple contest, whose win deals `damage` bludgeoning damage to the
 * target instead of holding it (D173).
 */
function tackleDefinition(damage: Record<string, unknown>) {
  const grapple = SRD_BASIC_ACTION_DEFINITIONS.find(({ id }) => id === SRD_BASIC_ACTION_IDS.GRAPPLE)
  if (grapple?.document.kind !== 'BASIC_ACTION') throw new Error('Missing Grapple fixture.')
  const [effect] = grapple.document.effects
  const [path] = effect!.paths
  if (path?.selectionKind !== 'FIXED') throw new Error('Grapple has no fixed result path.')
  const document = {
    ...grapple.document,
    id: TACKLE_ID,
    effects: [
      {
        ...effect!,
        id: TACKLE_EFFECT_ID,
        paths: [
          {
            ...path,
            resultBlock: {
              ...path.resultBlock,
              outcomes: [
                {
                  id: path.resultBlock.outcomes[0]!.id,
                  effectKind: 'DAMAGE' as const,
                  damageTypeId: BLUDGEONING_ID,
                  scalingKind: 'NONE' as const,
                  ...damage
                }
              ]
            }
          }
        ]
      }
    ]
  }
  return currentSrdDefinition({
    ...grapple,
    id: TACKLE_ID,
    label: 'Tackle',
    description: 'A homebrew tackle.',
    document,
    checksum: checksumRuleDocument(document)
  })
}

const FIXED_THREE = tackleDefinition({ valueKind: 'FIXED', amount: 3 })
const ONE_D6 = tackleDefinition({ valueKind: 'DICE', diceConfig: '1d6' })

/**
 * The tackler Wolf (Athletics +5) tackles a Wolf with Athletics +0 and Acrobatics +2. Auto-rolled,
 * the tackler's d20 is drawn first, then the defender's, then the damage dice.
 */
async function tackleRoom(
  definition: typeof FIXED_THREE,
  options: { autoRoll: boolean; faces?: number[] }
) {
  const room = await actionRoom({
    ...(options.autoRoll ? { autoRoll: 'BOTH' as const } : {}),
    rolls: (options.faces ?? []).map(draw),
    definitions: [definition],
    actors: [
      withCheckTotals(srdCreatureActor({ id: TACKLER_ID, creature: plainWolf }), {
        [SRD_ATHLETICS_SKILL_ID]: 5
      }),
      withCheckTotals(srdCreatureActor({ id: TARGET_ID, creature: plainWolf }), {
        [SRD_ATHLETICS_SKILL_ID]: 0,
        [SRD_ACROBATICS_SKILL_ID]: 2
      })
    ],
    ownerFeatureId: creatureFeature(plainWolf, 'Bite').id
  })
  const hitPointsBefore = readActorHitPoints(await readRoomHistory(room.room.base.stub), TARGET_ID)
  return { room, hitPointsBefore }
}

type TackleRoom = Awaited<ReturnType<typeof tackleRoom>>['room']

function tackle(room: TackleRoom) {
  return room.startAction(TARGET_ID, TOUCH_WITHOUT_SCENE, null, null, TACKLE_ACTION_ID, TACKLER_ID)
}

/** The settled contest outputs, the Run's occurrences and the target's hit points. */
async function settled(room: TackleRoom) {
  const history = await readRoomHistory(room.room.base.stub)
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
    targetHitPoints: readActorHitPoints(history, TARGET_ID)
  }
}

/** The receipt of a won Tackle that dealt `amount` bludgeoning damage from `before` hit points. */
function wonWith(amount: number, before: number) {
  return {
    sourceActorId: TACKLER_ID,
    targetActorId: TARGET_ID,
    outcome: 'SOURCE_WIN',
    stateTransition: {
      kind: 'TARGET_OUTCOME',
      mechanics: {
        applications: [
          {
            kind: 'DAMAGE',
            damageTypeId: BLUDGEONING_ID,
            appliedAmount: amount,
            beforeCurrentHitPoints: before,
            afterCurrentHitPoints: before - amount
          }
        ],
        targetTransition: {
          before: { currentHitPoints: before },
          after: { currentHitPoints: before - amount }
        }
      },
      forcedMovements: []
    }
  }
}

describe('a homebrew contest whose win deals damage, in the room (D173)', () => {
  it('deals its fixed damage to a target the tackler beats', async () => {
    // The tackler rolls 12 (+5 = 17); the defender auto-takes Acrobatics +2 and rolls 10 (12).
    const { room, hitPointsBefore } = await tackleRoom(FIXED_THREE, {
      autoRoll: true,
      faces: [12, 10]
    })
    const { answer } = await tackle(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const { outputs, occurrences, targetHitPoints } = await settled(room)
    expect(outputs).toMatchObject([
      {
        sourceRoll: { selectedNatural: 12, total: 17 },
        targetRoll: { selectedNatural: 10, total: 12 },
        ...wonWith(3, hitPointsBefore)
      }
    ])
    expect(occurrences).toEqual(['COMPLETED'])
    expect(targetHitPoints).toBe(hitPointsBefore - 3)
  })

  it('rolls its damage dice in the action roll window when its roller auto-rolls', async () => {
    const { room, hitPointsBefore } = await tackleRoom(ONE_D6, {
      autoRoll: true,
      faces: [12, 10, 4]
    })
    const { answer } = await tackle(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const { outputs, occurrences, targetHitPoints } = await settled(room)
    expect(outputs).toMatchObject([wonWith(4, hitPointsBefore)])
    expect(occurrences).toEqual(['COMPLETED'])
    expect(targetHitPoints).toBe(hitPointsBefore - 4)
  })

  it('deals nothing on a tie, and rolls no damage dice', async () => {
    // 7 + 5 = 12 against the defender's 10 + 2 = 12: a tie goes to the defender.
    const { room, hitPointsBefore } = await tackleRoom(ONE_D6, {
      autoRoll: true,
      faces: [7, 10]
    })
    const { answer } = await tackle(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const { outputs, targetHitPoints } = await settled(room)
    expect(outputs).toMatchObject([
      { outcome: 'TARGET_WIN_OR_TIE', stateTransition: { kind: 'NONE' } }
    ])
    expect(room.room.diceDrawn()).toBe(2)
    expect(targetHitPoints).toBe(hitPointsBefore)
  })

  it('asks the tackler for its damage dice once both checks settle, then deals what it enters', async () => {
    const { room, hitPointsBefore } = await tackleRoom(ONE_D6, { autoRoll: false })
    const { answer } = await tackle(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const initiator = await room.pendingDecision()
    if (initiator.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the tackler’s roll.')
    const first = await room.resolve(initiator, {
      kind: 'ENTER_DICE',
      requestId: initiator.pending.request.requestId,
      rawFaces: [12],
      rollMode: 'NORMAL'
    })
    expect(first.type, JSON.stringify(first)).toBe('COMMAND_COMMITTED')

    const defender = await room.pendingDecision()
    if (defender.pending.kind !== 'CONTEST_CHECK') throw new Error('Expected the defender’s check.')
    const { requestId } = defender.pending
    const second = await room.resolve(defender, {
      kind: 'CONTEST_CHECK',
      requestId,
      checkDefinitionId: SRD_ACROBATICS_SKILL_ID,
      roll: { kind: 'ENTER_DICE', requestId, rawFaces: [10], rollMode: 'NORMAL' }
    })
    expect(second.type, JSON.stringify(second)).toBe('COMMAND_COMMITTED')

    const dice = await room.pendingDecision()
    if (dice.pending.kind !== 'ACTION_OUTCOME_EVIDENCE')
      throw new Error(`Expected the damage die, got ${dice.pending.kind}.`)
    expect(dice.occurrence.id).toBe(initiator.occurrence.id)
    expect(dice.pending).toMatchObject({ rollerActorId: TACKLER_ID, request: { min: 1, max: 6 } })
    expect((await settled(room)).targetHitPoints).toBe(hitPointsBefore)

    const misanswered = await room.resolve(dice, {
      kind: 'CONTEST_CHECK',
      requestId: dice.pending.request.requestId,
      checkDefinitionId: SRD_ATHLETICS_SKILL_ID,
      roll: {
        kind: 'ENTER_DICE',
        requestId: dice.pending.request.requestId,
        rawFaces: [5],
        rollMode: 'NORMAL'
      }
    })
    expect(misanswered.type, JSON.stringify(misanswered)).toBe('COMMAND_REJECTED')

    const third = await room.resolve(dice, {
      kind: 'ENTER_INTEGER',
      requestId: dice.pending.request.requestId,
      value: 5
    })
    expect(third.type, JSON.stringify(third)).toBe('COMMAND_COMMITTED')
    const { outputs, occurrences, targetHitPoints } = await settled(room)
    expect(outputs).toMatchObject([
      {
        sourceRoll: { selectedNatural: 12, total: 17 },
        targetRoll: { selectedNatural: 10, total: 12 },
        ...wonWith(5, hitPointsBefore)
      }
    ])
    expect(occurrences).toEqual(['COMPLETED'])
    expect(targetHitPoints).toBe(hitPointsBefore - 5)
  })
})
