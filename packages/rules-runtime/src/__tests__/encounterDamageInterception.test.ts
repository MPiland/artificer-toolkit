import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { NO_DEATH_SAVES } from '@artificer-toolkit/schema/subjects/characterState'
import { mirrorImage } from '@artificer-toolkit/source-data/srd/spells/mirror-image.js'
import { describe, expect, it } from 'vitest'

import type { CharacterRuleActionApplication } from '../characterRuleActionSystemAdapter.js'
import { foldCharacterMechanicsApplications } from '../encounterCharacterMechanicsBatch.js'
import {
  applyDamageInterceptions,
  heldBatchInputs,
  heldDamageInterceptions,
  type HeldDamageInterception,
  type InterceptionSaveRoll
} from '../encounterDamageInterception.js'
import { ENCOUNTER_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { plannedModifierGrant } from '../testing/modifierGrantFixture.js'

const HOLDER_ID = testUuid(0xe002)
const DAMAGE_TYPE_ID = testUuid(0xe003)
const [mirrorImageEffect] = mirrorImage.effects ?? []

/**
 * An authored fixture effect: Mirror Image's grant with its modifier swapped for a damage
 * interception, planned as the real planner stores it (SPELLS-4.T2i2a proves the runtime; the SRD
 * Death Ward converts in T2i2b).
 */
function heldWard(input: {
  idSeed: number
  dropToHitPoints?: number
  negatesKill?: boolean
  uses?: number
  extras?: Record<string, unknown>
}): ActiveRuleEffectRecord {
  if (!mirrorImageEffect) throw new Error('The SRD Mirror Image has no effect.')
  const effect = structuredClone(mirrorImageEffect)
  for (const path of effect.paths)
    if (path.selectionKind === 'FIXED')
      for (const outcome of path.resultBlock.outcomes)
        if (outcome.effectKind === 'APPLY_GRANT')
          for (const modifier of outcome.grants.modifiers ?? [])
            Object.assign(modifier, {
              valueDomainCode: 'DAMAGE_INTERCEPTION',
              payload: {
                dropToHitPoints: input.dropToHitPoints ?? 1,
                negatesKill: input.negatesKill ?? true,
                ...input.extras
              }
            })
  const planned = plannedModifierGrant({
    encounterId: ENCOUNTER_ID,
    sourceActorId: HOLDER_ID,
    holderActorId: HOLDER_ID,
    lifecycle: {},
    effect
  })
  return {
    ...planned,
    id: testUuid(input.idSeed),
    owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: HOLDER_ID },
    sourceEncounterId: ENCOUNTER_ID,
    maintainedEffectStateId: null,
    createdOrdinal: 1,
    version: 1,
    definitionChecksum: 'a'.repeat(64),
    lifecycleChecksum: 'b'.repeat(64),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lifecycle: { ...planned.lifecycle, remainingUses: input.uses ?? 1 }
  }
}

const trace = {
  sourceNodeId: 'node',
  sourceOperationKey: 'operation',
  authoredPath: null,
  resolvedPath: null,
  targetActorId: HOLDER_ID
}

function damage(
  amount: number,
  state: { current: number; temporary?: number; maximum: number }
): CharacterRuleActionApplication {
  const temporary = state.temporary ?? 0
  const temporaryLost = Math.min(temporary, amount)
  const currentLost = Math.min(state.current, amount - temporaryLost)
  return {
    ...trace,
    kind: 'DAMAGE',
    requestedAmount: amount,
    resolvedAmount: amount,
    appliedAmount: temporaryLost + currentLost,
    beforeCurrentHitPoints: state.current,
    afterCurrentHitPoints: state.current - currentLost,
    beforeTemporaryHitPoints: temporary,
    afterTemporaryHitPoints: temporary - temporaryLost,
    maximumHitPoints: state.maximum,
    damageTypeId: DAMAGE_TYPE_ID,
    damageDisposition: 'NORMAL',
    incomingHalved: false,
    critical: false
  }
}

