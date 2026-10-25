import { describe, expect, it } from 'vitest'

import type { EncounterSealedChoiceSelection } from '../encounterSealedChoice.js'
import { onHitCandidates, onHitSlotChoices } from '../character/characterOnHitCosts.js'
import { advanceNativeActionGraphs } from '../encounterActionExecution.js'
import { resolveNativeActionOnHit } from '../encounterActionOnHit.js'
import type { EncounterOnHitCandidate } from '../encounterOnHitChoice.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  OPTIONAL_POOL_STRIKE_CHARGE_ID,
  OPTIONAL_POOL_STRIKE_EFFECT_ID,
  OPTIONAL_SMITE_EFFECT_ID,
  optionalPoolStrike
} from '../testing/optionalSmite.js'
import { outcomeDice, srdDamageTypeId } from './encounterCreatureAction.js'
import {
  HIT,
  MISS,
  NATURAL_20,
  SMITE_OCCURRENCE_ID,
  damage,
  scriptedRolls,
  smiteRuntime,
  smiteTargetBinding,
  smiter,
  smiterWeaponAttack
} from './optionalSmiteAttack.js'
import type { SrdCharacter } from '../testing/dnd5eSrdCharacter.js'

const RADIANT = srdDamageTypeId('RADIANT')
const SLASHING = srdDamageTypeId('SLASHING')
const smiteAt = (slotLevel: number): EncounterOnHitCandidate => ({
  kind: 'SPELL_SLOT',
  riderId: OPTIONAL_SMITE_EFFECT_ID,
  slotLevel
})

/** A Longsword attack made through the Encounter graphs, holding a hit for the attacker's choice. */
function longswordAttack(rolls: readonly number[], character?: SrdCharacter) {
  const { plan, actionMechanic } = smiterWeaponAttack(
    'Longsword',
    { attackKind: 'MELEE', grip: 'ONE_HANDED' },
    character
  )
  const scripted = scriptedRolls(rolls)
  const source = {
    runtime: smiteRuntime(),
    adapter: dnd5eCharacterRuleActionSystemAdapter,
    plan,
    occurrenceId: SMITE_OCCURRENCE_ID,
    autoRoll: { SOURCE: true, TARGET: true },
    binding: smiteTargetBinding(actionMechanic),
    afterTest: async () => undefined,
    random: scripted.next
  }
  return {
    scripted,
    source,
    advance: (candidates: readonly EncounterOnHitCandidate[]) =>
      advanceNativeActionGraphs({ ...source, onHitCandidates: candidates }),
    answer: async (
      held: Awaited<ReturnType<typeof advanceNativeActionGraphs>>,
      candidates: readonly EncounterOnHitCandidate[],
      selection: EncounterSealedChoiceSelection
    ) => {
      if (held.kind !== 'PENDING' || held.pause?.kind !== 'ON_HIT')
        throw new Error('The hit must be held for the on-hit choice.')
      return resolveNativeActionOnHit({
        ...source,
        candidates,
        adjustedBinding: null,
        offer: held.pause.payload,
        selection
      })
    }
  }
}

function completed(execution: Awaited<ReturnType<typeof advanceNativeActionGraphs>>) {
  if (execution.kind !== 'COMPLETE') throw new Error('The action must settle.')
  return execution
}

