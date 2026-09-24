import { describe, expect, it } from 'vitest'
import {
  aggregateInventoryCurrencies,
  getAuthorizedSourceOwners,
  getCharacterInventoryCurrencies,
  getCurrentCurrencyOptions,
  parseOwner
} from './campaignInventory.utils'

const currencyId = '11111111-1111-4111-8111-111111111111'

describe('Campaign inventory owners', () => {
  it('maps Vehicle custody without treating it as Character state', () => {
    expect(parseOwner('VEHICLE:vehicle-id', 'campaign-id')).toEqual({
      kind: 'VEHICLE',
      vehicleId: 'vehicle-id'
    })
  })

  it('includes authorized Vehicle cargo and only the player’s assigned Character', () => {
    expect(
      getAuthorizedSourceOwners(
        {
          role: 'PLAYER',
          memberships: [
            {
              userId: 'current-user',
              assignedCharacter: {
                id: 'my-character',
                publicId: 'my-character',
                label: 'My Character',
                systemId: 'system-id'
              }
            },
            {
              userId: 'other-user',
              assignedCharacter: {
                id: 'other-character',
                publicId: 'other-character',
                label: 'Other Character',
                systemId: 'system-id'
              }
            }
          ]
        },
        'current-user',
        [{ id: 'vehicle-id', label: 'Cart' }]
      )
    ).toEqual([
      { value: 'PARTY', label: 'Party inventory' },
      { value: 'CHARACTER:my-character', label: 'My Character' },
      { value: 'VEHICLE:vehicle-id', label: 'Cart' }
    ])
  })
})

describe('Campaign inventory currency rows', () => {
  it('keeps matching denomination IDs from separate currency systems distinct', () => {
    const rows = aggregateInventoryCurrencies([
      {
        kind: 'CAMPAIGN' as const,
        campaignCurrencySystemId: 'system-a',
        denominationId: currencyId,
        label: 'Gold',
        abbreviation: 'gp',
        amount: 2,
        containerId: null
      },
      {
        kind: 'CAMPAIGN' as const,
        campaignCurrencySystemId: 'system-b',
        denominationId: currencyId,
        label: 'Gold',
        abbreviation: 'gp',
        amount: 3,
        containerId: null
      }
    ])

    expect(rows).toHaveLength(2)
  })

  it('adds matching currency placements exactly beyond Number precision', () => {
    expect(
      aggregateInventoryCurrencies([
        {
          kind: 'RULESET' as const,
          denominationId: currencyId,
          label: 'Gold',
          abbreviation: 'gp',
          amount: Number.MAX_SAFE_INTEGER,
          containerId: null
        },
        {
          kind: 'RULESET' as const,
          denominationId: currencyId,
          label: 'Gold',
          abbreviation: 'gp',
          amount: Number.MAX_SAFE_INTEGER,
          containerId: null
        }
      ])
    ).toMatchObject([{ amount: '18014398509481982' }])
  })

  it('combines every placement into one exact transfer total', () => {
    expect(
      aggregateInventoryCurrencies(
        [
          {
            kind: 'RULESET' as const,
            denominationId: currencyId,
            label: 'Gold',
            abbreviation: 'gp',
            amount: Number.MAX_SAFE_INTEGER,
            containerId: null
          },
          {
            kind: 'RULESET' as const,
            denominationId: currencyId,
            label: 'Gold',
            abbreviation: 'gp',
            amount: Number.MAX_SAFE_INTEGER,
            containerId: 'pouch-id'
          }
        ].map((currency) => ({ ...currency, containerId: null }))
      )
    ).toMatchObject([{ amount: '18014398509481982' }])
  })
  it('preserves an unresolved UUID holding without classifying it as ruleset currency', () => {
    expect(
      getCharacterInventoryCurrencies([{ currencyId, amount: 4, label: 'Historic coin' }], [])
        .currencies
    ).toMatchObject([
      {
        denominationId: currencyId,
        kind: undefined,
        label: 'Historic coin'
      }
    ])
  })

  it('has no current acquisition options without a current System or Campaign currency system', () => {
    expect(getCurrentCurrencyOptions(null, [], 'STANDARD')).toEqual([])
  })
})
