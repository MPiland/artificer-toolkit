import { DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/reactionEligibilityPolicy'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf, reactionWolf } from '../src/testing/movementPlannerFixture.js'
import type { ClassFeature } from '../src/testing/srdCharacterSource.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'

const FIGHTER_ACTOR_ID = testUuid(0xa13)
const FIGHTER_ID = testUuid(0xa14)
const SOURCE_ID = testUuid(0xa00)
const TARGET_IDS = [testUuid(0xa01), testUuid(0xa02), testUuid(0xa03)]
const MOVER_ID = testUuid(0xa10)
const REACTOR_A_ID = testUuid(0xa11)
const REACTOR_C_ID = testUuid(0xa12)

const square = {
  kind: 'SQUARE',
  origin: { x: 0, y: 0 },
  cellSize: 100,
  diagonalPolicy: 'EQUAL'
} as const
/** The same 100 px square grid measured in feet and in squares: one square is the 5 ft base square. */
const GRIDS: readonly [string, CampaignSceneStateDto['grid']][] = [
  ['FEET', { ...square, distancePerCell: 5, unit: 'FEET' }],
  ['SQUARES', { ...square, distancePerCell: 1, unit: 'SQUARES' }]
]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * A Wolf whose Bite hits for 40 within `reachFeet`, in a row of three plain Wolves of 11 hit
 * points one, two and three squares away, with Cleaving on.
 */
function cleavingRoom(grid: CampaignSceneStateDto['grid'], reachFeet: number) {
  const attacker = biteWolf('ATTACK', { damage: 40, reachFeet })
  return actionRoom({
    autoRoll: 'GAME_MASTER',
    rolls: [18],
    sceneGrid: grid,
    actors: [
      srdCreatureActor({ id: SOURCE_ID, creature: attacker }),
      ...TARGET_IDS.map((id) => srdCreatureActor({ id, creature: plainWolf }))
    ],
    ownerFeatureId: creatureFeature(attacker, 'Bite').id,
    optionalCombatKinds: ['CLEAVING']
  })
}

/** The targets the room offers the chain after the first target falls. */
async function cleavingOptionTargets(room: Awaited<ReturnType<typeof cleavingRoom>>) {
  const { answer } = await room.startAction(TARGET_IDS[0]!, [], room.sceneContext())
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'OPTIONAL_COMBAT_CLEAVING')
    throw new Error('Expected the Cleaving choice.')
  return decision.pending.options.map((option) => option.targetActorId).sort()
}

/** FRIENDLY Wolves whose Bite is an opportunity attack, around a HOSTILE Wolf walking east. */
function reactionRoom(grid: CampaignSceneStateDto['grid']) {
  const positions: Record<string, ScenePoint> = {
    [REACTOR_A_ID]: { x: 150, y: 50 },
    [REACTOR_C_ID]: { x: 50, y: 150 },
    [MOVER_ID]: { x: 150, y: 150 }
  }
  return movementRoom({
    sceneGrid: grid,
    actors: [
      srdCreatureActor({ id: REACTOR_A_ID, creature: reactionWolf, disposition: 'FRIENDLY' }),
      srdCreatureActor({ id: REACTOR_C_ID, creature: reactionWolf, disposition: 'FRIENDLY' }),
      srdCreatureActor({ id: MOVER_ID, creature: plainWolf })
    ],
    moverActorId: MOVER_ID,
    positions
  })
}

/**
 * A Fighter whose reaction Bite needs to see the creature leaving its reach, which stretches
 * `reachFeet`: the SRD Wolf's Bite as a Class Feature.
 */
