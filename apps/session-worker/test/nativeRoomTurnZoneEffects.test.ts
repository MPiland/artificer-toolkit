import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { planEncounterPlacedZone } from '@artificer-toolkit/rules-runtime/encounterPlacedZone'
import { zonePlacementOf } from '@artificer-toolkit/rules-runtime/testing/authoredZoneFixture'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { SRD, srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import { authoredZone } from '@artificer-toolkit/rules-runtime/testing/encounterTurnZoneFixture'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { spiritGuardians } from '@artificer-toolkit/source-data/srd/spells/spirit-guardians.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  endConcentrationAtSheet,
  hitPointsOf,
  readMaintainedStates,
  readSheetStreamVersion,
  readZones,
  choiceOptionIdOf
} from './placedZoneRoomReads.js'
import { parseReceiptExecution, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-20 T4b2b2: turn-boundary zone effects through the public ADVANCE_TURN and
 * RESOLVE_RULE_OCCURRENCE commands of the real local room. The zones are placed by real casts (the
 * SRD Spirit Guardians aura, and the SRD Caltrops authored from core options to act at the end of a
 * turn); the stored receipt is the room's own history (D85, D88), so it is read here, not in Convex.
 */

const CASTER_ACTOR_ID = testUuid(0x2240)
const CASTER_ID = testUuid(0x2241)
const WOLF_ID = testUuid(0x2242)

/** Every die the room rolls shows this face (zero-based): each save is a 2, each d8 a 2. */
const DIE = 1
const AURA_DAMAGE = 3 * (DIE + 1)
const CALTROPS_DAMAGE = 1

/** The caster stands at (150, 150); a token is 100 px and the aura reaches 300 px past its edge. */
const INSIDE_THE_AURA = { x: 150, y: 450 }
const OUTSIDE_THE_AURA = { x: 150, y: 650 }
const FIELD_POINT = { x: 250, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

type Room = Awaited<ReturnType<typeof actionRoom>>

/** The aura's cast picks radiant damage, the SRD's choice for a caster who is not evil (D140). */
const castRadiantAura = (room: Room) =>
  room.startCasterCenteredAreaAction([], 'GM', {
    choiceOptionId: choiceOptionIdOf(spiritGuardians, 'Radiant')
  })

const casterActor = {
  ...characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
  snapshot: { kind: 'CHARACTER' as const, id: CASTER_ID, systemId: srdSystemRecord.id }
}

/**
 * The SRD Spirit Guardians cast by the Character, a Wisdom save at the start of a creature's turn;
 * `autoRoll` is off when a test answers the dice.
 */
function auraRoom(
  wolfAt: { x: number; y: number },
  autoRoll?: Parameters<typeof actionRoom>[0]['autoRoll']
) {
  return actionRoom({
    actors: [casterActor, srdCreatureActor({ id: WOLF_ID, creature: plainWolf })],
    positions: { [WOLF_ID]: wolfAt },
    characterSpellcasting: { spells: [spiritGuardians], prepared: [spiritGuardians.id] },
    characterAction: (action) => action.label === 'Spirit Guardians (3rd level)',
    autoRoll,
    fallbackRoll: DIE
  })
}

/** The SRD Caltrops with its zone acting at the end of a creature's turn instead of on entry. */
function endOfTurnCaltrops(): EquipmentAuthored {
  const equipment = structuredClone(caltropsBagOf20)
  const path = equipment.effects?.[0]?.paths[0]
  const outcome = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
  const component =
    outcome?.effectKind === 'MANIFEST' && outcome.manifestKind === 'ZONE'
      ? outcome.components?.[0]
      : undefined
  if (!component) throw new Error('Caltrops must author one zone component.')
  component.interactionKinds = ['END_TURN_IN_SPACE']
  return equipment
}

/** The Character spreads the caltrops under the Wolf; `autoRoll` is off when a test answers the dice. */
function fieldRoom(autoRoll?: Parameters<typeof actionRoom>[0]['autoRoll']) {
  const caltrops = endOfTurnCaltrops()
  return actionRoom({
    actors: [casterActor, srdCreatureActor({ id: WOLF_ID, creature: plainWolf })],
    positions: { [WOLF_ID]: FIELD_POINT },
    characterEquipment: [caltrops],
    characterAction: (action) => action.label === caltrops.label,
    autoRoll,
    fallbackRoll: DIE
  })
}

/** The ADVANCE_TURN command from the Run's current version, sendable again as an exact retry. */
async function advanceCommand(room: Room) {
  const command = {
    type: 'ADVANCE_TURN',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  }
  return { commandId: command.commandId, send: () => room.send(command) }
}

/** The zone phases the stored receipt of `commandId` keeps, whichever result shape carried them. */
async function storedZonePhases(room: Room, commandId: string) {
  const receipt = (await readRoomHistory(room.room.base.stub)).receipts.find(
    (candidate) => candidate.commandId === commandId
  )
  if (!receipt) throw new Error('The command left no receipt.')
  const result = parseReceiptExecution(receipt)
  return {
    receipt,
    outgoing: 'outgoingZoneEffects' in result ? result.outgoingZoneEffects : undefined,
    incoming: 'incomingZoneEffects' in result ? result.incomingZoneEffects : undefined
  }
}

async function runStateOf(room: Room) {
  const [run] = (await readRoomHistory(room.room.base.stub)).runs
  if (!run) throw new Error('The room holds no Run.')
  return readRunState(run)
}

async function castOnFirstTurn(room: Room, cast: () => ReturnType<Room['startAreaAction']>) {
  const { answer } = await cast()
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const [zone, ...others] = await readZones(room)
  expect(others).toEqual([])
  if (!zone) throw new Error('The cast left no zone.')
  return zone
}

describe('a room ADVANCE_TURN with turn-boundary zone effects (SPELLS-20 T4b2b2)', () => {
  it('rolls the incoming creature’s Spirit Guardians save at its turn start, applies the damage in the same commit and replays exactly', async () => {
    const room = await auraRoom(INSIDE_THE_AURA, 'EVERYONE')
    const zone = await castOnFirstTurn(room, () => castRadiantAura(room))
    // Real compile evidence: the SRD Spirit Guardians places a source zone that acts at a turn start.
    expect(zone.placement).toMatchObject({
      anchorKind: 'TOKEN',
      triggerModes: ['ENTER', 'CROSS'],
      turnTriggers: ['START_OF_TURN']
    })
    const hitPointsBefore = await hitPointsOf(room, WOLF_ID)
    const { turnSequence } = await runStateOf(room)

    const advance = await advanceCommand(room)
    const answer = await advance.send()
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const { outgoing, incoming } = await storedZonePhases(room, advance.commandId)
    // The caster ends its turn inside its own aura, which authors no end-of-turn trigger.
    expect(outgoing).toBeUndefined()
    expect(incoming).toMatchObject({
      kind: 'EXECUTED',
      executions: [
        {
          ordinal: 0,
          candidate: {
            boundaryOrdinal: 1,
            candidate: { effectId: zone.id, targetActorId: WOLF_ID }
          },
          applications: [expect.objectContaining({ kind: 'DAMAGE', appliedAmount: AURA_DAMAGE })]
        }
      ],
      characterTransitions: [],
      encounterActorTransitions: [{ targetActorId: WOLF_ID }]
    })
    expect(await hitPointsOf(room, WOLF_ID)).toBe((hitPointsBefore ?? 0) - AURA_DAMAGE)
    expect((await runStateOf(room)).zoneApplications).toEqual({
      [`${zone.id}:${WOLF_ID}`]: { turnSequence: turnSequence + 1, count: 1 }
    })

    // An exact retry replays the journal: the same answer, no dice and no new row of any kind.
    const held = await readRoomHistory(room.room.base.stub)
    const dice = room.room.diceDrawn()
    expect(await advance.send()).toEqual(answer)
    expect(room.room.diceDrawn()).toBe(dice)
    expect(await readRoomHistory(room.room.base.stub)).toEqual(held)
  })

  it('applies an outgoing creature’s end-of-turn zone and leaves an outgoing creature outside any zone untouched', async () => {
    const room = await fieldRoom('EVERYONE')
    const zone = await castOnFirstTurn(room, () => room.startAreaAction(FIELD_POINT))
    expect(zone.placement).toMatchObject({ turnTriggers: ['END_OF_TURN'] })
    const hitPointsBefore = await hitPointsOf(room, WOLF_ID)

    // The caster stands outside the field when its turn ends; the field acts at no turn start.
    const castersTurn = await advanceCommand(room)
    expect((await castersTurn.send()).type).toBe('COMMAND_COMMITTED')
    const first = await storedZonePhases(room, castersTurn.commandId)
    expect(first.outgoing).toBeUndefined()
    expect(first.incoming).toBeUndefined()
    expect(await hitPointsOf(room, WOLF_ID)).toBe(hitPointsBefore)

    // The Wolf ends its turn standing in the field.
    const wolfsTurn = await advanceCommand(room)
    const answer = await wolfsTurn.send()
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const second = await storedZonePhases(room, wolfsTurn.commandId)
    expect(second.incoming).toBeUndefined()
    expect(second.outgoing).toMatchObject({
      kind: 'EXECUTED',
      executions: [
        {
          ordinal: 0,
          candidate: {
            boundaryOrdinal: 0,
            candidate: { effectId: zone.id, targetActorId: WOLF_ID }
          },
          applications: [
            expect.objectContaining({ kind: 'DAMAGE', appliedAmount: CALTROPS_DAMAGE })
          ]
        }
      ],
      encounterActorTransitions: [{ targetActorId: WOLF_ID }]
    })
    expect(await hitPointsOf(room, WOLF_ID)).toBe((hitPointsBefore ?? 0) - CALTROPS_DAMAGE)

    const held = await readRoomHistory(room.room.base.stub)
    const dice = room.room.diceDrawn()
    expect(await wolfsTurn.send()).toEqual(answer)
    expect(room.room.diceDrawn()).toBe(dice)
    expect(await readRoomHistory(room.room.base.stub)).toEqual(held)
  })

  it('keeps the stored result free of zone phases for a turn no zone catches anyone in', async () => {
    const room = await auraRoom(OUTSIDE_THE_AURA, 'EVERYONE')
    await castOnFirstTurn(room, () => castRadiantAura(room))
    const hitPointsBefore = await hitPointsOf(room, WOLF_ID)

    const advance = await advanceCommand(room)
    expect((await advance.send()).type).toBe('COMMAND_COMMITTED')

    const { receipt, outgoing, incoming } = await storedZonePhases(room, advance.commandId)
    expect(outgoing).toBeUndefined()
    expect(incoming).toBeUndefined()
    expect(receipt.resultJson).not.toContain('outgoingZoneEffects')
    expect(receipt.resultJson).not.toContain('incomingZoneEffects')
    expect(await hitPointsOf(room, WOLF_ID)).toBe(hitPointsBefore)
    expect((await runStateOf(room)).zoneApplications).toBeUndefined()
  })

  /**
   * The terminal transaction refuses a stale plan ('Staged turn zone selection is stale.'), but no
   * public command can make one: the room refuses every command that could move a token or remove
   * the zone while the save is outstanding. This proves that fence, then the answer committing the
   * plan it staged.
   */
  it('lets nothing change the zone while its save is pending, so the staged plan commits as staged', async () => {
    const room = await fieldRoom()
    await castOnFirstTurn(room, () => room.startAreaAction(FIELD_POINT))
    const castersTurn = await advanceCommand(room)
    expect((await castersTurn.send()).type).toBe('COMMAND_COMMITTED')

    const wolfsTurn = await advanceCommand(room)
    const asked = await wolfsTurn.send()
    if (
      asked.type !== 'COMMAND_COMMITTED' ||
      asked.delta?.scope !== 'ENCOUNTER' ||
      !('occurrence' in asked.delta.result)
    )
      throw new Error(`Expected the pending save in the answer: ${JSON.stringify(asked)}`)
    const decision = asked.delta.result.occurrence?.pending
    if (decision?.kind !== 'D20_EVIDENCE') throw new Error('Expected the Wolf’s d20 save.')
    expect(decision.rollerActorId).toBe(WOLF_ID)

    const reverted = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(reverted).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'PENDING_DECISION' })

    const answered = await room.send({
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version(),
      occurrenceId: decision.occurrenceId,
      expectedOccurrenceVersion: decision.occurrenceVersion,
      correlationId: null,
      resolution: {
        kind: 'ENTER_DICE',
        requestId: decision.request.requestId,
        rawFaces: [DIE + 1],
        rollMode: decision.request.rollMode
      }
    })
    expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
    const stored = await readRoomHistory(room.room.base.stub)
    expect(stored.receipts.at(-1)?.resultJson).toContain('outgoingZoneEffects')
  })
})

