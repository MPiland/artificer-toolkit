import { describe, expect, it } from 'vitest'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'

import {
  prepareFixtureSheet,
  readyFighterFixture,
  system
} from '../testing/characterContextFixtures.js'

describe('Character Sheet item cost label', () => {
  it("names the System currency an item's cost is priced in", async () => {
    const fixture = readyFighterFixture()
    const character = {
      ...fixture.character,
      state: {
        ...fixture.character.state,
        equipment: {
          inventory: [{ id: 'held-club', equipmentId: club.id, quantity: 1 }],
          equipped: [],
          attuned: []
        }
      }
    }
    const { sheet } = await prepareFixtureSheet({ ...fixture, character })
    const currency = system.currencies.find(({ id }) => id === club.cost?.currencyId)
    if (!currency) throw new Error('The SRD club must be priced in a System currency.')

    expect(sheet.inventory.items.find(({ id }) => id === 'held-club')).toMatchObject({
      cost: { currencyId: currency.id },
      costLabel: currency.label
    })
  })
})
