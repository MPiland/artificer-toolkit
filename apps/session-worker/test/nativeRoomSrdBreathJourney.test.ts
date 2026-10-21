import { discoverEncounterFeatureActions } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import {
  installedSrdCreature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { blackDragonWyrmling } from '@artificer-toolkit/source-data/srd/creatures/black-dragon-wyrmling.js'
import { bronzeDragonWyrmling } from '@artificer-toolkit/source-data/srd/creatures/bronze-dragon-wyrmling.js'
import { winterWolf } from '@artificer-toolkit/source-data/srd/creatures/winter-wolf.js'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { answerAllSaves, areaReceipts, tokenPositions, vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory, type RoomHistory } from './roomHistoryReads.js'

const DRAGON_ID = testUuid(0xa00)
const FIRST_ID = testUuid(0xa01)
const SECOND_ID = testUuid(0xa02)
const THIRD_ID = testUuid(0xa03)
const BEYOND_ID = testUuid(0xa04)
const OFF_ROW_ID = testUuid(0xa05)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const feet = (amount: number) => ({ amount, unit: 'FEET' as const })

/**
 * The dragon at (150, 150) and Wolves in the cells east of it at x = 250, 350 and 450, all on its
 * row; a fourth at x = 550, past a 15 ft breath; a fifth well off the row. A token is 100 px, a cell
 * 5 feet.
 */
async function breathRoom(breath: { creature: typeof blackDragonWyrmling; featureLabel: string }) {
  const creature = installedSrdCreature(breath.creature)
  const feature = creature.features.find(({ label }) => label.startsWith(breath.featureLabel))
  if (!feature) throw new Error(`${creature.label} has no ${breath.featureLabel}.`)
  return {
    feature,
    room: await actionRoom({
      rolls: [1, 1, 1, 1, 1],
      actors: [
        srdCreatureActor({ id: DRAGON_ID, creature }),
        ...[FIRST_ID, SECOND_ID, THIRD_ID, BEYOND_ID, OFF_ROW_ID].map((id) =>
          srdCreatureActor({ id, creature: plainWolf })
        )
      ],
      positions: { [OFF_ROW_ID]: { x: 450, y: 650 } },
      ownerFeatureId: feature.id
    })
  }
}

/** The origin on the east edge of the dragon's token, and a point east of it. */
const EAST = { origin: { x: 200, y: 150 }, toward: { x: 500, y: 150 } }

const hitPointsOf = (history: RoomHistory, id: string) =>
  vitalsOf(history).find((vitals) => vitals.id === id)?.currentHitPoints

describe.each([
  {
    creature: blackDragonWyrmling,
    featureLabel: 'Acid Breath',
    area: { kind: 'LINE', length: feet(15), width: feet(5) }
  },
  { creature: winterWolf, featureLabel: 'Cold Breath', area: { kind: 'CONE', length: feet(15) } }
])(
  'an unmodified SRD $creature.label breathes in a real room',
  ({ creature, featureLabel, area }) => {
    it(`offers ${featureLabel} as its printed 15 ft ${area.kind.toLowerCase()}`, async () => {
      const { room } = await breathRoom({ creature, featureLabel })
      expect((await room.actionChoices()).actions.map(({ target }) => target)).toContainEqual({
        kind: 'DIRECTED',
        area
      })
    })

    it('catches the Wolves in the area, rolls their saves, deals full and half damage once, and the GM undoes it', async () => {
      const { room } = await breathRoom({ creature, featureLabel })
      const stub = room.room.base.stub
      const before = await readRoomHistory(stub)

      // 1. The GM aims the breath east: the three Wolves in the area are caught; the breather, the Wolf
      // past the end of the area and the Wolf off its row are not.
      const started = await room.startDirectedAreaAction(EAST.origin, EAST.toward)
      expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')
      const decision = await room.pendingDecision()
      if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
      expect(decision.pending.saves.map(({ actorId }) => actorId).sort()).toEqual(
        [FIRST_ID, SECOND_ID, THIRD_ID].sort()
      )

      // 2. Each Wolf answers its own save: one fails, one succeeds, one fails. Nothing is damaged
      // before the last answer.
      const answer = async (actorId: string, face: number) => {
        const pending = await room.pendingDecision()
        if (pending.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
        const save = pending.pending.saves.find((entry) => entry.actorId === actorId)
        if (!save) throw new Error('The creature has no pending save.')
        const answered = await room.send(
          room.resolveCommand(pending, {
            kind: 'ENTER_DICE',
            requestId: save.request.requestId,
            rawFaces: [face],
            rollMode: save.request.rollMode
          })
        )
        expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
      }
      await answer(SECOND_ID, 20)
      await answer(THIRD_ID, 1)
      expect(vitalsOf(await readRoomHistory(stub))).toEqual(vitalsOf(before))
      await answer(FIRST_ID, 1)

      // 3. The last answer commits the breath once: full damage on a failure, half on the success.
      expect(await readPendingActionDecision(stub)).toBeNull()
      const committed = await readRoomHistory(stub)
      expect(
        committed.commands.slice(before.commands.length).map((entry) => entry.commandType)
      ).toEqual(['RESOLVE_ACTION'])
      const { roots, children } = areaReceipts(committed)
      expect(roots).toHaveLength(1)
      expect(roots[0]?.outputs).toMatchObject({ sourceActorId: DRAGON_ID })
      expect(children).toHaveLength(3)
      const damageTaken = (id: string) =>
        (hitPointsOf(before, id) ?? Number.NaN) - (hitPointsOf(committed, id) ?? Number.NaN)
      expect(damageTaken(FIRST_ID)).toBeGreaterThan(0)
      expect(damageTaken(THIRD_ID)).toBe(damageTaken(FIRST_ID))
      expect(damageTaken(SECOND_ID)).toBe(Math.floor(damageTaken(FIRST_ID) / 2))
      expect(damageTaken(BEYOND_ID)).toBe(0)
      expect(damageTaken(OFF_ROW_ID)).toBe(0)
      expect(damageTaken(DRAGON_ID)).toBe(0)

      // 4. The GM's undo reverts every target and the dragon's spend.
      const undone = await room.send({
        type: 'REVERT_LAST_ACTION',
        encounterId: room.room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: await room.version()
      })
      expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
      expect(vitalsOf(await readRoomHistory(stub))).toEqual(vitalsOf(before))
    })
  }
)

describe('every SRD breath weapon is offered and resolves through the area (SPELLS-19.AC2)', () => {
  it('offers every breath of the corpus, and the Bronze Dragon Wyrmling’s Repulsion Breath pushes each creature that fails its save 30 ft away in one commit the GM’s undo takes back', async () => {
    // 1. Every breath Effect of every SRD Creature is offered; none is listed unavailable. Among
    // them, the Silver Dragon Wyrmling's Paralyzing Breath and the Gorgon's Petrifying Breath, whose
    // area resolution nativeRoomSrdBreathCondition and nativeRoomSrdBreathEscalation run.
    const breaths = srdBaselineContent.subjects.creatures.flatMap((creature, index) => {
      const discovery = discoverEncounterFeatureActions({
        spells: new Map(),
        actor: srdCreatureActor({ id: testUuid(0xc00 + index), creature }),
        conditionDefinitionIds: srdSystemRecord.conditionTypes.map(({ id }) => id),
        abilityDefinitions: (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))
      })
      return creature.features
        .filter(({ description }) => /\bexhales?\b/i.test(description ?? ''))
        .flatMap((feature) =>
          (feature.effects ?? [])
            .filter(({ invocation }) => invocation.kind === 'ACTION')
            .map((effect) => ({
              name: `${creature.label} ${feature.label}`,
              offered: discovery.available.some(
                (action) => action.ownerFeatureId === feature.id && action.effectId === effect.id
              ),
              listedUnavailable: discovery.unavailable.some(
                (action) => action.ownerFeatureId === feature.id
              )
            }))
        )
    })
    expect(breaths).toHaveLength(72)
    expect(
      breaths.filter(({ offered, listedUnavailable }) => !offered || listedUnavailable)
    ).toEqual([])
    expect(breaths.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'Silver Dragon Wyrmling Breath Weapons (Recharge 5-6)',
        'Gorgon Petrifying Breath (Recharge 5-6)',
        'Bronze Dragon Wyrmling Breath Weapons (Recharge 5-6)'
      ])
    )

    // 2. The Bronze Dragon Wyrmling breathes its 30 ft cone east: the Wolf on its row and the Wolf
    // below it are caught, the Wolf far off its row is not.
    const creature = installedSrdCreature(bronzeDragonWyrmling)
    const feature = creature.features.find(({ label }) => label.startsWith('Breath Weapons'))
    const repulsion = feature?.effects?.find(({ paths }) =>
      paths.some(
        (path) =>
          'resultBlock' in path &&
          path.resultBlock.outcomes.some(({ effectKind }) => effectKind === 'FORCED_MOVEMENT')
      )
    )
    if (!feature || !repulsion)
      throw new Error('The Bronze Dragon Wyrmling has no Repulsion Breath.')
    const room = await actionRoom({
      rolls: [],
      actors: [
        srdCreatureActor({ id: DRAGON_ID, creature }),
        ...[FIRST_ID, SECOND_ID, OFF_ROW_ID].map((id) =>
          srdCreatureActor({ id, creature: plainWolf })
        )
      ],
      positions: {
        [DRAGON_ID]: { x: 150, y: 150 },
        [FIRST_ID]: { x: 250, y: 150 },
        [SECOND_ID]: { x: 450, y: 250 },
        [OFF_ROW_ID]: { x: 450, y: 650 }
      },
      ownerFeatureId: feature.id,
      effectId: repulsion.id
    })
    const stub = room.room.base.stub
    const before = await readRoomHistory(stub)
    const started = await room.startDirectedAreaAction(EAST.origin, EAST.toward)
    expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    expect(decision.pending.saves.map(({ actorId }) => actorId).sort()).toEqual(
      [FIRST_ID, SECOND_ID].sort()
    )

    // 3. The first Wolf fails its Strength save and the second makes it: the breath commits once and
    // pushes only the first Wolf 30 ft straight away from the dragon.
    await answerAllSaves(room, { [FIRST_ID]: 1, [SECOND_ID]: 20 })
    expect(await readPendingActionDecision(stub)).toBeNull()
    const committed = await readRoomHistory(stub)
    expect(
      committed.commands.slice(before.commands.length).map((entry) => entry.commandType)
    ).toEqual(['RESOLVE_ACTION'])
    expect(areaReceipts(committed).children).toHaveLength(2)
    const pushed = tokenPositions(room)
    expect(pushed(FIRST_ID)).toEqual({ x: 850, y: 150 })
    expect(pushed(SECOND_ID)).toEqual({ x: 450, y: 250 })
    expect(pushed(OFF_ROW_ID)).toEqual({ x: 450, y: 650 })
    expect(pushed(DRAGON_ID)).toEqual({ x: 150, y: 150 })

    // 4. The GM's undo puts the Wolf back where it stood.
    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(tokenPositions(room)(FIRST_ID)).toEqual({ x: 250, y: 150 })
    expect(vitalsOf(await readRoomHistory(stub))).toEqual(vitalsOf(before))
  })
})