const kill: CharacterRuleActionApplication = { ...trace, kind: 'KILL' }
const ward: HeldDamageInterception = {
  effectId: testUuid(0xe100),
  dropToHitPoints: 1,
  negatesKill: true
}

describe('held damage interceptions', () => {
  it('lists the unspent interceptions of the holder, lowest effect id first', () => {
    const effects = [
      heldWard({ idSeed: 0xe202, dropToHitPoints: 3, negatesKill: false }),
      heldWard({ idSeed: 0xe201 }),
      heldWard({ idSeed: 0xe203, uses: 1 })
    ]
    const spent = { ...effects[2]!, lifecycle: { ...effects[2]!.lifecycle, remainingUses: 0 } }
    expect(heldDamageInterceptions([effects[0]!, effects[1]!, spent])).toEqual([
      { effectId: testUuid(0xe201), dropToHitPoints: 1, negatesKill: true },
      { effectId: testUuid(0xe202), dropToHitPoints: 3, negatesKill: false }
    ])
  })

  it('derives the effective maximum and the interceptions from the same held effects', () => {
    expect(
      heldBatchInputs({ baseMaximumHitPoints: 11, effects: [heldWard({ idSeed: 0xe205 })] })
    ).toEqual({
      effectiveMaximumHitPoints: 11,
      damageInterceptions: [{ effectId: testUuid(0xe205), dropToHitPoints: 1, negatesKill: true }]
    })
    expect(heldBatchInputs({ baseMaximumHitPoints: 11, effects: [] })).toEqual({
      effectiveMaximumHitPoints: 11,
      damageInterceptions: []
    })
  })

  it('holds none without a use left or a held interception', () => {
    const noUses = heldWard({ idSeed: 0xe204 })
    const { remainingUses: _remaining, ...lifecycle } = noUses.lifecycle
    expect(heldDamageInterceptions([{ ...noUses, lifecycle }])).toEqual([])
    expect(heldDamageInterceptions([])).toEqual([])
  })
})

