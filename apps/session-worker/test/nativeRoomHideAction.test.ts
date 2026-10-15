import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { encounterBasicActionId } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import {
  SRD_PERCEPTION_SKILL_ID,
  SRD_STEALTH_SKILL_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf, withCheckTotals } from './actionRoomFixture.js'
import { closeTrackedSockets, connectPlayer } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readRoomChatBodies,
  readRoomHistory,
  readRoomPrivateRollHolders,
  readRoomRollCards,
  readRoomTimeline
} from './roomHistoryReads.js'

const HIDER_ID = testUuid(0xe00)
/** Passive Perception 10, 15 and 20: the hider's Stealth +5 beats only the first at a d20 of 10. */
const SHARP_ID = testUuid(0xe01)
const KEEN_ID = testUuid(0xe02)
const ALERT_ID = testUuid(0xe03)
const OBSERVER_PERCEPTION = [
  [SHARP_ID, 0],
  [KEEN_ID, 5],
  [ALERT_ID, 10]
] as const
/** No Scene measures the Bite's reach, and the Hide used the turn's Action. */
const BITE_WARNINGS: EncounterRuleWarningCodeDto[] = [
  'TARGET_RANGE_UNCHECKED',
  'ACTION_ECONOMY_UNAVAILABLE'
]

const effectIdOf = (actionId: string) => {
  const definition = SRD_BASIC_ACTION_DEFINITIONS.find(({ id }) => id === actionId)
  if (definition?.document.kind !== 'BASIC_ACTION') throw new Error('Missing basic action fixture.')
  return definition.document.effects[0]!.id
}
const hideActionId = encounterBasicActionId(
  HIDER_ID,
  SRD_BASIC_ACTION_IDS.HIDE,
  effectIdOf(SRD_BASIC_ACTION_IDS.HIDE)
)
const searchActionId = (searcherId: string) =>
  encounterBasicActionId(
    searcherId,
    SRD_BASIC_ACTION_IDS.SEARCH,
    effectIdOf(SRD_BASIC_ACTION_IDS.SEARCH)
  )

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const bite = biteWolf('ATTACK', { damage: 1, reachFeet: 5 })

/** Between the hider (x 150) and the Wolves at x 350 and 450, but not the one at x 250. */
const wall = {
  kind: 'WALL' as const,
  id: testUuid(0xe10),
  a: { x: 300, y: -500 },
  b: { x: 300, y: 500 },
  blocksLight: true,
  blocksMovement: true
}
/** The same wall, but a token can cross it. */
const sightWall = { ...wall, blocksMovement: false }

/**
 * A Wolf hider with Stealth +5, acting first, beside three friendly Wolves of differing Perception.
 * `walled` puts a wall of the Scene between the hider and the two Wolves further away;
 * `playerHider` makes the hider a player's creature and the Sharp Wolf another player's; `rolls` feeds the room's own dice.
 */
function hideRoom(
  options: { walled?: boolean | 'SIGHT_ONLY'; playerHider?: boolean; rolls?: number[] } = {}
) {
  const hider = withCheckTotals(srdCreatureActor({ id: HIDER_ID, creature: bite }), {
    [SRD_STEALTH_SKILL_ID]: 5
  })
  return actionRoom({
    ...(options.walled
      ? { sceneOverrides: { barriers: [options.walled === 'SIGHT_ONLY' ? sightWall : wall] } }
      : {}),
    rolls: options.rolls ?? [],
    ...(options.playerHider
      ? { playerControlledActorIds: [HIDER_ID], otherPlayerControlledActorIds: [SHARP_ID] }
      : {}),
    actors: [
      hider,
      ...OBSERVER_PERCEPTION.map(([id, perception]) =>
        withCheckTotals(srdCreatureActor({ id, creature: bite, disposition: 'FRIENDLY' }), {
          [SRD_PERCEPTION_SKILL_ID]: perception
        })
      )
    ],
    ownerFeatureId: creatureFeature(bite, 'Bite').id
  }).then((room) => ({
    room,
    biteActionId: room.featureActionId(hider, creatureFeature(bite, 'Bite').id)
  }))
}

