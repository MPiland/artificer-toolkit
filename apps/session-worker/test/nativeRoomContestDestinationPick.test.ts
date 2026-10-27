import {
  creatureFeature,
  currentSrdDefinition,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { encounterBasicActionId } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import { encounterActionPendingContextDtoSchema } from '@artificer-toolkit/schema/shared/encounterActionPending'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import {
  SRD_ACROBATICS_SKILL_ID,
  SRD_ATHLETICS_SKILL_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, withCheckTotals } from './actionRoomFixture.js'
import { tokenPositions } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readPendingActionContext,
  readRoomHistory
} from './roomHistoryReads.js'

const SHOVER_ID = testUuid(0xb40)
const TARGET_ID = testUuid(0xb41)
const NUDGE_ACTION_DEFINITION_ID = testUuid(0xb42)
const NUDGE_EFFECT_ID = testUuid(0xb43)
const NUDGE_OPTION_ID = testUuid(0xb44)
const NUDGE_ACTION_ID = encounterBasicActionId(
  SHOVER_ID,
  NUDGE_ACTION_DEFINITION_ID,
  NUDGE_EFFECT_ID
)
const SHOVER_AT = { x: 150, y: 150 }
const TARGET_AT = { x: 250, y: 150 }
/** The zero-based draw of a d20 that shows `face`. */
const draw = (face: number) => face - 1

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const committed = (answer: { type: string }) =>
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

/**
 * A homebrew Shove whose pick adds a third option that moves the target 5 feet aside: authored data
 * on the contest's won outcome, no option-specific code (MOVE-2.T3a, D157).
 */
function nudgeDefinition() {
  const shove = SRD_BASIC_ACTION_DEFINITIONS.find(({ id }) => id === SRD_BASIC_ACTION_IDS.SHOVE)
  if (shove?.document.kind !== 'BASIC_ACTION') throw new Error('Missing Shove fixture.')
  const [effect] = shove.document.effects
  const [path] = effect!.paths
  if (path?.selectionKind !== 'CHOICE') throw new Error('Shove has no pick.')
  const document = {
    ...shove.document,
    id: NUDGE_ACTION_DEFINITION_ID,
    effects: [
      {
        ...effect!,
        id: NUDGE_EFFECT_ID,
        paths: [
          {
            ...path,
            options: [
              ...path.options,
              {
                id: NUDGE_OPTION_ID,
                order: path.options.length + 1,
                label: 'Nudge 5 feet aside',
                description: 'The target moves 5 feet to a space within your reach.',
                resultBlock: {
                  id: testUuid(0xb45),
                  resultKind: 'SINGLE' as const,
                  outcomes: [
                    {
                      id: testUuid(0xb46),
                      effectKind: 'FORCED_MOVEMENT' as const,
                      direction: 'ASIDE' as const,
                      actionEconomy: 'NONE' as const,
                      distanceMode: 'EXACT' as const,
                      amount: 5,
                      unit: 'FEET' as const
                    }
                  ]
                }
              }
            ]
          }
        ]
      }
    ]
  }
  return currentSrdDefinition({
    ...shove,
    id: NUDGE_ACTION_DEFINITION_ID,
    label: 'Homebrew Shove',
    document,
    checksum: checksumRuleDocument(document)
  })
}

/** The shover Wolf (Athletics +5) beats the adjacent Wolf (Acrobatics +2): 12 + 5 against 10 + 2. */
function nudgeRoom() {
  return actionRoom({
    autoRoll: 'BOTH',
    rolls: [12, 10].map(draw),
    actors: [
      withCheckTotals(srdCreatureActor({ id: SHOVER_ID, creature: plainWolf }), {
        [SRD_ATHLETICS_SKILL_ID]: 5
      }),
      withCheckTotals(srdCreatureActor({ id: TARGET_ID, creature: plainWolf }), {
        [SRD_ATHLETICS_SKILL_ID]: 0,
        [SRD_ACROBATICS_SKILL_ID]: 2
      })
    ],
    positions: { [SHOVER_ID]: SHOVER_AT, [TARGET_ID]: TARGET_AT },
    ownerFeatureId: creatureFeature(plainWolf, 'Bite').id,
    definitions: [nudgeDefinition()]
  })
}

type NudgeRoom = Awaited<ReturnType<typeof nudgeRoom>>

