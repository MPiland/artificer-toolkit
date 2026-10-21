import { attackDecoyFor } from '@artificer-toolkit/rules-runtime/encounterAttackDecoys'
import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { mirrorImage } from '@artificer-toolkit/source-data/srd/spells/mirror-image.js'
import { SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorHitPoints, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-4.T2k2 through the room: a Mirror Image on the target (`ATTACK_DECOYS`) may take an attack
 * for one of its decoys. The d20 that decides it is derived from the occurrence id the room mints,
 * so each test makes the room mint ids that do (or do not) reach the minimum for the decoys left.
 */

const ATTACKER_ID = testUuid(0x920)
const TARGET_ID = testUuid(0x921)
const EFFECT_ID = testUuid(0x5720)
/** The attack d20 faces (zero-based dice) the Bite adds 4 to: a hit on either armor class, a miss. */
const HITS = 14
const MISSES = 1

const attacker = biteWolf('ATTACK')
const [mirrorImageEffect] = mirrorImage.effects ?? []

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The Wolf attacker bites the Wolf target, which holds a Mirror Image with `remaining` decoys. */
async function decoyRoom(remaining: number, attackFace: number) {
  if (!mirrorImageEffect) throw new Error('The SRD Mirror Image has no effect.')
  const room = await actionRoom({
    actors: [
      srdCreatureActor({ id: ATTACKER_ID, creature: attacker, disposition: 'HOSTILE' }),
      srdCreatureActor({ id: TARGET_ID, creature: plainWolf, disposition: 'FRIENDLY' })
    ],
    ownerFeatureId: creatureFeature(attacker, 'Bite').id,
    autoRoll: 'BOTH',
    rolls: [attackFace],
    fallbackRoll: 0,
    seed: async ({ effects, encounterId, occurredAt }) => {
      const planned = plannedModifierGrant({
        encounterId,
        sourceActorId: TARGET_ID,
        holderActorId: TARGET_ID,
        lifecycle: {},
        effect: mirrorImageEffect,
        sourceLabel: mirrorImage.label
      })
      await effects.create({
        id: EFFECT_ID,
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: TARGET_ID },
        definition: planned.definition,
        lifecycle: { ...planned.lifecycle, remainingUses: remaining },
        occurredAt
      })
    }
  })

  /**
   * Makes every id the room mints from now on one whose derived decoy d20 does (or does not) reach
   * the minimum for the decoys left, found with the real `attackDecoyFor`, so whichever of them
   * the room takes as the attack's occurrence id decides the same way.
   */
  function mintOccurrences(intercepts: boolean) {
    const planned = plannedModifierGrant({
      encounterId: room.room.encounterId,
      sourceActorId: TARGET_ID,
      holderActorId: TARGET_ID,
      lifecycle: {},
      effect: mirrorImageEffect,
      sourceLabel: mirrorImage.label
    })
    const held = {
      ...planned,
      id: EFFECT_ID,
      owner: {
        kind: 'ENCOUNTER_ACTOR' as const,
        encounterId: room.room.encounterId,
        targetActorId: TARGET_ID
      },
      sourceEncounterId: room.room.encounterId,
      maintainedEffectStateId: null,
      createdOrdinal: 1,
      version: 1,
      definitionChecksum: 'a'.repeat(64),
      lifecycleChecksum: 'b'.repeat(64),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lifecycle: { ...planned.lifecycle, remainingUses: remaining }
    }
    const mint = crypto.randomUUID.bind(crypto)
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      for (;;) {
        const occurrenceId = mint()
        const decoy = attackDecoyFor({
          occurrenceId,
          effects: [held],
          scalarValues: {},
          system: { id: SRD_SYSTEM_ID, abilities: [] },
          perception: null
        })
        if ((decoy !== null) === intercepts) return occurrenceId
      }
    })
  }

  async function attack(intercepts: boolean) {
    mintOccurrences(intercepts)
    const { answer } = await room.startAction(TARGET_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    vi.restoreAllMocks()
  }

  async function target() {
    const history = await readRoomHistory(room.room.base.stub)
    return {
      remainingUses: history.activeEffects.find(({ id }) => id === EFFECT_ID)?.lifecycle
        .remainingUses,
      hitPoints: readActorHitPoints(history, TARGET_ID),
      history
    }
  }

  return { room, attack, target }
}

describe('Mirror Image takes an attack for a decoy (SPELLS-4.T2k2)', () => {
  it('spends a decoy and spares the target when the attack hits the decoy', async () => {
    const room = await decoyRoom(3, HITS)
    const before = await room.target()
    expect(before.remainingUses).toBe(3)

    await room.attack(true)

    const after = await room.target()
    expect(after.remainingUses).toBe(2)
    expect(after.hitPoints).toBe(before.hitPoints)
    expect(after.history.activeEffects.map(({ id }) => id)).toEqual([EFFECT_ID])
  })

  it('keeps every decoy when the attack misses the one it targeted', async () => {
    const room = await decoyRoom(3, MISSES)
    const before = await room.target()

    await room.attack(true)

    const after = await room.target()
    expect(after.remainingUses).toBe(3)
    expect(after.hitPoints).toBe(before.hitPoints)
  })

  it('ends the effect when the attack hits its last decoy', async () => {
    const room = await decoyRoom(1, HITS)
    const before = await room.target()
    expect(before.remainingUses).toBe(1)

    await room.attack(true)

    const after = await room.target()
    expect(after.history.activeEffects).toEqual([])
    expect(after.hitPoints).toBe(before.hitPoints)
  })

  it('resolves the attack against the real armor class when the roll falls short of the minimum', async () => {
    const room = await decoyRoom(3, HITS)
    const before = await room.target()

    await room.attack(false)

    const after = await room.target()
    expect(after.remainingUses).toBe(3)
    expect(after.hitPoints).toBe(before.hitPoints - 1)
  })

  it('gives the decoy back when the action is undone', async () => {
    const room = await decoyRoom(3, HITS)
    await room.attack(true)
    expect((await room.target()).remainingUses).toBe(2)

    const undone = await room.room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.room.version()
    })

    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect((await room.target()).remainingUses).toBe(3)
  })
})
