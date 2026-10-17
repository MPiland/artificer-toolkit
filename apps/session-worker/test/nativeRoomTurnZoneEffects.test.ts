import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { spiritGuardians } from '@artificer-toolkit/source-data/srd/spells/spirit-guardians.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { hitPointsOf, readZones } from './placedZoneRoomReads.js'
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

const casterActor = {
  ...characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
  snapshot: { kind: 'CHARACTER' as const, id: CASTER_ID, systemId: srdSystemRecord.id }
}

/** The SRD Spirit Guardians cast by the Character, a Wisdom save at the start of a creature's turn. */
function auraRoom(wolfAt: { x: number; y: number }) {
  return actionRoom({
    actors: [casterActor, srdCreatureActor({ id: WOLF_ID, creature: plainWolf })],
    positions: { [WOLF_ID]: wolfAt },
    characterSpellcasting: { spells: [spiritGuardians], prepared: [spiritGuardians.id] },
    characterAction: (action) => action.label === 'Spirit Guardians (3rd level)',
    autoRoll: 'EVERYONE',
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
    const room = await auraRoom(INSIDE_THE_AURA)
    const zone = await castOnFirstTurn(room, () => room.startCasterCenteredAreaAction())
    // Real compile evidence: the SRD Spirit Guardians places a source zone that acts at a turn start.
    expect(zone.placement).toMatchObject({
      anchorKind: 'TOKEN',
      triggerModes: ['ENTER'],
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
    const room = await auraRoom(OUTSIDE_THE_AURA)
    await castOnFirstTurn(room, () => room.startCasterCenteredAreaAction())
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
