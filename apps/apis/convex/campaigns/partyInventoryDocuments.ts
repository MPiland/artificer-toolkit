import {
  equipmentAuthoredDtoSchema,
  type EquipmentAuthoredDto
} from '@artificer-toolkit/schema/subjects/equipment'
import {
  inventoryCurrencyDtoSchema,
  inventoryItemDtoSchema
} from '@artificer-toolkit/schema/api/campaignInventory'
import {
  campaignStoredPartyItemSchema,
  campaignStoredPartyCurrencyGroupSchema,
  campaignStoredPartyCurrencySchema,
  campaignStoredCurrencyDenominationSchema
} from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import { presentCampaignPlainText } from '@artificer-toolkit/shared/campaign/textPolicy'
import { readAcquiredEquipmentRules } from '@artificer-toolkit/rules-runtime/character/acquiredEquipmentRules'
import type { QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { requireRulesCatalogueBinding } from '../content/catalogueBinding'
import { createContentMemo } from '@artificer-toolkit/shared/contentMemo'
import {
  canReadAuthoredRoot,
  readAuthoredVersion,
  readPublishedDocumentPayload
} from '../content/documents'
import { resolveCurrentEquipment } from '../content/equipmentRelationships'
import { readCampaignSharedActiveRoot, readCampaignSharedRootPublication } from './contentAccess'
import { requireSystem } from '../content/systemDocuments'
import { readCurrencySystem } from './currencySystemDocuments'
import { readCampaignInventory } from './inventoryVersionDocuments'
export { readCampaignInventory } from './inventoryVersionDocuments'
import {
  campaignPartyItemPageSchema,
  campaignPartyCurrencyPageSchema,
  type CampaignPartyInventoryListInput,
  type CampaignPartyItemPage,
  type CampaignPartyCurrencyPage
} from '@artificer-toolkit/schema/api/campaignInventoryPages'

import {
  campaignInventoryCleanupScopeSchema,
  type CampaignInventoryCleanupScope
} from '@artificer-toolkit/schema/api/campaignInventoryCleanup'
import { uuidSchema } from '@artificer-toolkit/schema/api/campaignContractSchemas'
import { campaignStoredVehicleCleanupTotalSchema } from '@artificer-toolkit/schema/projections/campaignVehicleCleanupPersistence'
import {
  readVehicleCleanupLock,
  vehicleCleanupRowAvailable,
  readVehicleCleanupProgress
} from './vehicleCleanupDocuments'

// The Equipment DTO parse of a verified stored document, by its exact JSON (every page re-reads it).
const publishedEquipment = createContentMemo<EquipmentAuthoredDto>()

async function readPartySourceIds(ctx: QueryCtx, campaign: Doc<'campaigns'>) {
  const { sourceIds } = await requireRulesCatalogueBinding(ctx, {
    systemId: campaign.gameSystemId,
    primaryRulesCatalogueId: campaign.primaryRulesCatalogueId,
    additionalRulesCatalogueIds: campaign.additionalRulesCatalogueIds
  })
  return sourceIds
}

/** One page's current Equipment reads: the catalogue binding once, each Equipment once. */
type HeldEquipmentPage = {
  sourceIds: Promise<ReadonlySet<string>>
  current: Map<string, Promise<Awaited<ReturnType<typeof readPartyEquipment>> | null>>
}

/** Party custody grants no access to a member's unshared Homebrew. */
export async function readPartyEquipmentSource(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  equipmentId: string,
  bindingSourceIds?: Promise<ReadonlySet<string>>
) {
  const root = await ctx.db
    .query('authoredRoots')
    .withIndex('by_publicId', (q) => q.eq('id', equipmentId))
    .unique()
  if (!root) return null
  if (root.subjectKind !== 'EQUIPMENT' || root.systemId !== campaign.gameSystemId)
    throw new Error('Stored Campaign Equipment identity mismatch.')
  const sourceIds = await (bindingSourceIds ?? readPartySourceIds(ctx, campaign))
  const shared = (candidate: Doc<'authoredRoots'>) =>
    readCampaignSharedRootPublication(ctx, campaign, candidate.subjectKind, candidate.id)
  let document: EquipmentAuthoredDto
  if (
    root.ownerUserId === undefined &&
    sourceIds.has(root.contentSourceId) &&
    (await canReadAuthoredRoot(ctx, root, null))
  ) {
    const published = await readPublishedDocumentPayload(
      ctx,
      root,
      await readAuthoredVersion(ctx, root)
    )
    document = publishedEquipment(published.documentJson, () =>
      equipmentAuthoredDtoSchema.parse(published.document)
    )
  } else {
    const publication = await shared(root)
    if (!publication) return null
    if (publication.subjectKind !== 'EQUIPMENT')
      throw new Error('Stored Campaign Equipment subject mismatch.')
    document = publication.document
  }
  // Canonical imported Equipment predates the optional authored status field.
  if (document.status !== undefined && document.status !== 'ACTIVE') return null
  const canReadSharedRoot = async (candidate: Doc<'authoredRoots'>) =>
    (await readCampaignSharedActiveRoot(
      ctx,
      campaign,
      candidate.subjectKind,
      candidate.id,
      candidate
    )) !== null
  return { document, sourceIds, canReadSharedRoot }
}

/** New copies always require current source authority. */
export async function readPartyEquipment(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  equipmentId: string
) {
  const source = await readPartyEquipmentSource(ctx, campaign, equipmentId)
  if (!source) throw new Error('Campaign Equipment is unavailable.')
  return (
    await resolveCurrentEquipment(
      ctx,
      source.document,
      null,
      source.sourceIds,
      source.canReadSharedRoot
    )
  ).effective
}

/** Existing custody exposes only this held item's usable mechanics. */
export async function readHeldPartyEquipment(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  item: { equipmentId: string; retainedRulesJson?: string },
  page?: HeldEquipmentPage
) {
  const retained = item.retainedRulesJson
    ? readAcquiredEquipmentRules(item.retainedRulesJson, item.equipmentId, campaign.gameSystemId)
    : null
  let current = page?.current.get(item.equipmentId)
  if (!current) {
    current = (async () => {
      const source = await readPartyEquipmentSource(
        ctx,
        campaign,
        item.equipmentId,
        page?.sourceIds
      )
      return source
        ? (
            await resolveCurrentEquipment(
              ctx,
              source.document,
              null,
              source.sourceIds,
              source.canReadSharedRoot
            )
          ).effective
        : null
    })()
    page?.current.set(item.equipmentId, current)
  }
  const equipment = await current
  if (equipment) return equipment
  if (!retained)
    throw new Error(
      'Acquired Campaign Equipment is unavailable without usable source or retained rules.'
    )
  return retained.equipment
}

async function presentCampaignItem(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  row: Doc<'campaignPartyItems'>,
  page: HeldEquipmentPage
) {
  const { _id, _creationTime, ...stored } = row
  const item = campaignStoredPartyItemSchema.parse(stored)
  if (item.campaignId !== campaign.id) throw new Error('Stored Campaign inventory scope mismatch.')
  const equipment = await readHeldPartyEquipment(ctx, campaign, item, page)
  return inventoryItemDtoSchema.parse({
    id: item.id,
    label: presentCampaignPlainText(item.customName ?? equipment.label, campaign.contentMaturity),
    quantity: item.quantity,
    containerId: item.containerId,
    isContainer: equipment.capacity !== undefined
  })
}

export async function readPartyDenomination(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  denominationId: string,
  storedCampaignCurrencySystemId?: string | null
) {
  if (storedCampaignCurrencySystemId !== null) {
    const row = await ctx.db
      .query('campaignCurrencyDenominations')
      .withIndex('by_campaignId_id', (q) =>
        q.eq('campaignId', campaign.id).eq('id', denominationId)
      )
      .unique()
    if (row) {
      const { _id, _creationTime, ...stored } = row
      const denomination = campaignStoredCurrencyDenominationSchema.parse(stored)
      if (
        denomination.campaignId !== campaign.id ||
        (storedCampaignCurrencySystemId !== undefined &&
          denomination.systemId !== storedCampaignCurrencySystemId)
      )
        throw new Error('Campaign currency denomination is unavailable.')
      const system = await ctx.db
        .query('campaignCurrencySystems')
        .withIndex('by_campaignId_id', (q) =>
          q.eq('campaignId', campaign.id).eq('id', denomination.systemId)
        )
        .unique()
      if (!system) throw new Error('Campaign currency system is unavailable.')
      await readCurrencySystem(ctx, system)
      return {
        campaignCurrencySystemId: system.id,
        denomination: inventoryCurrencyDtoSchema.parse({
          kind: 'CAMPAIGN',
          campaignCurrencySystemId: system.id,
          denominationId,
          label: denomination.label,
          abbreviation: denomination.abbreviation,
          amount: 0,
          containerId: null
        })
      }
    }
    if (storedCampaignCurrencySystemId !== undefined)
      throw new Error('Campaign currency denomination is unavailable.')
  }
  const system = await requireSystem(ctx, campaign.gameSystemId)
  const denomination = system.currencies.find((currency) => currency.id === denominationId)
  if (!denomination)
    throw new Error('Currency denomination is unavailable in this Campaign System.')
  return {
    campaignCurrencySystemId: undefined,
    denomination: inventoryCurrencyDtoSchema.parse({
      kind: 'RULESET',
      denominationId,
      label: denomination.label,
      abbreviation: denomination.short ?? denomination.code,
      amount: 0,
      containerId: null
    })
  }
}

export async function readCampaignCurrencyGroup(
  ctx: QueryCtx,
  campaignId: string,
  vehicleId: string | undefined,
  groupId: string
) {
  const row = await ctx.db
    .query('campaignPartyCurrencyGroups')
    .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId).eq('id', groupId))
    .unique()
  if (!row) throw new Error('Stored Campaign currency group is unavailable.')
  const { _id, _creationTime, ...stored } = row
  const group = campaignStoredPartyCurrencyGroupSchema.parse(stored)
  if (group.vehicleId !== vehicleId)
    throw new Error('Stored Campaign currency group ownership mismatch.')
  if (group.containerId !== null) {
    const container = await ctx.db
      .query('campaignPartyItems')
      .withIndex('by_campaignId_vehicleId_id', (q) =>
        q.eq('campaignId', campaignId).eq('vehicleId', vehicleId).eq('id', group.containerId!)
      )
      .unique()
    if (!container) throw new Error('Stored Campaign currency group container is unavailable.')
  }
  return group
}

