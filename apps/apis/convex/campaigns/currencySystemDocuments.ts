import type { CharacterSheetCurrencyOptionDto } from '@artificer-toolkit/schema/api/characterSheetData'
import {
  currencySystemDtoSchema,
  type CurrencySystemDto
} from '@artificer-toolkit/schema/api/campaignInventory'
import {
  campaignStoredCurrencySystemSchema,
  campaignStoredCurrencyDenominationSchema
} from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import { presentCampaignPlainText } from '@artificer-toolkit/shared/campaign/textPolicy'
import type { QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'

export function validateCurrencySystem(system: CurrencySystemDto) {
  const result = currencySystemDtoSchema.parse(system)
  for (const key of ['id', 'label', 'abbreviation', 'scaleInReference'] as const) {
    if (
      new Set(result.denominations.map((denomination) => denomination[key])).size !==
      result.denominations.length
    )
      throw new Error(
        'Currency denominations must have unique IDs, labels, abbreviations and scales.'
      )
  }
  if (
    result.denominations.filter((denomination) => denomination.scaleInReference === 1).length !== 1
  )
    throw new Error('A currency system needs exactly one reference denomination.')
  return result
}

export async function readCurrencySystem(ctx: QueryCtx, row: Doc<'campaignCurrencySystems'>) {
  const { _id, _creationTime, ...stored } = row
  const { campaignId, ...system } = campaignStoredCurrencySystemSchema.parse(stored)
  const rows = await ctx.db
    .query('campaignCurrencyDenominations')
    .withIndex('by_campaignId_systemId_sortOrder', (q) =>
      q.eq('campaignId', campaignId).eq('systemId', system.id)
    )
    .take(6)
  const denominations = rows.map((row, index) => {
    const { _id, _creationTime, ...stored } = row
    const {
      campaignId: denominationCampaignId,
      systemId,
      sortOrder,
      ...denomination
    } = campaignStoredCurrencyDenominationSchema.parse(stored)
    if (denominationCampaignId !== campaignId || systemId !== system.id || sortOrder !== index)
      throw new Error('Stored Campaign currency scope or ordering mismatch.')
    return denomination
  })
  return { document: validateCurrencySystem({ ...system, denominations }), rows }
}

export function presentCurrencySystem(system: CurrencySystemDto, campaign: Doc<'campaigns'>) {
  return currencySystemDtoSchema.parse({
    ...system,
    label: presentCampaignPlainText(system.label, campaign.contentMaturity),
    denominations: system.denominations.map((denomination) => ({
      ...denomination,
      label: presentCampaignPlainText(denomination.label, campaign.contentMaturity),
      abbreviation: presentCampaignPlainText(denomination.abbreviation, campaign.contentMaturity)
    }))
  })
}

/** Complete current Campaign acquisition options; caller has authorized this Campaign. */
export async function readCampaignCurrencyOptions(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>
): Promise<CharacterSheetCurrencyOptionDto[]> {
  const options: CharacterSheetCurrencyOptionDto[] = []
  const systemIds = new Set<string>()
  for await (const row of ctx.db
    .query('campaignCurrencySystems')
    .withIndex('by_campaignId_label_id', (q) => q.eq('campaignId', campaign.id))) {
    const system = presentCurrencySystem((await readCurrencySystem(ctx, row)).document, campaign)
    if (systemIds.has(system.id))
      throw new Error('Stored Campaign currency system IDs must be unique.')
    systemIds.add(system.id)
    for (const denomination of system.denominations)
      options.push({
        id: denomination.id,
        kind: 'CAMPAIGN',
        campaignCurrencySystemId: system.id,
        label: denomination.label + ' (' + system.label + ')'
      })
  }
  return options
}