describe('a hit is held for the attacker to add an optional on-hit rider (D123)', () => {
  it('holds the hit on a bounded choice that offers each way of paying and a decline', async () => {
    const attack = longswordAttack([HIT])
    const held = await attack.advance([smiteAt(1), smiteAt(2)])

    expect(held).toMatchObject({
      kind: 'PENDING',
      roller: 'SOURCE',
      d20Policy: null,
      continuation: { request: { min: 0, max: 2 } },
      pause: {
        kind: 'ON_HIT',
        payload: {
          reaction: null,
          options: [
            { riderId: OPTIONAL_SMITE_EFFECT_ID, slotLevel: 1 },
            { riderId: OPTIONAL_SMITE_EFFECT_ID, slotLevel: 2 }
          ]
        }
      }
    })
    expect(attack.scripted.remaining()).toEqual([])
  })

  it('adds nothing when the attacker declines', async () => {
    const attack = longswordAttack([HIT, 3])
    const held = await attack.advance([smiteAt(2)])
    const { execution, audit } = await attack.answer(held, [smiteAt(2)], { kind: 'DECLINE' })

    expect(audit).toMatchObject({ selection: 'DECLINE', option: null })
    expect(outcomeDice(completed(execution)).hit).toEqual(['d8'])
    expect(damage(completed(execution))).toEqual([
      { requested: 4 + 3, resolved: 4 + 3, damageTypeId: SLASHING }
    ])
  })

  it('adds the dice row of the slot level paid, as radiant damage', async () => {
    const attack = longswordAttack([HIT, 3, 0, 1, 2])
    const held = await attack.advance([smiteAt(1), smiteAt(2)])
    if (held.kind !== 'PENDING' || held.pause?.kind !== 'ON_HIT')
      throw new Error('Expected a held hit.')
    const second = held.pause.payload.options[1]
    const { execution, audit } = await attack.answer(held, [smiteAt(1), smiteAt(2)], {
      kind: 'OPTION',
      optionId: second!.useOptionId
    })

    expect(audit).toMatchObject({ selection: 'USE', option: { slotLevel: 2 } })
    expect(damage(completed(execution))).toEqual([
      { requested: 4 + 3, resolved: 4 + 3, damageTypeId: SLASHING },
      { requested: 1 + 2 + 3, resolved: 1 + 2 + 3, damageTypeId: RADIANT }
    ])
    expect(completed(execution).d20).toMatchObject({ resultPath: 'ON_HIT' })
  })

  it('doubles the rider dice on a critical hit', async () => {
    const attack = longswordAttack([NATURAL_20, 3, 6, 0, 1, 2, 3, 4, 5])
    const held = await attack.advance([smiteAt(2)])
    if (held.kind !== 'PENDING' || held.pause?.kind !== 'ON_HIT')
      throw new Error('Expected a held hit.')
    const { execution } = await attack.answer(held, [smiteAt(2)], {
      kind: 'OPTION',
      optionId: held.pause.payload.options[0]!.useOptionId
    })

    expect(completed(execution).d20).toMatchObject({ resultPath: 'ON_CRIT' })
    expect(damage(completed(execution)).map((part) => part.requested)).toEqual([
      4 + 7 + 3,
      1 + 2 + 3 + 4 + 5 + 6
    ])
  })

  it('never rolls more than 5 dice, however high the slot', async () => {
    const attack = longswordAttack([HIT, 3, 0, 0, 0, 0, 0])
    const held = await attack.advance([smiteAt(9)])
    if (held.kind !== 'PENDING' || held.pause?.kind !== 'ON_HIT')
      throw new Error('Expected a held hit.')
    const { execution } = await attack.answer(held, [smiteAt(9)], {
      kind: 'OPTION',
      optionId: held.pause.payload.options[0]!.useOptionId
    })

    expect(outcomeDice(completed(execution)).hit).toEqual(['d8', 'd8', 'd8', 'd8', 'd8', 'd8'])
  })

  it('does not hold a miss, and holds nothing when no slot can pay', async () => {
    const miss = longswordAttack([MISS])
    expect(completed(await miss.advance([smiteAt(2)])).d20).toMatchObject({
      resultPath: 'ON_MISS'
    })

    const unpaid = longswordAttack([HIT, 3])
    expect(completed(await unpaid.advance([]))).toMatchObject({ kind: 'COMPLETE' })
  })

  it('refuses an option the offer never issued, and one that can no longer be paid', async () => {
    const attack = longswordAttack([HIT])
    const held = await attack.advance([smiteAt(2)])
    if (held.kind !== 'PENDING' || held.pause?.kind !== 'ON_HIT')
      throw new Error('Expected a held hit.')

    await expect(
      attack.answer(held, [smiteAt(2)], { kind: 'OPTION', optionId: 'a'.repeat(64) })
    ).rejects.toThrow('On-hit selection was not issued.')
    await expect(
      attack.answer(held, [smiteAt(1)], {
        kind: 'OPTION',
        optionId: held.pause.payload.options[0]!.useOptionId
      })
    ).rejects.toThrow('On-hit evidence is stale.')
  })
})