export async function readCampaignCurrencyPlacement(
  ctx: QueryCtx,
  balance: Doc<'campaignPartyCurrencies'>
) {
  if (balance.groupId !== undefined) {
    const group = await readCampaignCurrencyGroup(
      ctx,
      balance.campaignId,
      balance.vehicleId,
      balance.groupId
    )
    if (balance.containerId !== group.containerId)
      throw new Error('Stored Campaign currency group placement mismatch.')
    return group.containerId
  }
  if (balance.containerId !== null) {
    const container = await ctx.db
      .query('campaignPartyItems')
      .withIndex('by_campaignId_vehicleId_id', (q) =>
        q
          .eq('campaignId', balance.campaignId)
          .eq('vehicleId', balance.vehicleId)
          .eq('id', balance.containerId!)
      )
      .unique()
    if (!container) throw new Error('Stored Campaign currency container is unavailable.')
  }
  return balance.containerId
}

async function presentCampaignCurrency(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  row: Doc<'campaignPartyCurrencies'>
) {
  const { _id, _creationTime, ...stored } = row
  const balance = campaignStoredPartyCurrencySchema.parse(stored)
  if (balance.campaignId !== campaign.id)
    throw new Error('Stored Campaign currency scope mismatch.')
  const [{ denomination }, containerId] = await Promise.all([
    readPartyDenomination(
      ctx,
      campaign,
      balance.denominationId,
      balance.campaignCurrencySystemId ?? null
    ),
    readCampaignCurrencyPlacement(ctx, row)
  ])
  return inventoryCurrencyDtoSchema.parse({
    ...denomination,
    amount: balance.amount,
    containerId,
    label: presentCampaignPlainText(denomination.label, campaign.contentMaturity),
    abbreviation: presentCampaignPlainText(denomination.abbreviation, campaign.contentMaturity)
  })
}

