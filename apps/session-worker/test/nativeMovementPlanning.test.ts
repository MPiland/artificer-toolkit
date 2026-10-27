import { compileInstalledCreatureRuleFacts } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import {
  characterActor,
  SRD_VOCABULARY,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { SceneBarrier, ScenePoint } from '@artificer-toolkit/shared/vtt'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '@artificer-toolkit/source-data/srd/optionalCombat.js'
import {
  SRD_ACROBATICS_SKILL_ID,
  SRD_ATHLETICS_SKILL_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { runInDurableObject } from 'cloudflare:test'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
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
    /** The first blocker's Bite is an opportunity attack. */
    reactiveBlocker?: boolean
    /** The first blocker's size, Medium like the mover unless it names another. */
    blockerSize?: CreatureAuthored['size']
    rolls?: readonly number[]
    optionalCombatKinds?: MovementRoomConfig['optionalCombatKinds']
  }) {
    const mover = srdCreatureActor({ id: MOVER_ID, creature: plainWolf, disposition: 'FRIENDLY' })
    const blocker = srdCreatureActor({
      id: BLOCKER_ID,
      creature: {
        ...(options.reactiveBlocker ? reactionWolf : plainWolf),
        ...(options.blockerSize ? { size: options.blockerSize } : {})
      }
    })
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
      optionalCombatKinds: options.optionalCombatKinds ?? ['OVERRUN', 'TUMBLE'],
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

  it('refuses to undo the Scene move whose won climb settled, so the cling cannot outlive the position (MOVE-4.T2a)', async () => {
    const room = await passageRoom({
      blockerSize: 'LARGE',
      optionalCombatKinds: ['CLIMB_ONTO_LARGER_CREATURE'],
      rolls: [19, 0]
    })
    await room.move([MOVER_START, { x: 750, y: 150 }])
    const climb = (await passageOptions(room)).find(
      (option) => option.ruleKind === 'CLIMB_ONTO_LARGER_CREATURE'
    )
    if (!climb) throw new Error('The climb option is missing.')

    await room.respond({ kind: 'PASSAGE_OPTION', optionId: climb.optionId })

    expect(await room.pending()).toBeNull()
    const commandId = crypto.randomUUID()
    expect(
      await room.send(commandId, {
        scope: 'SCENE',
        command: {
          type: 'UNDO_LAST_SCENE_MOVE',
          commandId,
          expectedSceneVersion: room.scene.version + 1,
          sceneId: room.scene.id
        }
      })
    ).toMatchObject({
      type: 'COMMAND_REJECTED',
      code: 'INVALID_COMMAND',
      message: 'This move settled Encounter mechanics and cannot be undone as a Scene move.'
    })
  })
  it('gives a won climb its cling on a Character blocker in that Character stream, versioned once (MOVE-4.T2a)', async () => {
    const climber = srdCreatureActor({
      id: MOVER_ID,
      creature: { ...plainWolf, size: 'SMALL' },
      disposition: 'HOSTILE'
    })
    const room = await movementRoom({
      actors: [climber, characterActor({ id: BLOCKER_ID, characterId: CHARACTER_ID })],
      moverActorId: MOVER_ID,
      positions: { [MOVER_ID]: MOVER_START, [BLOCKER_ID]: { x: 350, y: 150 } },
      optionalCombatKinds: ['CLIMB_ONTO_LARGER_CREATURE'],
      autoRoll: 'BOTH',
      rolls: [19, 0]
    })
    const characterState = () =>
      runInDurableObject(room.base.stub, (_instance, context) => {
        const store = new RoomEncounterStore(context.storage)
        const play = store
          .documents('characterPlayStates')
          .find((row) => row.characterId === CHARACTER_ID)
        if (!play) throw new Error('Missing room Character play state.')
        return {
          streamVersion: play.streamVersion,
          effects: store
            .documents('characterActiveRuleEffects')
            .filter((row) => row.characterId === CHARACTER_ID)
        }
      })
    const before = await characterState()
    expect(before.effects).toEqual([])
    await room.move([MOVER_START, { x: 750, y: 150 }])
    const climb = (await passageOptions(room)).find(
      (option) => option.ruleKind === 'CLIMB_ONTO_LARGER_CREATURE'
    )
    if (!climb) throw new Error('The climb option is missing.')

    await room.respond({ kind: 'PASSAGE_OPTION', optionId: climb.optionId })

    expect(await room.pending()).toBeNull()
    const after = await characterState()
    expect(after.effects).toHaveLength(1)
    expect(after.streamVersion).toBe(before.streamVersion + 1)
  })
  it.each(['OVERRUN', 'TUMBLE'] as const)(
    'settles a won %s on the checks its SRD definition pins and passes the blocker (MOVE-2)',
    async (ruleKind) => {
      const definition = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
        (candidate) => candidate.document.kind === ruleKind
      )
      if (!definition) throw new Error(`The SRD ${ruleKind} is missing.`)
      const { parameters } = definition.document
      if (parameters.kind !== 'OVERRUN' && parameters.kind !== 'TUMBLE')
        throw new Error(`The SRD ${ruleKind} must author its contest checks.`)
      const { checkTotals } = compileInstalledCreatureRuleFacts({
        creature: plainWolf,
        vocabulary: SRD_VOCABULARY
      })
      if (!checkTotals) throw new Error('The Wolf must compile its check totals.')
      // Both contestants are Wolves, whose Athletics and Acrobatics differ, so each total names its check.
      expect(checkTotals[SRD_ATHLETICS_SKILL_ID]).not.toBe(checkTotals[SRD_ACROBATICS_SKILL_ID])
      const room = await passageRoom({ laterBlocker: true, rolls: [19, 0] })
      await room.move([MOVER_START, { x: 750, y: 150 }])
      const option = (await passageOptions(room)).find(
        (candidate) => candidate.ruleKind === ruleKind && candidate.economy === 'ACTION'
      )
      if (!option) throw new Error(`The ${ruleKind} option is missing.`)

      await room.respond({ kind: 'PASSAGE_OPTION', optionId: option.optionId })

      expect(await room.pending()).toBeNull()
      expect(await resolvedReceipt(room, 'RESOLVE_RULE_OCCURRENCE')).toMatchObject({
        result: { terminalPosition: { x: 450, y: 150 } },
        metadata: {
          resolutionCommands: [
            {
              passageContest: {
                actionKind: ruleKind,
                outcome: 'SUCCESS',
                initiator: {
                  selectedNatural: 20,
                  modifier: checkTotals[parameters.initiatorCheckDefinitionId]
                },
                defender: {
                  selectedNatural: 1,
                  modifier: checkTotals[parameters.targetCheckDefinitionId]
                },
                audit: {
                  optionalCombat: {
                    definitionId: definition.id,
                    definitionChecksum: definition.checksum
                  },
                  sourceActorId: MOVER_ID,
                  blockerActorId: BLOCKER_ID
                }
              }
            }
          ]
        }
      })
    }
  )

  it.each(['OVERRUN', 'TUMBLE'] as const)(
    'a won %s still provokes the blocker it passes, because its SRD policy suppresses no opportunity attack (MOVE-2)',
    async (ruleKind) => {
      const room = await passageRoom({ reactiveBlocker: true, rolls: [19, 0] })
      await room.move([MOVER_START, { x: 550, y: 150 }])
      const option = (await passageOptions(room)).find(
        (candidate) => candidate.ruleKind === ruleKind && candidate.economy === 'ACTION'
      )
      if (!option) throw new Error(`The ${ruleKind} option is missing.`)

      await room.respond({ kind: 'PASSAGE_OPTION', optionId: option.optionId })

      const { reactionTimeline } = await reactionDecision(room)
      expect(reactionTimeline.map((entry) => entry.group.reactorActorId)).toEqual([BLOCKER_ID])
      await room.respond({ kind: 'DECLINE' })
      expect(await room.pending()).toBeNull()
      expect(await resolvedReceipt(room, 'RESOLVE_RULE_OCCURRENCE')).toMatchObject({
        result: { terminalPosition: { x: 550, y: 150 } },
        metadata: {
          resolutionCommands: [
            { passageContest: { actionKind: ruleKind, outcome: 'SUCCESS' } },
            { kind: 'DECLINE' }
          ]
        }
      })
    }
  )

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

  it('refuses a move through the hostile creature when the mover has no way to pass it', async () => {
    // The Encounter offers no Overrun or Tumble, so nothing lets the mover through.
    const room = await passageRoom({ optionalCombatKinds: [] })

    const answer = await room.move([MOVER_START, { x: 550, y: 150 }])

    expect(answer).toMatchObject({
      type: 'COMMAND_REJECTED',
      code: 'DOMAIN_REJECTED',
      reason: 'MOVEMENT_BLOCKED'
    })
    expect(await room.pending()).toBeNull()
    expect(await room.receipts()).toEqual([])
  })
})

