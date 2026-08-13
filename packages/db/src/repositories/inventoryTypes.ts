import type { DbTables, Json } from '#types'

export type InventoryOwnerRef =
  | { kind: 'CHARACTER'; characterId: string }
  | { kind: 'CAMPAIGN'; campaignId: string }
  | { kind: 'VEHICLE'; vehicleId: string }

export interface InventoryOwner {
  id: string
  kind: InventoryOwnerRef['kind']
  characterId: string | null
  campaignId: string | null
  vehicleId: string | null
  version: number
}
export interface InventoryItem {
  id: string
  ownerId: string
  equipmentId: string
  equipmentLabel: string | null
  quantity: number
  containerId: string | null
  isContainer: boolean
  customName: string | null
  notes: string | null
  equipped: boolean
  attuned: boolean
  placementKind: 'CREATURE' | 'VEHICLE' | null
  placementId: string | null
}
export type CurrencyDenomination =
  | {
      kind: 'RULESET'
      id: string
      systemId: string
      label: string
      abbreviation: string
      scaleInReference: null
    }
  | {
      kind: 'CAMPAIGN'
      id: string
      systemId: string
      label: string
      abbreviation: string
      scaleInReference: bigint
    }
export interface InventoryCurrencyBalance {
  id: string
  ownerId: string
  groupId: string | null
  containerId: string | null
  denomination: CurrencyDenomination
  amount: bigint
}
export interface InventoryAggregate {
  owner: InventoryOwner
  items: InventoryItem[]
  currencies: InventoryCurrencyBalance[]
}
export type CurrencyDenominationRef =
  | { kind: 'RULESET'; id: string }
  | { kind: 'CAMPAIGN'; id: string }
export interface CampaignCurrencyDenomination {
  id: string
  systemId: string
  name: string
  abbreviation: string
  scaleInReference: bigint
  sortOrder: number
}
export interface CampaignCurrencySystem {
  id: string
  campaignId: string
  name: string
  isReference: boolean
  version: number
  denominations: CampaignCurrencyDenomination[]
}
export interface CurrencyBalanceRewrite {
  id: string
  ownerId: string
  groupId: string | null
  denominationId: string
  amount: bigint
}
export interface CampaignCustodyEvent {
  id: string
  campaignId: string
  actorUserId: string | null
  subjectUserId: string | null
  subjectCharacterId: string | null
  kind: string
  visibility: 'TABLE' | 'OWNER' | 'SUBJECT'
  payload: Json
  idempotencyKey: string
  createdAt: string
}
export const campaignInventoryEventKinds = [
  'CUSTODY_TRANSFER',
  'PARTY_ITEM_ADD',
  'PARTY_ITEM_UPDATE',
  'PARTY_ITEM_CONSUME',
  'PARTY_ITEM_REMOVE',
  'PARTY_CURRENCY_ADJUST'
] as const
export type CampaignInventoryEventKind = (typeof campaignInventoryEventKinds)[number]
export interface CurrencyDebit {
  balanceId: string
  groupId: string | null
  amount: bigint
}
export interface CampaignCurrencyCleanup {
  denomination: Extract<CurrencyDenomination, { kind: 'CAMPAIGN' }>
  amount: bigint
  sourceBalanceIds: string[]
}

export type InventoryOwnerRow = DbTables['inventory_owners']['Row']
export type InventoryItemRow = DbTables['inventory_items']['Row'] & {
  equipment_label?: string | null
  capacity_amount?: number | null
  capacity_unit?: string | null
}
export type CurrencySystemRow = DbTables['campaign_currency_systems']['Row']
export type CampaignEventRow = DbTables['campaign_events']['Row']
export interface CurrencyBalanceRow {
  id: string
  owner_id: string
  group_id: string | null
  amount: string | number | bigint
  ruleset_currency_id: string | null
  campaign_denomination_id: string | null
  ruleset_system_id: string | null
  ruleset_label: string | null
  ruleset_abbreviation: string | null
  campaign_system_id: string | null
  campaign_label: string | null
  campaign_abbreviation: string | null
  campaign_scale: string | number | bigint | null
  container_item_id?: string | null
}
export interface CampaignDenominationRow {
  id: string
  system_id: string
  name: string
  abbreviation: string
  scale_in_reference: string | number | bigint
  sort_order: number
}

export function toOwner(row: InventoryOwnerRow): InventoryOwner {
  return {
    id: row.id,
    kind: row.kind as InventoryOwner['kind'],
    characterId: row.character_id,
    campaignId: row.campaign_id,
    vehicleId: row.vehicle_id,
    version: row.version
  }
}
export function toItem(row: InventoryItemRow): InventoryItem {
  return {
    id: row.id,
    ownerId: row.owner_id,
    equipmentId: row.equipment_id,
    equipmentLabel: row.equipment_label ?? null,
    quantity: row.quantity,
    containerId: row.container_id,
    isContainer:
      row.capacity_amount !== null &&
      row.capacity_amount !== undefined &&
      row.capacity_unit !== null &&
      row.capacity_unit !== undefined,
    customName: row.custom_name,
    notes: row.notes,
    equipped: row.equipped,
    attuned: row.attuned,
    placementKind: row.placement_kind as InventoryItem['placementKind'],
    placementId: row.placement_id
  }
}
export function orderedIds(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort()
}
