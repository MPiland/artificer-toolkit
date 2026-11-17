import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { describe, expect, it } from 'vitest'

import {
  prepareFixtureBuilder,
  prepareFixtureSheet,
  readyFighterFixture
} from '../testing/characterContextFixtures.js'

/**
 * QUALITY-15.T3ai: an all-items Equipment proficiency in a category, such as the Fighter's Shields,
 * is listed on the Sheet's armor proficiencies.
 */

if (fighter.category !== 'BASE') throw new Error('Expected the canonical parent Fighter class.')
const shieldGrants = (fighter.proficiencies ?? []).filter(
  (grant) => grant.proficiencyKind === 'EQUIPMENT' && grant.category === 'SHIELD'
)

async function sheetProficiencies() {
  expect(shieldGrants).toHaveLength(1)
  const fixture = readyFighterFixture()
  const [baseClass] = fixture.documents.CLASS
  const documents = {
    ...fixture.documents,
    CLASS: [{ ...baseClass, proficiencies: shieldGrants }]
  }
  const { character } = await prepareFixtureBuilder({ character: fixture.character, documents })
  const played = await prepareFixtureSheet({ character, documents })
  return played.sheet.reference.proficiencies
}

describe('the Sheet lists a category-wide Equipment proficiency (QUALITY-15.T3ai)', () => {
  it("lists the Fighter's Shields proficiency among its armor proficiencies", async () => {
    expect(await sheetProficiencies()).toContainEqual({
      kind: 'ARMOR',
      label: 'All shield equipment',
      value: 'Equipment · Proficient'
    })
  })
})
