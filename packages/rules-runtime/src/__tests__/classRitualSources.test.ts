import { describe, expect, it } from 'vitest'
import { createClassRitualSourceInstanceId } from '@artificer-toolkit/shared/character'
import { SPELL_ATTRIBUTE, SPELLCASTING_ATTRIBUTE } from '@artificer-toolkit/shared/core'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { assembleClassRitualSources } from '../character/classRitualSources.js'

const SPELLS = [
  { id: 'rite', attributes: [SPELL_ATTRIBUTE.RITUAL] },
  { id: 'bolt', attributes: [SPELL_ATTRIBUTE.CONCENTRATION] },
  { id: 'plain' }
] as const

function characterWith(spells: { learned: string[]; prepared: string[] }) {
  return { state: { classes: [{ classId: 'cls', spells }] } } as unknown as CharacterAuthored
}

function registryWith(attributes: string[] | undefined) {
  return {
    classes: { cls: { spellcasting: attributes ? { attributes } : undefined } }
  } as unknown as Parameters<typeof assembleClassRitualSources>[1]
}

describe('the spells a class casts as rituals (D171)', () => {
  const spellbook = [SPELLCASTING_ATTRIBUTE.RITUAL_CASTER, SPELLCASTING_ATTRIBUTE.USES_SPELLBOOK]
  const prepared = [SPELLCASTING_ATTRIBUTE.RITUAL_CASTER, SPELLCASTING_ATTRIBUTE.PREPARES_SPELLS]
  const character = characterWith({ learned: ['rite', 'bolt', 'plain'], prepared: [] })

  it('draws a spellbook class from the spells it has learned, prepared or not', () => {
    expect(assembleClassRitualSources(character, registryWith(spellbook), SPELLS)).toEqual([
      {
        classId: 'cls',
        source: {
          spellId: 'rite',
          sourceKind: 'CLASS',
          sourceInstanceId: createClassRitualSourceInstanceId('cls')
        }
      }
    ])
  })

  it('draws any other ritual caster only from the spells it has prepared', () => {
    expect(assembleClassRitualSources(character, registryWith(prepared), SPELLS)).toEqual([])
    expect(
      assembleClassRitualSources(
        characterWith({ learned: ['rite'], prepared: ['rite', 'bolt'] }),
        registryWith(prepared),
        SPELLS
      ).map(({ source }) => source.spellId)
    ).toEqual(['rite'])
  })

  it('casts nothing as a ritual for a class without the ritual caster attribute', () => {
    expect(
      assembleClassRitualSources(
        character,
        registryWith([SPELLCASTING_ATTRIBUTE.USES_SPELLBOOK]),
        SPELLS
      )
    ).toEqual([])
    expect(assembleClassRitualSources(character, registryWith(undefined), SPELLS)).toEqual([])
  })
})
