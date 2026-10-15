import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { blackDragonWyrmling } from '@artificer-toolkit/source-data/srd/creatures/black-dragon-wyrmling.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { areaReceipts, vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets, connectPlayer } from './liveRoomFixture.js'
import {
  readPendingActionDecision,
  readPendingAreaForViewer,
  readRoomChatBodies,
  readRoomPrivateRollHolders,
  readRoomRollCards,
  readRoomHistory,
  readRoomTimeline,
  type RoomHistory
} from './roomHistoryReads.js'

const CASTER_ID = testUuid(0x800)
const ALLY_ID = testUuid(0x801)
const ENEMY_ID = testUuid(0x802)
const PHANTOM_ID = testUuid(0x803)
const FAR_ID = testUuid(0x804)
const OUTSIDER_ID = testUuid(0x999)
const NO_ONE = new Set<string>()
const INVISIBLE_ID = srdSystemRecord.conditionTypes.find(
  (condition) => condition.code === 'INVISIBLE'
)?.id

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * An SRD Wolf that casts the SRD Black Dragon Wyrmling's Acid Breath (5d8, DC 11 Dexterity, half on
 * a success) over a 20-foot sphere anywhere within 150 feet, the shape of Fireball. It senses nothing
 * of its own, so only plain sight and the Invisible condition decide what it perceives.
 */
function fireballCaster() {
  const breath = blackDragonWyrmling.features?.find(({ label }) => label.startsWith('Acid Breath'))
  if (!breath) throw new Error('The SRD Acid Breath action is missing.')
  const creature = creatureAuthoredDtoSchema.parse({
    ...plainWolf,
    senses: [],
    features: [
      ...(plainWolf.features ?? []),
      {
        ...breath,
        effects: breath.effects?.map((effect) => {
          if (effect.invocation.kind !== 'ACTION') throw new Error('Expected an action.')
          return {
            ...effect,
            invocation: {
              ...effect.invocation,
              range: {
                id: effect.invocation.range.id,
                rangeKind: 'DISTANCE' as const,
                amount: 150,
                unit: 'FEET' as const
              },
              targeting: {
                selectionKind: 'AREA_CONTENTS' as const,
                dispositionKind: 'ANY' as const
              },
              shape: {
                id: '00000000-0000-4000-8000-000000000c97',
                shapeKind: 'SPHERE' as const,
                radius: { amount: 20, unit: 'FEET' as const }
              }
            }
          }
        })
      }
    ]
  })
  return { creature, featureId: breath.id }
}

/**
 * The caster (a player's), then an ally, an enemy and an Invisible creature in the area, and a Wolf
 * out of it. The five dice of the damage roll come up 2, so Fireball deals 10: 10 on a failed save,
 * 5 on a success.
 */
async function journeyRoom(options: { otherPlayerControlledActorIds?: readonly string[] } = {}) {
  const { creature, featureId } = fireballCaster()
  const wolf = (label: string) => ({ ...plainWolf, label })
  return actionRoom({
    playerControlledActorIds: [CASTER_ID],
    otherPlayerControlledActorIds: options.otherPlayerControlledActorIds,
    rolls: [1, 1, 1, 1, 1],
    actors: [
      srdCreatureActor({ id: CASTER_ID, creature }),
      srdCreatureActor({ id: ALLY_ID, creature: wolf('Ally Wolf') }),
      srdCreatureActor({ id: ENEMY_ID, creature: wolf('Enemy Wolf') }),
      srdCreatureActor({
        id: PHANTOM_ID,
        creature: wolf('Phantom Wolf'),
        conditionIds: INVISIBLE_ID ? [INVISIBLE_ID] : []
      }),
      srdCreatureActor({ id: FAR_ID, creature: wolf('Far Wolf') })
    ],
    ownerFeatureId: featureId
  })
}
type Room = Awaited<ReturnType<typeof journeyRoom>>

const hitPointsOf = (history: RoomHistory, id: string) =>
  vitalsOf(history).find((vitals) => vitals.id === id)?.currentHitPoints

