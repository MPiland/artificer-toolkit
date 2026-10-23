import { describe, expect, it } from 'vitest'
import type {
  EncounterCommandInputDto,
  EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import { barbarian } from '@artificer-toolkit/source-data/srd/classes/barbarian.js'
import { assistedPartyFixture, type AssistedParty } from '../../tests/fixtures/assistedParty'
import { declarationCommand } from '../../tests/fixtures/encounterInitiative'
import { domainRejection } from '../../tests/fixtures/playerControl'
import {
  checkpointLiveRoom,
  executeInRoom,
  queueRoomRolls,
  readRoomEncounterSession,
  readRoomRollCards,
  readRoomTimeline,
  useLocalRoomWorker,
  type RoomCaller
} from '../../tests/fixtures/localRoomWorker'
import { api } from '../_generated/api'

useLocalRoomWorker()

/**
 * ENCOUNTER-5.1: one Assisted Encounter with a GM and two players, each driving their own Character,
 * all three auto-rolling, through the real room from START to COMPLETE (ADR 0034). The criterion is the
 * Encounter flow each member receives, not what a page shows, so every read is the member's own
 * room frame or the table chat they would load.
 */

type Member = { caller: RoomCaller; userId: string }

/** A member's own view of the held Run: what the room sends that member's socket. */
async function viewOf(party: AssistedParty, member: Member) {
  const frame = await readRoomEncounterSession(member.caller, party.campaign.id, {
    timeline: false
  })
  if (!frame.held) throw new Error('Expected the room to hold the Run.')
  if (!frame.state.encounter) throw new Error('Expected an Encounter in the member view.')
  return frame.state.encounter
}

/** Runs one command at a time and keeps the Run's version for the next. */
function conductor() {
  let version = 0
  return {
    send: async (
      member: Member,
      command: (expectedVersion: number) => EncounterCommandInputDto
    ) => {
      const result = await executeInRoom(member.caller, { command: command(version) })
      version = result.projection.version
      return result
    }
  }
}

function start(party: AssistedParty) {
  return (expectedVersion: number): EncounterCommandInputDto => ({
    type: 'START',
    encounterId: party.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion
  })
}

function advance(party: AssistedParty) {
  return (expectedVersion: number): EncounterCommandInputDto => ({
    type: 'ADVANCE_TURN',
    encounterId: party.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion
  })
}

function complete(party: AssistedParty) {
  return (expectedVersion: number): EncounterCommandInputDto => ({
    type: 'COMPLETE',
    encounterId: party.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion
  })
}

/**
 * The table's declared-action initiative policy: START asks each actor's controller to declare, one
 * actor at a time, and the auto-roll preference lets the server make the d20 behind each declaration.
 * The three d20 faces (0-based) are 4, 9 and 14 in declaration order unless `rolls` says otherwise.
 * Returns the actors in that order.
 */
async function declarePartyInitiative(
  party: AssistedParty,
  send: ReturnType<typeof conductor>['send'],
  rolls = [4, 9, 14]
) {
  const controllers = new Map<string, Member>([
    [party.aria.actorId, party.aria.player],
    [party.bryn.actorId, party.bryn.player],
    [party.wolf.actorId, party.gm]
  ])
  await queueRoomRolls(party.campaign.id, { rolls })
  const declared: string[] = []
  for (let turn = 0; turn < controllers.size; turn += 1) {
    await checkpointLiveRoom(party.campaign.id)
    const pending = await party.gm.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
      encounterId: party.run.id
    })
    if (pending?.kind !== 'INITIATIVE_DECLARATION')
      throw new Error('Expected a pending initiative declaration.')
    const controller = controllers.get(pending.actorId)
    if (!controller) throw new Error('A declaring actor is not one of the three seated.')
    // A player settles only their own actor's declaration (the GM may adjudicate any): the other player
    // is refused, then the owner is accepted.
    for (const stranger of [party.aria.player, party.bryn.player])
      if (stranger !== controller)
        await expect(
          domainRejection(
            executeInRoom(stranger.caller, {
              command: declarationCommand({ encounterId: party.run.id, pending }).command
            })
          )
        ).resolves.toMatchObject({ reason: 'NOT_ACTOR_CONTROLLER' })
    await send(controller, () => declarationCommand({ encounterId: party.run.id, pending }).command)
    declared.push(pending.actorId)
  }
  return declared
}

