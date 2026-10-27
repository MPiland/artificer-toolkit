import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { parseReceiptExecution, readRoomHistory } from './roomHistoryReads.js'

/**
 * MOVE-4.2 (MOVE-4.T2b2): a climber that wins its climb onto a larger creature moves into that
 * creature's space and clings to it: it moves with the creature and has advantage on attacks
 * against it.
 */

const CLIMBER_ID = testUuid(0xe90)
const MOUNT_ID = testUuid(0xe91)
const CLIMBER_START: ScenePoint = { x: 150, y: 150 }
const MOUNT_START: ScenePoint = { x: 350, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A Small FRIENDLY Wolf whose Bite is an attack, one cell west of a Large HOSTILE Wolf. */
async function climbRoom() {
  const climber = { ...biteWolf('ATTACK'), size: 'SMALL' as const }
  return actionRoom({
    autoRoll: 'BOTH',
    // The climber wins its contest (20 against 1); its Bite then rolls 15s.
    rolls: [19, 0, ...Array.from({ length: 8 }, () => 14)],
    actors: [
      srdCreatureActor({ id: CLIMBER_ID, creature: climber, disposition: 'FRIENDLY' }),
      srdCreatureActor({ id: MOUNT_ID, creature: { ...plainWolf, size: 'LARGE' } })
    ],
    positions: { [CLIMBER_ID]: CLIMBER_START, [MOUNT_ID]: MOUNT_START },
    optionalCombatKinds: ['CLIMB_ONTO_LARGER_CREATURE'],
    ownerFeatureId: creatureFeature(climber, 'Bite').id
  })
}

/** The Scene version a committed answer published. */
function publishedSceneVersion(answer: unknown): number {
  const version = (answer as { delta?: { result?: { version?: unknown } } }).delta?.result?.version
  if (typeof version !== 'number')
    throw new Error(`Expected a Scene publish: ${JSON.stringify(answer)}`)
  return version
}

describe('a won climb onto a larger creature (MOVE-4.2), in the room', () => {
  it('places the climber in the mount’s space, carries it along, and gives it advantage on the mount', async () => {
    const room = await climbRoom()
    const [climberToken, mountToken] = room.room.scene.tokens
    if (!climberToken || !mountToken) throw new Error('The Scene holds both Wolves.')

    // The climber walks east into the mount and climbs it.
    const paused = await room.room.move([CLIMBER_START, { x: 750, y: 150 }])
    const pending = await room.room.pending()
    if (pending?.context.kind !== 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE')
      throw new Error(`Expected a passage choice, got ${pending?.context.kind}.`)
    const climb = pending.context.options.find(
      (option) => option.ruleKind === 'CLIMB_ONTO_LARGER_CREATURE'
    )
    if (!climb) throw new Error('The climb option is missing.')
    const climbed = await room.room.respond({ kind: 'PASSAGE_OPTION', optionId: climb.optionId })

    // The move stops at contact, then the won climb steps the climber into the mount's space.
    expect(await room.room.pending()).toBeNull()
    expect(climbed).toMatchObject({
      type: 'COMMAND_COMMITTED',
      delta: {
        result: {
          version: publishedSceneVersion(paused) + 1,
          delta: { kind: 'TOKEN_MOVED', tokenId: climberToken.id, position: MOUNT_START }
        }
      }
    })
    const { receipts } = await readRoomHistory(room.room.base.stub)
    expect(
      receipts.filter((entry) => entry.commandType === 'RESOLVE_RULE_OCCURRENCE').at(-1)
    ).toMatchObject({
      result: { terminalPosition: MOUNT_START },
      metadata: {
        resolutionCommands: [
          {
            passageContest: {
              actionKind: 'CLIMB_ONTO_LARGER_CREATURE',
              outcome: 'SUCCESS',
              audit: { contact: { x: 250, y: 150 }, enteredPosition: MOUNT_START }
            }
          }
        ]
      }
    })

    // On its turn the mount walks on and carries the clinging climber with it.
    await room.advanceTurn()
    const carried = { x: 550, y: 150 }
    const mountMoved = await room.room.move(
      [MOUNT_START, carried],
      await room.version(),
      publishedSceneVersion(climbed),
      mountToken.id
    )
    expect(mountMoved).toMatchObject({
      type: 'COMMAND_COMMITTED',
      delta: {
        result: {
          delta: {
            kind: 'BATCH',
            deltas: [
              { kind: 'TOKEN_MOVED', tokenId: mountToken.id, position: carried },
              { kind: 'TOKEN_MOVED', tokenId: climberToken.id, position: carried }
            ]
          }
        }
      }
    })
    expect(await room.room.pending()).toBeNull()

    // Back on its turn, the climber bites the mount it clings to with advantage.
    await room.advanceTurn()
    const { command, answer } = await room.startAction(MOUNT_ID, [], {
      sceneId: room.room.scene.id,
      expectedSceneVersion: publishedSceneVersion(mountMoved),
      sourceTokenId: climberToken.id,
      targetTokenId: mountToken.id
    })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const bite = (await readRoomHistory(room.room.base.stub)).receipts.find(
      (entry) => entry.commandId === command.commandId && entry.commandType === 'RESOLVE_ACTION'
    )
    if (!bite) throw new Error('The Bite left no receipt.')
    const execution = parseReceiptExecution(bite)
    if (
      execution.status !== 'COMPLETE' ||
      execution.applicationOutputs.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
    )
      throw new Error('Expected a settled Bite attack.')
    expect(execution.applicationOutputs.d20).toMatchObject({
      rollMode: 'ADVANTAGE',
      contributors: [{ influence: 'ADVANTAGE', source: { kind: 'ACTIVE_EFFECT' } }]
    })
  }, 60_000)
})