describe('Fireball journey', () => {
  const gmView = (room: Room) =>
    readPendingAreaForViewer(room.room.base.stub, { isOwner: true, controlledActorIds: NO_ONE })
  const playerView = (room: Room, controlled: string[]) =>
    readPendingAreaForViewer(room.room.base.stub, {
      isOwner: false,
      controlledActorIds: new Set(controlled)
    })
  const timelineEntry = async (room: Room, viewer: 'GM' | 'CASTER_PLAYER' | 'OUTSIDER') => {
    const { base } = room.room
    const page = await readRoomTimeline(base.stub, {
      player: viewer !== 'GM',
      userId:
        viewer === 'GM' ? base.userId : viewer === 'CASTER_PLAYER' ? base.playerId : OUTSIDER_ID
    })
    return { page, entry: page.entries.find((entry) => entry.commandType === 'RESOLVE_ACTION') }
  }
  /** `actorId`'s own save answered with one natural d20 face, by the GM or by the caster's player. */
  async function answerSave(room: Room, actorId: string, face: number, by: 'GM' | 'PLAYER') {
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    const save = decision.pending.saves.find((entry) => entry.actorId === actorId)
    if (!save) throw new Error('The creature has no pending save.')
    const command = room.resolveCommand(decision, {
      kind: 'ENTER_DICE',
      requestId: save.request.requestId,
      rawFaces: [face],
      rollMode: save.request.rollMode
    })
    const answered = by === 'GM' ? await room.send(command) : await room.sendAsPlayer(command)
    expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
  }

  it('catches the area for the right eyes, settles out of order, commits once and undoes whole', async () => {
    const room = await journeyRoom()
    const stub = room.room.base.stub
    const before = await readRoomHistory(stub)

    // 1. The caster's player targets a point; the area catches the caster, an ally, an enemy and a
    // creature the caster cannot perceive, and leaves the Wolf outside alone.
    const started = await room.startAreaAction({ x: 50, y: 150 }, [], 'PLAYER')
    expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')
    const opened = await gmView(room)
    expect(opened?.saves.map(({ actorId }) => actorId).sort()).toEqual(
      [CASTER_ID, ALLY_ID, ENEMY_ID, PHANTOM_ID].sort()
    )

    // 2. The GM sees every caught creature; the caster's player only those perceived; another
    // player none, and only their own prompt.
    expect(opened?.caught.slice().sort()).toEqual(
      ['Ally Wolf', 'Wolf', 'Enemy Wolf', 'Phantom Wolf'].sort()
    )
    const casterView = await playerView(room, [CASTER_ID])
    expect(casterView?.caught.slice().sort()).toEqual(['Ally Wolf', 'Wolf', 'Enemy Wolf'].sort())
    expect(casterView?.saves.map(({ actorId }) => actorId)).toEqual([CASTER_ID])
    expect(JSON.stringify(casterView)).not.toContain(PHANTOM_ID)
    expect(JSON.stringify(casterView)).not.toContain('Phantom')
    const otherView = await playerView(room, [ENEMY_ID])
    expect(otherView?.caught).toEqual([])
    expect(otherView?.saves.map(({ actorId }) => actorId)).toEqual([ENEMY_ID])
    expect(otherView?.caughtChecksum).toBeNull()
    expect(JSON.stringify(otherView)).not.toContain(PHANTOM_ID)

    // 3. The GM removes the ally; the caster's list shrinks, and nothing is on the timeline yet.
    const removed = await room.send(
      room.removeAreaTargetCommand(await room.pendingDecision(), ALLY_ID)
    )
    expect(removed.type, JSON.stringify(removed)).toBe('COMMAND_COMMITTED')
    expect((await playerView(room, [CASTER_ID]))?.caught.slice().sort()).toEqual(
      ['Wolf', 'Enemy Wolf'].sort()
    )
    expect(JSON.stringify((await timelineEntry(room, 'GM')).page)).not.toContain('removed')

    // 4. Saves are answered out of order, each by its creature's own roller. Nothing is damaged
    // until the last answer.
    await answerSave(room, PHANTOM_ID, 1, 'GM')
    expect(await readPendingActionDecision(stub)).not.toBeNull()
    await answerSave(room, CASTER_ID, 20, 'PLAYER')
    expect(vitalsOf(await readRoomHistory(stub))).toEqual(vitalsOf(before))
    expect((await playerView(room, [CASTER_ID]))?.saves).toEqual([])
    await answerSave(room, ENEMY_ID, 1, 'GM')

    // 5. The last answer commits the area once.
    expect(await readPendingActionDecision(stub)).toBeNull()
    const committed = await readRoomHistory(stub)
    const added = committed.commands.slice(before.commands.length)
    expect(added.map((entry) => entry.commandType)).toEqual(['RESOLVE_ACTION'])
    expect(added[0]?.commandId).toBe(started.command.commandId)
    const { roots, children } = areaReceipts(committed)
    expect(roots).toHaveLength(1)
    expect(roots[0]?.outputs).toMatchObject({
      sourceActorId: CASTER_ID,
      removedActorIds: [ALLY_ID]
    })
    expect(children).toHaveLength(3)

    // One damage roll for all: full on a failed save, half on a success, the ally and the outside
    // Wolf untouched.
    const damageTaken = (id: string) =>
      (hitPointsOf(before, id) ?? Number.NaN) - (hitPointsOf(committed, id) ?? Number.NaN)
    expect(damageTaken(ENEMY_ID)).toBe(10)
    expect(damageTaken(PHANTOM_ID)).toBe(10)
    expect(damageTaken(CASTER_ID)).toBe(5)
    expect(damageTaken(ALLY_ID)).toBe(0)
    expect(damageTaken(FAR_ID)).toBe(0)
    expect(
      vitalsOf(committed).find((vitals) => vitals.id === CASTER_ID)?.spent.length
    ).toBeGreaterThan(0)

    // The caster's results show what the caster perceived, and the unperceived failure unnamed.
    const caster = await timelineEntry(room, 'CASTER_PLAYER')
    expect(caster.entry?.visibility).toBe('ISSUER')
    expect(caster.entry?.issuerLines.slice().sort()).toEqual([
      'An unseen creature failed its save',
      'Enemy Wolf failed its save',
      'Wolf succeeded on its save'
    ])
    // The GM-only line is in the GM's history alone, after the commit.
    const gm = await timelineEntry(room, 'GM')
    expect(gm.entry?.gmLines).toEqual(['GM removed Ally Wolf from the area'])
    expect(caster.entry?.gmLines).toEqual([])
    const outsider = await timelineEntry(room, 'OUTSIDER')
    expect(outsider.entry).toBeUndefined()
    // No timeline, chat or table roll card a player holds names the unperceived creature or the
    // GM's removal; the GM's private history holds the unperceived creature's save card.
    const cards = await readRoomRollCards(stub)
    const tableCards = cards.filter((card) => card.audience === 'TABLE')
    for (const playerRead of [
      caster.page,
      outsider.page,
      await readRoomChatBodies(stub),
      tableCards
    ]) {
      expect(JSON.stringify(playerRead)).not.toContain('Phantom')
      expect(JSON.stringify(playerRead)).not.toContain(PHANTOM_ID)
      expect(JSON.stringify(playerRead)).not.toContain('removed')
    }
    expect(JSON.stringify(tableCards)).toContain('Enemy Wolf')
    expect(JSON.stringify(cards.filter((card) => card.audience === 'PRIVATE'))).toContain(
      'Phantom Wolf'
    )

    // 6. The GM's undo reverts every target and the source spend.
    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(vitalsOf(await readRoomHistory(stub))).toEqual(vitalsOf(before))
  })
})

