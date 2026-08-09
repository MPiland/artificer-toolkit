import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'

const mocks = vi.hoisted(() => ({
  lockTier: vi.fn(),
  findTier: vi.fn(),
  countUsage: vi.fn(),
  characterExists: vi.fn(),
  countCharacters: vi.fn(),
  transaction: { isTransaction: true }
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  class TestEntitlementLimitError extends Error {
    readonly name = 'EntitlementLimitError'

    constructor(public readonly resource: string) {
      super(`Your account has reached its ${resource} limit.`)
    }
  }
  return {
    ...actual,
    EntitlementLimitError: TestEntitlementLimitError,
    createAccountEntitlementsRepository: () => ({
      lockTier: mocks.lockTier,
      findTier: mocks.findTier,
      countUsage: mocks.countUsage,
      characterExistsForUser: mocks.characterExists,
      countPersonalCharacters: mocks.countCharacters
    }),
    withTransaction: (_db: DBLike, callback: (trx: DBLike) => Promise<unknown>) =>
      callback(mocks.transaction as DBLike)
  }
})

const {
  ENTITLEMENT_LIMITS,
  ENTITLEMENT_PRICING,
  EntitlementLimitError,
  assertEntitlementLimit,
  getEntitlementProjection,
  withPersonalCharacterLimit
} = await import('./entitlementService.js')

describe('account entitlements', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.lockTier.mockResolvedValue('FREE')
    mocks.findTier.mockResolvedValue('FREE')
    mocks.countUsage.mockResolvedValue({
      storageBytes: 0,
      personalCharacters: 0,
      homebrewRoots: 0,
      activeHostedCampaigns: 0,
      publicListings: 0,
      savedEncounters: 0
    })
    mocks.characterExists.mockResolvedValue(false)
    mocks.countCharacters.mockResolvedValue(0)
  })

  it('keeps the release tier matrix in one code-owned map', () => {
    expect(ENTITLEMENT_LIMITS).toEqual({
      FREE: {
        storageBytes: 250 * 1024 * 1024,
        personalCharacters: 6,
        homebrewRoots: 20,
        activeHostedCampaigns: 1,
        playerSeatsPerCampaign: 5,
        publicListings: 1,
        savedEncounters: 3,
        paidTablesEnabled: false,
        platformFeeBasisPoints: 0
      },
      PLAYER: {
        storageBytes: 1024 * 1024 * 1024,
        personalCharacters: null,
        homebrewRoots: null,
        activeHostedCampaigns: 1,
        playerSeatsPerCampaign: 5,
        publicListings: 1,
        savedEncounters: 3,
        paidTablesEnabled: false,
        platformFeeBasisPoints: 0
      },
      GM: {
        storageBytes: 5 * 1024 * 1024 * 1024,
        personalCharacters: null,
        homebrewRoots: null,
        activeHostedCampaigns: 5,
        playerSeatsPerCampaign: 12,
        publicListings: 5,
        savedEncounters: null,
        paidTablesEnabled: true,
        platformFeeBasisPoints: 1000
      },
      PRO_GM: {
        storageBytes: 25 * 1024 * 1024 * 1024,
        personalCharacters: null,
        homebrewRoots: null,
        activeHostedCampaigns: null,
        playerSeatsPerCampaign: 12,
        publicListings: null,
        savedEncounters: null,
        paidTablesEnabled: true,
        platformFeeBasisPoints: 0
      }
    })
    expect(ENTITLEMENT_PRICING).toEqual({
      FREE: { currency: 'USD', monthlyPriceCents: 0, annualPriceCents: 0 },
      PLAYER: { currency: 'USD', monthlyPriceCents: 499, annualPriceCents: 4999 },
      GM: { currency: 'USD', monthlyPriceCents: 999, annualPriceCents: 9999 },
      PRO_GM: { currency: 'USD', monthlyPriceCents: 4999, annualPriceCents: 49999 }
    })
  })

  it('blocks only a new Character id once the tier limit is reached', async () => {
    const callback = vi.fn()
    mocks.countCharacters.mockResolvedValue(6)

    await expect(
      withPersonalCharacterLimit({} as DBLike, 'user-1', 'character-7', callback)
    ).rejects.toEqual(new EntitlementLimitError('personalCharacters'))
    expect(callback).not.toHaveBeenCalled()

    mocks.characterExists.mockResolvedValue(true)
    await withPersonalCharacterLimit({} as DBLike, 'user-1', 'character-1', callback)
    expect(callback).toHaveBeenCalledOnce()
  })

  it('enforces the saved Encounter cap at the shared entitlement guard', () => {
    expect(() => assertEntitlementLimit('savedEncounters', 3, 3)).toThrow(
      new EntitlementLimitError('savedEncounters')
    )
    expect(() => assertEntitlementLimit('savedEncounters', 2, 3)).not.toThrow()
  })

  it('projects the protected tier with current usage', async () => {
    mocks.findTier.mockResolvedValue('GM')
    mocks.countUsage.mockResolvedValue({
      storageBytes: 42,
      personalCharacters: 7,
      homebrewRoots: 8,
      activeHostedCampaigns: 2,
      publicListings: 1,
      savedEncounters: 0
    })

    await expect(getEntitlementProjection({} as DBLike, 'user-1')).resolves.toEqual({
      tier: 'GM',
      limits: ENTITLEMENT_LIMITS.GM,
      usage: {
        storageBytes: 42,
        personalCharacters: 7,
        homebrewRoots: 8,
        activeHostedCampaigns: 2,
        publicListings: 1,
        savedEncounters: 0
      },
      pricing: ENTITLEMENT_PRICING.GM
    })
  })
})