/** Page-only filtering: mutation aggregate readers must reject affected locks rather than omit rows. */
async function readPendingCleanup(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  row:
    | Doc<'campaignPartyItems'>
    | Doc<'campaignPartyCurrencyGroups'>
    | Doc<'campaignPartyCurrencies'>,
  currency?: Doc<'campaignPartyCurrencies'>
): Promise<CampaignInventoryCleanupScope | null> {
  if (row.campaignId !== campaign.id) throw new Error('Stored Campaign inventory scope mismatch.')
  if (row.cleanupJobId === undefined) return null
  const jobId = uuidSchema.parse(row.cleanupJobId)
  if (await vehicleCleanupRowAvailable(ctx, row)) return null
  // The current member already owns this party read; no owner-only progress fields leave this helper.
  const progress = await readVehicleCleanupProgress(ctx, campaign.id, jobId, 'OWNER')
  if (progress.status !== 'RUNNING' && progress.status !== 'FAILED')
    throw new Error('Campaign inventory cleanup destination fence is inconsistent.')
  if (currency && currency.groupId === undefined && currency.containerId === null) {
    const totalRow = await ctx.db
      .query('campaignVehicleCleanupTotals')
      .withIndex('by_jobId_slot', (q) =>
        q
          .eq('jobId', jobId)
          .eq('campaignCurrencySystemId', currency.campaignCurrencySystemId)
          .eq('denominationId', currency.denominationId)
      )
      .unique()
    if (!totalRow) throw new Error('Campaign inventory cleanup currency fence is inconsistent.')
    const { _id, _creationTime, ...stored } = totalRow
    const total = campaignStoredVehicleCleanupTotalSchema.parse(stored)
    if (
      total.jobId !== jobId ||
      !total.locked ||
      total.targetId !== currency.id ||
      total.campaignCurrencySystemId !== currency.campaignCurrencySystemId ||
      total.denominationId !== currency.denominationId
    )
      throw new Error('Campaign inventory cleanup currency fence is inconsistent.')
    return campaignInventoryCleanupScopeSchema.parse({
      kind: 'CURRENCY',
      jobId,
      status: progress.status,
      campaignCurrencySystemId: currency.campaignCurrencySystemId ?? null,
      denominationId: currency.denominationId
    })
  }
  return campaignInventoryCleanupScopeSchema.parse({
    kind: 'CARGO',
    jobId,
    status: progress.status
  })
}

