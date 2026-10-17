import { describe, expect, expectTypeOf, it } from 'vitest'
import type { ModifierGrantAuthored, ModifierGrantAuthoredFor } from '#authored'
import { compileModifierGrant, compileModifierGrantResult, type CompiledModifierGrant } from '#compilers'
import type { ModifierKind, ValueDomainCode } from '#core'

type DamageAbilityModifier = Extract<
  ModifierGrantAuthoredFor<'DAMAGE'>,
  { modifierKind: 'ABILITY_MODIFIER_BONUS' }
>

const meleeDamageBonus: DamageAbilityModifier = {
  id: 'melee-damage-strength',
  order: 1,
  grantKind: 'MODIFIER_GRANT',
  selectionKind: 'GRANTED',
  valueDomainCode: 'DAMAGE',
  domain: { attackDomain: 'MELEE' },
  modifierKind: 'ABILITY_MODIFIER_BONUS',
  scope: 'SOURCE',
  payload: { ability: 'STRENGTH' }
}

describe('modifier grant compiler', () => {
  it('lets a generic transform spread and override an authored modifier grant', () => {
    function reorder<M extends ModifierGrantAuthored>(modifier: M, order: number): M {
      return { ...modifier, order }
    }
    const capped = { ...meleeDamageBonus, payload: { ...meleeDamageBonus.payload, max: 0 } }

    const asAuthored: ModifierGrantAuthored = capped

    expectTypeOf(reorder(meleeDamageBonus, 2)).toEqualTypeOf<DamageAbilityModifier>()
    expect(reorder(asAuthored, 2)).toMatchObject({ order: 2, payload: { ability: 'STRENGTH', max: 0 } })
  })

  it('compiles to one flat shape whose domain and kind override independently', () => {
    const compiled = compileModifierGrant(meleeDamageBonus)
    const retarget = (
      grant: CompiledModifierGrant,
      valueDomainCode: ValueDomainCode,
      modifierKind: ModifierKind
    ): CompiledModifierGrant => ({ ...grant, valueDomainCode, modifierKind })

    expect(compiled).toStrictEqual({
      id: 'melee-damage-strength',
      order: 1,
      grantKind: 'MODIFIER_GRANT',
      selectionKind: 'GRANTED',
      valueDomainCode: 'DAMAGE',
      domain: { attackDomain: 'MELEE' },
      modifierKind: 'ABILITY_MODIFIER_BONUS',
      scope: 'SOURCE',
      payload: { ability: 'STRENGTH' }
    })
    expect(retarget(compiled, 'ATTACK_ROLL', 'ABILITY_MODIFIER_BONUS')).toMatchObject({
      valueDomainCode: 'ATTACK_ROLL',
      modifierKind: 'ABILITY_MODIFIER_BONUS'
    })
  })

  it('rejects a modifier kind its value domain does not support', () => {
    // Stored or imported data can carry a kind its domain no longer supports.
    const unsupported = {
      ...meleeDamageBonus,
      modifierKind: 'ADD_OPTION'
    } as unknown as ModifierGrantAuthored

    expect(compileModifierGrantResult(unsupported)).toEqual({
      ok: false,
      diagnostics: [
        {
          code: 'MODIFIER_KIND_UNSUPPORTED_FOR_DOMAIN',
          message: 'DAMAGE does not support ADD_OPTION modifiers.',
          severity: 'error',
          path: ['modifierKind']
        }
      ]
    })
  })
})
