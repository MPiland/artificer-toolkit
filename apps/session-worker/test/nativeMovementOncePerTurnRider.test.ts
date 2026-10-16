import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/reactionEligibilityPolicy'
import {
  oncePerTurnSneakAttack,
  riderGate,
  UNCONDITIONAL_SNEAK_ATTACK_ID,
  withFixedRiderDice
} from '@artificer-toolkit/rules-runtime/testing/unconditionalSneakAttack'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/authored'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import {
  EQUIPMENT_GRIP,
  meleeWeaponAbilityModifiers,
  meleeWeaponEffects
} from '@artificer-toolkit/source-data/srd/equipment/shared.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import type { ClassFeature } from '../src/testing/srdCharacterSource.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * D119(f) through a movement reaction: a Character's opportunity attack is planned with the
 * once-per-turn record and the Scene's enemy proximity, so a Sneak Attack-style rider rides on it.
 */

const FIGHTER_ACTOR_ID = testUuid(0xe00)
const FIGHTER_ID = testUuid(0xe01)
const WOLF_ID = testUuid(0xe02)
const ALLY_ID = testUuid(0xe03)

/** The 1d6 the rider adds, rolling its minimum. */
const RIDER_DAMAGE = 1

const REACTION_CLUB_ID = testUuid(0xe120)

const WOLF_START: ScenePoint = { x: 150, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A Club the Fighter attacks with as an opportunity attack, taken as a Reaction when a creature leaves its reach. */
const reactionClub: EquipmentAuthored = (() => {
  const [attack] = meleeWeaponEffects(REACTION_CLUB_ID, 'BLUDGEONING', '1d4', EQUIPMENT_GRIP.ONE_HANDED)
  if (!attack || attack.invocation.kind !== 'ACTION') throw new Error('The melee attack is missing.')
  return {
    ...club,
    id: REACTION_CLUB_ID,
    label: 'Reaction Club',
    modifiers: meleeWeaponAbilityModifiers(REACTION_CLUB_ID),
    effects: [
      {
        ...attack,
        invocation: {
          ...attack.invocation,
          activation: { code: 'REACTION' as const, amount: 1 },
          reactionTrigger: {
            kind: 'MOVEMENT' as const,
            stage: 'BEFORE_LEAVE_REACH' as const,
            perceptionRequirement: null,
            eligibilityDefinitionId: DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID,
            movementInterruption: null
          }
        }
      }
    ]
  }
})()

/** A once-per-turn 1d6 rider on a melee attack against a target an able enemy of it stands within 5 ft of. */
const nearbyEnemyOncePerTurnRider = (): ClassFeature =>
  withFixedRiderDice(
    oncePerTurnSneakAttack(
      testUuid(0xe110),
      riderGate([{ predicateCode: 'ENEMY_NEAR_TARGET', feet: 5 }])
    ),
    testUuid(0xe111),
    '1d6'
  )

/**
 * The Wolf walks out of the Fighter's reach and takes its opportunity attack. The Fighter's ally
 * (an enemy of the Wolf) stands at `allyPosition`. Returns the hit points the Wolf lost and the
 * once-per-turn uses the Fighter's turn record then holds.
 */
async function wolfHitPointsLostToOpportunityAttack(allyPosition: ScenePoint) {
  const room = await movementRoom({
    actors: [
      characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf }),
      srdCreatureActor({ id: ALLY_ID, creature: plainWolf, disposition: 'FRIENDLY' })
    ],
    moverActorId: WOLF_ID,
    positions: {
      [FIGHTER_ACTOR_ID]: { x: 50, y: 150 },
      [WOLF_ID]: WOLF_START,
      [ALLY_ID]: allyPosition
    },
    autoRoll: 'BOTH',
    characterClassFeatures: [nearbyEnemyOncePerTurnRider()],
    characterEquipment: [reactionClub],
    // The attack is a 19 and hits; every later die rolls the minimum.
    rolls: [18],
    fallbackRoll: 0
  })
  const hitPoints = async () => {
    const wolf = vitalsOf(await readRoomHistory(room.base.stub)).find(({ id }) => id === WOLF_ID)
    if (wolf?.currentHitPoints === undefined) throw new Error('The Wolf holds no hit points.')
    return wolf.currentHitPoints
  }
  const before = await hitPoints()
  const moved = await room.move([WOLF_START, { x: 450, y: 150 }])
  expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
  const pending = await room.pending()
  if (pending?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
    throw new Error(`Expected a reaction decision, got ${pending?.context.kind}.`)
  const option = pending.context.reactionTimeline[0]?.group.options[0]
  if (!option) throw new Error('The reaction decision offers no option.')
  const used = await room.respond({ kind: 'OPTION', optionId: option.optionId })
  expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
  const records = await runInDurableObject(room.base.stub, async (_instance, context) =>
    new RoomEncounterStore(context.storage).documents('encounterTurnMovements')
  )
  return {
    lost: before - (await hitPoints()),
    spentUses: records.filter(({ actorId }) => actorId === FIGHTER_ACTOR_ID).flatMap((record) => record.usedOncePerTurn)
  }
}

describe('an opportunity attack with a once-per-turn rider that reads the Scene (D119 f)', () => {
  it('adds the rider when an ally of the attacker stands beside the mover, and spends the turn’s use', async () => {
    const near = await wolfHitPointsLostToOpportunityAttack({ x: 150, y: 250 })
    const far = await wolfHitPointsLostToOpportunityAttack({ x: 150, y: 650 })
    expect(near.lost - far.lost).toBe(RIDER_DAMAGE)
    expect(near.spentUses).toEqual([UNCONDITIONAL_SNEAK_ATTACK_ID])
    expect(far.spentUses).toEqual([])
  }, 60_000)
})
