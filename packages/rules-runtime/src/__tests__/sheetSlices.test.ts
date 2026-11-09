import { describe, expect, it } from 'vitest'
import { characterSheetSliceSchema } from '@artificer-toolkit/schema/api/characterSheetSlices'
import {
  projectCharacterSheetForViewer,
  type CharacterSheetCampaignContext
} from '../character/campaignCharacterSheet.js'
import { composeCharacterSheet, projectCharacterSheetSlice } from '../character/sheetSlices.js'
import {
  prepareFixtureBuilder,
  prepareFixtureSheet,
  readyFighterFixture
} from '../testing/characterContextFixtures.js'

const context: CharacterSheetCampaignContext = {
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

const storedSlices = characterSheetSliceSchema.options.filter((slice) => slice !== 'NOTES')

async function fixtureSheet() {
  const fixture = readyFighterFixture()
  const { character } = await prepareFixtureBuilder(fixture)
  return (await prepareFixtureSheet({ ...fixture, character })).sheet
}

describe('Character Sheet slices', () => {
  it("rebuilds each viewer's whole Sheet from its six slices and notes", async () => {
    const sheet = await fixtureSheet()
    for (const viewer of ['CHARACTER_OWNER', 'CAMPAIGN_OWNER', 'PARTY_MEMBER'] as const) {
      const viewed = projectCharacterSheetForViewer(sheet, { ...context, viewer })
      const slices = storedSlices.map((slice) => projectCharacterSheetSlice(viewed, slice))
      expect(composeCharacterSheet(slices, viewed.notes)).toEqual(viewed)
    }
  })

  it('refuses to compose a Sheet without one of its slices', async () => {
    const sheet = await fixtureSheet()
    const slices = storedSlices
      .filter((slice) => slice !== 'SPELLS')
      .map((slice) => projectCharacterSheetSlice(sheet, slice))
    expect(() => composeCharacterSheet(slices, sheet.notes)).toThrow(
      'Character Sheet slice SPELLS is missing.'
    )
  })
})