async function readPendingContainerCleanup(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  row:
    | Doc<'campaignPartyItems'>
    | Doc<'campaignPartyCurrencies'>
    | Doc<'campaignPartyCurrencyGroups'>
) {
  if (row.containerId === null) return null
  const container = await ctx.db
    .query('campaignPartyItems')
    .withIndex('by_campaignId_vehicleId_id', (q) =>
      q.eq('campaignId', campaign.id).eq('vehicleId', row.vehicleId).eq('id', row.containerId!)
    )
    .unique()
  if (!container) throw new Error('Stored Campaign inventory container is unavailable.')
  return readPendingCleanup(ctx, campaign, container)
}

/** Caller has authorized current Campaign membership; Vehicle scope is checked by the owner reader. */
export async function readCampaignItemPage(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  paginationOpts: CampaignPartyInventoryListInput['paginationOpts'],
  vehicleId?: string,
  sourceCleanup: Awaited<ReturnType<typeof readVehicleCleanupLock>> = null
): Promise<CampaignPartyItemPage> {
  const inventory = await readCampaignInventory(ctx, campaign.id, vehicleId)
  const result = await ctx.db
    .query('campaignPartyItems')
    .withIndex('by_campaignId_vehicleId_id', (q) =>
      q.eq('campaignId', campaign.id).eq('vehicleId', vehicleId)
    )
    .paginate({
      ...paginationOpts,
      maximumRowsRead: 8,
      maximumBytesRead: 1024 * 1024
    })
  const pendingCleanup = new Map<string, CampaignInventoryCleanupScope>()
  const visibleRows: Doc<'campaignPartyItems'>[] = []
  if (sourceCleanup) {
    const scope = campaignInventoryCleanupScopeSchema.parse({ kind: 'CARGO', ...sourceCleanup })
    pendingCleanup.set(JSON.stringify(scope), scope)
  } else {
    for (const row of result.page) {
      const scope =
        (await readPendingCleanup(ctx, campaign, row)) ??
        (await readPendingContainerCleanup(ctx, campaign, row))
      if (scope) pendingCleanup.set(JSON.stringify(scope), scope)
      else visibleRows.push(row)
    }
  }
  // One current source resolution per Equipment in this snapshot; each item's retained rules stay independent.
  let sourceIds: Promise<ReadonlySet<string>> | undefined
  const page: HeldEquipmentPage = {
    get sourceIds() {
      return (sourceIds ??= readPartySourceIds(ctx, campaign))
    },
    current: new Map()
  }
  return campaignPartyItemPageSchema.parse({
    ...result,
    owner:
      vehicleId === undefined
        ? { kind: 'CAMPAIGN', campaignId: campaign.id }
        : { kind: 'VEHICLE', vehicleId },
    version: inventory?.version ?? 0,
    ...(pendingCleanup.size ? { pendingCleanup: [...pendingCleanup.values()] } : {}),
    page: await Promise.all(visibleRows.map((row) => presentCampaignItem(ctx, campaign, row, page)))
  })
}

