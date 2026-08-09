import {
  createAccountEntitlementsRepository,
  EntitlementLimitError,
  withTransaction,
  type DBLike,
  type EntitlementResource
} from '@artificer-toolkit/db'
import type {
  EntitlementLimitDto,
  EntitlementPricingDto,
  EntitlementProjectionDto,
  EntitlementTierDto
} from '@artificer-toolkit/schema/api/campaigns'

const MEBIBYTE = 1024 * 1024
const GIBIBYTE = 1024 * MEBIBYTE

export { EntitlementLimitError }

export const ENTITLEMENT_LIMITS = {
  FREE: {
    storageBytes: 250 * MEBIBYTE,
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
    storageBytes: GIBIBYTE,
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
    storageBytes: 5 * GIBIBYTE,
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
    storageBytes: 25 * GIBIBYTE,
    personalCharacters: null,
    homebrewRoots: null,
    activeHostedCampaigns: null,
    playerSeatsPerCampaign: 12,
    publicListings: null,
    savedEncounters: null,
    paidTablesEnabled: true,
    platformFeeBasisPoints: 0
  }
} as const satisfies Record<EntitlementTierDto, EntitlementLimitDto>

export const ENTITLEMENT_PRICING = {
  FREE: { currency: 'USD', monthlyPriceCents: 0, annualPriceCents: 0 },
  PLAYER: { currency: 'USD', monthlyPriceCents: 499, annualPriceCents: 4999 },
  GM: { currency: 'USD', monthlyPriceCents: 999, annualPriceCents: 9999 },
  PRO_GM: { currency: 'USD', monthlyPriceCents: 4999, annualPriceCents: 49999 }
} as const satisfies Record<EntitlementTierDto, EntitlementPricingDto>

export function assertEntitlementLimit(
  resource: EntitlementResource,
  usage: number,
  limit: number | null
): void {
  if (limit !== null && usage >= limit) throw new EntitlementLimitError(resource)
}

export async function getEntitlementLimits(
  db: DBLike,
  userId: string
): Promise<EntitlementLimitDto> {
  const tier = await createAccountEntitlementsRepository(db).findTier(userId)
  return ENTITLEMENT_LIMITS[tier]
}

export async function getEntitlementProjection(
  db: DBLike,
  userId: string
): Promise<EntitlementProjectionDto> {
  const repository = createAccountEntitlementsRepository(db)
  const [tier, usage] = await Promise.all([
    repository.findTier(userId),
    repository.countUsage(userId)
  ])
  return {
    tier,
    limits: ENTITLEMENT_LIMITS[tier],
    usage,
    pricing: ENTITLEMENT_PRICING[tier]
  }
}

export function withLockedEntitlementLimits<T>(
  db: DBLike,
  userId: string,
  callback: (trx: DBLike, limits: EntitlementLimitDto) => Promise<T>
): Promise<T> {
  return withTransaction(db, async (trx) => {
    const tier = await createAccountEntitlementsRepository(trx).lockTier(userId)
    return callback(trx, ENTITLEMENT_LIMITS[tier])
  })
}

export function withPersonalCharacterLimit<T>(
  db: DBLike,
  userId: string,
  characterId: string,
  callback: (trx: DBLike) => Promise<T>
): Promise<T> {
  return withLockedEntitlementLimits(db, userId, async (trx, limits) => {
    const repository = createAccountEntitlementsRepository(trx)
    if (!(await repository.characterExistsForUser(userId, characterId))) {
      assertEntitlementLimit(
        'personalCharacters',
        await repository.countPersonalCharacters(userId),
        limits.personalCharacters
      )
    }
    return callback(trx)
  })
}
