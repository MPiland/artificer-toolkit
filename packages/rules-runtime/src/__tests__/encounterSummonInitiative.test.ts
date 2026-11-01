import { describe, expect, it } from 'vitest'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { SRD_DND5E_SPEED_FACTOR_INITIATIVE_POLICY_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/initiativePolicies.js'

import { buildEncounterSummon } from '../encounterSummon.js'
import { rollSummonInitiative } from '../encounterSummonInitiative.js'
import { createSrdRulesRuntime } from '../testing/dnd5eSrdEncounter.js'
import {
  initiativePolicySnapshot,
  seededInitiativePolicySnapshot
} from '../testing/initiativePolicySnapshot.js'
import { creatureActor, creatureEncounter } from './encounterCreatureAction.js'
import { scriptedDice } from './encounterInitiativeFixtures.js'

/**
 * SPELLS-35.T5 (D200): a summon authored to roll its own initiative rolls it through the Run's pinned
 * policy graph as it arrives, in one `1dN` face the room posts as its Initiative card.
 */

const OCCURRENCE_ID = '00000000-0000-4000-8000-00000000f035'
const owner = creatureActor({ id: crypto.randomUUID(), label: 'Owner', features: [] })
const familiar = {
  ...creatureActor({ id: crypto.randomUUID(), label: 'Familiar', features: [] }),
  owner: { ownerActorId: owner.id, turnTiming: 'OWN_INITIATIVE' as const }
}

function runWith(policy: ReturnType<typeof initiativePolicySnapshot> | null) {
  const { state } = creatureEncounter([owner])
  return {
    ...state,
    initiativePolicySnapshot: policy?.snapshot ?? null,
    initiativePolicySnapshotChecksum: policy?.checksum ?? null
  }
}

const actorRoll = initiativePolicySnapshot({ procedure: 'ACTOR_ROLL', cadence: 'ENCOUNTER_START' })

function roll(
  state: ReturnType<typeof runWith>,
  actor: EncounterRunActorState,
  dice = scriptedDice([13])
) {
  return rollSummonInitiative({
    state,
    actor,
    runtime: createSrdRulesRuntime(),
    occurrenceId: OCCURRENCE_ID,
    integerSource: dice.next
  })
}

/** A stat-block summon the way a spell cast conjures one: a custom actor carrying its resolved scores. */
const statBlockSummon = (dexterity: number | null) =>
  buildEncounterSummon({
    summon: { kind: 'STAT_BLOCK', statBlock: {} },
    spellSummon: {
      spellId: crypto.randomUUID(),
      summonOutcomeId: 'conjure',
      label: 'Spirit',
      concentration: true,
      armorClass: null,
      ...(dexterity === null ? {} : { abilityScores: { DEXTERITY: dexterity } })
    },
    cannotAttack: false,
    turnTiming: 'OWN_INITIATIVE',
    caster: owner,
    casterHitPointMaximum: 40,
    label: 'Spirit',
    sourceEffectId: crypto.randomUUID(),
    point: { x: 150, y: 150 },
    edgeLength: 100,
    occurredAt: '2026-10-23T00:00:00.000Z'
  }).actor

describe('rollSummonInitiative (SPELLS-35.T5)', () => {
  it('rolls a stat-block summon by the Dexterity modifier its stat block resolved', async () => {
    const dice = scriptedDice([13])
    const spirit = statBlockSummon(14)

    expect(spirit.kind).toBe('CUSTOM')
    expect(await roll(runWith(actorRoll), spirit, dice)).toEqual({
      sides: 20,
      face: 13,
      modifier: 2
    })
    expect(await roll(runWith(actorRoll), statBlockSummon(null), scriptedDice([13]))).toEqual({
      sides: 20,
      face: 13,
      modifier: 0
    })
  })

  it('rolls one d20 through the policy graph and returns its face and modifier', async () => {
    const dice = scriptedDice([13])
    const rolled = await roll(runWith(actorRoll), familiar, dice)

    expect(dice.requests).toEqual([{ min: 1, max: 20 }])
    expect(rolled).toMatchObject({ sides: 20, face: 13 })
    expect(Number.isInteger(rolled?.modifier)).toBe(true)
  })

  it('rolls nothing for an actor that takes no roll of its own', async () => {
    const dice = scriptedDice([13])
    const sameTurn = { ...familiar, owner: { ownerActorId: owner.id } }

    expect(await roll(runWith(actorRoll), sameTurn, dice)).toBeNull()
    expect(await roll(runWith(actorRoll), owner, dice)).toBeNull()
    expect(dice.remaining()).toBe(1)
  })

  it('rolls nothing in a Run with no policy snapshot or one that is not an actor roll', async () => {
    const dice = scriptedDice([13])
    const declared = seededInitiativePolicySnapshot(
      SRD_DND5E_SPEED_FACTOR_INITIATIVE_POLICY_DEFINITION_ID
    )

    expect(await roll(runWith(null), familiar, dice)).toBeNull()
    expect(await roll(runWith(declared), familiar, dice)).toBeNull()
    expect(dice.remaining()).toBe(1)
  })

  it('rolls nothing in a Run that has not started: the summon then rolls with the start cohort', async () => {
    const dice = scriptedDice([13])

    expect(await roll({ ...runWith(actorRoll), status: 'PREPARED' }, familiar, dice)).toBeNull()
    expect(dice.remaining()).toBe(1)
  })
})
