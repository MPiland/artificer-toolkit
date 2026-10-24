import { describe, expect, it } from 'vitest'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { compileSpell } from '@artificer-toolkit/shared/subjects/compilers'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'

import { buildCharacterSpellActionRuleFacts } from '../character/characterSpellActionRuleFacts.js'
import { getSpellCastLevels } from '../character/sheetProjection.js'
import type { SheetSpellSource } from '../character/sheetCommandReducer.js'
import { absorbElementsSpell } from '../testing/absorbElementsSpell.js'
import { fixedHealSpell } from '../testing/fixedHealSpell.js'

const source = (fields: Record<string, unknown> = {}) =>
  ({ source: { kind: 'CLASS', classId: 'wizard' }, ...fields }) as unknown as SheetSpellSource

const srdSpell = (label: string): SpellAuthored => {
  const found = srdSpells.find((entry) => entry.label === label)
  if (!found) throw new Error(`SRD spell "${label}" is missing.`)
  return found
}

/** Whether the spell's authored effects read the level it is cast at, as the Character's facts say. */
function readsCastLevel(spell: SpellAuthored): boolean {
  const [facts] = buildCharacterSpellActionRuleFacts({
    spellIds: [spell.id],
    spells: [compileSpell(spell)]
  }).spellActionFacts
  return facts!.readsCastLevel
}

describe('the levels a spell is cast at', () => {
  it('offers every owned higher slot level beside its own when the spell reads its cast level', () => {
    expect(
      getSpellCastLevels({ level: 1, readsCastLevel: true }, source(), new Set([1, 3, 5]))
    ).toEqual([1, 3, 5])
  })

  it('offers only its own level when nothing about the spell reads its cast level', () => {
    expect(
      getSpellCastLevels({ level: 1, readsCastLevel: false }, source(), new Set([1, 2, 3]))
    ).toEqual([1])
  })

  it('offers only its own level when no higher slot is owned', () => {
    expect(
      getSpellCastLevels({ level: 3, readsCastLevel: true }, source(), new Set([1, 2, 3]))
    ).toEqual([3])
  })

  it('offers a cantrip and a non-slot cast only at their own level', () => {
    expect(
      getSpellCastLevels({ level: 0, readsCastLevel: true }, source(), new Set([1, 2]))
    ).toEqual([0])
    expect(
      getSpellCastLevels(
        { level: 1, readsCastLevel: true },
        source({ castMode: 'AT_WILL' }),
        new Set([1, 2])
      )
    ).toEqual([1])
    expect(
      getSpellCastLevels(
        { level: 1, readsCastLevel: true },
        source({ castMode: 'SPELL_SLOT', fixedLevel: 4 }),
        new Set([4, 5])
      )
    ).toEqual([4, 5])
  })
})

describe('the spells whose authored effects read their cast level', () => {
  it.each([
    ['scales its healing by it', srdSpell('Cure Wounds')],
    ['scales its damage by it', srdSpell('Fireball')],
    ['scales its targets by it', srdSpell('Magic Missile')],
    ['scales a granted amount by its slot level', absorbElementsSpell(['FIRE'])],
    ['scales the damage of its follow-up save by it', srdSpell('Phantasmal Killer')],
    ['scales the damage of the attack it repeats by it', srdSpell('Spiritual Weapon')],
    // A regression (SPELLS-4.T2v2a3d): the sibling attack a repeat re-runs was never read.
    ['scales the damage of its held attack by it', srdSpell('Flame Blade')],
    ['compares the slot with the cast spell’s level', srdSpell('Counterspell')]
  ])('%s', (_reason, spell) => {
    expect(readsCastLevel(spell)).toBe(true)
  })

  it.each(['Shield', 'Fly'])('%s does not', (label) => {
    expect(readsCastLevel(srdSpell(label))).toBe(false)
  })

  it('does not for a fixed heal', () => {
    expect(readsCastLevel(fixedHealSpell())).toBe(false)
  })
})