/** The shover wins the contest with the aside pick; the room then waits on the destination. */
async function wonNudge(room: NudgeRoom) {
  const { answer } = await room.startAction(
    TARGET_ID,
    ['TARGET_RANGE_UNCHECKED'],
    null,
    null,
    NUDGE_ACTION_ID,
    SHOVER_ID,
    NUDGE_OPTION_ID
  )
  committed(answer)
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'FORCED_MOVEMENT_DESTINATION')
    throw new Error(`Expected the destination pick, got ${decision.pending.kind}.`)
  return { decision, pending: decision.pending }
}

const byPosition = (left: { x: number; y: number }, right: { x: number; y: number }) =>
  left.x - right.x || left.y - right.y

describe('a won contest whose outcome moves its target aside, in the room (MOVE-2.T3a, D157)', () => {
  it('pauses for the shover to pick a square in reach, then lands the target there and commits the contest', async () => {
    const room = await nudgeRoom()
    const { decision, pending } = await wonNudge(room)

    // The Wolf at x 150 reaches 5 feet; the squares 5 feet from the target inside that reach flank it.
    expect(pending).toMatchObject({ sourceActorId: SHOVER_ID, targetActorId: TARGET_ID })
    expect([...pending.positions].sort(byPosition)).toEqual([
      { x: 150, y: 50 },
      { x: 150, y: 250 },
      { x: 250, y: 50 },
      { x: 250, y: 250 }
    ])
    expect(tokenPositions(room)(TARGET_ID)).toEqual(TARGET_AT)

    committed(
      await room.resolve(decision, {
        kind: 'FORCED_MOVEMENT',
        requestId: pending.requestId,
        position: { x: 250, y: 250 }
      })
    )
    expect(tokenPositions(room)(TARGET_ID)).toEqual({ x: 250, y: 250 })
    expect(tokenPositions(room)(SHOVER_ID)).toEqual(SHOVER_AT)
    expect(await room.room.pending()).toBeNull()

    const history = await readRoomHistory(room.room.base.stub)
    // The contest's own command receipt; the answer's receipt carries the same settled execution.
    const outputs = history.receipts.flatMap((receipt) => {
      if (receipt.commandType !== 'RESOLVE_ACTION') return []
      const execution = parseReceiptExecution(receipt)
      return execution.status === 'COMPLETE' &&
        execution.applicationOutputs?.kind === 'CONTESTED_ACTION'
        ? [execution.applicationOutputs]
        : []
    })
    // The pick resumes the settled contest: its checks keep the faces rolled before the pause.
    expect(outputs).toMatchObject([
      {
        sourceActorId: SHOVER_ID,
        targetActorId: TARGET_ID,
        sourceRoll: { selectedNatural: 12, total: 17 },
        targetRoll: { selectedNatural: 10, total: 12 },
        outcome: 'SOURCE_WIN',
        stateTransition: {
          kind: 'TARGET_OUTCOME',
          mechanics: null,
          forcedMovements: [{ direction: 'ASIDE', feet: 5, upTo: false }]
        }
      }
    ])
    expect(history.occurrences.map(({ state }) => state)).toEqual(['COMPLETED'])
  })

  it('stores the pause as the contest’s destination phase holding the settled outcome', async () => {
    const room = await nudgeRoom()
    const { pending } = await wonNudge(room)

    const context = await readPendingActionContext(room.room.base.stub)
    expect(context).toMatchObject({
      contestPhase: 'DESTINATION',
      rollerActorId: SHOVER_ID,
      d20Policy: null,
      twoPhase: null,
      contest: {
        rollEvidence: { initiator: { rawFaces: [12] }, defender: { rawFaces: [10] } }
      },
      pause: {
        kind: 'FORCED_MOVEMENT',
        payload: {
          targetActorId: TARGET_ID,
          positions: pending.positions,
          completion: { execution: { status: 'COMPLETE' }, d20: null, nestedD20: null }
        }
      }
    })

    // The phase and its pick hold each other: neither stands without the other.
    const parses = (value: unknown) =>
      encounterActionPendingContextDtoSchema.safeParse(value).success
    expect(parses(context)).toBe(true)
    const { pause: _pause, ...withoutPause } = context
    expect(parses(withoutPause)).toBe(false)
    expect(parses({ ...context, contestPhase: 'OUTCOME' })).toBe(false)
    expect(parses({ ...context, contestPhase: 'CHECKS' })).toBe(false)
  })
})