type Fixture = Awaited<ReturnType<typeof hideRoom>>

/** Answers the pending d20 with `face`, as the roller's dice; the mode the room asked it in. */
async function answerD20(fixture: Fixture, face: number) {
  const decision = await fixture.room.pendingDecision()
  if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a d20 request.')
  const { request } = decision.pending
  const answer = await fixture.room.resolve(decision, {
    kind: 'ENTER_DICE',
    requestId: request.requestId,
    rawFaces: request.rollMode === 'NORMAL' ? [face] : [face, face],
    rollMode: request.rollMode
  })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  return request.rollMode
}

/** The hider hides, rolling `face` (Stealth +5 adds to it); `onScene` hides it on the Scene. */
async function hide(fixture: Fixture, face: number, onScene = false) {
  const { answer } = await fixture.room.startAction(
    HIDER_ID,
    [],
    onScene ? fixture.room.sceneContext(0) : null,
    null,
    hideActionId,
    HIDER_ID
  )
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  await answerD20(fixture, face)
}

/** The Run's stored concealments, with the observers each hides its holder from. */
async function concealments(fixture: Fixture) {
  const { activeEffects } = await readRoomHistory(fixture.room.room.base.stub)
  return activeEffects.map((effect) => ({
    holder: effect.targetActorId,
    observers: effect.lifecycle.concealedFromActorIds,
    concealmentTotal: Number(/"concealmentTotal":(\d+)/.exec(effect.definitionJson)?.[1])
  }))
}

/** The CONCEALMENT_CHECK outputs the Run's receipts hold. */
async function concealmentOutputs(fixture: Fixture) {
  const { receipts } = await readRoomHistory(fixture.room.room.base.stub)
  return receipts.flatMap((receipt) => {
    const execution = parseReceiptExecution(receipt)
    return execution.status === 'COMPLETE' &&
      execution.applicationOutputs?.kind === 'CONCEALMENT_CHECK'
      ? [execution.applicationOutputs]
      : []
  })
}

async function revertLast(fixture: Fixture) {
  const undone = await fixture.room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: fixture.room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await fixture.room.version()
  })
  expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
}