export async function readCampaignCurrencyPage(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  paginationOpts: CampaignPartyInventoryListInput['paginationOpts'],
  vehicleId?: string,
  sourceCleanup: Awaited<ReturnType<typeof readVehicleCleanupLock>> = null
): Promise<CampaignPartyCurrencyPage> {
  const inventory = await readCampaignInventory(ctx, campaign.id, vehicleId)
  const result = await ctx.db
    .query('campaignPartyCurrencies')
    .withIndex('by_campaignId_vehicleId_id', (q) =>
      q.eq('campaignId', campaign.id).eq('vehicleId', vehicleId)
    )
    .paginate({
      ...paginationOpts,
      maximumRowsRead: 48,
      maximumBytesRead: 1024 * 1024
    })
  const pendingCleanup = new Map<string, CampaignInventoryCleanupScope>()
  const visibleRows: Doc<'campaignPartyCurrencies'>[] = []
  if (sourceCleanup) {
    const scope = campaignInventoryCleanupScopeSchema.parse({ kind: 'CARGO', ...sourceCleanup })
    pendingCleanup.set(JSON.stringify(scope), scope)
  } else {
    for (const row of result.page) {
      let scope = await readPendingCleanup(ctx, campaign, row, row)
      if (!scope && row.groupId !== undefined) {
        const group = await ctx.db
          .query('campaignPartyCurrencyGroups')
          .withIndex('by_campaignId_id', (q) =>
            q.eq('campaignId', campaign.id).eq('id', row.groupId!)
          )
          .unique()
        if (!group) throw new Error('Stored Campaign currency group is unavailable.')
        if (group.vehicleId !== vehicleId)
          throw new Error('Stored Campaign currency group ownership mismatch.')
        scope =
          (await readPendingCleanup(ctx, campaign, group)) ??
          (await readPendingContainerCleanup(ctx, campaign, group))
      }
      scope ??= await readPendingContainerCleanup(ctx, campaign, row)
      if (scope) pendingCleanup.set(JSON.stringify(scope), scope)
      else visibleRows.push(row)
    }
  }
  return campaignPartyCurrencyPageSchema.parse({
    ...result,
    owner:
      vehicleId === undefined
        ? { kind: 'CAMPAIGN', campaignId: campaign.id }
        : { kind: 'VEHICLE', vehicleId },
    version: inventory?.version ?? 0,
    ...(pendingCleanup.size ? { pendingCleanup: [...pendingCleanup.values()] } : {}),
    page: await Promise.all(visibleRows.map((row) => presentCampaignCurrency(ctx, campaign, row)))
  })
}
