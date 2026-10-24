import { buildPlatformNavigation, contentKindOrder, isNavItemActive } from './navigation'

const platformNavigation = buildPlatformNavigation(contentKindOrder)

describe('Campaign navigation', () => {
  it('wires Campaigns into the Workspace and keeps detail routes active', () => {
    const item = platformNavigation
      .find((group) => group.label === 'Workspace')
      ?.items.find((candidate) => candidate.label === 'Campaigns')

    expect(item?.href).toBe('/campaigns')
    expect(item && isNavItemActive(item, '/campaigns/4fzz7/ashfall-at-dawn')).toBe(true)
  })

  it('wires Social Hub into the Workspace and keeps its journeys active', () => {
    const item = platformNavigation
      .find((group) => group.label === 'Workspace')
      ?.items.find((candidate) => candidate.label === 'Social Hub')

    expect(item?.href).toBe('/social')
    expect(item && isNavItemActive(item, '/social/listings/listing-id/table-title')).toBe(true)
  })
})

describe('capability-driven navigation', () => {
  const contentLabels = (kinds: Parameters<typeof buildPlatformNavigation>[0]) =>
    buildPlatformNavigation(kinds)
      .find((group) => group.label === 'Content')
      ?.items.map((item) => item.label)

  it('lists the published kinds in the fixed presentation order, whatever order they arrive in', () => {
    expect(contentLabels(['VEHICLE', 'SPELL', 'RACE', 'SPELL'])).toEqual([
      'Spells',
      'Races',
      'Vehicles'
    ])
  })

  it('offers every kind when every kind is published', () => {
    expect(contentLabels(contentKindOrder)).toHaveLength(contentKindOrder.length)
  })

  it('shows an explicit empty state, with no Content entries, when nothing is published', () => {
    const content = buildPlatformNavigation([]).find((group) => group.label === 'Content')

    expect(content?.items).toEqual([])
    expect(content?.emptyLabel).toBe('No Game System content available')
  })

  it('has no Content group while the published kinds are loading', () => {
    expect(buildPlatformNavigation(undefined).map((group) => group.label)).toEqual(['Workspace'])
  })
})
