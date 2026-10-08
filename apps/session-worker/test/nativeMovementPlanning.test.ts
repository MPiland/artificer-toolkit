import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf, reactionWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  CONCENTRATION_STATE_ID,
  movementRoom,
  type MovementRoomConfig
} from './movementRoomFixture.js'

const MOVER_ID = testUuid(0x200)
const REACTOR_A_ID = testUuid(0x201)
const REACTOR_B_ID = testUuid(0x202)
const REACTOR_C_ID = testUuid(0x203)
const BLOCKER_ID = testUuid(0x301)
const LATER_BLOCKER_ID = testUuid(0x302)
const CHARACTER_ID = testUuid(0x400)

const MOVER_START: ScenePoint = { x: 150, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

type Room = Awaited<ReturnType<typeof movementRoom>>

/** The one PENDING reaction decision, which the movement planner raised for the mover's walk. */
async function reactionDecision(room: Room) {
  const pending = await room.pending()
  if (pending?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
    throw new Error(`Expected a reaction decision, got ${pending?.context.kind}.`)
  return pending.context
}

async function passageOptions(room: Room) {
  const pending = await room.pending()
  if (pending?.context.kind !== 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE')
    throw new Error(`Expected a passage choice, got ${pending?.context.kind}.`)
  return pending.context.options
}

async function resolvedReceipt(room: Room, commandType: string) {
  const receipt = (await room.receipts())
    .filter((entry) => entry.commandType === commandType)
    .at(-1)
  if (!receipt) throw new Error(`No ${commandType} receipt was committed.`)
  return receipt
}

describe('movement reactions', () => {
  /** FRIENDLY Wolves whose Bite is an opportunity attack, around a HOSTILE Wolf walking east. */
  function reactionRoom(
    reactorIds: readonly string[],
    positions: Record<string, ScenePoint>,
    extra: Partial<MovementRoomConfig> = {}
  ) {
    const mover = srdCreatureActor({ id: MOVER_ID, creature: plainWolf })
    const reactors = reactorIds.map((id) =>
      srdCreatureActor({ id, creature: reactionWolf, disposition: 'FRIENDLY' })
    )
    return movementRoom({
      actors: [...reactors, mover],
      moverActorId: MOVER_ID,
      positions: { ...positions, [MOVER_ID]: MOVER_START },
      ...extra
    })
  }

  const east = [MOVER_START, { x: 750, y: 150 }]

  it('orders reactions that fall at the same distance by reactor identity, whatever the capture order', async () => {
    // Two reactors mirrored about the path: each loses the mover at the same point.
    const room = await reactionRoom([REACTOR_B_ID, REACTOR_A_ID], {
      [REACTOR_A_ID]: { x: 150, y: 50 },
      [REACTOR_B_ID]: { x: 150, y: 250 }
    })

    await room.move(east)

    const { reactionTimeline } = await reactionDecision(room)
    expect(reactionTimeline.map((entry) => entry.group.reactorActorId)).toEqual([
      REACTOR_A_ID,
      REACTOR_B_ID
    ])
  })

  it('offers the reactor the mover leaves first before those it leaves later', async () => {
    // C stands behind the mover, so the mover leaves C's reach before it leaves A's.
    const room = await reactionRoom([REACTOR_A_ID, REACTOR_C_ID], {
      [REACTOR_A_ID]: { x: 150, y: 50 },
      [REACTOR_C_ID]: { x: 50, y: 150 }
    })

    await room.move(east)

    const { reactionTimeline } = await reactionDecision(room)
    expect(reactionTimeline.map((entry) => entry.group.reactorActorId)).toEqual([
      REACTOR_C_ID,
      REACTOR_A_ID
    ])
  })

  it('asks each reactor in order as the earlier ones decline', async () => {
    const room = await reactionRoom([REACTOR_B_ID, REACTOR_A_ID, REACTOR_C_ID], {
      [REACTOR_A_ID]: { x: 150, y: 50 },
      [REACTOR_B_ID]: { x: 150, y: 250 },
      [REACTOR_C_ID]: { x: 50, y: 150 }
    })
    await room.move(east)

    const asked: string[] = []
    while (await room.pending()) {
      expect(asked.length, 'A reaction decision never cleared.').toBeLessThan(5)
      const { reactionTimeline } = await reactionDecision(room)
      asked.push(reactionTimeline[0]!.group.reactorActorId)
      await room.respond({ kind: 'DECLINE' })
    }

    expect(asked).toEqual([REACTOR_C_ID, REACTOR_A_ID, REACTOR_B_ID])
    expect(await resolvedReceipt(room, 'RESOLVE_RULE_OCCURRENCE')).toMatchObject({
      result: { terminalPosition: east[1] }
    })
  })

  it('refuses a move that holds an older Encounter version as VERSION_STALE, without writing', async () => {
    const room = await reactionRoom([REACTOR_A_ID], { [REACTOR_A_ID]: { x: 150, y: 50 } })

    const refused = await room.move(east, 0)

    expect(refused).toMatchObject({
      type: 'COMMAND_REJECTED',
      code: 'DOMAIN_REJECTED',
      reason: 'VERSION_STALE'
    })
    expect(await room.pending()).toBeNull()
    expect(await room.receipts()).toEqual([])
  })

  it('refuses a response that holds an older occurrence version as VERSION_STALE, without writing', async () => {
    const room = await reactionRoom([REACTOR_A_ID, REACTOR_C_ID], {
      [REACTOR_A_ID]: { x: 150, y: 50 },
      [REACTOR_C_ID]: { x: 50, y: 150 }
    })
    await room.move(east)
    await room.respond({ kind: 'DECLINE' })
    const pending = await room.pending()
    if (!pending) throw new Error('Expected a second reaction decision.')
    expect(pending.occurrence.version).toBe(1)

    const refused = await room.respond({ kind: 'DECLINE' }, 0)

    expect(refused).toMatchObject({
      type: 'COMMAND_REJECTED',
      code: 'DOMAIN_REJECTED',
      reason: 'VERSION_STALE'
    })
    expect(await room.pending()).toEqual(pending)
  })
})

describe('used movement reactions', () => {
  const destination = { x: 750, y: 150 }

  /** Two FRIENDLY reaction Wolves that hit every time, east of a HOSTILE Wolf walking toward them. */
  function usedReactionRoom(spatialEffects: MovementRoomConfig['spatialEffects']) {
    const mover = srdCreatureActor({ id: MOVER_ID, creature: plainWolf })
    const reactors = [REACTOR_A_ID, REACTOR_B_ID].map((id) =>
      srdCreatureActor({ id, creature: reactionWolf, disposition: 'FRIENDLY' })
    )
    return movementRoom({
      actors: [...reactors, mover],
      moverActorId: MOVER_ID,
      positions: {
        [REACTOR_A_ID]: { x: 450, y: 50 },
        [REACTOR_B_ID]: { x: 450, y: 250 },
        [MOVER_ID]: MOVER_START
      },
      autoRoll: 'GAME_MASTER',
      spatialEffects
    })
  }

  it('settles a crossed spatial prefix before the first reaction contact', async () => {
    const room = await usedReactionRoom([{ center: { x: 350, y: 150 }, radius: 50 }])

    await room.move([MOVER_START, destination])

    const context = await reactionDecision(room)
    const firstReactionDistance =
      context.reactionTimeline[0]!.group.options[0]!.candidate.pathDistance
    if (
      context.appliedSpatialPrefix?.status !== 'BATCH_COMPLETE' ||
      context.appliedSpatialPrefix.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT'
    )
      throw new Error('The crossed spatial prefix was not settled before the first reaction.')
    for (const execution of context.appliedSpatialPrefix.executions)
      expect(execution.candidate.candidate.pathDistance).toBeLessThan(firstReactionDistance)
  })

  it('retains each used reaction in order and ends at the destination', async () => {
    const room = await usedReactionRoom([])
    await room.move([MOVER_START, destination])

    for (let uses = 0; (await room.pending()) && uses < 5; uses++) {
      const context = await reactionDecision(room)
      if (context.phase.kind !== 'CHOICE')
        throw new Error('Expected a reaction Use/Decline choice.')
      await room.respond({
        kind: 'OPTION',
        optionId: context.reactionTimeline[0]!.group.options[0]!.optionId
      })
    }

    expect(await room.pending()).toBeNull()
    expect(await resolvedReceipt(room, 'RESOLVE_RULE_OCCURRENCE')).toMatchObject({
      result: {
        reactionExecutions: [{ ordinal: 0 }, { ordinal: 1 }],
        terminalPosition: destination
      }
    })
    // Each Use is linked to the resolution command that chose it.
    const { metadata, result } = await resolvedReceipt(room, 'RESOLVE_RULE_OCCURRENCE')
    const commandIds = (
      metadata as { resolutionCommands: { commandId: string }[] }
    ).resolutionCommands.map((command) => command.commandId)
    expect(commandIds).toHaveLength(2)
    expect(result).toMatchObject({
      reactionExecutions: commandIds.map((sourceCommandId) => ({ sourceCommandId }))
    })
  })
})

describe('movement through a hostile creature', () => {
  /** A FRIENDLY Wolf walking east through a HOSTILE Wolf one cell ahead. */
  function passageRoom(options: {
    automationMode?: 'MANUAL' | 'ASSISTED'
    /** A second HOSTILE Wolf further along the path, past the first. */
    laterBlocker?: boolean
    rolls?: readonly number[]
  }) {
    const mover = srdCreatureActor({ id: MOVER_ID, creature: plainWolf, disposition: 'FRIENDLY' })
    const blocker = srdCreatureActor({ id: BLOCKER_ID, creature: plainWolf })
    const later = srdCreatureActor({ id: LATER_BLOCKER_ID, creature: plainWolf })
    return movementRoom({
      actors: options.laterBlocker ? [mover, blocker, later] : [mover, blocker],
      moverActorId: MOVER_ID,
      positions: {
        [MOVER_ID]: MOVER_START,
        [BLOCKER_ID]: { x: 350, y: 150 },
        ...(options.laterBlocker ? { [LATER_BLOCKER_ID]: { x: 550, y: 150 } } : {})
      },
      automationMode: options.automationMode,
      optionalCombatKinds: ['OVERRUN', 'TUMBLE'],
      autoRoll: 'GAME_MASTER',
      rolls: options.rolls
    })
  }

  async function overrunOptionId(room: Room) {
    const overrun = (await passageOptions(room)).find(
      (option) => option.ruleKind === 'OVERRUN' && option.economy === 'ACTION'
    )
    if (!overrun) throw new Error('The Overrun option is missing.')
    return overrun.optionId
  }

  it('asks the mover how to pass before moving through the creature', async () => {
    const room = await passageRoom({})

    await room.move([MOVER_START, { x: 550, y: 150 }])

    expect(
      (await passageOptions(room)).map(({ ruleKind, economy }) => ({ ruleKind, economy }))
    ).toEqual(
      expect.arrayContaining([
        { ruleKind: 'OVERRUN', economy: 'ACTION' },
        { ruleKind: 'OVERRUN', economy: 'BONUS_ACTION' },
        { ruleKind: 'TUMBLE', economy: 'ACTION' },
        { ruleKind: 'TUMBLE', economy: 'BONUS_ACTION' }
      ])
    )
  })

  it('settles the passage contest of the chosen option', async () => {
    const room = await passageRoom({})
    await room.move([MOVER_START, { x: 550, y: 150 }])

    await room.respond({ kind: 'PASSAGE_OPTION', optionId: await overrunOptionId(room) })

    expect(await resolvedReceipt(room, 'RESOLVE_RULE_OCCURRENCE')).toMatchObject({
      metadata: {
        resolutionCommands: [
          {
            kind: 'PASSAGE_OPTION',
            passageContest: { actionKind: 'OVERRUN', audit: { sourceActorId: MOVER_ID } }
          }
        ]
      }
    })
  })

  it('stops a successful passage at the sealed next hostile blocker without a second contest', async () => {
    // The mover wins the contest (initiator face 20, defender face 1) and is stopped at the next
    // hostile creature's contact: the receipt's audit records that terminal position.
    const room = await passageRoom({ laterBlocker: true, rolls: [19, 0] })
    await room.move([MOVER_START, { x: 750, y: 150 }])

    await room.respond({ kind: 'PASSAGE_OPTION', optionId: await overrunOptionId(room) })

    expect(await room.pending()).toBeNull()
    const receipt = await resolvedReceipt(room, 'RESOLVE_RULE_OCCURRENCE')
    expect(receipt).toMatchObject({
      result: { terminalPosition: { x: 450, y: 150 } },
      metadata: {
        resolutionCommands: [
          {
            passageContest: { outcome: 'SUCCESS', audit: { terminalPosition: { x: 450, y: 150 } } }
          }
        ]
      }
    })
  })

  it('moves through without a contest when the Encounter is manual', async () => {
    const room = await passageRoom({ automationMode: 'MANUAL' })

    const answer = await room.move([MOVER_START, { x: 550, y: 150 }])

    expect(answer).toMatchObject({
      type: 'COMMAND_COMMITTED',
      delta: { result: { delta: { kind: 'TOKEN_MOVED', position: { x: 550, y: 150 } } } }
    })
    expect(await room.pending()).toBeNull()
    expect(await room.receipts()).toEqual([])
  })

  it('refuses a voluntary move that ends inside the hostile creature', async () => {
    const room = await passageRoom({})

    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const answer = await room.move([MOVER_START, { x: 350, y: 150 }])

    // A player-caused rule outcome is a domain rejection; it names no creature, so it hides a fogged one.
    expect(answer).toMatchObject({
      type: 'COMMAND_REJECTED',
      code: 'DOMAIN_REJECTED',
      reason: 'MOVEMENT_BLOCKED',
      message: "You can't end your move there."
    })
    expect(logged).not.toHaveBeenCalled()
    expect(await room.pending()).toBeNull()
    expect(await room.receipts()).toEqual([])
  })
})

describe('movement-triggered Concentration', () => {
  const hazard = { center: { x: 350, y: 150 }, radius: 50 }

  /** A Character maintaining Concentration crosses a spatial effect that deals it 1 damage (DC 10). */
  function concentrationRoom(options: {
    autoRoll: boolean
    rolls?: readonly number[]
    hazards?: MovementRoomConfig['spatialEffects']
  }) {
    return movementRoom({
      actors: [characterActor({ id: MOVER_ID, characterId: CHARACTER_ID })],
      moverActorId: MOVER_ID,
      positions: { [MOVER_ID]: MOVER_START },
      autoRoll: options.autoRoll ? 'PLAYER' : undefined,
      concentration: true,
      spatialEffects: options.hazards ?? [hazard],
      rolls: options.rolls
    })
  }

  const walk = [MOVER_START, { x: 550, y: 150 }]

  it('waits for the check roll when the owner has not asked for automatic rolls', async () => {
    const room = await concentrationRoom({ autoRoll: false })

    await room.move(walk)

    expect((await room.pending())?.context).toMatchObject({
      kind: 'ENCOUNTER_MOVEMENT_REACTION',
      phase: { kind: 'CONCENTRATION_EVIDENCE' }
    })
  })

  it('keeps Concentration when the automatic check succeeds', async () => {
    const room = await concentrationRoom({ autoRoll: true, rolls: [19] })

    await room.move(walk)

    expect(await resolvedReceipt(room, 'CONCENTRATION_CHECK')).toMatchObject({
      result: {
        applicationOutputs: { outcome: 'SAVE_SUCCESS', d20: { selectedNatural: 20, dc: 10 } }
      }
    })
  })

  it('ends Concentration when the automatic check fails', async () => {
    const room = await concentrationRoom({ autoRoll: true, rolls: [0] })

    await room.move(walk)

    expect(await resolvedReceipt(room, 'CONCENTRATION_CHECK')).toMatchObject({
      result: {
        applicationOutputs: {
          outcome: 'SAVE_FAILURE',
          application: { targetActorId: MOVER_ID },
          d20: {
            rawFaces: [1],
            rollMode: 'NORMAL',
            selectedNatural: 1,
            modifier: 1,
            total: 2,
            dc: 10
          },
          cleanup: { maintainedStateId: CONCENTRATION_STATE_ID }
        }
      }
    })
  })

  it('checks Concentration once for two same-contact hazards that damage the Character', async () => {
    const room = await concentrationRoom({
      autoRoll: true,
      rolls: [0],
      hazards: [hazard, { ...hazard, variant: 1 }]
    })

    await room.move(walk)

    const receipts = await room.receipts()
    expect(receipts.filter((entry) => entry.commandType === 'CONCENTRATION_CHECK')).toHaveLength(1)
    expect(await resolvedReceipt(room, 'CONCENTRATION_CHECK')).toMatchObject({
      result: {
        applicationOutputs: {
          outcome: 'SAVE_FAILURE',
          d20: { rawFaces: [1] },
          cleanup: { maintainedStateId: CONCENTRATION_STATE_ID }
        }
      }
    })
    // The first contact carries the one check; the second hazard's damage rides on it.
    const move = receipts.find((entry) => entry.commandType === 'MOVE_SCENE_TOKEN')
    if (!move) throw new Error('No movement receipt was committed.')
    expect(move.result).toMatchObject({
      executions: [{ ordinal: 0, concentrationChecks: [{}] }, { ordinal: 1 }],
      spatialEffectTransitions: [
        { transition: { kind: 'DELETE' } },
        { transition: { kind: 'DELETE' } }
      ]
    })
    const { executions } = move.result as { executions: object[] }
    expect(executions[1]).not.toHaveProperty('concentrationChecks')
  })
})

describe('movement-triggered Concentration held by a Creature', () => {
  const hazard = { center: { x: 350, y: 150 }, radius: 50 }

  /** A Wolf maintaining Concentration crosses a spatial effect that deals it 1 damage (DC 10). */
  function creatureConcentrationRoom(rolls: readonly number[]) {
    return movementRoom({
      actors: [srdCreatureActor({ id: MOVER_ID, creature: plainWolf })],
      moverActorId: MOVER_ID,
      positions: { [MOVER_ID]: MOVER_START },
      autoRoll: 'GAME_MASTER',
      concentration: true,
      concentrationDependentActorIds: [MOVER_ID],
      spatialEffects: [hazard],
      rolls
    })
  }

  const walk = [MOVER_START, { x: 550, y: 150 }]

  it('keeps Concentration when the GM-rolled Creature check succeeds', async () => {
    const room = await creatureConcentrationRoom([19])

    await room.move(walk)

    expect(await resolvedReceipt(room, 'CONCENTRATION_CHECK')).toMatchObject({
      result: {
        applicationOutputs: {
          outcome: 'SAVE_SUCCESS',
          application: { targetActorId: MOVER_ID },
          d20: { selectedNatural: 20, modifier: 1, dc: 10 }
        }
      }
    })
  })

  it('ends Concentration when the GM-rolled Creature check fails', async () => {
    const room = await creatureConcentrationRoom([0])

    await room.move(walk)

    expect(await resolvedReceipt(room, 'CONCENTRATION_CHECK')).toMatchObject({
      result: {
        applicationOutputs: {
          outcome: 'SAVE_FAILURE',
          d20: { rawFaces: [1], rollMode: 'NORMAL', total: 2, dc: 10 },
          cleanup: { maintainedStateId: CONCENTRATION_STATE_ID }
        }
      }
    })
  })
})