describe('Hide, a System basic action with a per-observer check, in the room', () => {
  it('hides the hider from the observers its Stealth total beats, and never from one that ties', async () => {
    const fixture = await hideRoom()
    // d20 10 + Stealth 5 = 15: above passive 10, level with passive 15, below passive 20.
    await hide(fixture, 10)
    expect(await concealments(fixture)).toEqual([
      { holder: HIDER_ID, observers: [SHARP_ID], concealmentTotal: 15 }
    ])
    expect(await concealmentOutputs(fixture)).toMatchObject([
      { resolution: { kind: 'CONCEAL', hiddenFromActorIds: [SHARP_ID] } }
    ])
  })

  it('never hides the hider from an observer that sees it clearly on the Scene, whatever its Perception', async () => {
    const fixture = await hideRoom({ walled: true })
    // d20 20 + Stealth 5 = 25 beats every passive, but the Wolf at x 250 sees the hider past the wall.
    await hide(fixture, 20, true)
    expect(await concealments(fixture)).toEqual([
      { holder: HIDER_ID, observers: [KEEN_ID, ALERT_ID].sort(), concealmentTotal: 25 }
    ])
  })

  it('hides the hider from every observer when its total beats them all', async () => {
    const fixture = await hideRoom()
    await hide(fixture, 20)
    expect(await concealments(fixture)).toEqual([
      {
        holder: HIDER_ID,
        observers: [SHARP_ID, KEEN_ID, ALERT_ID].sort(),
        concealmentTotal: 25
      }
    ])
  })

  it('makes no concealment when the total beats no observer, though the Action is spent', async () => {
    const fixture = await hideRoom()
    const before = await fixture.room.version()
    await hide(fixture, 1)
    expect(await concealments(fixture)).toEqual([])
    expect(await concealmentOutputs(fixture)).toMatchObject([
      { resolution: { kind: 'CONCEAL', hiddenFromActorIds: [], createdEffect: null } }
    ])
    expect(await fixture.room.version()).toBeGreaterThan(before)
  })

  it('gives an attack from hiding advantage against a target that cannot see the hider, and ends the hiding', async () => {
    const fixture = await hideRoom()
    await hide(fixture, 10)
    const attack = await fixture.room.startAction(
      SHARP_ID,
      BITE_WARNINGS,
      null,
      null,
      fixture.biteActionId,
      HIDER_ID
    )
    expect(attack.answer.type, JSON.stringify(attack.answer)).toBe('COMMAND_COMMITTED')
    expect(await answerD20(fixture, 10)).toBe('ADVANTAGE')
    // The attack revealed the hider to everyone, not only its target.
    expect(await concealments(fixture)).toEqual([])
  })

  it('rolls an attack from hiding at a target that sees the hider clearly without advantage, and still ends the hiding', async () => {
    const fixture = await hideRoom()
    await hide(fixture, 10)
    const attack = await fixture.room.startAction(
      ALERT_ID,
      BITE_WARNINGS,
      null,
      null,
      fixture.biteActionId,
      HIDER_ID
    )
    expect(attack.answer.type, JSON.stringify(attack.answer)).toBe('COMMAND_COMMITTED')
    expect(await answerD20(fixture, 10)).toBe('NORMAL')
    expect(await concealments(fixture)).toEqual([])
  })

  it('undoes to the moment before the Hide: the Action and the concealment are both gone', async () => {
    const fixture = await hideRoom()
    await hide(fixture, 10)
    await revertLast(fixture)
    expect(await concealments(fixture)).toEqual([])
  })

  it('refuses to undo the Hide once a token move pruned its observers, and keeps the concealment', async () => {
    const fixture = await hideRoom({ walled: 'SIGHT_ONLY' })
    await hide(fixture, 20, true)
    expect(await concealments(fixture)).toMatchObject([{ observers: [KEEN_ID, ALERT_ID].sort() }])

    // Crossing the wall brings the hider into plain sight of both observers; the move is not a Run command.
    const moved = await fixture.room.room.move(
      [
        { x: 150, y: 150 },
        { x: 320, y: 150 }
      ],
      await fixture.room.version()
    )
    expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
    expect(await concealments(fixture)).toMatchObject([{ observers: [] }])

    const refused = await fixture.room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: fixture.room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await fixture.room.version()
    })
    expect(refused.type, JSON.stringify(refused)).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(refused)).toContain('The concealment changed after this action')
    expect(await concealments(fixture)).toMatchObject([{ observers: [] }])
  })
})

/** The hider hides at a total of 15, the turn passes to the searcher, and the searcher searches. */
async function search(fixture: Fixture, searcherId: string, face: number) {
  await hide(fixture, 10)
  // The hider acts first; the observers follow in `OBSERVER_PERCEPTION` order.
  const turnsUntilSearcher = 1 + OBSERVER_PERCEPTION.findIndex(([id]) => id === searcherId)
  for (let turn = 0; turn < turnsUntilSearcher; turn += 1) await fixture.room.advanceTurn()
  const { answer } = await fixture.room.startAction(
    searcherId,
    [],
    null,
    null,
    searchActionId(searcherId),
    searcherId
  )
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  await answerD20(fixture, face)
}