describe('a room START with a turn-boundary zone (SPELLS-20 T4f)', () => {
  const SOURCE_ID = testUuid(0x2243)
  const ZONE_ID = testUuid(0x2244)
  const ZONE_POINT = { x: 150, y: 150 }

  /**
   * A Run not started yet whose first creature, the Wolf, stands in a placed zone acting at the start
   * of a turn: the real planner places the core-options zone (a Caltrops variant, DC 15, 1d4) that
   * a Zombie left before the Encounter began. Both roll the same die, so the Wolf's higher
   * initiative modifier puts it first.
   */
  function preparedRoom() {
    return actionRoom({
      actors: [
        srdCreatureActor({ id: WOLF_ID, creature: plainWolf }),
        srdCreatureActor({ id: SOURCE_ID, creature: srdByLabel(SRD.creatures, 'Zombie') })
      ],
      positions: { [WOLF_ID]: ZONE_POINT, [SOURCE_ID]: { x: 750, y: 750 } },
      ownerFeatureId: creatureFeature(plainWolf, 'Bite').id,
      status: 'PREPARED',
      autoRoll: 'EVERYONE',
      fallbackRoll: DIE,
      seed: async ({ spatial, encounterId }) => {
        const { id, definition, lifecycle, placement, spatialState } = planEncounterPlacedZone({
          zone: zonePlacementOf(authoredZone(['START_TURN_IN_SPACE'])),
          id: ZONE_ID,
          maintainedEffectStateId: null,
          encounterId,
          occurrenceId: testUuid(0x2245),
          rootCommandId: testUuid(0x2246),
          sourceActorId: SOURCE_ID,
          point: ZONE_POINT,
          area: { kind: 'CUBE', edgeLength: 100 },
          sourceToken: null,
          saveDc: null
        })
        await spatial.create({ id, definition, lifecycle, placement, spatialState })
      }
    })
  }

  it('rolls the first creature’s zone save as the Encounter starts, applies the damage in the same commit and replays exactly', async () => {
    const room = await preparedRoom()
    expect((await runStateOf(room)).status).toBe('PREPARED')
    const hitPointsBefore = await hitPointsOf(room, WOLF_ID)

    const start = {
      type: 'START',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    }
    const answer = await room.send(start)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const state = await runStateOf(room)
    expect(state).toMatchObject({ status: 'ACTIVE', round: 1, currentActorId: WOLF_ID })
    const { receipt, outgoing, incoming } = await storedZonePhases(room, start.commandId)
    expect(receipt.commandType).toBe('START')
    // No turn ends when the Encounter starts.
    expect(outgoing).toBeUndefined()
    expect(incoming).toMatchObject({
      kind: 'EXECUTED',
      executions: [
        {
          ordinal: 0,
          candidate: {
            boundaryOrdinal: 0,
            candidate: { effectId: ZONE_ID, targetActorId: WOLF_ID, trigger: 'START_OF_TURN' }
          },
          applications: [expect.objectContaining({ kind: 'DAMAGE', appliedAmount: DIE + 1 })]
        }
      ],
      encounterActorTransitions: [{ targetActorId: WOLF_ID }]
    })
    expect(await hitPointsOf(room, WOLF_ID)).toBe((hitPointsBefore ?? 0) - (DIE + 1))
    expect(state.zoneApplications).toEqual({
      [`${ZONE_ID}:${WOLF_ID}`]: { turnSequence: state.turnSequence, count: 1 }
    })

    const held = await readRoomHistory(room.room.base.stub)
    const dice = room.room.diceDrawn()
    expect(await room.send(start)).toEqual(answer)
    expect(room.room.diceDrawn()).toBe(dice)
    expect(await readRoomHistory(room.room.base.stub)).toEqual(held)
  })
})

