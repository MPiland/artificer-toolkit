import { describe, expect, it } from 'vitest'

import { onHitCandidates, onHitSlotChoices } from '../character/characterOnHitSlots.js'
import { advanceNativeActionGraphs } from '../encounterActionExecution.js'
import { resolveNativeActionOnHit } from '../encounterActionOnHit.js'
import type { EncounterOnHitCandidate, EncounterOnHitSelection } from '../encounterOnHitChoice.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { OPTIONAL_SMITE_EFFECT_ID } from '../testing/optionalSmite.js'
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
  smiterWeaponAttack
} from './optionalSmiteAttack.js'

const RADIANT = srdDamageTypeId('RADIANT')
const SLASHING = srdDamageTypeId('SLASHING')
const smiteAt = (slotLevel: number): EncounterOnHitCandidate => ({
  riderId: OPTIONAL_SMITE_EFFECT_ID,
  slotLevel
})

/** A Longsword attack made through the Encounter graphs, holding a hit for the attacker's choice. */
function longswordAttack(rolls: readonly number[]) {
  const { plan, actionMechanic } = smiterWeaponAttack('Longsword', {
    attackKind: 'MELEE',
    grip: 'ONE_HANDED'
  })
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
      selection: EncounterOnHitSelection
    ) => {
      if (held.kind !== 'PENDING' || !held.onHitChoice)
        throw new Error('The hit must be held for the on-hit choice.')
      return resolveNativeActionOnHit({
        ...source,
        candidates,
        adjustedBinding: null,
        offer: held.onHitChoice,
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
      onHitChoice: {
        reaction: null,
        options: [
          { riderId: OPTIONAL_SMITE_EFFECT_ID, slotLevel: 1 },
          { riderId: OPTIONAL_SMITE_EFFECT_ID, slotLevel: 2 }
        ]
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
    if (held.kind !== 'PENDING' || !held.onHitChoice) throw new Error('Expected a held hit.')
    const second = held.onHitChoice.options[1]
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
    if (held.kind !== 'PENDING' || !held.onHitChoice) throw new Error('Expected a held hit.')
    const { execution } = await attack.answer(held, [smiteAt(2)], {
      kind: 'OPTION',
      optionId: held.onHitChoice.options[0]!.useOptionId
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
    if (held.kind !== 'PENDING' || !held.onHitChoice) throw new Error('Expected a held hit.')
    const { execution } = await attack.answer(held, [smiteAt(9)], {
      kind: 'OPTION',
      optionId: held.onHitChoice.options[0]!.useOptionId
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
    if (held.kind !== 'PENDING' || !held.onHitChoice) throw new Error('Expected a held hit.')

    await expect(
      attack.answer(held, [smiteAt(2)], { kind: 'OPTION', optionId: 'a'.repeat(64) })
    ).rejects.toThrow('On-hit selection was not issued.')
    await expect(
      attack.answer(held, [smiteAt(1)], {
        kind: 'OPTION',
        optionId: held.onHitChoice.options[0]!.useOptionId
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
      pactMagic: null,
      fusionStrategy: 'NONE' as const
    }

    expect(onHitSlotChoices(spellSlots).map(({ level }) => level)).toEqual([1, 2])
    expect(
      onHitCandidates({ riders: [{ riderId: OPTIONAL_SMITE_EFFECT_ID }], spellSlots })
    ).toEqual([smiteAt(1), smiteAt(2)])
    expect(
      onHitCandidates({
        riders: [{ riderId: OPTIONAL_SMITE_EFFECT_ID }],
        spellSlots: {
          ...spellSlots,
          maxByLevel: spellSlots.maxByLevel.map((slot) => ({ ...slot, remaining: 0 }))
        }
      })
    ).toEqual([])
  })
})
