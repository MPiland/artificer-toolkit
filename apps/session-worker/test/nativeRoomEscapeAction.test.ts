import {
  characterActor,
  creatureFeature,
  creatureRuleFacts,
  srdCondition,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { encounterRuleUsageSnapshot } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { escapeGrappleEffectDefinition } from '@artificer-toolkit/rules-runtime/testing/escapeGrappleEffectFixture'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_ATHLETICS_SKILL_ID,
  SRD_MEDICINE_SKILL_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { guidance } from '@artificer-toolkit/source-data/srd/spells/guidance.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, type ActionRoomConfig } from './actionRoomFixture.js'
import { heldDieEffect, seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { parseReceiptExecution, readRoomHistory } from './roomHistoryReads.js'

const HOLDER_ID = testUuid(0xe10)
const GRAPPLER_ID = testUuid(0xe11)
const EFFECT_ID = testUuid(0xe12)
const FIGHTER_ACTOR_ID = testUuid(0xe13)
const FIGHTER_ID = testUuid(0xe14)
const ATHLETICS = SRD_ATHLETICS_SKILL_ID
const STRENGTH = SRD_ABILITY_DEFINITION_IDS.STRENGTH
const DC = 13
const GRAPPLED = srdCondition('Grappled')
const RESTRAINED = srdCondition('Restrained')
/** The zero-based draw of a d20 that shows `face`. */
const draw = (face: number) => face - 1
const ENCOUNTER_COMMAND_FAILED = 'Live Session Encounter command failed in the room.'

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The holder Wolf: Strength 14 (+2) and an Athletics total of exactly +4, held Grappled and Restrained. */
function heldWolf() {
  const wolf = srdCreatureActor({
    id: HOLDER_ID,
    creature: plainWolf,
    disposition: 'FRIENDLY',
    conditionIds: [GRAPPLED, RESTRAINED]
  })
  if (typeof wolf.snapshot !== 'object' || wolf.snapshot === null || Array.isArray(wolf.snapshot))
    throw new Error('The fixture Creature snapshot must be an object.')
  return {
    ...wolf,
    snapshot: {
      ...wolf.snapshot,
      ruleFacts: {
        ...creatureRuleFacts({
          STRENGTH: 14,
          DEXTERITY: 10,
          CONSTITUTION: 10,
          INTELLIGENCE: 10,
          WISDOM: 10,
          CHARISMA: 10
        }),
        checkTotals: { [ATHLETICS]: 4 }
      }
    }
  }
}

function escapeRoom(
  options: {
    autoRoll: boolean
    faces?: number[]
    hideGrappler?: boolean
    /** The grappler holds the turn, so the holder is out of turn. */
    grapplerTurn?: boolean
    /** A die the holder holds for after its d20 (D168). */
    heldDie?: ReturnType<typeof heldDieEffect>
  } & Pick<ActionRoomConfig, 'playerControlledActorIds'>
) {
  const holder = heldWolf()
  const grappler = {
    ...srdCreatureActor({ id: GRAPPLER_ID, creature: plainWolf }),
    public: !options.hideGrappler
  }
  return actionRoom({
    ...(options.autoRoll ? { autoRoll: 'BOTH' as const } : {}),
    rolls: (options.faces ?? []).map(draw),
    playerControlledActorIds: options.playerControlledActorIds,
    actors: [
      ...(options.grapplerTurn ? [grappler, holder] : [holder, grappler]),
      characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID })
    ],
    ownerFeatureId: creatureFeature(plainWolf, 'Bite').id,
    seed: async (seeding) => {
      const { effects, encounterId, occurredAt } = seeding
      await effects.create({
        id: EFFECT_ID,
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: HOLDER_ID },
        lifecycle: { schemaVersion: 1, remainingTicks: null },
        definition: escapeGrappleEffectDefinition({
          encounterId,
          grapplerId: GRAPPLER_ID,
          conditionIds: [GRAPPLED, RESTRAINED],
          dc: DC
        }),
        occurredAt
      })
      if (options.heldDie)
        await seedModifierGrant({
          sourceActorId: HOLDER_ID,
          holderActorId: HOLDER_ID,
          lifecycle: {},
          effect: options.heldDie,
          sourceLabel: guidance.label
        })(seeding)
    }
  })
}

type EscapeRoom = Awaited<ReturnType<typeof escapeRoom>>