describe('which optional on-hit riders a Character can pay for (D123)', () => {
  it('finds the rider on a melee weapon attack and none on a ranged one', () => {
    const riders = (weapon: string, select: Parameters<typeof smiterWeaponAttack>[1]) =>
      dnd5eCharacterRuleActionSystemAdapter.optionalOnHitRiders({
        compilerSource: smiterWeaponAttack(weapon, select).compilerSource
      })

    expect(riders('Longsword', { attackKind: 'MELEE', grip: 'ONE_HANDED' })).toEqual([
      { riderId: OPTIONAL_SMITE_EFFECT_ID, cost: { kind: 'SPELL_SLOT' } }
    ])
    expect(riders('Shortbow', { attackKind: 'RANGED' })).toEqual([])
  })

  it('offers each slot level the Character still holds', () => {
    const spellSlots = {
      calculationId: 'slots',
      sourceClassIds: [],
      maxByLevel: [1, 2].map((spellLevel) => ({
        spellLevel,
        slotCount: 2,
        sourceIds: [],
        rawUsed: 0,
        effectiveUsed: 0,
        remaining: 2
      })),
      slotPools: [],
      fusionStrategy: 'NONE' as const
    }

    expect(onHitSlotChoices(spellSlots).map(({ level }) => level)).toEqual([1, 2])
    expect(
      onHitCandidates({
        riders: [{ riderId: OPTIONAL_SMITE_EFFECT_ID, cost: { kind: 'SPELL_SLOT' } }],
        spellSlots,
        resources: []
      })
    ).toEqual([smiteAt(1), smiteAt(2)])
    expect(
      onHitCandidates({
        riders: [{ riderId: OPTIONAL_SMITE_EFFECT_ID, cost: { kind: 'SPELL_SLOT' } }],
        resources: [],
        spellSlots: {
          ...spellSlots,
          maxByLevel: spellSlots.maxByLevel.map((slot) => ({ ...slot, remaining: 0 }))
        }
      })
    ).toEqual([])
  })

  it('pays a level from a slot pool only where no standard slot or earlier pool is left there', () => {
    const slotPool = (poolCode: string, level: number, remaining: number) => ({
      poolCode,
      sourceClassId: 'caster',
      slots: 2,
      level,
      rawUsed: 2 - remaining,
      effectiveUsed: 2 - remaining,
      remaining
    })
    const spellSlots = {
      calculationId: 'slots',
      sourceClassIds: [],
      maxByLevel: [
        { spellLevel: 2, slotCount: 1, sourceIds: [], rawUsed: 0, effectiveUsed: 0, remaining: 1 }
      ],
      slotPools: [
        slotPool('FIRST_POOL', 2, 2),
        slotPool('FIRST_POOL_HIGH', 4, 1),
        slotPool('SECOND_POOL', 4, 2),
        slotPool('SPENT_POOL', 5, 0)
      ],
      fusionStrategy: 'NONE' as const
    }

    expect(onHitSlotChoices(spellSlots)).toEqual([
      { level: 2, slotKey: 'STANDARD:2' },
      { level: 4, slotKey: 'FIRST_POOL_HIGH' }
    ])
  })
})

const POOL_ID = 'CLASS:monk:charge-1'
const poolStrikeAt = (cost: number, poolId = POOL_ID): EncounterOnHitCandidate => ({
  kind: 'RESOURCE_POOL',
  riderId: OPTIONAL_POOL_STRIKE_EFFECT_ID,
  poolId,
  cost
})
const poolResource = (
  overrides: {
    poolId?: string
    chargeId?: string
    state?: 'RESOLVED' | 'UNRESOLVED'
    remaining?: number | null
  } = {}
): Parameters<typeof onHitCandidates>[0]['resources'][number] => ({
  sequence: 0,
  poolId: POOL_ID,
  ownerKind: 'ITEM_INSTANCE',
  itemInstanceId: 'item-1',
  sourceId: null,
  chargeId: OPTIONAL_POOL_STRIKE_CHARGE_ID,
  resourceDefinitionId: 'ki',
  chargeCalculationId: POOL_ID,
  state: 'RESOLVED',
  maximum: 5,
  rawUsed: 2,
  effectiveUsed: 2,
  remaining: 3,
  reasonCode: 'CALCULATED',
  baseContribution: { sourceId: 'charge-1', value: 5 },
  bonusContributions: [],
  resetKind: 'SHORT_REST',
  resetResolution: { baseResetKind: 'SHORT_REST', appliedGrantId: null, source: null },
  ...overrides
})
const poolRider = (cost: number) => ({
  riderId: OPTIONAL_POOL_STRIKE_EFFECT_ID,
  cost: { kind: 'RESOURCE_POOL' as const, chargeId: OPTIONAL_POOL_STRIKE_CHARGE_ID, cost }
})
const emptySlots = {
  calculationId: 'slots',
  sourceClassIds: [],
  maxByLevel: [],
  slotPools: [],
  fusionStrategy: 'NONE' as const
}