describe('a mover whose passage grants let it through (SPELLS-33.T6k1)', () => {
  const ghost = srdBaselineContent.subjects.creatures.find((entry) => entry.label === 'Ghost')
  if (!ghost) throw new Error('The SRD Ghost is missing.')
  const wall: SceneBarrier = {
    id: testUuid(0x3310),
    kind: 'WALL',
    a: { x: 250, y: 0 },
    b: { x: 250, y: 400 },
    blocksLight: true,
    blocksMovement: true
  }

  /** A FRIENDLY mover walking east toward a HOSTILE Wolf one cell ahead, or across a wall. */
  function passingRoom(options: { mover: 'GHOST' | 'WOLF'; walled?: boolean }) {
    return movementRoom({
      actors: [
        srdCreatureActor({
          id: MOVER_ID,
          creature: options.mover === 'GHOST' ? ghost! : plainWolf,
          disposition: 'FRIENDLY'
        }),
        ...(options.walled ? [] : [srdCreatureActor({ id: BLOCKER_ID, creature: plainWolf })])
      ],
      moverActorId: MOVER_ID,
      positions: {
        [MOVER_ID]: MOVER_START,
        ...(options.walled ? {} : { [BLOCKER_ID]: { x: 350, y: 150 } })
      },
      optionalCombatKinds: ['OVERRUN', 'TUMBLE'],
      autoRoll: 'GAME_MASTER',
      ...(options.walled ? { sceneOverrides: { barriers: [wall] } } : {})
    })
  }

  async function feetMoved(room: Room) {
    const movements = await runInDurableObject(room.base.stub, async (_instance, context) =>
      new RoomEncounterStore(context.storage).documents('encounterTurnMovements')
    )
    return movements
      .filter((movement) => movement.actorId === MOVER_ID)
      .reduce((total, { usedFeet }) => total + usedFeet, 0)
  }

  it('moves an incorporeal Ghost through the hostile creature without a contest, paying double inside it', async () => {
    const room = await passingRoom({ mover: 'GHOST' })

    const answer = await room.move([MOVER_START, { x: 550, y: 150 }])

    expect(answer).toMatchObject({
      type: 'COMMAND_COMMITTED',
      delta: { result: { delta: { kind: 'TOKEN_MOVED', position: { x: 550, y: 150 } } } }
    })
    expect(await room.pending()).toBeNull()
    // 20 ft walked; the footprints overlap while the Ghost's centre is between x=250 and x=450,
    // and those 10 ft cost double.
    expect(await feetMoved(room)).toBe(30)
  })

  it('still refuses to let the Ghost end its move inside the hostile creature', async () => {
    const room = await passingRoom({ mover: 'GHOST' })

    const answer = await room.move([MOVER_START, { x: 350, y: 150 }])

    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'MOVEMENT_BLOCKED' })
    expect(await room.pending()).toBeNull()
  })

  it('moves the Ghost through a wall that stops a Wolf', async () => {
    const ghostRoom = await passingRoom({ mover: 'GHOST', walled: true })
    expect(await ghostRoom.move([MOVER_START, { x: 350, y: 150 }])).toMatchObject({
      type: 'COMMAND_COMMITTED',
      delta: { result: { delta: { kind: 'TOKEN_MOVED', position: { x: 350, y: 150 } } } }
    })
    closeTrackedSockets()

    const wolfRoom = await passingRoom({ mover: 'WOLF', walled: true })
    expect(await wolfRoom.move([MOVER_START, { x: 350, y: 150 }])).toMatchObject({
      type: 'COMMAND_REJECTED'
    })
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

    expect(await resolvedReceipt(room, 'DAMAGE_SAVE_CHECK')).toMatchObject({
      result: {
        applicationOutputs: { outcome: 'SAVE_SUCCESS', d20: { selectedNatural: 20, dc: 10 } }
      }
    })
  })

  it('ends Concentration when the automatic check fails', async () => {
    const room = await concentrationRoom({ autoRoll: true, rolls: [0] })

    await room.move(walk)

    expect(await resolvedReceipt(room, 'DAMAGE_SAVE_CHECK')).toMatchObject({
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
    expect(receipts.filter((entry) => entry.commandType === 'DAMAGE_SAVE_CHECK')).toHaveLength(1)
    expect(await resolvedReceipt(room, 'DAMAGE_SAVE_CHECK')).toMatchObject({
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

    expect(await resolvedReceipt(room, 'DAMAGE_SAVE_CHECK')).toMatchObject({
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

    expect(await resolvedReceipt(room, 'DAMAGE_SAVE_CHECK')).toMatchObject({
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

describe('a spatial hazard that drops a walker to 0 hit points (D156)', () => {
  it('ends the voluntary move at that contact, before any later hazard', async () => {
    const room = await movementRoom({
      actors: [characterActor({ id: MOVER_ID, characterId: CHARACTER_ID })],
      moverActorId: MOVER_ID,
      positions: { [MOVER_ID]: MOVER_START },
      autoRoll: 'PLAYER',
      characterPlay: { currentHitPoints: 1 },
      spatialEffects: [
        { center: { x: 350, y: 150 }, radius: 50 },
        { center: { x: 500, y: 150 }, radius: 20, variant: 1 }
      ]
    })

    await room.move([MOVER_START, { x: 650, y: 150 }])

    const move = (await room.receipts()).find((entry) => entry.commandType === 'MOVE_SCENE_TOKEN')
    if (!move) throw new Error('The move left no receipt.')
    // The token's half-cell edge meets the first hazard's rim (x 300) with its center at x 250.
    expect(move.result).toMatchObject({ terminalPosition: { x: 250, y: 150 } })
    expect((move.result as { executions: object[] }).executions).toHaveLength(1)
  })
})