// A Character (death saves) and a Run creature (none) settle through the same fold.
describe.each([
  ['a Character', NO_DEATH_SAVES],
  ['a Run creature', null]
] as const)('damage interception on %s', (_actor, deathSaves) => {
  // The planner applies the interceptions and the fold validates them (`planEncounterMechanicsBatch`).
  const foldApplied = (
    applications: CharacterRuleActionApplication[],
    interceptions: readonly HeldDamageInterception[],
    state: { current: number; temporary: number }
  ) =>
    foldCharacterMechanicsApplications({
      targetActorId: HOLDER_ID,
      currentHitPoints: state.current,
      temporaryHitPoints: state.temporary,
      maximumHitPoints: 30,
      deathSaves,
      conditionIds: [],
      applications,
      damageInterceptions: interceptions
    })
  const fold = (
    applications: CharacterRuleActionApplication[],
    interceptions: readonly HeldDamageInterception[],
    state = { current: 10, temporary: 0 }
  ) =>
    foldApplied(
      applyDamageInterceptions({
        applications,
        currentHitPoints: state.current,
        temporaryHitPoints: state.temporary,
        interceptions
      }),
      interceptions,
      state
    )

  it('leaves lethal damage at the interception total and names the spent effect', () => {
    const folded = fold([damage(40, { current: 10, maximum: 30 })], [ward])
    expect(folded.after.currentHitPoints).toBe(1)
    expect(folded.after.deathSaves).toEqual(deathSaves)
    expect(folded.applications).toMatchObject([
      {
        kind: 'DAMAGE',
        interceptedBy: ward.effectId,
        appliedAmount: 9,
        afterCurrentHitPoints: 1
      }
    ])
  })

  it('does not intercept damage that leaves hit points above 0, or damage at 0 already', () => {
    expect(
      fold([damage(9, { current: 10, maximum: 30 })], [ward]).applications[0]
    ).not.toHaveProperty('interceptedBy')
    const atZero = fold([damage(5, { current: 0, maximum: 30 })], [ward], {
      current: 0,
      temporary: 0
    })
    expect(atZero.applications[0]).not.toHaveProperty('interceptedBy')
  })

  it('counts temporary hit points before the blow that would drop the holder', () => {
    const state = { current: 10, temporary: 5 }
    expect(
      fold([damage(14, { ...state, maximum: 30 })], [ward], state).applications[0]
    ).not.toHaveProperty('interceptedBy')
    const lethal = fold([damage(15, { ...state, maximum: 30 })], [ward], state)
    expect(lethal.after).toMatchObject({ currentHitPoints: 1, temporaryHitPoints: 0 })
  })

  it('spends the first interception on the first lethal blow; a later blow meets it spent', () => {
    const folded = fold(
      [damage(40, { current: 10, maximum: 30 }), damage(40, { current: 0, maximum: 30 })],
      [ward]
    )
    expect(folded.applications).toMatchObject([
      { kind: 'DAMAGE', interceptedBy: ward.effectId, afterCurrentHitPoints: 1 },
      { kind: 'DAMAGE', beforeCurrentHitPoints: 1, afterCurrentHitPoints: 0 }
    ])
    expect(folded.applications[1]).not.toHaveProperty('interceptedBy')
    expect(folded.after.currentHitPoints).toBe(0)
  })

  it('negates an instant kill and leaves the holder as it was', () => {
    const folded = fold([kill], [ward])
    expect(folded.applications).toMatchObject([{ kind: 'KILL_NEGATED', negatedBy: ward.effectId }])
    expect(folded.after).toMatchObject({ currentHitPoints: 10, temporaryHitPoints: 0, deathSaves })
  })

  it('kills when the interception does not negate a kill', () => {
    const folded = fold([kill], [{ ...ward, negatesKill: false }])
    expect(folded.applications).toMatchObject([{ kind: 'KILL' }])
    expect(folded.after.currentHitPoints).toBe(0)
  })

  it('kills when no interception is held', () => {
    expect(fold([kill], []).after.currentHitPoints).toBe(0)
  })

  it('rebases a heal after an interception onto the hit points it left', () => {
    const heal: CharacterRuleActionApplication = {
      ...trace,
      kind: 'HEAL',
      requestedAmount: 4,
      resolvedAmount: 4,
      appliedAmount: 4,
      beforeCurrentHitPoints: 0,
      afterCurrentHitPoints: 4,
      beforeTemporaryHitPoints: 0,
      afterTemporaryHitPoints: 0,
      maximumHitPoints: 30
    }
    const folded = fold([damage(40, { current: 10, maximum: 30 }), heal], [ward])
    expect(folded.after.currentHitPoints).toBe(5)
  })

  it('rebases temporary hit points granted after an interception onto the pools it left', () => {
    const grant: CharacterRuleActionApplication = {
      ...trace,
      kind: 'TEMPORARY_HIT_POINTS',
      requestedAmount: 6,
      resolvedAmount: 6,
      appliedAmount: 6,
      beforeCurrentHitPoints: 0,
      afterCurrentHitPoints: 0,
      beforeTemporaryHitPoints: 0,
      afterTemporaryHitPoints: 6,
      maximumHitPoints: 30
    }
    const folded = fold([damage(40, { current: 10, maximum: 30 }), grant], [ward])
    expect(folded.after).toMatchObject({ currentHitPoints: 1, temporaryHitPoints: 6 })
    expect(folded.applications[1]).toMatchObject({
      kind: 'TEMPORARY_HIT_POINTS',
      beforeCurrentHitPoints: 1,
      afterCurrentHitPoints: 1,
      appliedAmount: 6
    })
  })

  it('refuses lethal damage the planner left unintercepted while a ward is held', () => {
    const lethal = damage(40, { current: 10, maximum: 30 })
    expect(() => foldApplied([lethal], [ward], { current: 10, temporary: 0 })).toThrow(
      'The Character damage interception is invalid.'
    )
  })

  it('refuses an interception the held wards do not name', () => {
    const forged: CharacterRuleActionApplication = {
      ...trace,
      kind: 'DAMAGE',
      requestedAmount: 40,
      resolvedAmount: 40,
      appliedAmount: 9,
      beforeCurrentHitPoints: 10,
      afterCurrentHitPoints: 1,
      beforeTemporaryHitPoints: 0,
      afterTemporaryHitPoints: 0,
      maximumHitPoints: 30,
      damageTypeId: DAMAGE_TYPE_ID,
      damageDisposition: 'NORMAL',
      incomingHalved: false,
      critical: false,
      interceptedBy: testUuid(0xe1ff)
    }
    expect(() => foldApplied([forged], [ward], { current: 10, temporary: 0 })).toThrow(
      'The Character damage application is invalid.'
    )
  })
})

