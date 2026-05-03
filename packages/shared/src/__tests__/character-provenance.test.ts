import { describe, expect, it } from 'vitest'

import {
  isSameCharacterProvenanceIdentity,
  type CharacterProvenance
} from '#authored'

describe('character provenance identity', () => {
  it('matches class-owned sources by stable class identity instead of class level', () => {
    const firstLevelSource: CharacterProvenance = { kind: 'CLASS', classId: 'wizard', classLevel: 1 }
    const fifthLevelSource: CharacterProvenance = { kind: 'CLASS', classId: 'wizard', classLevel: 5 }

    expect(isSameCharacterProvenanceIdentity(firstLevelSource, fifthLevelSource)).toBe(true)
  })

  it('matches subclass-owned sources by stable subclass identity instead of class level', () => {
    const thirdLevelSource: CharacterProvenance = { kind: 'SUBCLASS', subclassId: 'evoker', classLevel: 3 }
    const seventhLevelSource: CharacterProvenance = { kind: 'SUBCLASS', subclassId: 'evoker', classLevel: 7 }

    expect(isSameCharacterProvenanceIdentity(thirdLevelSource, seventhLevelSource)).toBe(true)
  })

  it('does not collapse different source identities of the same kind', () => {
    const wizardSource: CharacterProvenance = { kind: 'CLASS', classId: 'wizard', classLevel: 1 }
    const fighterSource: CharacterProvenance = { kind: 'CLASS', classId: 'fighter', classLevel: 1 }
    const arcanaOptionSource: CharacterProvenance = { kind: 'OPTION', acquiredParentId: 'feature-choice-1', optionId: 'arcana' }
    const historyOptionSource: CharacterProvenance = { kind: 'OPTION', acquiredParentId: 'feature-choice-1', optionId: 'history' }

    expect(isSameCharacterProvenanceIdentity(wizardSource, fighterSource)).toBe(false)
    expect(isSameCharacterProvenanceIdentity(arcanaOptionSource, historyOptionSource)).toBe(false)
  })
})