async function escapeCommand(room: EscapeRoom, checkDefinitionId: string = ATHLETICS) {
  return {
    type: 'ESCAPE',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    actorId: HOLDER_ID,
    activeEffectId: EFFECT_ID,
    checkDefinitionId,
    acknowledgedWarnings: []
  }
}

async function escape(room: EscapeRoom, checkDefinitionId?: string) {
  return room.send(await escapeCommand(room, checkDefinitionId))
}

/**
 * An escape the rules refuse as invalid: the member is told only that the command could not be
 * completed, so the cause is read off what the room logged.
 */
async function invalidEscape(room: EscapeRoom, checkDefinitionId?: string) {
  const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const answer = await escape(room, checkDefinitionId)
  return {
    answer,
    // The console is process-wide: keep only the Encounter command failure, not other rooms' logs.
    causes: logged.mock.calls
      .filter(([message]) => message === ENCOUNTER_COMMAND_FAILED)
      .map(([, error]) => (error instanceof Error ? error.message : error))
  }
}

/** Answers the prompted escape's pending d20 with the raw `face`. */
async function answerD20(room: EscapeRoom, face: number) {
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a d20 request.')
  return room.resolve(decision, {
    kind: 'ENTER_DICE',
    requestId: decision.pending.request.requestId,
    rawFaces: [face],
    rollMode: decision.pending.request.rollMode
  })
}

async function undo(room: EscapeRoom) {
  return room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })
}

/** The escape the Run settled, the held effect rows and the holder's conditions. */
async function escapeState(room: EscapeRoom) {
  const history = await readRoomHistory(room.room.base.stub)
  const outputs = history.receipts.flatMap((receipt) => {
    const execution = parseReceiptExecution(receipt)
    return execution.status === 'COMPLETE' && execution.applicationOutputs?.kind === 'ESCAPE_CHECK'
      ? [execution.applicationOutputs]
      : []
  })
  const holderRow = history.actors.find((actor) => actor.id === HOLDER_ID)
  if (!holderRow) throw new Error('The holder left the Run.')
  const holder = readStoredRunActor(holderRow)
  if (holder.kind === 'CHARACTER') throw new Error('A Character keeps its conditions on its Sheet.')
  return {
    outputs,
    occurrences: history.occurrences,
    effectIds: history.activeEffects.map((effect) => effect.id),
    conditions: z.array(z.string()).parse(holder.conditions).sort(),
    /** How many uses of any rule (the Action, here) the holder has spent. */
    spent: Object.values(encounterRuleUsageSnapshot(holder)).reduce((sum, used) => sum + used, 0)
  }
}

const HELD = [GRAPPLED, RESTRAINED].sort()

