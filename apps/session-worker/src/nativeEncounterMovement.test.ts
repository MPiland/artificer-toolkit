import {
  characterActor,
  srdCreatureActor,
  srdEncounterState
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { describe, expect, it } from 'vitest'

import type { prepareNativeLiveMovement } from './nativeEncounterMovement.js'
import {
  concentrationSlot,
  createMovementScenario,
  pendingMovement,
  plainWolf,
  reactionPolicyDefinitions,
  reactionWolf,
  spatialDamageEffect,
  srdCharacterReads
} from './testing/movementPlannerFixture.js'
import { testUuid } from './testing/liveCaptureFixture.js'

type PlannedMovement = Awaited<ReturnType<typeof prepareNativeLiveMovement>>

const MOVER_ID = testUuid(0x200)
const REACTOR_A_ID = testUuid(0x201)
const REACTOR_B_ID = testUuid(0x202)
const REACTOR_C_ID = testUuid(0x203)
const BLOCKER_ID = testUuid(0x301)
const CHARACTER_ID = testUuid(0x400)

const MOVER_START = { x: 150, y: 150 }

function reactorOrder(planned: PlannedMovement) {
  return planned.reactions.reactionTimeline.map((entry) => entry.group.reactorActorId)
}

describe('movement reactions', () => {
  /** FRIENDLY Wolves whose Bite is an opportunity attack, around a HOSTILE Wolf walking east. */
  function reactionScenario(
    reactorIds: readonly string[],
    positions: Record<string, { x: number; y: number }>
  ) {
    const mover = srdCreatureActor({ id: MOVER_ID, creature: plainWolf })
    const reactors = reactorIds.map((id) =>
      srdCreatureActor({ id, creature: reactionWolf, disposition: 'FRIENDLY' })
    )
    const actors = [...reactors, mover]
    return createMovementScenario({
      state: srdEncounterState({ actors, currentActorId: MOVER_ID }),
      actors,
      positions: { ...positions, [MOVER_ID]: MOVER_START },
      moverActorId: MOVER_ID,
      path: [MOVER_START, { x: 750, y: 150 }],
      autoRollByActorId: {},
      extraDefinitions: reactionPolicyDefinitions
    })
  }

  it('orders reactions that fall at the same distance by reactor identity, whatever the capture order', async () => {
    // Two reactors mirrored about the path: each loses the mover at the same point.
    const scenario = await reactionScenario([REACTOR_B_ID, REACTOR_A_ID], {
      [REACTOR_A_ID]: { x: 150, y: 50 },
      [REACTOR_B_ID]: { x: 150, y: 250 }
    })

    const { result } = await scenario.start()

    expect(result.outcome.kind).toBe('PENDING')
    expect(reactorOrder(result)).toEqual([REACTOR_A_ID, REACTOR_B_ID])
  })

  it('offers the reactor the mover leaves first before those it leaves later', async () => {
    // C stands behind the mover, so the mover leaves C's reach before it leaves A's.
    const scenario = await reactionScenario([REACTOR_A_ID, REACTOR_C_ID], {
      [REACTOR_A_ID]: { x: 150, y: 50 },
      [REACTOR_C_ID]: { x: 50, y: 150 }
    })

    const { result } = await scenario.start()

    expect(reactorOrder(result)).toEqual([REACTOR_C_ID, REACTOR_A_ID])
  })

  it('asks each reactor in order as the earlier ones decline', async () => {
    const scenario = await reactionScenario([REACTOR_B_ID, REACTOR_A_ID, REACTOR_C_ID], {
      [REACTOR_A_ID]: { x: 150, y: 50 },
      [REACTOR_B_ID]: { x: 150, y: 250 },
      [REACTOR_C_ID]: { x: 50, y: 150 }
    })

    let { result } = await scenario.start()
    const asked: string[] = []
    while (result.outcome.kind === 'PENDING' && asked.length < 5) {
      const { context } = pendingMovement(result)
      if (context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
        throw new Error(`Expected a reaction decision, got ${context.kind}.`)
      asked.push(...context.reactionTimeline.slice(0, 1).map((entry) => entry.group.reactorActorId))
      ;({ result } = await scenario.respond(result, { kind: 'DECLINE' }))
    }

    expect(asked).toEqual([REACTOR_C_ID, REACTOR_A_ID, REACTOR_B_ID])
    expect(result.outcome.kind).toBe('TERMINAL')
  })
})

describe('movement through a hostile creature', () => {
  /** A FRIENDLY Wolf walking east through a HOSTILE Wolf one cell ahead. */
  async function passageScenario(options: {
    automationMode?: 'MANUAL' | 'ASSISTED'
    destination: { x: number; y: number }
  }) {
    const mover = srdCreatureActor({ id: MOVER_ID, creature: plainWolf, disposition: 'FRIENDLY' })
    const blocker = srdCreatureActor({ id: BLOCKER_ID, creature: plainWolf })
    const actors = [mover, blocker]
    return createMovementScenario({
      state: srdEncounterState({
        actors,
        currentActorId: MOVER_ID,
        automationMode: options.automationMode,
        optionalCombatKinds: ['OVERRUN', 'TUMBLE']
      }),
      actors,
      positions: { [MOVER_ID]: MOVER_START, [BLOCKER_ID]: { x: 350, y: 150 } },
      moverActorId: MOVER_ID,
      path: [MOVER_START, options.destination],
      autoRollByActorId: { [MOVER_ID]: true, [BLOCKER_ID]: true }
    })
  }

  function passageChoices(planned: PlannedMovement) {
    const { context } = pendingMovement(planned)
    if (context.kind !== 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE')
      throw new Error(`Expected a passage choice, got ${context.kind}.`)
    return context.options
  }

  it('asks the mover how to pass before moving through the creature', async () => {
    const scenario = await passageScenario({ destination: { x: 550, y: 150 } })

    const { result } = await scenario.start()

    expect(result.outcome.kind).toBe('PENDING')
    expect(passageChoices(result).map(({ ruleKind, economy }) => ({ ruleKind, economy }))).toEqual(
      expect.arrayContaining([
        { ruleKind: 'OVERRUN', economy: 'ACTION' },
        { ruleKind: 'OVERRUN', economy: 'BONUS_ACTION' },
        { ruleKind: 'TUMBLE', economy: 'ACTION' },
        { ruleKind: 'TUMBLE', economy: 'BONUS_ACTION' }
      ])
    )
  })

  it('settles the passage contest of the chosen option', async () => {
    const scenario = await passageScenario({ destination: { x: 550, y: 150 } })
    const { result: pending } = await scenario.start()
    const overrun = passageChoices(pending).find(
      (option) => option.ruleKind === 'OVERRUN' && option.economy === 'ACTION'
    )
    if (!overrun) throw new Error('The Overrun option is missing.')

    const { result } = await scenario.respond(pending, {
      kind: 'PASSAGE_OPTION',
      optionId: overrun.optionId
    })

    expect(result.outcome.kind).not.toBe('UNINTERRUPTED')
    expect(result.settlementInputs).toContainEqual(
      expect.objectContaining({ kind: 'PASSAGE', actorId: MOVER_ID })
    )
  })

  it('moves through without a contest when the Encounter is manual', async () => {
    const scenario = await passageScenario({
      automationMode: 'MANUAL',
      destination: { x: 550, y: 150 }
    })

    const { result } = await scenario.start()

    expect(result.outcome).toMatchObject({ kind: 'UNINTERRUPTED', reason: 'MANUAL' })
  })

  it('refuses a voluntary move that ends inside the hostile creature', async () => {
    const scenario = await passageScenario({ destination: { x: 350, y: 150 } })

    await expect(scenario.start()).rejects.toThrow(
      'Voluntary movement cannot end inside a hostile occupied footprint.'
    )
  })
})

describe('movement-triggered Concentration', () => {
  /** A Character maintaining Concentration crosses a spatial effect that deals it 1 damage (DC 10). */
  async function concentrationScenario(options: {
    autoRoll: boolean
    random?: (maximum: number) => number
  }) {
    const actor = characterActor({ id: MOVER_ID, characterId: CHARACTER_ID })
    return createMovementScenario({
      state: srdEncounterState({ actors: [actor], currentActorId: MOVER_ID }),
      actors: [actor],
      positions: { [MOVER_ID]: MOVER_START },
      moverActorId: MOVER_ID,
      path: [MOVER_START, { x: 550, y: 150 }],
      autoRollByActorId: options.autoRoll ? { [MOVER_ID]: true } : {},
      maintenanceSlot: await concentrationSlot(MOVER_ID),
      prepareCharacter: await srdCharacterReads(CHARACTER_ID),
      spatialEffects: [
        await spatialDamageEffect({
          targetActorId: MOVER_ID,
          center: { x: 350, y: 150 },
          radius: 50
        })
      ],
      random: options.random
    })
  }

  function concentrationCheck(planned: PlannedMovement) {
    const settlement = planned.settlementInputs.find((input) => input.kind === 'CONCENTRATION')
    if (!settlement) throw new Error('No Concentration check was planned.')
    return settlement.execution.result.applicationOutputs
  }

  it('waits for the check roll when the owner has not asked for automatic rolls', async () => {
    const scenario = await concentrationScenario({ autoRoll: false })

    const { result } = await scenario.start()

    expect(result.outcome.kind).toBe('PENDING')
    expect(pendingMovement(result).context).toMatchObject({
      kind: 'ENCOUNTER_MOVEMENT_REACTION',
      phase: { kind: 'CONCENTRATION_EVIDENCE' }
    })
  })

  it('keeps Concentration when the automatic check succeeds', async () => {
    const scenario = await concentrationScenario({ autoRoll: true, random: () => 19 })

    const { result } = await scenario.start()

    expect(concentrationCheck(result)).toMatchObject({
      outcome: 'SAVE_SUCCESS',
      d20: { selectedNatural: 20, dc: 10 }
    })
  })

  it('ends Concentration when the automatic check fails', async () => {
    const scenario = await concentrationScenario({ autoRoll: true, random: () => 0 })

    const { result } = await scenario.start()

    expect(concentrationCheck(result)).toMatchObject({
      outcome: 'SAVE_FAILURE',
      d20: { selectedNatural: 1, dc: 10 }
    })
  })
})
