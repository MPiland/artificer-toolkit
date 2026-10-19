import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { mirrorImage } from '@artificer-toolkit/source-data/srd/spells/mirror-image.js'
import {
  SRD_ABILITIES,
  SRD_ABILITY_DEFINITION_IDS
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import {
  attackDecoyFor,
  decoyIsLast,
  decoyStruck,
  withAttackDecoyArmorClass
} from '../encounterAttackDecoys.js'
import { ENCOUNTER_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { plannedModifierGrant } from '../testing/modifierGrantFixture.js'

const HOLDER_ID = testUuid(0xd002)
const [mirrorImageEffect] = mirrorImage.effects ?? []
const abilities = SRD_ABILITIES.map(({ id, code }) => ({ id, code }))
const dexterityId = SRD_ABILITY_DEFINITION_IDS.DEXTERITY
const scalarValues = { [dexterityId]: 14 }

/** Mirror Image as the real planner stores it, with `remaining` decoys left. */
function heldMirrorImage(remaining: number, idSeed = 0xd100): ActiveRuleEffectRecord {
  if (!mirrorImageEffect) throw new Error('The SRD Mirror Image has no effect.')
  const planned = plannedModifierGrant({
    encounterId: ENCOUNTER_ID,
    sourceActorId: HOLDER_ID,
    holderActorId: HOLDER_ID,
    lifecycle: {},
    effect: mirrorImageEffect
  })
  return {
    ...planned,
    id: testUuid(idSeed),
    owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: HOLDER_ID },
    sourceEncounterId: ENCOUNTER_ID,
    maintainedEffectStateId: null,
    createdOrdinal: 1,
    version: 1,
    definitionChecksum: 'a'.repeat(64),
    lifecycleChecksum: 'b'.repeat(64),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lifecycle: { ...planned.lifecycle, remainingUses: remaining }
  }
}

/** The occurrence ids whose derived d20 is each face, found by search so no roll is copied. */
function occurrenceRolling(predicate: (roll: number) => boolean, effect: ActiveRuleEffectRecord) {
  for (let seed = 1; seed < 10_000; seed++) {
    const occurrenceId = testUuid(seed)
    const decoy = attackDecoyFor({ occurrenceId, effects: [effect], scalarValues, abilities })
    const roll = decoy?.roll
    if (decoy && roll !== undefined && predicate(roll)) return { occurrenceId, decoy }
  }
  throw new Error('No occurrence rolled the wanted face.')
}

describe('attack decoys (Mirror Image)', () => {
  it('targets a decoy only when the derived d20 reaches the minimum for the decoys left', () => {
    const effect = heldMirrorImage(3)
    const hits = new Set<number>()
    const misses = new Set<number>()
    for (let seed = 1; seed < 400; seed++) {
      const decoy = attackDecoyFor({
        occurrenceId: testUuid(seed),
        effects: [effect],
        scalarValues,
        abilities
      })
      if (decoy) hits.add(decoy.roll)
      else misses.add(seed)
    }
    expect(Math.min(...hits)).toBe(6)
    expect(Math.max(...hits)).toBe(20)
    expect(misses.size).toBeGreaterThan(0)
  })

  it('needs a higher roll as the decoys run out and replays the same roll for one occurrence', () => {
    const three = heldMirrorImage(3)
    const one = heldMirrorImage(1)
    const { occurrenceId, decoy } = occurrenceRolling((roll) => roll >= 6 && roll < 11, three)
    expect(decoy.minimumRoll).toBe(6)
    expect(attackDecoyFor({ occurrenceId, effects: [three], scalarValues, abilities })?.roll).toBe(
      decoy.roll
    )
    expect(attackDecoyFor({ occurrenceId, effects: [one], scalarValues, abilities })).toBeNull()
  })

  it('rolls against 10 plus the holder Dexterity modifier', () => {
    const effect = heldMirrorImage(3)
    const { decoy } = occurrenceRolling(() => true, effect)
    expect(decoy.armorClass).toBe(12)
  })

  it('ends the effect with the last decoy and otherwise spends one use', () => {
    const { decoy: last } = occurrenceRolling(() => true, heldMirrorImage(1))
    const { decoy: two } = occurrenceRolling(() => true, heldMirrorImage(2))
    expect(decoyIsLast(last)).toBe(true)
    expect(decoyIsLast(two)).toBe(false)
  })

  it('holds no decoy for a holder without the effect, or one with no uses left', () => {
    expect(
      attackDecoyFor({ occurrenceId: testUuid(1), effects: [], scalarValues, abilities })
    ).toBeNull()
    const { lifecycle } = heldMirrorImage(3)
    const { remainingUses: _spent, ...rest } = lifecycle
    const spent = { ...heldMirrorImage(3), lifecycle: rest }
    expect(
      attackDecoyFor({ occurrenceId: testUuid(1), effects: [spent], scalarValues, abilities })
    ).toBeNull()
  })

  it('destroys a decoy only on a hit', () => {
    expect(decoyStruck('ON_HIT')).toBe(true)
    expect(decoyStruck('ON_CRIT')).toBe(true)
    expect(decoyStruck('ON_MISS')).toBe(false)
    expect(decoyStruck(undefined)).toBe(false)
  })

  it('puts the decoy armor class where a Character and a Creature carry theirs', () => {
    const facts = {
      keep: 1,
      derivedStats: { armorClass: { base: 15, effective: 16 } },
      statBlock: { armorClass: 16, hitPoints: 5 }
    }
    expect(withAttackDecoyArmorClass(facts, 12)).toEqual({
      keep: 1,
      derivedStats: { armorClass: { base: 15, effective: 12 } },
      statBlock: { armorClass: 12, hitPoints: 5 }
    })
    expect(facts.statBlock.armorClass).toBe(16)
  })
})
