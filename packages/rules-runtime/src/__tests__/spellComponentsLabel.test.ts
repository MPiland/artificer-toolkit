import { describe, expect, it } from 'vitest'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'

import { spellComponentsLabel } from '../spellCastCandidates.js'

describe('the components a spell cast shows (D171)', () => {
  it('names each component by its letter and gives the material beside it', () => {
    expect(
      spellComponentsLabel({
        components: ['VERBAL', 'SOMATIC', 'MATERIAL'],
        materialDescription: 'a pearl worth at least 100 gp'
      })
    ).toBe('V, S, M (a pearl worth at least 100 gp)')
  })

  it('omits the material text when the spell has no material component', () => {
    expect(spellComponentsLabel({ components: ['VERBAL'], materialDescription: 'stale' })).toBe('V')
    expect(spellComponentsLabel({ components: ['SOMATIC', 'MATERIAL'] })).toBe('S, M')
  })

  it('shows nothing for a spell that authors no components', () => {
    expect(spellComponentsLabel({})).toBeUndefined()
    expect(spellComponentsLabel({ components: [] })).toBeUndefined()
  })

  it('reads the SRD spell data as authored', () => {
    const identify = srdSpells.find((spell) => spell.label === 'Identify')
    expect(spellComponentsLabel(identify!)).toBe(
      'V, S, M (a pearl worth at least 100 gp and an owl feather)'
    )
  })
})