describe('an optional on-hit rider paid from a resource pool (SPELLS-31.T5r-a, D156)', () => {
  const homebrewStrike = optionalPoolStrike({
    maximum: 5,
    cost: 2,
    diceConfig: '2d6',
    damageTypeCode: 'FORCE'
  })
  const strikerAttack = (rolls: readonly number[]) =>
    longswordAttack(rolls, smiter('Longsword', homebrewStrike))

  it('finds the rider and its pool cost on a melee weapon attack', () => {
    expect(
      dnd5eCharacterRuleActionSystemAdapter.optionalOnHitRiders({
        compilerSource: smiterWeaponAttack(
          'Longsword',
          { attackKind: 'MELEE', grip: 'ONE_HANDED' },
          smiter('Longsword', homebrewStrike)
        ).compilerSource
      })
    ).toEqual([poolRider(2)])
  })

  it('offers the pool only while exactly one resolved pool holds the cost', () => {
    const offer = (resources: Parameters<typeof onHitCandidates>[0]['resources']) =>
      onHitCandidates({ riders: [poolRider(2)], spellSlots: emptySlots, resources })

    expect(offer([poolResource()])).toEqual([poolStrikeAt(2)])
    expect(offer([poolResource({ remaining: 2 })])).toEqual([poolStrikeAt(2)])
    expect(offer([poolResource({ remaining: 1 })])).toEqual([])
    expect(offer([poolResource({ state: 'UNRESOLVED', remaining: null })])).toEqual([])
    expect(offer([poolResource({ chargeId: 'other' })])).toEqual([])
    expect(offer([poolResource(), poolResource({ poolId: 'CLASS:monk:charge-2' })])).toEqual([])
  })

  it('holds the hit on the pool option, and adds the rider damage when it is used', async () => {
    const attack = strikerAttack([HIT, 3, 0, 1])
    const held = await attack.advance([poolStrikeAt(2)])
    expect(held).toMatchObject({
      kind: 'PENDING',
      pause: {
        kind: 'ON_HIT',
        payload: {
          options: [
            {
              kind: 'RESOURCE_POOL',
              riderId: OPTIONAL_POOL_STRIKE_EFFECT_ID,
              poolId: POOL_ID,
              cost: 2
            }
          ]
        }
      }
    })
    if (held.kind !== 'PENDING' || held.pause?.kind !== 'ON_HIT')
      throw new Error('Expected a held hit.')
    const { execution, audit } = await attack.answer(held, [poolStrikeAt(2)], {
      kind: 'OPTION',
      optionId: held.pause.payload.options[0]!.useOptionId
    })

    expect(audit).toMatchObject({
      selection: 'USE',
      option: { kind: 'RESOURCE_POOL', poolId: POOL_ID, cost: 2 }
    })
    expect(damage(completed(execution))).toEqual([
      { requested: 4 + 3, resolved: 4 + 3, damageTypeId: SLASHING },
      { requested: 1 + 2, resolved: 1 + 2, damageTypeId: srdDamageTypeId('FORCE') }
    ])
  })

  it('adds nothing when the attacker declines', async () => {
    const attack = strikerAttack([HIT, 3])
    const held = await attack.advance([poolStrikeAt(2)])
    const { execution, audit } = await attack.answer(held, [poolStrikeAt(2)], { kind: 'DECLINE' })

    expect(audit).toMatchObject({ selection: 'DECLINE', option: null })
    expect(damage(completed(execution))).toEqual([
      { requested: 4 + 3, resolved: 4 + 3, damageTypeId: SLASHING }
    ])
  })

  it('refuses a pool option whose cost or pool changed since it was offered', async () => {
    const attack = strikerAttack([HIT])
    const held = await attack.advance([poolStrikeAt(2)])
    if (held.kind !== 'PENDING' || held.pause?.kind !== 'ON_HIT')
      throw new Error('Expected a held hit.')
    const optionId = held.pause.payload.options[0]!.useOptionId

    for (const stale of [poolStrikeAt(3), poolStrikeAt(2, 'CLASS:monk:charge-2'), smiteAt(2)])
      await expect(attack.answer(held, [stale], { kind: 'OPTION', optionId })).rejects.toThrow(
        'On-hit evidence is stale.'
      )
  })
})