/**
 * D138: a placed zone ends only with its source (Concentration, undo, deletion). Each of those, sent
 * while a save the zone asked for is outstanding, is refused with PENDING_DECISION, so the answer
 * commits the zone and the plan it staged and nothing is left pending against a zone that is gone.
 */
describe('a zone ending while its save is pending (SPELLS-20 T4f)', () => {
  /** The ways a placed aura can end in play, each sent while its save is pending. */
  async function endingsWhilePending(room: Room) {
    const sheetVersion = await readSheetStreamVersion(room, CASTER_ID)
    const maintained = await readMaintainedStates(room)
    const concentration = await endConcentrationAtSheet(room, CASTER_ID)
    // The refused Sheet write rolls back whole: the Sheet and the Concentration slot are untouched.
    expect(await readSheetStreamVersion(room, CASTER_ID)).toBe(sheetVersion)
    expect(await readMaintainedStates(room)).toEqual(maintained)
    const removal = await room.send({
      type: 'REMOVE_ACTOR',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version(),
      actorId: CASTER_ACTOR_ID
    })
    const undo = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    return { concentration, removal, undo }
  }

  const REFUSED = {
    concentration: { type: 'COMMAND_REJECTED', reason: 'PENDING_DECISION' },
    removal: { type: 'COMMAND_REJECTED', reason: 'PENDING_DECISION' },
    undo: { type: 'COMMAND_REJECTED', reason: 'PENDING_DECISION' }
  }

  it('refuses every end of the aura while a turn-start save it asked for is pending, then commits the staged plan', async () => {
    const room = await auraRoom(INSIDE_THE_AURA)
    const zone = await castOnFirstTurn(room, () => castRadiantAura(room))
    const advance = await advanceCommand(room)
    const asked = await advance.send()
    if (
      asked.type !== 'COMMAND_COMMITTED' ||
      asked.delta?.scope !== 'ENCOUNTER' ||
      !('occurrence' in asked.delta.result)
    )
      throw new Error(`Expected the pending save in the answer: ${JSON.stringify(asked)}`)
    const decision = asked.delta.result.occurrence?.pending
    if (decision?.kind !== 'D20_EVIDENCE') throw new Error('Expected the Wolf’s d20 save.')
    expect(decision.rollerActorId).toBe(WOLF_ID)

    expect(await endingsWhilePending(room)).toMatchObject(REFUSED)
    expect(await readZones(room)).toEqual([zone])

    const answered = await room.send({
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version(),
      occurrenceId: decision.occurrenceId,
      expectedOccurrenceVersion: decision.occurrenceVersion,
      correlationId: null,
      resolution: {
        kind: 'ENTER_DICE',
        requestId: decision.request.requestId,
        rawFaces: [DIE + 1],
        rollMode: decision.request.rollMode
      }
    })
    // The failed save asks for each of its damage dice; the last answer commits the staged turn.
    let reply = answered
    for (let die = 0; die < 8; die += 1) {
      const pending =
        reply.type === 'COMMAND_COMMITTED' &&
        reply.delta?.scope === 'ENCOUNTER' &&
        'occurrence' in reply.delta.result
          ? reply.delta.result.occurrence?.pending
          : null
      if (!pending) break
      if (pending.kind !== 'ACTION_OUTCOME_EVIDENCE') throw new Error('Expected a damage die.')
      reply = await room.send({
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: room.room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: await room.version(),
        occurrenceId: pending.occurrenceId,
        expectedOccurrenceVersion: pending.occurrenceVersion,
        correlationId: null,
        resolution: {
          kind: 'ENTER_INTEGER',
          requestId: pending.request.requestId,
          value: pending.request.min
        }
      })
      expect(reply.type, JSON.stringify(reply)).toBe('COMMAND_COMMITTED')
    }
    expect((await readRoomHistory(room.room.base.stub)).receipts.at(-1)?.resultJson).toContain(
      'incomingZoneEffects'
    )
  })

  it('refuses every end of the aura while a walk into it awaits its save, then resumes the paused walk', async () => {
    const room = await auraRoom(OUTSIDE_THE_AURA)
    const zone = await castOnFirstTurn(room, () => castRadiantAura(room))
    await room.advanceTurn()
    const walk = await room.room.move(
      [OUTSIDE_THE_AURA, INSIDE_THE_AURA],
      await room.version(),
      room.room.scene.version,
      room.room.scene.tokens[1]!.id
    )
    expect(walk.type, JSON.stringify(walk)).toBe('COMMAND_COMMITTED')
    expect((await room.room.pending())?.context.kind).toBe('ENCOUNTER_SPATIAL_MOVEMENT')

    expect(await endingsWhilePending(room)).toMatchObject(REFUSED)
    expect(await readZones(room)).toEqual([zone])

    const prompt = await room.room.pendingFor(true)
    if (prompt?.kind !== 'D20_EVIDENCE') throw new Error('Expected the Wolf’s d20 save.')
    const answered = await room.room.respond({
      kind: 'ENTER_DICE',
      requestId: prompt.request.requestId,
      rawFaces: [DIE + 1],
      rollMode: prompt.request.rollMode
    })
    expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
  })
})
