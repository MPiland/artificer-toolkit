import { socialListingManagementSearchSchema } from './socialSearch'

describe('socialListingManagementSearchSchema', () => {
  it('supports direct application-review links and defaults invalid sections safely', () => {
    expect(socialListingManagementSearchSchema.parse({ section: 'applications' })).toEqual({
      section: 'applications'
    })
    expect(socialListingManagementSearchSchema.parse({ section: 'unknown' })).toEqual({
      section: 'listing'
    })
  })
})
