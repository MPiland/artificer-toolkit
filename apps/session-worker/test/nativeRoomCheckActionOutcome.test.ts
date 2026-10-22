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
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES,
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
  readActorHitPoints,
  readRoomHistory
} from './roomHistoryReads.js'

const STRIKER_ID = testUuid(0xc90)
const TARGET_ID = testUuid(0xc91)
const STRIKE_ID = testUuid(0xc92)
const STRIKE_EFFECT_ID = testUuid(0xc93)
const BLUDGEONING_ID = SRD_DAMAGE_TYPES.find(({ code }) => code === 'BLUDGEONING')!.id
const PRONE_ID = SRD_CONDITION_TYPES.find(({ code }) => code === 'PRONE')!.id
/** First Aid's touch targets a willing creature, and a room without a Scene cannot measure it. */
const HOSTILE_TOUCH: EncounterRuleWarningCodeDto[] = [
  'TARGET_DISPOSITION',
  'TARGET_RANGE_UNCHECKED'
]
const STRIKE_ACTION_ID = encounterBasicActionId(STRIKER_ID, STRIKE_ID, STRIKE_EFFECT_ID)
/** The zero-based draw of a die that shows `face`. */
const draw = (face: number) => face - 1

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * A homebrew Pressure Point: First Aid's DC 10 Medicine check, whose success runs the given
 * outcomes on the target instead of stabilizing it (D173).
 */
function strikeDefinition(outcomes: Record<string, unknown>[]) {
  const firstAid = SRD_BASIC_ACTION_DEFINITIONS.find(
    ({ id }) => id === SRD_BASIC_ACTION_IDS.FIRST_AID
  )
  if (firstAid?.document.kind !== 'BASIC_ACTION') throw new Error('Missing First Aid fixture.')
  const [effect] = firstAid.document.effects
  const [path] = effect!.paths
  if (path?.selectionKind !== 'FIXED') throw new Error('First Aid has no fixed result path.')
  const document = {
    ...firstAid.document,
    id: STRIKE_ID,
    effects: [
      {
        ...effect!,
        id: STRIKE_EFFECT_ID,
        paths: [
          {
            ...path,
            resultBlock: {
              ...path.resultBlock,
              outcomes: outcomes.map((outcome, index) => ({
                id: testUuid(0xca0 + index),
                ...outcome
              }))
            }
          }
        ]
      }
    ]
  }
  return currentSrdDefinition({
    ...firstAid,
    id: STRIKE_ID,
    label: 'Pressure Point',
    description: 'A homebrew pressure point.',
    document,
    checksum: checksumRuleDocument(document)
  })
}

const bludgeoning = (damage: Record<string, unknown>) => ({
  effectKind: 'DAMAGE' as const,
  damageTypeId: BLUDGEONING_ID,
  scalingKind: 'NONE' as const,
  ...damage
})
const FIXED_THREE = strikeDefinition([bludgeoning({ valueKind: 'FIXED', amount: 3 })])
const PRONE = strikeDefinition([{ effectKind: 'CONDITION', conditionId: PRONE_ID }])
const ONE_D6 = strikeDefinition([bludgeoning({ valueKind: 'DICE', diceConfig: '1d6' })])

/** The striker Wolf (Medicine +3) strikes a plain Wolf. Its d20 is drawn first, then the damage. */
async function strikeRoom(
  definition: typeof ONE_D6,
  options: { autoRoll: boolean; faces?: number[] }
) {
  const room = await actionRoom({
    ...(options.autoRoll ? { autoRoll: 'BOTH' as const } : {}),
    rolls: (options.faces ?? []).map(draw),
    definitions: [definition],
    actors: [
      withCheckTotals(srdCreatureActor({ id: STRIKER_ID, creature: plainWolf }), {
        [SRD_MEDICINE_SKILL_ID]: 3
      }),
      srdCreatureActor({ id: TARGET_ID, creature: plainWolf })
    ],
    ownerFeatureId: creatureFeature(plainWolf, 'Bite').id
  })
  const hitPointsBefore = readActorHitPoints(await readRoomHistory(room.room.base.stub), TARGET_ID)
  return { room, hitPointsBefore }
}

type StrikeRoom = Awaited<ReturnType<typeof strikeRoom>>['room']

function strike(room: StrikeRoom) {
  return room.startAction(TARGET_ID, HOSTILE_TOUCH, null, null, STRIKE_ACTION_ID, STRIKER_ID)
}

