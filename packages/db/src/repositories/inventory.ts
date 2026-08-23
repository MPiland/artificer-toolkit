import type { DBLike } from '#types'
import { createCampaignCurrencySystemRepository } from './inventoryCampaignCurrency.js'
import {
  createInventoryCurrencyRepository,
  InsufficientInventoryCurrencyError
} from './inventoryCurrency.js'
import { createInventoryCustodyRepository } from './inventoryCustody.js'
import { createInventoryOwnerItemRepository } from './inventoryOwnerItems.js'
export {
  createCampaignVehicleEvacuationRepository,
  type CampaignVehicleCurrencyTransfer,
  type CampaignVehicleEvacuationResult
} from './campaignVehicleEvacuation.js'

export {
  campaignInventoryEventKinds,
  type CampaignCurrencyCleanup,
  type CampaignCurrencyDenomination,
  type CampaignCurrencySystem,
  type CampaignCustodyEvent,
  type CampaignInventoryEventKind,
  type CurrencyBalanceRewrite,
  type CurrencyDebit,
  type CurrencyDenomination,
  type CurrencyDenominationRef,
  type InventoryAggregate,
  type InventoryCurrencyBalance,
  type InventoryItem,
  type InventoryOwner,
  type InventoryOwnerRef
} from './inventoryTypes.js'
export { InsufficientInventoryCurrencyError }

export function createInventoryRepository(db: DBLike) {
  const currency = createInventoryCurrencyRepository(db)
  return {
    ...createInventoryOwnerItemRepository(db, currency.listCurrencyBalances),
    ...currency,
    ...createInventoryCustodyRepository(db),
    ...createCampaignCurrencySystemRepository(db, currency.upsertUngroupedCurrencyBalance)
  }
}