describe('Search, a System basic action against concealments, in the room', () => {
  it('reveals the hider to a searcher whose total reaches the Stealth total, and a tie finds it', async () => {
    const found = await hideRoom()
    // Sharp has Perception +0: a d20 of 15 totals 15, level with the Stealth total.
    await search(found, SHARP_ID, 15)
    expect(await concealments(found)).toEqual([
      { holder: HIDER_ID, observers: [], concealmentTotal: 15 }
    ])
    expect(await concealmentOutputs(found)).toMatchObject([
      { resolution: { kind: 'CONCEAL' } },
      { resolution: { kind: 'DETECT', found: [{ holderActorId: HIDER_ID }] } }
    ])
  })

  it('leaves the hider hidden from a searcher whose total falls short', async () => {
    const missed = await hideRoom()
    await search(missed, SHARP_ID, 14)
    expect(await concealments(missed)).toEqual([
      { holder: HIDER_ID, observers: [SHARP_ID], concealmentTotal: 15 }
    ])
  })

  it('finds nothing for a searcher the hider was never hidden from', async () => {
    const fixture = await hideRoom()
    await search(fixture, ALERT_ID, 20)
    expect(await concealments(fixture)).toEqual([
      { holder: HIDER_ID, observers: [SHARP_ID], concealmentTotal: 15 }
    ])
  })

  it('restores the searcher to the hider’s observers when the GM undoes the Search', async () => {
    const fixture = await hideRoom()
    await search(fixture, SHARP_ID, 20)
    expect((await concealments(fixture))[0]?.observers).toEqual([])
    await revertLast(fixture)
    expect(await concealments(fixture)).toEqual([
      { holder: HIDER_ID, observers: [SHARP_ID], concealmentTotal: 15 }
    ])
  })
})

describe('the observers a hider is hidden from, in the room', () => {
  const setObservers = async (
    fixture: Fixture,
    activeEffectId: string,
    change: { add: string[]; remove: string[] },
    sender: 'GM' | 'PLAYER' = 'GM'
  ) => {
    const command = {
      type: 'SET_CONCEALMENT_OBSERVERS',
      encounterId: fixture.room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await fixture.room.version(),
      activeEffectId,
      ...change
    }
    return sender === 'GM' ? fixture.room.send(command) : fixture.room.sendAsPlayer(command)
  }
  const effectId = async (fixture: Fixture) =>
    (await readRoomHistory(fixture.room.room.base.stub)).activeEffects[0]!.id

  it('lets the GM add and remove observers, records it, and undoes it', async () => {
    const fixture = await hideRoom()
    await hide(fixture, 10)
    const id = await effectId(fixture)
    const changed = await setObservers(fixture, id, { add: [KEEN_ID], remove: [SHARP_ID] })
    expect(changed.type, JSON.stringify(changed)).toBe('COMMAND_COMMITTED')
    expect((await concealments(fixture))[0]?.observers).toEqual([KEEN_ID])
    const { commands } = await readRoomHistory(fixture.room.room.base.stub)
    expect(commands.at(-1)).toMatchObject({
      commandType: 'SET_CONCEALMENT_OBSERVERS',
      receipt: {
        beforeObserverActorIds: [SHARP_ID],
        afterObserverActorIds: [KEEN_ID]
      }
    })

    await revertLast(fixture)
    expect((await concealments(fixture))[0]?.observers).toEqual([SHARP_ID])
  })

  it('refuses a player, and a change that names the hider or an unknown creature', async () => {
    const fixture = await hideRoom()
    await hide(fixture, 10)
    const id = await effectId(fixture)
    const refused = await setObservers(fixture, id, { add: [KEEN_ID], remove: [] }, 'PLAYER')
    expect(refused.type, JSON.stringify(refused)).toBe('COMMAND_REJECTED')
    expect(refused).toMatchObject({ reason: 'GM_ONLY' })

    for (const invalid of [HIDER_ID, testUuid(0xeff)]) {
      const answer = await setObservers(fixture, id, { add: [invalid], remove: [] })
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_REJECTED')
    }
    expect((await concealments(fixture))[0]?.observers).toEqual([SHARP_ID])
  })
})

describe('who learns whom the hider is hidden from, in the room', () => {
  it('names the failed observers to the GM alone: no player view, timeline or pending check carries them', async () => {
    const fixture = await hideRoom()
    const { base } = fixture.room.room
    await fixture.room.startAction(HIDER_ID, [], null, null, hideActionId, HIDER_ID)
    // The hider's pending check never states which observers it is rolled against.
    const decision = await fixture.room.pendingDecision()
    expect(JSON.stringify(decision.pending)).not.toContain(SHARP_ID)
    expect(decision.pending).toMatchObject({ trigger: { kind: 'BASIC_ACTION_CHECK', dc: null } })
    await answerD20(fixture, 10)

    expect(await concealments(fixture)).toMatchObject([{ observers: [SHARP_ID] }])
    const player = await readRoomTimeline(base.stub, { player: true, userId: base.playerId })
    expect(JSON.stringify(player)).not.toContain(SHARP_ID)
    expect(player.entries.every((entry) => entry.gmLines.length === 0)).toBe(true)
  })
})

