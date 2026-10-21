import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { preparedCastsSpell, preparedSpellCastLevel } from '../encounterPreparedSpellCast.js'

describe('prepared spell cast level', () => {
  const prepared = (
    source: { kind: string; candidate?: { mechanicsOwner: { kind: string } } },
    spellCastLevel?: number
  ) =>
    ({
      source,
      characterActionState:
        spellCastLevel === undefined ? null : { actionMechanic: { spellCastLevel } }
    }) as unknown as Parameters<typeof preparedSpellCastLevel>[0]

  it('is the cast level of a Character spell, 0 for a cantrip', () => {
    const spell = { kind: 'CHARACTER_ACTION', candidate: { mechanicsOwner: { kind: 'SPELL' } } }
    expect(preparedSpellCastLevel(prepared(spell, 3))).toBe(3)
    expect(preparedSpellCastLevel(prepared(spell, 0))).toBe(0)
  })

  it('is null for anything that is not a Character spell cast or has no known level', () => {
    const weapon = { kind: 'CHARACTER_ACTION', candidate: { mechanicsOwner: { kind: 'ITEM' } } }
    expect(preparedSpellCastLevel(prepared(weapon, 1))).toBeNull()
    expect(preparedSpellCastLevel(prepared({ kind: 'CREATURE_CAPABILITY' }, 1))).toBeNull()
    expect(
      preparedSpellCastLevel(
        prepared({ kind: 'CHARACTER_ACTION', candidate: { mechanicsOwner: { kind: 'SPELL' } } })
      )
    ).toBeNull()
  })
})

describe('prepared Creature capability cast level', () => {
  const creature = (spellCast?: { castLevel: number }, triggerCode = 'ACTIVATED') =>
    ({
      source: {
        kind: 'CREATURE',
        capability: { spellCast, mechanicFacts: { invocation: { triggerCode } } }
      },
      characterActionState: null
    }) as unknown as Parameters<typeof preparedSpellCastLevel>[0]

  it('is the authored cast level ', () => {
    expect(preparedSpellCastLevel(creature({ castLevel: 3 }))).toBe(3)
  })

  it('is null for a capability that casts no spell, a spell attack included', () => {
    expect(preparedSpellCastLevel(creature())).toBeNull()
    expect(preparedSpellCastLevel(creature(undefined, 'MELEE_SPELL_ATTACK'))).toBeNull()
  })
})

describe('prepared action casts a spell', () => {
  const creature = (triggerCode: string) =>
    ({
      source: { kind: 'CREATURE', capability: { mechanicFacts: { invocation: { triggerCode } } } },
      characterActionState: null,
      state: { gameSystemId: srdSystemRecord.id }
    }) as unknown as Parameters<typeof preparedCastsSpell>[0]

  it('is true for a Character spell cast, a cantrip included', () => {
    const spell = { kind: 'CHARACTER_ACTION', candidate: { mechanicsOwner: { kind: 'SPELL' } } }
    for (const spellCastLevel of [0, 3])
      expect(
        preparedCastsSpell({
          source: spell,
          characterActionState: { actionMechanic: { spellCastLevel } }
        } as unknown as Parameters<typeof preparedCastsSpell>[0])
      ).toBe(true)
  })

  it.each(['MELEE_SPELL_ATTACK', 'RANGED_SPELL_ATTACK'])(
    'is true for a Creature action triggered by a %s',
    (triggerCode) => {
      expect(preparedCastsSpell(creature(triggerCode))).toBe(true)
    }
  )

  it.each([
    'MELEE_WEAPON_ATTACK',
    'RANGED_WEAPON_ATTACK',
    'UNARMED_ATTACK',
    'SAVING_THROW',
    'ACTIVATED'
  ])('is false for a Creature action triggered by %s', (triggerCode) => {
    expect(preparedCastsSpell(creature(triggerCode))).toBe(false)
  })

  it('is false for a Character action that is not a spell', () => {
    expect(
      preparedCastsSpell({
        source: { kind: 'CHARACTER_ACTION', candidate: { mechanicsOwner: { kind: 'ITEM' } } },
        characterActionState: { actionMechanic: { spellCastLevel: 1 } }
      } as unknown as Parameters<typeof preparedCastsSpell>[0])
    ).toBe(false)
  })
})
