import {
  creatureFeature,
  currentSrdDefinition,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { withGrantModifiers } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { encounterBasicActionId } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import { basicActionReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/basicActions'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { BASIC_ACTION_DEFINITION_FAMILY_KEY } from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { guidance } from '@artificer-toolkit/source-data/srd/spells/guidance.js'
import { glibness } from '@artificer-toolkit/source-data/srd/spells/glibness.js'
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
import { heldDieEffect, seedModifierGrant } from './grantSeed.js'
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
 * `playerHider` makes the hider a player's creature and the Sharp Wolf another player's; `rolls` feeds the room's own dice;
 * `definitions` adds published definitions to the System's; `autoRoll` rolls the d20 for the roller.
 */
function hideRoom(
  options: {
    walled?: boolean | 'SIGHT_ONLY'
    playerHider?: boolean
    rolls?: number[]
    definitions?: ReturnType<typeof currentSrdDefinition>[]
    seed?: Parameters<typeof actionRoom>[0]['seed']
    autoRoll?: boolean
  } = {}
) {
  const hider = withCheckTotals(srdCreatureActor({ id: HIDER_ID, creature: bite }), {
    [SRD_STEALTH_SKILL_ID]: 5
  })
  return actionRoom({
    ...(options.autoRoll ? { autoRoll: 'BOTH' as const } : {}),
    ...(options.walled
      ? { sceneOverrides: { barriers: [options.walled === 'SIGHT_ONLY' ? sightWall : wall] } }
      : {}),
    rolls: options.rolls ?? [],
    ...(options.definitions ? { definitions: options.definitions } : {}),
    ...(options.seed ? { seed: options.seed } : {}),
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
async function answerD20(fixture: Fixture, face: number, addedFaces?: number[]) {
  const decision = await fixture.room.pendingDecision()
  if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a d20 request.')
  const { request } = decision.pending
  const answer = await fixture.room.resolve(decision, {
    kind: 'ENTER_DICE',
    requestId: request.requestId,
    rawFaces: request.rollMode === 'NORMAL' ? [face] : [face, face],
    ...(addedFaces && { addedFaces }),
    rollMode: request.rollMode
  })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  return request.rollMode
}

/** The hider hides, rolling `face` (Stealth +5 adds to it); `onScene` hides it on the Scene. */
async function hide(
  fixture: Fixture,
  face: number,
  onScene = false,
  sceneMoves = 0,
  addedFaces?: number[]
) {
  const { answer } = await fixture.room.startAction(
    HIDER_ID,
    [],
    onScene
      ? {
          ...fixture.room.sceneContext(0),
          expectedSceneVersion: fixture.room.room.scene.version + sceneMoves
        }
      : null,
    null,
    hideActionId,
    HIDER_ID
  )
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  await answerD20(fixture, face, addedFaces)
}

/** The Run's stored concealments, with the observers each hides its holder from. */
async function concealments(fixture: Fixture) {
  const { activeEffects } = await readRoomHistory(fixture.room.room.base.stub)
  return activeEffects
    .filter((effect) => effect.lifecycle.concealedFromActorIds)
    .map((effect) => ({
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
/** The stored effects without their row identity, which a restored effect gets anew. */
const activeEffects = async (fixture: Fixture) =>
  (await readRoomHistory(fixture.room.room.base.stub)).activeEffects.map(
    ({ _id, _creationTime, ...effect }) => effect
  )
const effectId = async (fixture: Fixture) => (await activeEffects(fixture))[0]!.id

/** Passes the turn on, from `fromId`'s turn, through the other creatures back to the hider's next turn. */
async function advanceToHiderTurn(fixture: Fixture, fromId = HIDER_ID) {
  const position = 1 + OBSERVER_PERCEPTION.findIndex(([id]) => id === fromId)
  const turns = OBSERVER_PERCEPTION.length + 1
  for (let turn = fromId === HIDER_ID ? 0 : position; turn < turns; turn += 1)
    await fixture.room.advanceTurn()
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

  it('ends the concealment when a token move prunes its last observers, and refuses to undo the Hide', async () => {
    const fixture = await hideRoom({ walled: 'SIGHT_ONLY' })
    await hide(fixture, 20, true)
    expect(await concealments(fixture)).toMatchObject([{ observers: [KEEN_ID, ALERT_ID].sort() }])

    // Crossing the wall brings the hider into plain sight of both observers; the move is not a Run command.
    const moved = await fixture.room.room.move(
      [
        { x: 150, y: 150 },
        { x: 150, y: 300 },
        { x: 320, y: 300 }
      ],
      await fixture.room.version()
    )
    expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
    expect(await concealments(fixture)).toEqual([])

    const refused = await fixture.room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: fixture.room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await fixture.room.version()
    })
    expect(refused.type, JSON.stringify(refused)).toBe('COMMAND_REJECTED')
    expect(refused).toMatchObject({ reason: 'REVERT_UNAVAILABLE' })
    expect(await concealments(fixture)).toEqual([])
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
    // The only creature it was hidden from found it, so the concealment is over.
    expect(await concealments(found)).toEqual([])
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
    expect(await concealments(fixture)).toEqual([])
    await revertLast(fixture)
    expect(await concealments(fixture)).toEqual([
      { holder: HIDER_ID, observers: [SHARP_ID], concealmentTotal: 15 }
    ])
  })
})

describe('the observers a hider is hidden from, in the room', () => {
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

  it('ends the concealment when the GM takes its last observer away, and undoes that', async () => {
    const fixture = await hideRoom()
    await hide(fixture, 10)
    const before = await activeEffects(fixture)
    const changed = await setObservers(fixture, await effectId(fixture), {
      add: [],
      remove: [SHARP_ID]
    })
    expect(changed.type, JSON.stringify(changed)).toBe('COMMAND_COMMITTED')
    expect(await concealments(fixture)).toEqual([])

    await revertLast(fixture)
    expect(await activeEffects(fixture)).toEqual(before)
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

describe('who is shown the observers a hider is hidden from, in the room', () => {
  it('lists them on the GM’s projection of the hider and on no player’s, whatever the GM changes (D116)', async () => {
    const fixture = await hideRoom()
    const player = await connectPlayer(fixture.room.room.base)
    await hide(fixture, 10)
    const id = await effectId(fixture)
    const changed = await setObservers(fixture, id, { add: [ALERT_ID], remove: [] })
    expect(changed.type, JSON.stringify(changed)).toBe('COMMAND_COMMITTED')
    if (changed.type !== 'COMMAND_COMMITTED' || changed.delta?.scope !== 'ENCOUNTER')
      throw new Error('Missing the GM’s Encounter answer.')
    const hider = changed.delta.result.projection.actors.find(
      ({ id: actorId }) => actorId === HIDER_ID
    )
    expect(hider).toMatchObject({
      concealment: {
        effectId: id,
        concealmentTotal: 15,
        observerActorIds: [SHARP_ID, ALERT_ID].sort()
      }
    })

    await vi.waitFor(() =>
      expect(
        player.messages.some(
          (message) =>
            message.type === 'COMMAND_COMMITTED' && message.commandId === changed.commandId
        )
      ).toBe(true)
    )
    const seen = JSON.stringify(player.messages)
    for (const hidden of ['concealment', 'observerActorIds', 'concealedFromActorIds', id])
      expect(seen).not.toContain(hidden)
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

describe('hiding again, in the room', () => {
  it('hides anew after a Search ended the concealment, and undoes only that Hide', async () => {
    const fixture = await hideRoom()
    await search(fixture, SHARP_ID, 20)
    expect(await concealments(fixture)).toEqual([])

    await advanceToHiderTurn(fixture, SHARP_ID)
    await hide(fixture, 20)
    expect(await concealments(fixture)).toEqual([
      {
        holder: HIDER_ID,
        observers: [SHARP_ID, KEEN_ID, ALERT_ID].sort(),
        concealmentTotal: 25
      }
    ])

    await revertLast(fixture)
    expect(await concealments(fixture)).toEqual([])
  })

  it('hides anew after a token move ended the concealment, and undoes only that Hide', async () => {
    const fixture = await hideRoom({ walled: 'SIGHT_ONLY' })
    await hide(fixture, 20, true)
    // Crossing the wall brings the hider into plain sight of both observers it was hidden from.
    const moved = await fixture.room.room.move(
      [
        { x: 150, y: 150 },
        { x: 150, y: 300 },
        { x: 320, y: 300 }
      ],
      await fixture.room.version()
    )
    expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
    expect(await concealments(fixture)).toEqual([])

    // From (320, 300) the wall hides it from the Sharp Wolf alone.
    await advanceToHiderTurn(fixture)
    await hide(fixture, 20, true, 1)
    expect(await concealments(fixture)).toEqual([
      { holder: HIDER_ID, observers: [SHARP_ID], concealmentTotal: 25 }
    ])

    await revertLast(fixture)
    expect(await concealments(fixture)).toEqual([])
  })

  it('replaces a concealment still hiding the hider from some, and undo gives the old one back', async () => {
    const fixture = await hideRoom()
    await hide(fixture, 20)
    const outcome = await setObservers(fixture, await effectId(fixture), {
      add: [],
      remove: [SHARP_ID]
    })
    expect(outcome.type, JSON.stringify(outcome)).toBe('COMMAND_COMMITTED')
    const partial = await activeEffects(fixture)
    expect(await concealments(fixture)).toMatchObject([{ observers: [KEEN_ID, ALERT_ID].sort() }])

    await advanceToHiderTurn(fixture)
    await hide(fixture, 10)
    // One concealment at a time: the new Hide, hiding the hider from the Sharp Wolf alone.
    expect(await concealments(fixture)).toEqual([
      { holder: HIDER_ID, observers: [SHARP_ID], concealmentTotal: 15 }
    ])
    expect((await activeEffects(fixture))[0]!.id).not.toBe(partial[0]!.id)

    await revertLast(fixture)
    expect(await activeEffects(fixture)).toEqual(partial)
  })

  it('takes Hide as a bonus action, as a Rogue’s Cunning Action does, through the same path', async () => {
    const regularHide = SRD_BASIC_ACTION_DEFINITIONS.find(
      ({ id }) => id === SRD_BASIC_ACTION_IDS.HIDE
    )!
    const cunningId = testUuid(0xe20)
    // The System's Hide with the Bonus Action as its cost: published content, not code.
    const document = basicActionReusableDefinitionDocumentDtoSchema.parse(
      JSON.parse(
        JSON.stringify(regularHide.document)
          .replaceAll(regularHide.id.slice(-8), cunningId.slice(-8))
          .replaceAll(regularHide.id, cunningId)
          .replaceAll('"code":"ACTION"', '"code":"BONUS_ACTION"')
      )
    )
    const fixture = await hideRoom({
      definitions: [
        currentSrdDefinition({
          id: cunningId,
          definitionFamilyKey: BASIC_ACTION_DEFINITION_FAMILY_KEY,
          label: 'Cunning Action: Hide',
          description: 'Hide as a bonus action.',
          document,
          checksum: checksumRuleDocument(document)
        })
      ]
    })
    const { answer } = await fixture.room.startAction(
      HIDER_ID,
      [],
      null,
      null,
      encounterBasicActionId(HIDER_ID, cunningId, document.effects[0]!.id),
      HIDER_ID
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    await answerD20(fixture, 10)
    expect(await concealments(fixture)).toEqual([
      { holder: HIDER_ID, observers: [SHARP_ID], concealmentTotal: 15 }
    ])

    // The Action is still unspent, so the same turn's Hide replaces the bonus action's.
    await hide(fixture, 20)
    expect(await concealments(fixture)).toEqual([
      {
        holder: HIDER_ID,
        observers: [SHARP_ID, KEEN_ID, ALERT_ID].sort(),
        concealmentTotal: 25
      }
    ])
  })
})

describe('a held d20 floor on a Hide check, in the room', () => {
  /** Glibness's real effect with its Charisma narrowing lifted, so the floor reaches a Stealth check. */
  const floorEffect = withGrantModifiers(glibness.effects?.[0], { domain: {} })
  const floorSeed = seedModifierGrant({
    sourceActorId: HIDER_ID,
    holderActorId: HIDER_ID,
    lifecycle: {},
    effect: floorEffect,
    sourceLabel: glibness.label
  })

  it('counts a low d20 as the floor in the Stealth total, and records the floor on the roll', async () => {
    const fixture = await hideRoom({ seed: floorSeed })
    // d20 1 counts as 15, Stealth +5 = 20: above passive 10 and 15, level with passive 20.
    await hide(fixture, 1)
    expect(await concealments(fixture)).toEqual([
      { holder: HIDER_ID, observers: [SHARP_ID, KEEN_ID].sort(), concealmentTotal: 20 }
    ])
    const [card] = await readRoomRollCards(fixture.room.room.base.stub)
    expect(card?.roll.ruleCheck).toEqual({
      kind: 'D20_MINIMUM_ROLL',
      amount: 15,
      label: 'Glibness'
    })
  })

  it('leaves a d20 above the floor as rolled', async () => {
    const fixture = await hideRoom({ seed: floorSeed })
    // d20 18 + 5 = 23: the floor of 15 raises nothing.
    await hide(fixture, 18)
    expect(await concealments(fixture)).toEqual([
      { holder: HIDER_ID, observers: [SHARP_ID, KEEN_ID, ALERT_ID].sort(), concealmentTotal: 23 }
    ])
    const [card] = await readRoomRollCards(fixture.room.room.base.stub)
    expect(card?.roll.ruleCheck).toBeUndefined()
  })

  it('settles a check that carries an added die, and counts the die in the roll record', async () => {
    const fixture = await hideRoom({
      seed: seedModifierGrant({
        sourceActorId: HIDER_ID,
        holderActorId: HIDER_ID,
        lifecycle: {},
        effect: guidance.effects?.[0],
        sourceLabel: guidance.label
      })
    })
    // d20 10 + Stealth 5 + a d4 of 3 = 18: above passive 10 and 15, below passive 20.
    await hide(fixture, 10, false, 0, [3])
    expect(await concealments(fixture)).toEqual([
      { holder: HIDER_ID, observers: [SHARP_ID, KEEN_ID].sort(), concealmentTotal: 18 }
    ])
    const [card] = await readRoomRollCards(fixture.room.room.base.stub)
    expect(card?.roll.evidence.terms).toHaveLength(2)
    expect(card?.roll.evidence.total).toBe(18)
  })
})

describe('a die the hider holds for after the d20, in the Hide room (SPELLS-31.T4c1a2)', () => {
  const heldDieSeed = (effect: ReturnType<typeof heldDieEffect>) =>
    seedModifierGrant({
      sourceActorId: HIDER_ID,
      holderActorId: HIDER_ID,
      lifecycle: {},
      effect,
      sourceLabel: guidance.label
    })

  /** The hider rolls a natural 5 (Stealth total 10, beating no observer) and meets the window. */
  async function openWindow(fixture: Fixture) {
    await hide(fixture, 5)
    expect(await concealmentOutputs(fixture)).toEqual([])
    const decision = await fixture.room.pendingDecision()
    if (decision.pending.kind !== 'D20_WINDOW') throw new Error('Expected the d20 window.')
    return { decision, pending: decision.pending }
  }

  it('offers the die once the d20 is seen, and spending it hides the hider from the observer the new total beats', async () => {
    const fixture = await hideRoom({ seed: heldDieSeed(heldDieEffect()) })
    const { decision, pending } = await openWindow(fixture)
    expect(pending).toMatchObject({
      rollerActorId: HIDER_ID,
      d20: { selectedNatural: 5, total: 10 },
      options: [{ label: 'Guidance', count: 1, faces: 4, sign: 'ADD' }]
    })
    expect(await activeEffects(fixture)).toHaveLength(1)

    const settled = await fixture.room.resolve(decision, {
      kind: 'D20_WINDOW_USE',
      requestId: pending.requestId,
      optionId: pending.options[0]!.optionId,
      faces: [3]
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')

    // 10 + the d4 of 3 = 13: above passive 10, below passive 15 and 20.
    expect(await concealments(fixture)).toEqual([
      { holder: HIDER_ID, observers: [SHARP_ID], concealmentTotal: 13 }
    ])
    expect(await concealmentOutputs(fixture)).toMatchObject([
      {
        d20: {
          selectedNatural: 5,
          total: 13,
          addedDice: [{ label: 'Guidance', rolledFaces: [3] }]
        },
        resolution: { kind: 'CONCEAL', hiddenFromActorIds: [SHARP_ID] }
      }
    ])
    const history = await readRoomHistory(fixture.room.room.base.stub)
    expect(history.occurrences.map((occurrence) => occurrence.state)).toEqual(['COMPLETED'])
    // The Guidance die is spent: only the concealment remains.
    expect(history.activeEffects.map((effect) => effect.lifecycle.concealedFromActorIds)).toEqual([
      [SHARP_ID]
    ])
  })

  it('keeps the roll and the die when the hider declines', async () => {
    const fixture = await hideRoom({ seed: heldDieSeed(heldDieEffect()) })
    const { decision, pending } = await openWindow(fixture)
    const settled = await fixture.room.resolve(decision, {
      kind: 'D20_WINDOW_DECLINE',
      requestId: pending.requestId
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
    expect(await concealments(fixture)).toEqual([])
    expect(await concealmentOutputs(fixture)).toMatchObject([{ d20: { total: 10 } }])
    expect(await activeEffects(fixture)).toHaveLength(1)
  })

  it('offers a homebrew die authored differently (two dice) through the same path', async () => {
    const fixture = await hideRoom({ seed: heldDieSeed(heldDieEffect({ count: 2 })) })
    const { decision, pending } = await openWindow(fixture)
    expect(pending.options).toMatchObject([{ count: 2, faces: 4 }])
    const settled = await fixture.room.resolve(decision, {
      kind: 'D20_WINDOW_USE',
      requestId: pending.requestId,
      optionId: pending.options[0]!.optionId,
      faces: [4, 2]
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
    // 10 + 6 = 16: above passive 10 and 15, below passive 20.
    expect(await concealments(fixture)).toEqual([
      { holder: HIDER_ID, observers: [SHARP_ID, KEEN_ID].sort(), concealmentTotal: 16 }
    ])
  })

  it('offers no die whose ability the check is not, and settles the Stealth d20 at once', async () => {
    const fixture = await hideRoom({ seed: heldDieSeed(heldDieEffect({ ability: 'STRENGTH' })) })
    await hide(fixture, 10)
    expect(await concealments(fixture)).toEqual([
      { holder: HIDER_ID, observers: [SHARP_ID], concealmentTotal: 15 }
    ])
  })

  it('asks a hider who rolls automatically for the d20 while it holds a die', async () => {
    const fixture = await hideRoom({
      autoRoll: true,
      rolls: [9],
      seed: heldDieSeed(heldDieEffect())
    })
    await hide(fixture, 5)
    const decision = await fixture.room.pendingDecision()
    expect(decision.pending.kind).toBe('D20_WINDOW')
  })
})
