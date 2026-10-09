import { describe, expect, it } from 'vitest'

import {
  projectCharacterSheetForViewer,
  type CharacterSheetCampaignContext
} from '../character/campaignCharacterSheet.js'
import {
  prepareFixtureBuilder,
  prepareFixtureSheet,
  readyFighterFixture
} from '../testing/characterContextFixtures.js'

const baseContext: CharacterSheetCampaignContext = {
  viewer: 'CHARACTER_OWNER',
  isCampaignOwner: false,
  campaignId: crypto.randomUUID(),
  campaignStatus: 'ACTIVE',
  contentMaturity: 'STANDARD',
  attunementSlotOverride: null,
  adjustments: [],
  secretAdjustmentIds: new Set(),
  conditions: []
}

async function endActiveEffects(context: Partial<CharacterSheetCampaignContext>) {
  const fixture = readyFighterFixture()
  const { character } = await prepareFixtureBuilder(fixture)
  const { sheet } = await prepareFixtureSheet({ ...fixture, character })
  return projectCharacterSheetForViewer(sheet, { ...baseContext, ...context }).meta.capabilities
    .endActiveEffects
}

describe('Character Sheet end-effect capability', () => {
  it('lets the Campaign owner end effects on their own Character (D92, D99)', async () => {
    expect(await endActiveEffects({ viewer: 'CHARACTER_OWNER', isCampaignOwner: true })).toBe(true)
  })

  it('lets the Campaign owner end effects on a player Character', async () => {
    expect(await endActiveEffects({ viewer: 'CAMPAIGN_OWNER', isCampaignOwner: true })).toBe(true)
  })

  it('does not offer a player or party member the capability', async () => {
    expect(await endActiveEffects({ viewer: 'CHARACTER_OWNER' })).toBe(false)
    expect(await endActiveEffects({ viewer: 'PARTY_MEMBER' })).toBe(false)
  })

  it('withholds it from the Campaign owner on an archived Campaign', async () => {
    expect(
      await endActiveEffects({
        viewer: 'CAMPAIGN_OWNER',
        isCampaignOwner: true,
        campaignStatus: 'ARCHIVED'
      })
    ).toBe(false)
  })
})