/** The settled check action outputs, the Run's occurrences and the target's state. */
async function settled(room: StrikeRoom) {
  const history = await readRoomHistory(room.room.base.stub)
  const outputs = history.receipts.flatMap((receipt) => {
    if (receipt.commandType !== 'RESOLVE_ACTION') return []
    const execution = parseReceiptExecution(receipt)
    return execution.status === 'COMPLETE' && execution.applicationOutputs?.kind === 'CHECK_ACTION'
      ? [execution.applicationOutputs]
      : []
  })
  return {
    outputs,
    occurrences: history.occurrences.map(({ state }) => state),
    targetHitPoints: readActorHitPoints(history, TARGET_ID),
    targetConditionIds: readActorConditionIds(history, TARGET_ID)
  }
}

/** The receipt of a successful strike that dealt `amount` bludgeoning damage from `before`. */
function succeededWith(amount: number, before: number) {
  return {
    actorId: STRIKER_ID,
    targetActorId: TARGET_ID,
    check: { checkDefinitionId: SRD_MEDICINE_SKILL_ID, dc: 10 },
    outcome: 'SUCCESS',
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

describe('a homebrew fixed-DC check whose success runs its outcome, in the room (D173)', () => {
  it('deals its fixed damage when the check reaches the DC', async () => {
    // 12 + 3 = 15 against DC 10.
    const { room, hitPointsBefore } = await strikeRoom(FIXED_THREE, { autoRoll: true, faces: [12] })
    const { answer } = await strike(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const { outputs, occurrences, targetHitPoints } = await settled(room)
    expect(outputs).toMatchObject([
      { d20: { selectedNatural: 12, total: 15 }, ...succeededWith(3, hitPointsBefore) }
    ])
    expect(occurrences).toEqual(['COMPLETED'])
    expect(targetHitPoints).toBe(hitPointsBefore - 3)
  })

  it('applies its condition when the check reaches the DC', async () => {
    const { room, hitPointsBefore } = await strikeRoom(PRONE, { autoRoll: true, faces: [12] })
    expect(
      readActorConditionIds(await readRoomHistory(room.room.base.stub), TARGET_ID)
    ).not.toContain(PRONE_ID)
    const { answer } = await strike(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const { outputs, occurrences, targetHitPoints, targetConditionIds } = await settled(room)
    expect(outputs).toMatchObject([
      {
        outcome: 'SUCCESS',
        stateTransition: { kind: 'TARGET_OUTCOME', mechanics: { applications: [{}] } }
      }
    ])
    expect(occurrences).toEqual(['COMPLETED'])
    expect(targetConditionIds).toContain(PRONE_ID)
    expect(targetHitPoints).toBe(hitPointsBefore)
  })

  it('rolls its damage dice for a roller who auto-rolls', async () => {
    const { room, hitPointsBefore } = await strikeRoom(ONE_D6, { autoRoll: true, faces: [12, 4] })
    const { answer } = await strike(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const { outputs, occurrences, targetHitPoints } = await settled(room)
    expect(outputs).toMatchObject([succeededWith(4, hitPointsBefore)])
    expect(occurrences).toEqual(['COMPLETED'])
    expect(targetHitPoints).toBe(hitPointsBefore - 4)
  })

  it('runs nothing on a miss, and rolls no damage dice', async () => {
    // 3 + 3 = 6 against DC 10.
    const { room, hitPointsBefore } = await strikeRoom(ONE_D6, { autoRoll: true, faces: [3] })
    const { answer } = await strike(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const { outputs, targetHitPoints } = await settled(room)
    expect(outputs).toMatchObject([
      {
        d20: { selectedNatural: 3, total: 6 },
        outcome: 'FAILURE',
        stateTransition: { kind: 'NONE' }
      }
    ])
    expect(room.room.diceDrawn()).toBe(1)
    expect(targetHitPoints).toBe(hitPointsBefore)
  })

  it('refuses a roller whose preference does not roll for them, until the check can pend', async () => {
    const { room, hitPointsBefore } = await strikeRoom(ONE_D6, { autoRoll: false })
    const before = await room.version()
    const { answer } = await strike(room)
    expect(answer.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(answer)).toContain(
      'This check action rolls only for a roller whose preference rolls for them.'
    )
    expect(answer).toMatchObject({ code: 'DOMAIN_REJECTED', reason: 'SOURCE_REQUIREMENTS_NOT_MET' })
    expect(await room.version()).toBe(before)
    expect((await settled(room)).targetHitPoints).toBe(hitPointsBefore)
  })
})