describe('Fireball journey: a creature the caster cannot perceive, rolled by its own player (ATTACK-17.5)', () => {
  /** The room's answers to one command, in the order a member's socket received them. */
  const answersTo = (
    messages: Awaited<ReturnType<typeof connectPlayer>>['messages'],
    commandId: string
  ) =>
    messages.flatMap((message) =>
      message.type === 'COMMAND_COMMITTED' && message.commandId === commandId ? [message.delta] : []
    )
  const privateRollsIn = (deltas: ReturnType<typeof answersTo>) =>
    deltas.flatMap((delta) =>
      delta?.scope === 'CAMPAIGN_CHAT' && delta.privateRoll ? [delta.privateRoll] : []
    )
  const encounterRollIn = (deltas: ReturnType<typeof answersTo>) =>
    deltas.flatMap((delta) => (delta?.scope === 'ENCOUNTER' ? [delta.result.roll] : []))

  it('shows the roll to that player and the GM alone, never the caster or the table', async () => {
    const room = await journeyRoom({ otherPlayerControlledActorIds: [PHANTOM_ID] })
    const { base } = room.room
    const caster = await connectPlayer(base)
    const phantomPlayer = await connectPlayer(base, 'OTHER_PLAYER')

    // The caster's player casts the area over a creature they cannot perceive.
    const started = await room.startAreaAction({ x: 50, y: 150 }, [], 'PLAYER')
    expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')

    // The creature's own player presses "Roll dice" for its save.
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    const save = decision.pending.saves.find((entry) => entry.actorId === PHANTOM_ID)
    if (!save) throw new Error('The creature has no pending save.')
    const commandId = crypto.randomUUID()
    phantomPlayer.socket.send(
      JSON.stringify({
        type: 'COMMAND',
        expectedSessionSequence: 0,
        command: {
          scope: 'ENCOUNTER',
          command: {
            type: 'ROLL_RULE_EVIDENCE',
            encounterId: room.room.encounterId,
            commandId,
            expectedVersion: decision.encounterVersion,
            occurrenceId: decision.occurrence.id,
            expectedOccurrenceVersion: decision.occurrence.version,
            requestId: save.request.requestId,
            rollMode: null
          }
        }
      })
    )
    await vi.waitFor(() => {
      expect(privateRollsIn(answersTo(phantomPlayer.messages, commandId))).toHaveLength(1)
      expect(encounterRollIn(answersTo(caster.messages, commandId))).toHaveLength(1)
    })

    // That player's socket receives the private roll, and their own answer carries it.
    const [own] = privateRollsIn(answersTo(phantomPlayer.messages, commandId))
    expect(own).toMatchObject({ gmCampaignRoll: null })
    expect(encounterRollIn(answersTo(phantomPlayer.messages, commandId))).toEqual([
      expect.objectContaining({ id: own!.id })
    ])

    // The caster's socket receives no roll in its answer and nothing from the chat.
    expect(encounterRollIn(answersTo(caster.messages, commandId))).toEqual([null])
    expect(privateRollsIn(answersTo(caster.messages, commandId))).toEqual([])
    expect(
      answersTo(caster.messages, commandId).filter((delta) => delta?.scope === 'CAMPAIGN_CHAT')
    ).toEqual([])
    expect(JSON.stringify(caster.messages)).not.toContain(own!.id)

    // The GM's socket receives the card with its reveal binding, and the table's chat none of it.
    expect(privateRollsIn(answersTo(base.messages, commandId))).toEqual([
      expect.objectContaining({
        id: own!.id,
        gmCampaignRoll: expect.objectContaining({ revealedAt: null, noticedAt: null })
      })
    ])
    const stub = base.stub
    const cards = await readRoomRollCards(stub)
    expect(cards.filter((card) => card.audience === 'TABLE')).toEqual([])
    expect(JSON.stringify(await readRoomChatBodies(stub))).not.toContain('Phantom')

    // The GM's history and the creature's player's hold the card; the caster's does not.
    const holders = await readRoomPrivateRollHolders(stub)
    expect(holders.map(({ userId, rollId }) => [userId, rollId]).sort()).toEqual(
      [
        [base.userId, own!.id],
        [base.otherPlayerId, own!.id]
      ].sort()
    )
    expect(holders.find(({ userId }) => userId === base.userId)?.gmCampaignRoll).not.toBeNull()
    expect(holders.find(({ userId }) => userId === base.otherPlayerId)?.gmCampaignRoll).toBeNull()
  })
})
