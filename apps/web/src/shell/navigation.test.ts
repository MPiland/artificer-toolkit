import { isNavItemActive, platformNavigation } from './navigation'

describe('Campaign navigation', () => {
  it('wires Campaigns into the Workspace and keeps detail routes active', () => {
    const item = platformNavigation
      .find((group) => group.label === 'Workspace')
      ?.items.find((candidate) => candidate.label === 'Campaigns')

    expect(item?.href).toBe('/campaigns')
    expect(item && isNavItemActive(item, '/campaigns/4fzz7/ashfall-at-dawn')).toBe(true)
  })
})