describe('Escape from a fixed-DC grapple, in the room', () => {
  it('asks the holder for the d20, and a total that reaches the DC ends the effect and the conditions it owns', async () => {
    const room = await escapeRoom({ autoRoll: false })
    const answer = await escape(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect((await escapeState(room)).outputs).toEqual([])

    const decision = await room.pendingDecision()
    expect(decision.pending).toMatchObject({
      kind: 'D20_EVIDENCE',
      rollerActorId: HOLDER_ID,
      trigger: { kind: 'BASIC_ACTION_CHECK', actionLabel: 'Escape', dc: DC }
    })
    const settled = await answerD20(room, 9)
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')

    const state = await escapeState(room)
    expect(state.outputs).toMatchObject([
      {
        actorId: HOLDER_ID,
        activeEffectId: EFFECT_ID,
        check: { checkDefinitionId: ATHLETICS, dc: DC },
        d20: { selectedNatural: 9, total: 13 },
        outcome: 'ESCAPED',
        removedConditionIds: HELD
      }
    ])
    expect(state.effectIds).toEqual([])
    expect(state.conditions).toEqual([])
    expect(state.occurrences.map((occurrence) => occurrence.state)).toEqual(['COMPLETED'])
  })

  it('keeps the effect and the conditions when the total misses the DC, though the Action is spent', async () => {
    const room = await escapeRoom({ autoRoll: true, faces: [8] })
    const before = await escapeState(room)
    const answer = await escape(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const state = await escapeState(room)
    expect(state.outputs).toMatchObject([
      { d20: { selectedNatural: 8, total: 12 }, outcome: 'FAILED', removedConditionIds: [] }
    ])
    expect(state.effectIds).toEqual([EFFECT_ID])
    expect(state.conditions).toEqual(HELD)
    expect(before.spent).toBe(0)
    expect(state.spent).toBe(1)
  })

  it('settles in one commit for a holder who rolls automatically', async () => {
    const room = await escapeRoom({ autoRoll: true, faces: [20] })
    const version = await room.version()
    const answer = await escape(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await room.version()).toBe(version + 1)

    const state = await escapeState(room)
    expect(state.outputs).toMatchObject([{ outcome: 'ESCAPED' }])
    expect(state.effectIds).toEqual([])
    expect(state.conditions).toEqual([])
    // Freed or not, the attempt spent the Action.
    expect(state.spent).toBe(1)
  })

  it('rolls the Strength ability check when the holder chooses it', async () => {
    const room = await escapeRoom({ autoRoll: true, faces: [11] })
    const answer = await escape(room, STRENGTH)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const state = await escapeState(room)
    expect(state.outputs).toMatchObject([
      {
        check: { checkDefinitionId: STRENGTH, dc: DC },
        d20: { selectedNatural: 11, total: 13 },
        outcome: 'ESCAPED'
      }
    ])
  })

  it('refuses a check the effect does not allow, and rolls nothing', async () => {
    const room = await escapeRoom({ autoRoll: true, faces: [20] })
    const { answer, causes } = await invalidEscape(room, SRD_MEDICINE_SKILL_ID)
    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', code: 'UNAVAILABLE' })
    expect(causes).toEqual(['The escape does not allow that check.'])

    const state = await escapeState(room)
    expect(state.outputs).toEqual([])
    expect(state.effectIds).toEqual([EFFECT_ID])
    expect(state.spent).toBe(0)
  })

  it('reports only its own refusal when another room logs an error meanwhile', async () => {
    const room = await escapeRoom({ autoRoll: true, faces: [20] })
    // A room from an earlier test retrying its alarm logs through the same process-wide console.
    setTimeout(
      () => console.error('Live Session alarm failed; retrying.', new Error('other room')),
      0
    )
    const { causes } = await invalidEscape(room, SRD_MEDICINE_SKILL_ID)
    expect(causes).toEqual(['The escape does not allow that check.'])
  })

  it('refuses a second escape once the effect has ended', async () => {
    const room = await escapeRoom({ autoRoll: true, faces: [20, 20] })
    expect((await escape(room)).type).toBe('COMMAND_COMMITTED')
    const { answer, causes } = await invalidEscape(room)
    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', code: 'UNAVAILABLE' })
    expect(causes).toEqual(['The creature is not held by an effect it can escape.'])
    expect((await escapeState(room)).outputs).toHaveLength(1)
  })

  it('refuses a player who does not control the holder', async () => {
    const room = await escapeRoom({ autoRoll: true, faces: [20] })
    const refused = await room.sendAsPlayer(await escapeCommand(room))
    expect(refused.type, JSON.stringify(refused)).toBe('COMMAND_REJECTED')
    expect((await escapeState(room)).effectIds).toEqual([EFFECT_ID])
  })

  it('refuses an escape out of turn', async () => {
    const room = await escapeRoom({ autoRoll: true, faces: [20], grapplerTurn: true })
    const refused = await escape(room)
    expect(refused).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'NOT_CURRENT_ACTOR' })
    const state = await escapeState(room)
    expect(state.outputs).toEqual([])
    expect(state.spent).toBe(0)
  })

  it('lets the GM escape for a holder a player controls', async () => {
    const room = await escapeRoom({
      autoRoll: true,
      faces: [20],
      playerControlledActorIds: [HOLDER_ID]
    })
    const answer = await escape(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect((await escapeState(room)).outputs).toMatchObject([
      { actorId: HOLDER_ID, outcome: 'ESCAPED' }
    ])
  })

  it('replays the same command without escaping or spending again', async () => {
    const room = await escapeRoom({ autoRoll: true, faces: [8, 20] })
    const command = await escapeCommand(room)
    expect((await room.send(command)).type).toBe('COMMAND_COMMITTED')
    const version = await room.version()
    const before = await escapeState(room)

    const replayed = await room.send(command)
    expect(replayed.type, JSON.stringify(replayed)).toBe('COMMAND_COMMITTED')
    expect(await room.version()).toBe(version)
    expect(await escapeState(room)).toEqual(before)
    expect(before.outputs).toMatchObject([{ outcome: 'FAILED' }])
  })

  it('offers the holder its escape, naming the grappler only to those who can see it', async () => {
    const seen = await escapeRoom({ autoRoll: false, playerControlledActorIds: [HOLDER_ID] })
    const expected = [
      {
        activeEffectId: EFFECT_ID,
        dc: DC,
        actionCost: 'ACTION',
        checks: [{ checkDefinitionId: ATHLETICS }, { checkDefinitionId: STRENGTH }]
      }
    ]
    expect((await seen.actionChoices()).escapes).toMatchObject(expected)
    expect((await seen.actionChoicesAsPlayer(HOLDER_ID)).escapes).toMatchObject([
      { ...expected[0], label: `Escape from ${plainWolf.label}` }
    ])

    const hidden = await escapeRoom({
      autoRoll: false,
      hideGrappler: true,
      playerControlledActorIds: [HOLDER_ID]
    })
    expect((await hidden.actionChoicesAsPlayer(HOLDER_ID)).escapes).toMatchObject([
      { ...expected[0], label: 'Escape a grapple' }
    ])
    expect((await hidden.actionChoices()).escapes).toMatchObject([
      { label: `Escape from ${plainWolf.label}` }
    ])
  })

  it('lets the player who controls the holder escape', async () => {
    const room = await escapeRoom({
      autoRoll: true,
      faces: [20],
      playerControlledActorIds: [HOLDER_ID]
    })
    const answer = await room.sendAsPlayer(await escapeCommand(room))
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect((await escapeState(room)).effectIds).toEqual([])
  })

  it('undoes a failed escape by returning the Action', async () => {
    const room = await escapeRoom({ autoRoll: true, faces: [8] })
    expect((await escape(room)).type).toBe('COMMAND_COMMITTED')
    expect((await escapeState(room)).spent).toBe(1)

    const undone = await undo(room)
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')

    const state = await escapeState(room)
    expect(state.spent).toBe(0)
    expect(state.effectIds).toEqual([EFFECT_ID])
    expect(state.conditions).toEqual(HELD)
  })

  it('refuses to undo an escape that freed the holder', async () => {
    const room = await escapeRoom({ autoRoll: true, faces: [20] })
    expect((await escape(room)).type).toBe('COMMAND_COMMITTED')

    const refused = await undo(room)
    expect(refused).toMatchObject({
      type: 'COMMAND_REJECTED',
      message: "Undo can't restore an escaped grapple; adjust manually."
    })
    expect((await escapeState(room)).effectIds).toEqual([])
  })

  describe('undoing the prompted answer', () => {
    it('returns the Action of a failed escape', async () => {
      const room = await escapeRoom({ autoRoll: false })
      expect((await escape(room)).type).toBe('COMMAND_COMMITTED')
      expect((await answerD20(room, 8)).type).toBe('COMMAND_COMMITTED')
      expect((await escapeState(room)).spent).toBe(1)

      const undone = await undo(room)
      expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
      const state = await escapeState(room)
      expect(state.spent).toBe(0)
      expect(state.effectIds).toEqual([EFFECT_ID])
      expect(state.conditions).toEqual(HELD)
    })

    it('refuses once the answer freed the holder', async () => {
      const room = await escapeRoom({ autoRoll: false })
      expect((await escape(room)).type).toBe('COMMAND_COMMITTED')
      expect((await answerD20(room, 9)).type).toBe('COMMAND_COMMITTED')

      expect(await undo(room)).toMatchObject({
        type: 'COMMAND_REJECTED',
        message: "Undo can't restore an escaped grapple; adjust manually."
      })
      const state = await escapeState(room)
      expect(state.effectIds).toEqual([])
      expect(state.spent).toBe(1)
    })
  })
})

describe('a die the holder holds for after the d20, in the Escape room (SPELLS-31.T4c1a2)', () => {
  /** The holder enters a natural `face` (7: Athletics total 11 against DC 13) and meets the window. */
  async function openWindow(room: EscapeRoom, face = 7) {
    const answer = await escape(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const opened = await answerD20(room, face)
    expect(opened.type, JSON.stringify(opened)).toBe('COMMAND_COMMITTED')
    expect((await escapeState(room)).outputs).toEqual([])
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'D20_WINDOW') throw new Error('Expected the d20 window.')
    return { decision, pending: decision.pending }
  }

  it('offers the die once the d20 is seen, and spending it turns a miss into an escape and ends the die', async () => {
    const room = await escapeRoom({ autoRoll: false, heldDie: heldDieEffect() })
    const { decision, pending } = await openWindow(room)
    expect(pending).toMatchObject({
      rollerActorId: HOLDER_ID,
      d20: { selectedNatural: 7, total: 11 },
      options: [{ label: 'Guidance', count: 1, faces: 4, sign: 'ADD' }]
    })
    expect((await escapeState(room)).effectIds).toHaveLength(2)

    const settled = await room.resolve(decision, {
      kind: 'D20_WINDOW_USE',
      requestId: pending.requestId,
      optionId: pending.options[0]!.optionId,
      faces: [3]
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')

    const state = await escapeState(room)
    expect(state.outputs).toMatchObject([
      {
        d20: {
          selectedNatural: 7,
          total: 14,
          addedDice: [{ label: 'Guidance', rolledFaces: [3] }]
        },
        outcome: 'ESCAPED',
        removedConditionIds: HELD
      }
    ])
    expect(state.occurrences.map((occurrence) => occurrence.state)).toEqual(['COMPLETED'])
    // The grapple and the spent Guidance die have both ended.
    expect(state.effectIds).toEqual([])
    expect(state.conditions).toEqual([])
  })

  it('keeps the roll and the die when the holder declines', async () => {
    const room = await escapeRoom({ autoRoll: false, heldDie: heldDieEffect() })
    const { decision, pending } = await openWindow(room)
    const settled = await room.resolve(decision, {
      kind: 'D20_WINDOW_DECLINE',
      requestId: pending.requestId
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
    const state = await escapeState(room)
    expect(state.outputs).toMatchObject([{ d20: { total: 11 }, outcome: 'FAILED' }])
    expect(state.effectIds).toHaveLength(2)
    expect(state.conditions).toEqual(HELD)
  })

  it('gives the spent die back with the Action when the GM undoes an escape the die could not save', async () => {
    const room = await escapeRoom({ autoRoll: false, heldDie: heldDieEffect() })
    const before = await escapeState(room)
    // A natural 2 is 6; the d4 of 3 makes 9, still short of DC 13.
    const { decision, pending } = await openWindow(room, 2)
    const settled = await room.resolve(decision, {
      kind: 'D20_WINDOW_USE',
      requestId: pending.requestId,
      optionId: pending.options[0]!.optionId,
      faces: [3]
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
    const spent = await escapeState(room)
    expect(spent.outputs).toMatchObject([{ d20: { total: 9 }, outcome: 'FAILED' }])
    expect(spent.effectIds).toEqual([EFFECT_ID])

    const undone = await undo(room)
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    const restored = await escapeState(room)
    expect(restored.effectIds.sort()).toEqual([...before.effectIds].sort())
    expect(restored.spent).toBe(before.spent)
  })

  it('offers a homebrew die authored differently (two dice, Strength only) through the same path', async () => {
    const room = await escapeRoom({
      autoRoll: false,
      heldDie: heldDieEffect({ count: 2, ability: 'STRENGTH' })
    })
    const { decision, pending } = await openWindow(room)
    expect(pending.options).toMatchObject([{ count: 2, faces: 4 }])
    const settled = await room.resolve(decision, {
      kind: 'D20_WINDOW_USE',
      requestId: pending.requestId,
      optionId: pending.options[0]!.optionId,
      faces: [1, 1]
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
    expect((await escapeState(room)).outputs).toMatchObject([
      { d20: { total: 13 }, outcome: 'ESCAPED' }
    ])
  })

  it('offers no die whose ability the check is not, and settles the d20 at once', async () => {
    const room = await escapeRoom({
      autoRoll: false,
      heldDie: heldDieEffect({ ability: 'WISDOM' })
    })
    await escape(room)
    const settled = await answerD20(room, 7)
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
    expect((await escapeState(room)).outputs).toMatchObject([
      { d20: { total: 11 }, outcome: 'FAILED' }
    ])
  })

  it('asks a holder who rolls automatically for the d20 while it holds a die', async () => {
    const room = await escapeRoom({ autoRoll: true, faces: [9], heldDie: heldDieEffect() })
    const answer = await escape(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect((await escapeState(room)).outputs).toEqual([])
    expect((await room.pendingDecision()).pending.kind).toBe('D20_EVIDENCE')
  })
})