describe('who sees the Hide and Search rolls, in the room', () => {
  const secretKeys = ['concealedFromActorIds', 'concealmentTotal', 'hiddenFromActorIds']
  const framesOf = (player: Awaited<ReturnType<typeof connectPlayer>>) =>
    JSON.stringify(player.messages)

  it('keeps a GM hider’s roll to the GM though the GM’s roll preference is public, for Hide and Search', async () => {
    const fixture = await hideRoom()
    const { stub, userId } = fixture.room.room.base
    await search(fixture, SHARP_ID, 15)
    const cards = await readRoomRollCards(stub)
    expect(cards.filter(({ audience }) => audience === 'TABLE')).toEqual([])
    // The Hide and the Search each left a private card, and the GM alone holds them.
    expect(cards.filter(({ audience }) => audience === 'PRIVATE')).toHaveLength(2)
    expect((await readRoomPrivateRollHolders(stub)).map((holder) => holder.userId)).toEqual([
      userId,
      userId
    ])
    expect(await readRoomChatBodies(stub)).toEqual([])
  })

  it('shows a player hider’s roll to that player and the GM alone, never another player or the table', async () => {
    const fixture = await hideRoom({ playerHider: true })
    const { base } = fixture.room.room
    const hiderPlayer = await connectPlayer(base)
    const otherPlayer = await connectPlayer(base, 'OTHER_PLAYER')
    await hide(fixture, 10)

    const cards = await readRoomRollCards(base.stub)
    expect(cards.filter(({ audience }) => audience === 'TABLE')).toEqual([])
    expect(
      (await readRoomPrivateRollHolders(base.stub)).map(({ userId }) => userId).sort()
    ).toEqual([base.userId, base.playerId].sort())
    expect(framesOf(otherPlayer)).not.toContain('privateRoll')
    for (const player of [hiderPlayer, otherPlayer])
      for (const key of secretKeys) expect(framesOf(player)).not.toContain(key)
  })

  it('keeps the same secrecy when the hider’s player presses Roll dice', async () => {
    const fixture = await hideRoom({ playerHider: true, rolls: [10] })
    const { base } = fixture.room.room
    const hiderPlayer = await connectPlayer(base)
    const otherPlayer = await connectPlayer(base, 'OTHER_PLAYER')
    const { answer } = await fixture.room.startAction(
      HIDER_ID,
      [],
      null,
      null,
      hideActionId,
      HIDER_ID
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const decision = await fixture.room.pendingDecision()
    if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a d20 request.')
    const rolled = await fixture.room.sendAsPlayer({
      type: 'ROLL_RULE_EVIDENCE',
      encounterId: fixture.room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: decision.encounterVersion,
      occurrenceId: decision.occurrence.id,
      expectedOccurrenceVersion: decision.occurrence.version,
      requestId: decision.pending.request.requestId,
      rollMode: null
    })
    expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
    // The app's roll is held until the same responder settles on it.
    const [held] = (await readRoomHistory(base.stub)).evidenceRolls
    const settled = await fixture.room.sendAsPlayer(
      fixture.room.resolveCommand(decision, {
        kind: 'SYSTEM_ROLL',
        requestId: decision.pending.request.requestId,
        rollId: held!.id
      })
    )
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
    expect(await concealmentOutputs(fixture)).toHaveLength(1)

    const cards = await readRoomRollCards(base.stub)
    expect(cards.filter(({ audience }) => audience === 'TABLE')).toEqual([])
    expect(
      (await readRoomPrivateRollHolders(base.stub)).map(({ userId }) => userId).sort()
    ).toEqual([base.userId, base.playerId].sort())
    expect(framesOf(otherPlayer)).not.toContain('privateRoll')
    for (const player of [hiderPlayer, otherPlayer])
      for (const key of secretKeys) expect(framesOf(player)).not.toContain(key)
  })
})
