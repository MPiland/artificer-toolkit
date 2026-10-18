import {
  characterStateDtoSchema,
  type CharacterStateDto
} from '@artificer-toolkit/schema/subjects/character'
import {
  campaignStoredPartyCurrencyGroupSchema,
  campaignStoredPartyCurrencySchema,
  campaignStoredPartyInventorySchema
} from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import {
  createCharacterCurrencyIdentityKey,
  characterCurrencyIdentity,
  type CharacterCurrencyIdentityDto
} from '@artificer-toolkit/schema/shared/characterCurrency'
import { readCampaignCurrencyOptions } from './currencySystemDocuments'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { readCampaignInventory, readPartyDenomination } from './partyInventoryDocuments'

/** Caller authorizes departure and persists the returned Character state in this same mutation. */
export async function returnDepartingCharacterCurrency(input: {
  ctx: MutationCtx
  campaign: Doc<'campaigns'>
  characterId: string
  actorUserId: string
  reason: string
  state: CharacterStateDto
}) {
  const { ctx, campaign } = input
  const state = characterStateDtoSchema.parse(input.state)
  const campaignOptions = await readCampaignCurrencyOptions(ctx, campaign)
  const currentSystemIds = new Set(campaignOptions.map((option) => option.campaignCurrencySystemId))
  const currentCurrencyKeys = new Set(
    campaignOptions.map((option) =>
      createCharacterCurrencyIdentityKey({
        currencyId: option.id,
        kind: option.kind,
        campaignCurrencySystemId: option.campaignCurrencySystemId
      })
    )
  )
  const totals = new Map<string, { identity: CharacterCurrencyIdentityDto; amount: bigint }>()
  for (const group of state.currency) {
    const groupKeys = new Set<string>()
    for (const balance of group.currencies) {
      if (!Number.isSafeInteger(balance.amount) || balance.amount < 0)
        throw new Error('Stored Character currency amount is invalid.')
      const identity = characterCurrencyIdentity(balance)
      const key = createCharacterCurrencyIdentityKey(identity)
      if (groupKeys.has(key))
        throw new Error('Stored Character currency group has duplicate identities.')
      groupKeys.add(key)
      if (identity.kind !== 'CAMPAIGN' || !currentSystemIds.has(identity.campaignCurrencySystemId))
        continue
      if (!currentCurrencyKeys.has(key))
        throw new Error('Stored Campaign currency denomination is unavailable.')
      totals.set(key, {
        identity,
        amount: (totals.get(key)?.amount ?? 0n) + BigInt(balance.amount)
      })
    }
  }
  const returnedKeys = new Set<string>()
  const moved: Array<{ denominationId: string; amount: string }> = []
  const movedSystems = new Map<string, string>()
  const inventory =
    input.reason === 'CAMPAIGN_DELETED' ? null : await readCampaignInventory(ctx, campaign.id)
  for (const [key, { identity, amount: total }] of [...totals].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    returnedKeys.add(key)
    // Campaign deletion removes this custody next; do not credit funds that would immediately be purged.
    if (input.reason === 'CAMPAIGN_DELETED') continue
    const denominationId = identity.currencyId
    const { campaignCurrencySystemId } = await readPartyDenomination(
      ctx,
      campaign,
      denominationId,
      identity.campaignCurrencySystemId
    )
    if (!campaignCurrencySystemId) throw new Error('Stored Campaign currency identity mismatch.')
    movedSystems.set(denominationId, campaignCurrencySystemId)
    if (total === 0n) continue
    const matches = await ctx.db
      .query('campaignPartyCurrencies')
      .withIndex('by_owner_system_denomination_container', (q) =>
        q
          .eq('campaignId', campaign.id)
          .eq('vehicleId', undefined)
          .eq('campaignCurrencySystemId', campaignCurrencySystemId)
          .eq('denominationId', denominationId)
          .eq('groupId', undefined)
          .eq('containerId', null)
      )
      .take(2)
    const existing = matches.length === 1 ? (matches[0] ?? null) : null
    if (existing) {
      const { _id, _creationTime, ...stored } = existing
      campaignStoredPartyCurrencySchema.parse(stored)
    }
    const amount = total + BigInt(existing?.amount ?? 0)
    if (
      existing &&
      existing.cleanupJobId === undefined &&
      amount <= BigInt(Number.MAX_SAFE_INTEGER)
    )
      await ctx.db.patch(existing._id, { amount: Number(amount) })
    else if (!existing && total <= BigInt(Number.MAX_SAFE_INTEGER))
      await ctx.db.insert(
        'campaignPartyCurrencies',
        campaignStoredPartyCurrencySchema.parse({
          campaignId: campaign.id,
          id: crypto.randomUUID(),
          denominationId,
          campaignCurrencySystemId,
          amount: Number(total),
          containerId: null
        })
      )
    else {
      let remaining = total
      while (remaining > 0n) {
        const groupId = crypto.randomUUID()
        const groupAmount =
          remaining > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : remaining
        await ctx.db.insert(
          'campaignPartyCurrencyGroups',
          campaignStoredPartyCurrencyGroupSchema.parse({
            campaignId: campaign.id,
            id: groupId,
            containerId: null
          })
        )
        await ctx.db.insert(
          'campaignPartyCurrencies',
          campaignStoredPartyCurrencySchema.parse({
            campaignId: campaign.id,
            id: crypto.randomUUID(),
            groupId,
            denominationId,
            campaignCurrencySystemId,
            amount: Number(groupAmount),
            containerId: null
          })
        )
        remaining -= groupAmount
      }
    }
    moved.push({ denominationId, amount: total.toString() })
  }
  let eventId: string | null = null
  if (moved.length > 0) {
    const next = campaignStoredPartyInventorySchema.parse({
      campaignId: campaign.id,
      version: (inventory?.version ?? 0) + 1
    })
    if (inventory) await ctx.db.patch(inventory._id, { version: next.version })
    else await ctx.db.insert('campaignPartyInventories', next)
  }
  if (moved.length > 0) {
    eventId = crypto.randomUUID()
    await ctx.db.insert(
      'campaignEvents',
      campaignStoredEventSchema.parse({
        id: eventId,
        campaignId: campaign.id,
        actorUserId: input.actorUserId,
        subjectCharacterId: input.characterId,
        type: 'CUSTODY_TRANSFER',
        visibility: 'OWNER',
        visibleInHistory: true,
        inventoryAudit: true,
        createdAt: new Date().toISOString(),
        payloadJson: JSON.stringify({
          action: 'CUSTODY_TRANSFER',
          custodyContext: {
            sourceOwnerId: input.characterId,
            destinationOwnerId: campaign.id
          },
          reason: input.reason,
          denominations: moved.map(({ denominationId, amount }) => ({
            denominationId,
            kind: 'CAMPAIGN',
            campaignCurrencySystemId: movedSystems.get(denominationId),
            amount,
            beforeSourceAmount: amount,
            afterSourceAmount: '0'
          }))
        })
      })
    )
  }
  return {
    state:
      returnedKeys.size === 0
        ? state
        : {
            ...state,
            currency: state.currency.map((group) => ({
              ...group,
              currencies: group.currencies.filter(
                (balance) =>
                  !returnedKeys.has(
                    createCharacterCurrencyIdentityKey(characterCurrencyIdentity(balance))
                  )
              )
            }))
          },
    moved,
    eventId
  }
}
