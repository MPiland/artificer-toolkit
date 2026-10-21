import { attackDecoyFor } from '@artificer-toolkit/rules-runtime/encounterAttackDecoys'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { mirrorImage } from '@artificer-toolkit/source-data/srd/spells/mirror-image.js'
import { SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { INVISIBLE_ID } from './endTriggerEffectSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import { reactionClub } from './reactionClubFixture.js'
import { readActorHitPoints, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-4.T2k2b: an opportunity attack against the holder of a Mirror Image (`ATTACK_DECOYS`) takes
 * the same decoy planner as an action attack. The decoy d20 is derived from the move's occurrence id
 * salted with the reactor, so the room is made to mint ids whose salted derivation does (or does not)
 * reach the minimum for the decoys left.
 */

const FIGHTER_ACTOR_ID = testUuid(0xe50)
const FIGHTER_ID = testUuid(0xe51)
const WOLF_ID = testUuid(0xe52)
const EFFECT_ID = testUuid(0x5751)
const WOLF_START: ScenePoint = { x: 150, y: 150 }
/** A d20 face that hits a decoy's armor class and the Wolf's alike. */
const HITS = 18

const [mirrorImageEffect] = mirrorImage.effects ?? []

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The Wolf walks out of the Fighter's reach holding a Mirror Image with `remaining` decoys. */
async function decoyReactionRoom(remaining: number, moverConditionIds: string[] = []) {
  if (!mirrorImageEffect) throw new Error('The SRD Mirror Image has no effect.')
  const room = await movementRoom({
    actors: [
      characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf, conditionIds: moverConditionIds })
    ],
    moverActorId: WOLF_ID,
    positions: { [FIGHTER_ACTOR_ID]: { x: 50, y: 150 }, [WOLF_ID]: WOLF_START },
    autoRoll: 'BOTH',
    characterEquipment: [reactionClub],
    // An unseen target is attacked with disadvantage: two d20s, both the same.
    rolls: [HITS, HITS],
    fallbackRoll: 0,
    seed: async ({ effects, encounterId, occurredAt }) => {
      const planned = plannedModifierGrant({
        encounterId,
        sourceActorId: WOLF_ID,
        holderActorId: WOLF_ID,
        lifecycle: {},
        effect: mirrorImageEffect,
        sourceLabel: mirrorImage.label
      })
      await effects.create({
        id: EFFECT_ID,
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: WOLF_ID },
        definition: planned.definition,
        lifecycle: { ...planned.lifecycle, remainingUses: remaining },
        occurredAt
      })
    }
  })

  const planned = plannedModifierGrant({
    encounterId: room.encounterId,
    sourceActorId: WOLF_ID,
    holderActorId: WOLF_ID,
    lifecycle: {},
    effect: mirrorImageEffect,
    sourceLabel: mirrorImage.label
  })
  const held = {
    ...planned,
    id: EFFECT_ID,
    owner: {
      kind: 'ENCOUNTER_ACTOR' as const,
      encounterId: room.encounterId,
      targetActorId: WOLF_ID
    },
    sourceEncounterId: room.encounterId,
    maintainedEffectStateId: null,
    createdOrdinal: 1,
    version: 1,
    definitionChecksum: 'a'.repeat(64),
    lifecycleChecksum: 'b'.repeat(64),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lifecycle: { ...planned.lifecycle, remainingUses: remaining }
  }

  async function opportunityAttack(intercepts: boolean) {
    const mint = crypto.randomUUID.bind(crypto)
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      for (;;) {
        const occurrenceId = mint()
        const decoy = attackDecoyFor({
          occurrenceId: `${occurrenceId}:${FIGHTER_ACTOR_ID}`,
          effects: [held],
          scalarValues: {},
          system: { id: SRD_SYSTEM_ID, abilities: [] },
          perception: null
        })
        if ((decoy !== null) === intercepts) return occurrenceId
      }
    })
    const moved = await room.move([WOLF_START, { x: 450, y: 150 }])
    expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
    const pending = await room.pending()
    if (pending?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
      throw new Error(`Expected a reaction decision, got ${pending?.context.kind}.`)
    const option = pending.context.reactionTimeline[0]?.group.options[0]
    if (!option) throw new Error('The reaction decision offers no option.')
    const used = await room.respond({ kind: 'OPTION', optionId: option.optionId })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    vi.restoreAllMocks()
  }

  async function mover() {
    const history = await readRoomHistory(room.base.stub)
    return {
      remainingUses: history.activeEffects.find(({ id }) => id === EFFECT_ID)?.lifecycle
        .remainingUses,
      effectIds: history.activeEffects.map(({ id }) => id),
      hitPoints: readActorHitPoints(history, WOLF_ID)
    }
  }

  return { opportunityAttack, mover }
}

describe('an opportunity attack against a Mirror Image (SPELLS-4.T2k2b)', () => {
  it('spends a decoy and spares the mover when the attack hits the decoy', async () => {
    const room = await decoyReactionRoom(3)
    const before = await room.mover()

    await room.opportunityAttack(true)

    const after = await room.mover()
    expect(after.remainingUses).toBe(2)
    expect(after.hitPoints).toBe(before.hitPoints)
  }, 60_000)

  it('ends the effect when the attack hits its last decoy', async () => {
    const room = await decoyReactionRoom(1)
    const before = await room.mover()

    await room.opportunityAttack(true)

    const after = await room.mover()
    expect(after.effectIds).toEqual([])
    expect(after.hitPoints).toBe(before.hitPoints)
  }, 60_000)

  it('resolves the attack against the real armor class when the roll falls short of the minimum', async () => {
    const room = await decoyReactionRoom(3)
    const before = await room.mover()

    await room.opportunityAttack(false)

    const after = await room.mover()
    expect(after.remainingUses).toBe(3)
    expect(after.hitPoints).toBeLessThan(before.hitPoints)
  }, 60_000)

  it('is exempt when the attacker cannot see the mover', async () => {
    const room = await decoyReactionRoom(3, [INVISIBLE_ID])
    const before = await room.mover()

    await room.opportunityAttack(true)

    const after = await room.mover()
    expect(after.remainingUses).toBe(3)
    expect(after.hitPoints).toBeLessThan(before.hitPoints)
  }, 60_000)
})