function attack(party: AssistedParty, actorId: string, targetActorId: string, actionId: string) {
  return (expectedVersion: number): EncounterCommandInputDto => ({
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    // No Scene is bound, so reach can't be measured (D11).
    acknowledgedWarnings: ['TARGET_RANGE_UNCHECKED'],
    encounterId: party.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion,
    actorId,
    target: { kind: 'ACTOR', actorId: targetActorId },
    actionId,
    optionalCombatIntent: null,
    sceneContext: null
  })
}

function actorIds(party: AssistedParty) {
  return [party.aria.actorId, party.bryn.actorId, party.wolf.actorId]
}

describe('Three-user Assisted Encounter with auto-roll (ENCOUNTER-5.1)', () => {
  it('seats the GM and two players, each bound to their own Character, and keeps a player off the other’s', async () => {
    const party = await assistedPartyFixture()
    const { send } = conductor()
    await send(party.gm, start(party))
    await declarePartyInitiative(party, send)

    // The Run seats both Characters and the Creature; each Character belongs to its own player.
    const views = [party.gm, party.aria.player, party.bryn.player].map((member) =>
      viewOf(party, member)
    )
    for (const view of await Promise.all(views))
      expect(view.actors.map((actor) => actor.id).sort()).toEqual(actorIds(party).sort())

    // A player's command for the other player's Character is refused, and for the GM's Creature too.
    const stranger = attack(
      party,
      party.bryn.actorId,
      party.wolf.actorId,
      party.bryn.attackActionId
    )
    await expect(
      domainRejection(
        executeInRoom(party.aria.player.caller, { command: stranger(await party.version()) })
      )
    ).resolves.toMatchObject({ reason: 'NOT_ACTOR_CONTROLLER' })
    const forWolf = attack(party, party.wolf.actorId, party.aria.actorId, party.wolf.attackActionId)
    await expect(
      domainRejection(
        executeInRoom(party.bryn.player.caller, { command: forWolf(await party.version()) })
      )
    ).resolves.toMatchObject({ reason: 'NOT_ACTOR_CONTROLLER' })
  }, 180000)

  it('auto-rolls each actor’s initiative for its controller and every member reads the same order and the same roll cards', async () => {
    const party = await assistedPartyFixture()
    const { send } = conductor()
    await send(party.gm, start(party))
    const declared = await declarePartyInitiative(party, send)

    // Premise: the auto-rolled d20s (5, 10, 15 plus modifiers) rose with each declaration, so the stored
    // initiative scores rise in declaration order and the last declarer must lead the turn order.
    await checkpointLiveRoom(party.campaign.id)
    const scores = await party.t.run(async (ctx) =>
      Promise.all(
        declared.map(async (actorId) => {
          const row = await ctx.db
            .query('encounterInitiativeParticipants')
            .withIndex('by_encounterId_round_actorId', (query) =>
              query.eq('encounterId', party.run.id).eq('round', 1).eq('actorId', actorId)
            )
            .unique()
          if (!row) throw new Error('Missing a stored initiative participant.')
          return row.initiativeScore
        })
      )
    )
    expect(scores[0]!).toBeLessThan(scores[1]!)
    expect(scores[1]).toBeLessThan(scores[2]!)

    // Every member loads one Initiative card per declared actor, in declaration order: the d20 each
    // declaration rolled, and the total that became the stored score (ENCOUNTER-9.1).
    const members = [party.gm, party.aria.player, party.bryn.player]
    const labelOf = (actorId: string) =>
      party.run.actors.find((actor) => actor.id === actorId)?.label ?? 'missing'
    const initiativeCardsBy = await Promise.all(
      members.map(async (member) =>
        (await readRoomRollCards(member.caller, party.campaign.id)).filter(
          (card) => card.source.kind === 'INITIATIVE'
        )
      )
    )
    for (const cards of initiativeCardsBy) {
      expect(cards.map((card) => card.characterLabel)).toEqual(declared.map(labelOf))
      expect(cards.map((card) => card.evidence.terms[0]?.rolls)).toEqual([[5], [10], [15]])
      expect(cards.map((card) => card.evidence.total)).toEqual(scores)
      expect(cards).toEqual(initiativeCardsBy[0])
    }

    // Every member reads that same order, last declarer first.
    for (const actorId of [...declared].reverse()) {
      for (const member of members)
        expect(await viewOf(party, member)).toMatchObject({ round: 1, currentActorId: actorId })
      await send(party.gm, advance(party))
    }
    for (const member of members)
      expect(await viewOf(party, member)).toMatchObject({
        round: 2,
        currentActorId: declared[2]
      })
  }, 180000)

  it('auto-rolls two d20s for each advantage Character and every member reads the same one card with both faces', async () => {
    const feralInstinct = barbarian.features?.find((feature) => feature.label === 'Feral Instinct')
    if (!feralInstinct) throw new Error('Missing SRD Feral Instinct.')
    const party = await assistedPartyFixture({
      features: [{ ...feralInstinct, availableAtLevel: 1, effects: [] }]
    })
    const { send } = conductor()
    await send(party.gm, start(party))
    // The fixture's class feature reaches both Characters, so Aria and Bryn each take two dice and the
    // Wolf one, in whatever order they declare. The faces keep the three best scores at least nine
    // apart for every order the actors can declare in: a tie would draw unqueued platform dice and,
    // tied again, leave the Run waiting on a manual order choice.
    const declared = await declarePartyInitiative(party, send, [0, 1, 10, 2, 19])
    await checkpointLiveRoom(party.campaign.id)
    const scoreOf = (actorId: string) =>
      party.t.run(async (ctx) => {
        const row = await ctx.db
          .query('encounterInitiativeParticipants')
          .withIndex('by_encounterId_round_actorId', (query) =>
            query.eq('encounterId', party.run.id).eq('round', 1).eq('actorId', actorId)
          )
          .unique()
        if (!row) throw new Error('Missing a stored initiative participant.')
        return row.initiativeScore
      })
    const members = [party.gm, party.aria.player, party.bryn.player]
    const initiativeCardsBy = await Promise.all(
      members.map(async (member) =>
        (await readRoomRollCards(member.caller, party.campaign.id)).filter(
          (card) => card.source.kind === 'INITIATIVE'
        )
      )
    )
    const labelOf = (actorId: string) =>
      party.run.actors.find((actor) => actor.id === actorId)?.label ?? 'missing'
    for (const cards of initiativeCardsBy) {
      expect(cards.map((card) => card.characterLabel)).toEqual(declared.map(labelOf))
      for (const [index, card] of cards.entries()) {
        const advantage = declared[index] !== party.wolf.actorId
        const [term] = card.evidence.terms
        expect(card.evidence.keep).toBe(advantage ? 'HIGHER' : 'FIRST')
        expect(term?.rolls).toHaveLength(advantage ? 2 : 1)
        expect(card.evidence.total).toBe(await scoreOf(declared[index]!))
      }
      expect(cards).toEqual(initiativeCardsBy[0])
    }
    for (const card of initiativeCardsBy[0]!.filter(
      (candidate) => candidate.evidence.mode === 'ADVANTAGE'
    ))
      expect(card.evidence.terms[0]?.subtotal).toBe(Math.max(...card.evidence.terms[0]!.rolls))
  }, 180000)

  it('plays one full round of auto-rolled attacks, then the GM completes it and all three see it end', async () => {
    const party = await assistedPartyFixture()
    const { send } = conductor()
    await send(party.gm, start(party))
    await declarePartyInitiative(party, send)

    const members = [party.gm, party.aria.player, party.bryn.player]
    const seats = [
      { ...party.aria, controller: party.aria.player, targetId: party.wolf.actorId },
      { ...party.bryn, controller: party.bryn.player, targetId: party.wolf.actorId },
      { ...party.wolf, controller: party.gm, targetId: party.aria.actorId }
    ]
    const turnOrder: string[] = []
    const first = await viewOf(party, party.gm)
    let currentActorId = first.currentActorId
    while (currentActorId && turnOrder.length < seats.length) {
      const seat = seats.find((candidate) => candidate.actorId === currentActorId)
      if (!seat) throw new Error('The current actor is not one of the three seated.')
      turnOrder.push(seat.actorId)
      // A hit for a player, a miss for the Creature: the d20 face, then the damage die.
      await queueRoomRolls(party.campaign.id, {
        rolls: seat.actorId === party.wolf.actorId ? [0] : [14, 0]
      })
      const acted = await send(
        seat.controller,
        attack(party, seat.actorId, seat.targetId, seat.attackActionId)
      )
      expect(acted.occurrence).toMatchObject({ status: 'COMPLETE' })
      const ended = await send(seat.controller, advance(party))
      currentActorId = ended.projection.currentActorId
    }
    expect(new Set(turnOrder).size).toBe(3)
    // The round wrapped: round 2, back to whoever acted first.
    for (const member of members) {
      const view = await viewOf(party, member)
      expect(view.round).toBe(2)
      expect(view.currentActorId).toBe(turnOrder[0])
    }

    // Every attack and its damage posted once to the table; every member loads the same cards.
    const cardsBy = await Promise.all(
      members.map((member) => readRoomRollCards(member.caller, party.campaign.id))
    )
    const [gmCards] = cardsBy
    if (!gmCards) throw new Error('Missing the GM cards.')
    for (const cards of cardsBy) expect(cards).toEqual(gmCards)
    // Each Character and the Wolf attacked once; only the two hits dealt damage (the Wolf missed).
    const labelOf = (actorId: string) =>
      party.run.actors.find((actor) => actor.id === actorId)?.label ?? 'missing'
    const ownersOf = (kind: string) =>
      gmCards
        .filter((card) => card.source.kind === kind)
        .map((card) => card.characterLabel)
        .sort()
    expect(ownersOf('ATTACK')).toEqual(
      [party.aria.actorId, party.bryn.actorId, party.wolf.actorId].map(labelOf).sort()
    )
    expect(ownersOf('DAMAGE')).toEqual([party.aria.actorId, party.bryn.actorId].map(labelOf).sort())
    expect(new Set(gmCards.map((card) => card.id)).size).toBe(gmCards.length)

    // Players read only the table's timeline entries; the GM reads them all.
    const gmTimeline = await readRoomTimeline(party.gm.caller, party.campaign.id)
    for (const player of [party.aria.player, party.bryn.player])
      expect(await readRoomTimeline(player.caller, party.campaign.id)).toEqual(
        gmTimeline.filter((entry) => entry.visibility === 'TABLE')
      )

    // The GM completes it; the Run ends for all three.
    const completed: EncounterCommandResultDto = await send(party.gm, complete(party))
    expect(completed.projection.status).toBe('COMPLETED')
    // The room releases the finished Run: no held frame for any member.
    for (const member of members)
      expect(
        await readRoomEncounterSession(member.caller, party.campaign.id, { timeline: false })
      ).toMatchObject({ held: false })
    expect(
      await party.gm.caller.query(api.encounters.projectionReads.get, { encounterId: party.run.id })
    ).toMatchObject({ status: 'COMPLETED' })
    for (const player of [party.aria.player, party.bryn.player])
      await expect(
        player.caller.query(api.encounters.projectionReads.get, { encounterId: party.run.id })
      ).rejects.toThrow('Encounter is unavailable.')
  }, 240000)
})