describe('applyDamageInterceptions', () => {
  it('caps the interception total at the maximum hit points', () => {
    const [intercepted] = applyDamageInterceptions({
      applications: [damage(20, { current: 5, maximum: 2 })],
      currentHitPoints: 5,
      temporaryHitPoints: 0,
      interceptions: [{ ...ward, dropToHitPoints: 8 }]
    })
    expect(intercepted).toMatchObject({ afterCurrentHitPoints: 2, interceptedBy: ward.effectId })
  })

  it('returns the applications untouched without interceptions', () => {
    const applications = [damage(40, { current: 10, maximum: 30 }), kill]
    expect(
      applyDamageInterceptions({
        applications,
        currentHitPoints: 10,
        temporaryHitPoints: 0,
        interceptions: []
      })
    ).toEqual(applications)
  })
})

/**
 * SPELLS-33.T4i2a: a damage interception may ask the holder a save whose DC grows with the damage
 * taken, and may exclude damage types and critical hits or cap the damage it meets. The planner and the
 * fold decide it through the same discovery, so they agree on every blow.
 */
describe('damage interception with a save, exclusions and a cap', () => {
  const RADIANT_ID = testUuid(0xe004)
  const state = { current: 10, maximum: 30 }
  const fortitude: HeldDamageInterception = {
    effectId: testUuid(0xe110),
    dropToHitPoints: 1,
    negatesKill: false,
    save: {
      ability: 'CONSTITUTION',
      dc: { base: 5, plusDamageTaken: true, plusPerChargeUsed: 0 },
      spendsUseOnFailure: false
    },
    excludes: { damageTypeIds: [RADIANT_ID], critical: true }
  }
  const relentless: HeldDamageInterception = {
    effectId: testUuid(0xe111),
    dropToHitPoints: 1,
    negatesKill: false,
    maxDamageTaken: 14
  }
  const blow = (amount: number, extra: { damageTypeId?: string; critical?: boolean } = {}) => ({
    ...damage(amount, state),
    ...extra
  })
  const settle = (
    application: CharacterRuleActionApplication,
    held: readonly HeldDamageInterception[],
    saveRoll?: InterceptionSaveRoll
  ) => {
    // The caller rolled one die per interception that asks a save, before the blow lands.
    const interceptions = saveRoll
      ? held.map((interception) =>
          interception.save ? { ...interception, saveRoll } : interception
        )
      : held
    const [planned] = applyDamageInterceptions({
      applications: [application],
      currentHitPoints: state.current,
      temporaryHitPoints: 0,
      interceptions
    })
    const folded = foldCharacterMechanicsApplications({
      targetActorId: HOLDER_ID,
      currentHitPoints: state.current,
      temporaryHitPoints: 0,
      maximumHitPoints: state.maximum,
      deathSaves: null,
      conditionIds: [],
      applications: planned ? [planned] : [],
      damageInterceptions: interceptions
    })
    return { planned, folded }
  }

  it('lists the payload fields of a held interception', () => {
    expect(
      heldDamageInterceptions([
        heldWard({
          idSeed: 0xe210,
          extras: {
            save: fortitude.save,
            excludes: fortitude.excludes,
            maxDamageTaken: 14
          }
        })
      ])
    ).toEqual([
      {
        effectId: testUuid(0xe210),
        dropToHitPoints: 1,
        negatesKill: true,
        save: fortitude.save,
        excludes: fortitude.excludes,
        maxDamageTaken: 14
      }
    ])
  })

  it('leaves the holder at the interception total when it passes a save at 5 plus the damage', () => {
    const { planned, folded } = settle(blow(10), [fortitude], { rawDie: 12, addedTotal: 3 })
    expect(planned).toMatchObject({
      interceptedBy: fortitude.effectId,
      afterCurrentHitPoints: 1,
      interceptionSaves: [
        { effectId: fortitude.effectId, rawDie: 12, addedTotal: 3, dc: 15, passed: true }
      ]
    })
    expect(folded.after.currentHitPoints).toBe(1)
  })

  it('scales the DC with the damage taken, the whole blow rather than the overflow past 0', () => {
    const roll = { rawDie: 12, addedTotal: 3 }
    // 15 against 10 hit points: the overflow is 5, but the blow is 15 and the DC 20.
    const { planned } = settle(blow(15), [fortitude], roll)
    expect(planned).not.toHaveProperty('interceptedBy')
    expect(planned).toMatchObject({
      afterCurrentHitPoints: 0,
      interceptionSaves: [{ dc: 20, passed: false }]
    })
    expect(settle(blow(10), [fortitude], roll).planned).toHaveProperty('interceptedBy')
  })

  it('spends nothing on a failed save and lets the next interception meet the blow', () => {
    const { planned, folded } = settle(blow(10), [fortitude, relentless], {
      rawDie: 1,
      addedTotal: 0
    })
    expect(planned).toMatchObject({
      interceptedBy: relentless.effectId,
      interceptionSaves: [{ effectId: fortitude.effectId, passed: false }]
    })
    expect(folded.after.currentHitPoints).toBe(1)
  })

  it('does not ask the save of a blow its exclusions do not admit', () => {
    for (const excluded of [{ damageTypeId: RADIANT_ID }, { critical: true }]) {
      const { planned } = settle(blow(10, excluded), [fortitude], { rawDie: 20, addedTotal: 9 })
      expect(planned).not.toHaveProperty('interceptedBy')
      expect(planned).not.toHaveProperty('interceptionSaves')
      expect(planned).toMatchObject({ afterCurrentHitPoints: 0 })
    }
  })

  it('meets damage of 14 and not of 15 under a cap of 14', () => {
    expect(settle(blow(14), [relentless]).planned).toHaveProperty('interceptedBy')
    const over = settle(blow(15), [relentless])
    expect(over.planned).not.toHaveProperty('interceptedBy')
    expect(over.folded.after.currentHitPoints).toBe(0)
  })

  it('refuses a plan without a die for the save a blow asks', () => {
    expect(() => settle(blow(10), [fortitude])).toThrow('A damage interception save has no die.')
  })

  it('refuses a save the planner did not record, or one the fold would settle differently', () => {
    const roll = { rawDie: 12, addedTotal: 3 }
    const { planned } = settle(blow(10), [fortitude], roll)
    if (planned?.kind !== 'DAMAGE') throw new Error('Expected a damage application.')
    const { interceptionSaves: _saves, ...unrecorded } = planned
    const fold = (application: CharacterRuleActionApplication, saveRoll = roll) =>
      foldCharacterMechanicsApplications({
        targetActorId: HOLDER_ID,
        currentHitPoints: state.current,
        temporaryHitPoints: 0,
        maximumHitPoints: state.maximum,
        deathSaves: null,
        conditionIds: [],
        applications: [application],
        damageInterceptions: [{ ...fortitude, saveRoll }]
      })
    expect(() => fold(unrecorded)).toThrow('The Character damage interception is invalid.')
    expect(() => fold(planned, { rawDie: 2, addedTotal: 3 })).toThrow(
      'The Character damage interception is invalid.'
    )
    expect(() => fold(planned)).not.toThrow()
  })
})
