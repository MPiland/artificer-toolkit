import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { ruleCheckRollId } from '@artificer-toolkit/rules-runtime/encounterRuleCheckRolls'
import { sanctuary } from '@artificer-toolkit/source-data/srd/spells/sanctuary.js'
import { scorchingRay } from '@artificer-toolkit/source-data/srd/spells/scorching-ray.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  readPendingActionDecision,
  readPendingApplicationContext,
  readRoomHistory,
  readRoomRollCards
} from './roomHistoryReads.js'

/**
 * QUALITY-13.T1c5c: an incoming-gate ward save is one roll card, whoever made it: a single attack
 * and each ray of a list share one card path, for a passed save, a failed one and a turned ray's.
 * The SRD Sanctuary is the gate; the SRD Bite and Scorching Ray are the attacks.
 */

const ATTACKER_ID = testUuid(0x9f0)
const WARDED_ID = testUuid(0x9f1)
const WARDER_ACTOR_ID = testUuid(0x9f2)
const WARDER_ID = testUuid(0x9f3)
const CASTER_ACTOR_ID = testUuid(0x9f4)
const CASTER_ID = testUuid(0x9f5)
const OPEN_ID = testUuid(0x9f6)
/** Natural d20 faces: a save that passes any Sanctuary DC, one that fails it, and a hit. */
const SAVE_PASSES = 20
const SAVE_FAILS = 1
const HIT = 19

const bite = biteWolf('ATTACK')
const [warding] = sanctuary.effects ?? []

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const ward = (holderActorId: string) => {
  if (!warding) throw new Error('The SRD Sanctuary has no effect.')
  return seedModifierGrant({
    sourceActorId: WARDER_ACTOR_ID,
    holderActorId,
    lifecycle: {},
    effect: warding,
    sourceLabel: sanctuary.label
  })
}

/** The ward saves the room carded, in card order. */
async function wardCards(room: {
  room: { base: { stub: Parameters<typeof readRoomRollCards>[0] } }
}) {
  return (await readRoomRollCards(room.room.base.stub)).filter(
    ({ roll }) => roll.source.kind === 'SAVING_THROW' && roll.source.label.startsWith('Ward: ')
  )
}

async function labelOf(
  room: { room: { base: { stub: Parameters<typeof readRoomHistory>[0] } } },
  actorId: string
) {
  const actor = (await readRoomHistory(room.room.base.stub)).actors.find(({ id }) => id === actorId)
  if (!actor) throw new Error('The room holds no such actor.')
  return readStoredRunActor(actor).label
}

