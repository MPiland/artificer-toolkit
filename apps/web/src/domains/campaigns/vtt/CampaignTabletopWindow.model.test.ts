import { describe, expect, it } from 'vitest'
import {
  buildAuxiliaryWindowFeatures,
  buildTabletopHref,
  tabletopWindowName
} from './CampaignTabletopWindow.model'

describe('CampaignTabletopWindow model', () => {
  it('builds an encoded standalone tabletop route and stable window name', () => {
    expect(buildTabletopHref('campaign/demo')).toBe('/tabletop/campaigns/campaign%2Fdemo')
    expect(tabletopWindowName('campaign/demo')).toBe('artificer-tabletop-campaign-demo')
  })

  it('sizes the popup to the available screen area', () => {
    const features = buildAuxiliaryWindowFeatures({
      availHeight: 1040,
      availLeft: 1920,
      availTop: 0,
      availWidth: 1920
    })
    expect(features.split(',')).toEqual(
      expect.arrayContaining(['popup=yes', 'width=1920', 'height=1040', 'left=1920', 'top=0'])
    )
  })

  it('opens at the screen origin when the screen reports none', () => {
    const features = buildAuxiliaryWindowFeatures({ availHeight: 800, availWidth: 1280 })
    expect(features.split(',')).toEqual(expect.arrayContaining(['left=0', 'top=0']))
  })
})
