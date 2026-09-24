import { describe, expect, it } from 'vitest'
import {
  masterRaceFixture,
  ownedBaseRaceResponseFixture,
  ownedSubraceFixture
} from './race.fixtures'
import { resolveRaceParentPreview } from './raceParentPreview.utils'

describe('resolveRaceParentPreview', () => {
  const subrace = ownedSubraceFixture
  if (subrace.category !== 'SUBRACE') throw new Error('Expected the subrace fixture.')
  const parentResponse = { ...ownedBaseRaceResponseFixture, item: masterRaceFixture }

  it('uses the selected draft subrace parent rather than an active sibling parent', () => {
    expect(
      resolveRaceParentPreview({ ...subrace, parentRaceId: masterRaceFixture.id }, parentResponse)
    ).toBe(masterRaceFixture)
    expect(
      resolveRaceParentPreview({ ...subrace, parentRaceId: 'different-parent' }, parentResponse)
    ).toBeNull()
  })

  it('rejects base, missing, foreign-System, and non-base parent responses', () => {
    expect(resolveRaceParentPreview(masterRaceFixture, parentResponse)).toBeNull()
    expect(resolveRaceParentPreview(subrace, null)).toBeNull()
    expect(
      resolveRaceParentPreview(subrace, {
        ...parentResponse,
        item: { ...masterRaceFixture, systemId: 'other-system' }
      })
    ).toBeNull()
    expect(
      resolveRaceParentPreview(subrace, {
        ...parentResponse,
        item: { ...subrace, id: subrace.parentRaceId }
      })
    ).toBeNull()
  })
})