function seeingStrike(reachFeet: number): ClassFeature {
  const bite = creatureFeature(plainWolf, 'Bite')
  const effect = bite.effects?.[0]
  const hit = effect?.paths[0]
  if (
    !effect ||
    effect.invocation.kind !== 'ACTION' ||
    effect.invocation.triggerCode === 'CHECK' ||
    !hit ||
    !('resultBlock' in hit)
  )
    throw new Error('The SRD Wolf Bite is missing.')
  return {
    ...bite,
    id: testUuid(0xa20),
    label: 'Seeing Strike',
    availableAtLevel: 1,
    effects: [
      {
        ...effect,
        id: testUuid(0xa21),
        invocation: {
          ...effect.invocation,
          activation: { code: 'REACTION' as const, amount: 1 },
          range: {
            id: effect.invocation.range.id,
            rangeKind: 'DISTANCE' as const,
            amount: reachFeet,
            unit: 'FEET' as const
          },
          reactionTrigger: {
            kind: 'MOVEMENT' as const,
            stage: 'BEFORE_LEAVE_REACH' as const,
            perceptionRequirement: 'SEE' as const,
            eligibilityDefinitionId: DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID,
            movementInterruption: null
          }
        },
        paths: [{ ...hit, id: testUuid(0xa22) }]
      }
    ]
  }
}

/**
 * A Fighter in an unlit Scene of 50 px squares and a Wolf that walks away from it, until it
 * leaves the Fighter's `reachFeet` reach. Only Darkvision, 60 ft here, lets the Fighter see it.
 */
function darkRoom(
  grid: CampaignSceneStateDto['grid'],
  { reachFeet, darkvision }: { reachFeet: number; darkvision: boolean }
) {
  return movementRoom({
    sceneGrid: grid,
    sceneOverrides: { ambientIllumination: 'ORDINARY_DARKNESS' },
    actors: [
      characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
      srdCreatureActor({ id: MOVER_ID, creature: plainWolf })
    ],
    moverActorId: MOVER_ID,
    positions: { [FIGHTER_ACTOR_ID]: { x: 50, y: 50 }, [MOVER_ID]: { x: 250, y: 50 } },
    characterClassFeatures: [seeingStrike(reachFeet)],
    characterDarkvision: darkvision
  })
}

describe('a SQUARES Scene measures a square as the 5 ft base square', () => {
  describe.each(GRIDS)('Cleaving facts on a %s Scene', (_unit, grid) => {
    it.each([
      // 20 ft reach is four squares: every Wolf in the row is in reach.
      [20, [TARGET_IDS[1], TARGET_IDS[2]]],
      // 10 ft reach is two squares: the Wolf three squares away is out of reach.
      [10, [TARGET_IDS[1]]]
    ] as const)('offers the chain what a %s ft reach covers', async (reachFeet, expected) => {
      const room = await cleavingRoom(grid, reachFeet)
      expect(await cleavingOptionTargets(room)).toEqual([...expected].sort())
    })
  })

  describe.each(GRIDS)('combat perception on a %s Scene of 50 px squares', (_unit, grid) => {
    const fineGrid = { ...grid, cellSize: 50 }

    it.each([
      // 50 ft is ten squares: within the 60 ft Darkvision, which is twelve.
      [50, true, true],
      // 80 ft is sixteen squares: beyond it.
      [80, true, false],
      // Without Darkvision the Fighter sees nothing in the dark at any distance.
      [50, false, false]
    ] as const)(
      'offers a %s ft reach reaction when Darkvision is %s: %s',
      async (reachFeet, darkvision, offered) => {
        const room = await darkRoom(fineGrid, { reachFeet, darkvision })
        const moved = await room.move([
          { x: 250, y: 50 },
          { x: 950, y: 50 }
        ])
        expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
        expect((await room.pending())?.context.kind === 'ENCOUNTER_MOVEMENT_REACTION').toBe(offered)
      },
      60_000
    )
  })

  describe.each(GRIDS)('movement reaction contacts on a %s Scene', (_unit, grid) => {
    it('offers the reactor the mover leaves first before the one it leaves later', async () => {
      const room = await reactionRoom(grid)
      await room.move([
        { x: 150, y: 150 },
        { x: 750, y: 150 }
      ])
      const pending = await room.pending()
      if (pending?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
        throw new Error(`Expected a reaction decision, got ${pending?.context.kind}.`)
      expect(pending.context.reactionTimeline.map((entry) => entry.group.reactorActorId)).toEqual([
        REACTOR_C_ID,
        REACTOR_A_ID
      ])
    })
  })
})
