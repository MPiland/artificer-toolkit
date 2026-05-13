import {
  buildAuthoredRouteHandle,
  isCanonicalAuthoredRouteHandle,
  normalizeAuthoredRouteSlug,
  parseAuthoredRouteHandle,
  parseAuthoredRouteId
} from './authoredRouteHandles'

const uuid = '00000000-0000-0000-0020-000100000000'

describe('authored route handles', () => {
  it('normalizes labels into lowercase kebab slugs', () => {
    expect(normalizeAuthoredRouteSlug('Acid Arrow')).toBe('acid-arrow')
    expect(normalizeAuthoredRouteSlug('\u00c9lan & Fire!')).toBe('elan-and-fire')
    expect(normalizeAuthoredRouteSlug('   ')).toBe('item')
  })

  it('builds and parses handles from persisted public IDs', () => {
    const handle = buildAuthoredRouteHandle('1WLL5', 'Acid Arrow')

    expect(handle).toEqual({
      publicId: '1wll5',
      slug: 'acid-arrow'
    })
    expect(parseAuthoredRouteHandle('1WLL5')).toEqual({
      id: '1wll5',
      isLegacy: false
    })
  })

  it('accepts legacy raw UUID route params', () => {
    expect(parseAuthoredRouteHandle(uuid.toUpperCase())).toEqual({
      id: uuid,
      isLegacy: true
    })
  })

  it('keeps selected public IDs canonical for duplicate labels', () => {
    const handle = buildAuthoredRouteHandle('abc123', 'Fixture Spell')

    expect(parseAuthoredRouteId(handle.publicId)).toBe('abc123')
    expect(isCanonicalAuthoredRouteHandle(handle.publicId, handle.slug, {
      id: uuid,
      publicId: 'abc123',
      label: 'Fixture Spell'
    })).toBe(true)
    expect(isCanonicalAuthoredRouteHandle('abc123', 'stale-fixture-spell', {
      id: uuid,
      publicId: 'abc123',
      label: 'Fixture Spell'
    })).toBe(false)
  })

  it('rejects malformed handles', () => {
    expect(parseAuthoredRouteHandle('not-valid-public-id')).toBeNull()
    expect(parseAuthoredRouteHandle('')).toBeNull()
  })
})