describe('a single attack’s ward save is one roll card', () => {
  function attackRoom(config: { rolls: number[]; autoRoll: 'BOTH' | 'PLAYER' }) {
    return actionRoom({
      actors: [
        srdCreatureActor({ id: ATTACKER_ID, creature: bite, disposition: 'HOSTILE' }),
        srdCreatureActor({ id: WARDED_ID, creature: plainWolf, disposition: 'FRIENDLY' }),
        characterActor({ id: WARDER_ACTOR_ID, characterId: WARDER_ID })
      ],
      ownerFeatureId: creatureFeature(bite, 'Bite').id,
      autoRoll: config.autoRoll,
      rolls: config.rolls,
      fallbackRoll: 0,
      characterSpellcasting: { spells: [sanctuary], prepared: [sanctuary.id] },
      seed: ward(WARDED_ID)
    })
  }

  async function startBite(room: Awaited<ReturnType<typeof attackRoom>>) {
    const { answer } = await room.startAction(WARDED_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  }

  async function enter(room: Awaited<ReturnType<typeof attackRoom>>, face: number) {
    const decision = await readPendingActionDecision(room.room.base.stub)
    if (decision?.pending.kind !== 'D20_EVIDENCE') throw new Error('No d20 request is pending.')
    const answer = await room.send(
      room.resolveCommand(decision, {
        kind: 'ENTER_DICE',
        requestId: decision.pending.request.requestId,
        rawFaces: [face],
        rollMode: 'NORMAL'
      })
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    return decision
  }

  it('cards the pass of an auto-rolled save once, from the attacker, with the d20 rolled', async () => {
    const room = await attackRoom({ autoRoll: 'BOTH', rolls: [SAVE_PASSES - 1, HIT - 1] })
    await startBite(room)

    const cards = await wardCards(room)
    expect(cards).toHaveLength(1)
    expect(cards[0]!.roll.characterLabel).toBe(await labelOf(room, ATTACKER_ID))
    expect(cards[0]!.roll.evidence.terms[0]).toMatchObject({ die: 20, rolls: [SAVE_PASSES] })
  })

  it('cards a prompted attacker’s passing save once, with the face they entered', async () => {
    const room = await attackRoom({ autoRoll: 'PLAYER', rolls: [] })
    await startBite(room)
    await enter(room, SAVE_PASSES)
    await enter(room, HIT)

    const cards = await wardCards(room)
    expect(cards).toHaveLength(1)
    expect(cards[0]!.roll.evidence.terms[0]).toMatchObject({ die: 20, rolls: [SAVE_PASSES] })
  })

  it('cards a failed save once, and the card stays when the lost attack is undone', async () => {
    const room = await attackRoom({ autoRoll: 'BOTH', rolls: [SAVE_FAILS - 1, HIT - 1] })
    await startBite(room)
    const offer = await readPendingActionDecision(room.room.base.stub)
    if (offer?.pending.kind !== 'ATTACK_RETARGET_CHOICE') throw new Error('No retarget is pending.')
    const lost = await room.resolve(offer, { kind: 'DECLINE' })
    expect(lost.type, JSON.stringify(lost)).toBe('COMMAND_COMMITTED')

    const cards = await wardCards(room)
    expect(cards).toHaveLength(1)
    expect(cards[0]!.roll.id).toBe(ruleCheckRollId(offer.occurrence.id, 0, 'ward-save'))
    expect(cards[0]!.roll.evidence.terms[0]).toMatchObject({ die: 20, rolls: [SAVE_FAILS] })

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    // A roll card is a table record: undoing the action does not unsay the roll (D173).
    expect(await wardCards(room)).toEqual(cards)
  })

  it('cards a prompted attacker’s failing save once, from the attacker', async () => {
    const room = await attackRoom({ autoRoll: 'PLAYER', rolls: [] })
    await startBite(room)
    const asked = await enter(room, SAVE_FAILS)
    const offer = await readPendingActionDecision(room.room.base.stub)
    if (offer?.pending.kind !== 'ATTACK_RETARGET_CHOICE') throw new Error('No retarget is pending.')
    expect((await room.resolve(offer, { kind: 'DECLINE' })).type).toBe('COMMAND_COMMITTED')

    const cards = await wardCards(room)
    expect(cards.map(({ roll }) => roll.id)).toEqual([
      ruleCheckRollId(asked.occurrence.id, 0, 'ward-save')
    ])
    expect(cards[0]!.roll.characterLabel).toBe(await labelOf(room, ATTACKER_ID))
  })
})

describe('each ray’s ward save is one roll card', () => {
  const rayRoom = (config: { autoRoll?: 'EVERYONE'; rolls?: readonly number[] }) =>
    actionRoom({
      actors: [
        characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
        srdCreatureActor({
          id: WARDED_ID,
          creature: { ...plainWolf, hitPoints: 40 },
          currentHitPoints: 40
        }),
        srdCreatureActor({
          id: OPEN_ID,
          creature: { ...plainWolf, hitPoints: 40 },
          currentHitPoints: 40
        }),
        characterActor({ id: WARDER_ACTOR_ID, characterId: WARDER_ID })
      ],
      characterSpellcasting: { spells: [scorchingRay], prepared: [scorchingRay.id] },
      secondCharacter: {
        characterId: WARDER_ID,
        spellcasting: { spells: [sanctuary], prepared: [sanctuary.id] }
      },
      characterAction: (action) => action.label === 'Scorching Ray (2nd level)',
      ...(config.autoRoll && { autoRoll: config.autoRoll }),
      rolls: config.rolls ?? [],
      fallbackRoll: 0,
      seed: ward(WARDED_ID)
    })
  type Room = Awaited<ReturnType<typeof rayRoom>>

  async function cast(room: Room, targets: readonly string[]) {
    const { answer } = await room.startActorsAction(targets, [], true)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  }

  async function roll(room: Room, face: number) {
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the pending rolls.')
    const { request } = decision.pending.saves[0]!
    const answer = await room.send(
      room.resolveCommand(decision, {
        kind: 'ENTER_DICE',
        requestId: request.requestId,
        rawFaces: [face],
        rollMode: request.rollMode
      })
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  }

  async function entries(room: Room) {
    const context = await readPendingApplicationContext(room.room.base.stub)
    if (context.kind !== 'ENCOUNTER_AREA_ACTION') throw new Error('Expected the pending ray list.')
    return context.targets.map(({ snapshot }) => snapshot.occurrenceId)
  }

  async function offerAnswer(room: Room, answer: 'DECLINE' | { toward: string }) {
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'ATTACK_RETARGET_CHOICE')
      throw new Error('No retarget is pending.')
    const sent = await room.resolve(
      decision,
      answer === 'DECLINE'
        ? { kind: 'DECLINE' }
        : {
            kind: 'OPTION',
            optionId: decision.pending.options.find(
              ({ targetActorId }) => targetActorId === answer.toward
            )!.optionId
          }
    )
    expect(sent.type, JSON.stringify(sent)).toBe('COMMAND_COMMITTED')
  }

  it('cards a passed ray and a lost ray once each, and none for a ray no ward gates, from the caster', async () => {
    const room = await rayRoom({})
    await cast(room, [WARDED_ID, WARDED_ID, OPEN_ID])
    const [first, second] = await entries(room)

    await roll(room, SAVE_PASSES)
    await roll(room, HIT)
    await roll(room, SAVE_FAILS)
    await offerAnswer(room, 'DECLINE')
    await roll(room, HIT)

    const cards = await wardCards(room)
    // The ray at the creature under no ward owes no save, so it has no card.
    expect(cards.map(({ roll }) => roll.id)).toEqual([
      ruleCheckRollId(first!, 0, 'ward-save'),
      ruleCheckRollId(second!, 0, 'ward-save')
    ])
    expect(cards.map(({ roll }) => roll.evidence.terms[0])).toMatchObject([
      { die: 20, rolls: [SAVE_PASSES] },
      { die: 20, rolls: [SAVE_FAILS] }
    ])
    const caster = await labelOf(room, CASTER_ACTOR_ID)
    expect(cards.map(({ roll }) => roll.characterLabel)).toEqual([caster, caster])
  })

  it('cards each save of an auto-rolled list once', async () => {
    const room = await rayRoom({
      autoRoll: 'EVERYONE',
      rolls: [SAVE_FAILS - 1, SAVE_PASSES - 1, HIT - 1, 0, 0, HIT - 1]
    })
    await cast(room, [WARDED_ID, WARDED_ID, OPEN_ID])
    await offerAnswer(room, 'DECLINE')

    const cards = await wardCards(room)
    expect(cards.map(({ roll }) => roll.evidence.terms[0])).toMatchObject([
      { die: 20, rolls: [SAVE_FAILS] },
      { die: 20, rolls: [SAVE_PASSES] }
    ])
  })

  it('cards a turned ray’s failed save under that ray’s entry', async () => {
    const room = await rayRoom({})
    await cast(room, [WARDED_ID, OPEN_ID])
    const [first] = await entries(room)

    await roll(room, SAVE_FAILS)
    await offerAnswer(room, { toward: OPEN_ID })
    await roll(room, HIT)
    await roll(room, HIT)

    const cards = await wardCards(room)
    expect(cards.map(({ roll }) => roll.id)).toEqual([ruleCheckRollId(first!, 0, 'ward-save')])
    expect(cards[0]!.roll.evidence.terms[0]).toMatchObject({ die: 20, rolls: [SAVE_FAILS] })
  })

  it('keeps the cards when the list’s cast is undone', async () => {
    const room = await rayRoom({})
    await cast(room, [WARDED_ID, WARDED_ID])
    await roll(room, SAVE_FAILS)
    await offerAnswer(room, 'DECLINE')
    await roll(room, SAVE_FAILS)
    await offerAnswer(room, 'DECLINE')

    const cards = await wardCards(room)
    expect(cards).toHaveLength(2)
    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    // A roll card is a table record: undoing the action does not unsay the roll (D173).
    expect(await wardCards(room)).toEqual(cards)
  })
})
