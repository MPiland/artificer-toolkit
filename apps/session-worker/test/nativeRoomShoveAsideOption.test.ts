import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { encounterBasicActionId } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
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
import { parseReceiptExecution, readRoomHistory } from './roomHistoryReads.js'

const SHOVER_ID = testUuid(0xb50)
const TARGET_ID = testUuid(0xb51)
const SHOVER_AT = { x: 150, y: 150 }
const TARGET_AT = { x: 250, y: 150 }
const ASIDE = 'Shove 5 feet aside'
const shoveDefinition = SRD_BASIC_ACTION_DEFINITIONS.find(
  ({ id }) => id === SRD_BASIC_ACTION_IDS.SHOVE
)
if (shoveDefinition?.document.kind !== 'BASIC_ACTION') throw new Error('Missing Shove fixture.')
const SHOVE_ACTION_ID = encounterBasicActionId(
  SHOVER_ID,
  SRD_BASIC_ACTION_IDS.SHOVE,
  shoveDefinition.document.effects[0]!.id
)
const [shovePath] = shoveDefinition.document.effects[0]!.paths
if (shovePath?.selectionKind !== 'CHOICE') throw new Error('Shove has no pick.')
const ASIDE_OPTION_ID = shovePath.options.find(({ label }) => label === ASIDE)!.id
/** The zero-based draw of a d20 that shows `face`. */
const draw = (face: number) => face - 1

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * The shover Wolf (Athletics +5) shoves the adjacent Wolf (Acrobatics +2); a token is 100 px, a cell
 * 5 ft. At disadvantage the shover draws 18 and 12 and keeps 12 (17), against the defender's 10 (12).
 */
function shoveRoom(shoveAside: boolean) {
  return actionRoom({
    autoRoll: 'BOTH',
    rolls: [18, 12, 10].map(draw),
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
    ...(shoveAside && { optionalCombatKinds: ['SHOVE_ASIDE' as const] })
  })
}

type ShoveRoom = Awaited<ReturnType<typeof shoveRoom>>

async function offeredOptions(room: ShoveRoom) {
  const choices = await room.actionChoices(SHOVER_ID)
  const shove = choices.basicActionChoices.find(({ id }) => id === SHOVE_ACTION_ID)
  return shove?.target && 'choiceOptions' in shove.target ? shove.target.choiceOptions : []
}

const shoveAside = (room: ShoveRoom) =>
  room.startAction(
    TARGET_ID,
    ['TARGET_RANGE_UNCHECKED'],
    null,
    null,
    SHOVE_ACTION_ID,
    SHOVER_ID,
    ASIDE_OPTION_ID
  )

const byPosition = (left: { x: number; y: number }, right: { x: number; y: number }) =>
  left.x - right.x || left.y - right.y

describe('the SRD Shove’s 5 feet aside under the Shove Aside rule, in the room (MOVE-2.T3b, D157)', () => {
  it('neither offers nor runs the aside pick while the Encounter does not use the rule', async () => {
    const room = await shoveRoom(false)
    expect((await offeredOptions(room))?.map(({ label }) => label)).toEqual([
      'Knock prone',
      'Push 5 feet away'
    ])
    const before = await readRoomHistory(room.room.base.stub)

    const { answer } = await shoveAside(room)
    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'TARGET_UNAVAILABLE' })
    expect((await readRoomHistory(room.room.base.stub)).receipts).toEqual(before.receipts)
    expect(tokenPositions(room)(TARGET_ID)).toEqual(TARGET_AT)
  })

  it('offers the pick under the rule, rolls the shover at disadvantage, and lands the target on the picked square in reach', async () => {
    const room = await shoveRoom(true)
    const options = await offeredOptions(room)
    expect(options?.map(({ label }) => label)).toEqual(['Knock prone', 'Push 5 feet away', ASIDE])

    const { answer } = await shoveAside(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'FORCED_MOVEMENT_DESTINATION')
      throw new Error(`Expected the destination pick, got ${decision.pending.kind}.`)
    const { pending } = decision

    // The squares 5 feet from the target that stay inside the Wolf's 5-foot reach flank it.
    expect(pending).toMatchObject({ sourceActorId: SHOVER_ID, targetActorId: TARGET_ID })
    expect([...pending.positions].sort(byPosition)).toEqual([
      { x: 150, y: 50 },
      { x: 150, y: 250 },
      { x: 250, y: 50 },
      { x: 250, y: 250 }
    ])
    expect(tokenPositions(room)(TARGET_ID)).toEqual(TARGET_AT)

    const picked = await room.resolve(decision, {
      kind: 'FORCED_MOVEMENT',
      requestId: pending.requestId,
      position: { x: 250, y: 50 }
    })
    expect(picked.type, JSON.stringify(picked)).toBe('COMMAND_COMMITTED')
    expect(tokenPositions(room)(TARGET_ID)).toEqual({ x: 250, y: 50 })
    expect(tokenPositions(room)(SHOVER_ID)).toEqual(SHOVER_AT)
    expect(await room.room.pending()).toBeNull()

    const history = await readRoomHistory(room.room.base.stub)
    const outputs = history.receipts.flatMap((receipt) => {
      if (receipt.commandType !== 'RESOLVE_ACTION') return []
      const execution = parseReceiptExecution(receipt)
      return execution.status === 'COMPLETE' &&
        execution.applicationOutputs?.kind === 'CONTESTED_ACTION'
        ? [execution.applicationOutputs]
        : []
    })
    expect(outputs).toMatchObject([
      {
        sourceActorId: SHOVER_ID,
        targetActorId: TARGET_ID,
        sourceRoll: { rawFaces: [18, 12], selectedNatural: 12, total: 17 },
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
})
