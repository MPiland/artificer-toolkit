import type { CharacterSheetCurrencyOptionDto } from '@artificer-toolkit/schema/api/characterSheetData'
import type { CurrencySystemDto } from '@artificer-toolkit/schema/api/campaignInventory'
import { campaignStoredAssignmentSchema } from '@artificer-toolkit/schema/projections/campaignPersistence'
import {
  createCharacterCurrencyIdentityKey,
  resolveCharacterCurrencyIdentity
} from '@artificer-toolkit/schema/shared/characterCurrency'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { readCharacterRecord } from '../characters/stateDocuments'
import { requireSystem } from '../content/systemDocuments'
import { readCampaignAssignedCharacter } from './assignedCharacter'
import { requireCampaignAuthority } from './authority'
import { readCampaignCurrencyOptions } from './currencySystemDocuments'

type CharacterCurrencyGroup = CharacterAuthored['state']['currency'][number]
type CharacterCurrency = CharacterCurrencyGroup['currencies'][number]

export type CharacterCurrencyRewrite = {
  record: Doc<'characters'>
  character: CharacterAuthored
  streamVersion: number
  updatedAt: string
}

type CharacterCurrencyRewriteInput = {
  campaign: Doc<'campaigns'>
  systemId: string
  oldDenominations: ReadonlyMap<string, CurrencySystemDto['denominations'][number]>
  nextDenominations: readonly CurrencySystemDto['denominations'][number][]
  remove: boolean
}

function requireSafeAmount(amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new Error('Character currency amount is outside the supported range.')
}

function requireSafeNextStreamVersion(version: number) {
  if (!Number.isSafeInteger(version) || version < 0 || version === Number.MAX_SAFE_INTEGER)
    throw new Error('Character stream version is outside the supported range.')
  return version + 1
}

export async function readCampaignInventoryCurrencyOptions(
  ctx: MutationCtx,
  campaign: Doc<'campaigns'>
): Promise<CharacterSheetCurrencyOptionDto[]> {
  const [system, campaignOptions] = await Promise.all([
    requireSystem(ctx, campaign.gameSystemId),
    readCampaignCurrencyOptions(ctx, campaign)
  ])
  return [
    ...system.currencies.map((currency) => ({
      id: currency.id,
      kind: 'RULESET' as const,
      label: currency.label
    })),
    ...campaignOptions
  ]
}

function rewriteGroup(input: {
  group: CharacterCurrencyGroup
  options: readonly CharacterSheetCurrencyOptionDto[]
  systemId: string
  oldDenominations: CharacterCurrencyRewriteInput['oldDenominations']
  nextDenominations: CharacterCurrencyRewriteInput['nextDenominations']
  remove: boolean
}): { group: CharacterCurrencyGroup; changed: boolean } {
  const resolved = input.group.currencies.map((currency) => {
    requireSafeAmount(currency.amount)
    return {
      currency,
      identity: resolveCharacterCurrencyIdentity(currency, input.options)
    }
  })
  const identities = new Set<string>()
  for (const entry of resolved) {
    const key = createCharacterCurrencyIdentityKey(entry.identity)
    if (identities.has(key)) throw new Error('Character currency group has duplicate balances.')
    identities.add(key)
  }

  let changed = false
  const currencies: CharacterCurrency[] = []
  for (const entry of resolved) {
    const isTarget =
      entry.identity.kind === 'CAMPAIGN' &&
      entry.identity.campaignCurrencySystemId === input.systemId
    if (!isTarget) {
      currencies.push(entry.currency)
      continue
    }
    changed = true
    if (input.remove) {
      if (entry.currency.amount > 0)
        throw new Error('Currency system has positive Character balances.')
      continue
    }
    const previous = input.oldDenominations.get(entry.currency.currencyId)
    if (!previous) throw new Error('Stored Character currency denomination is unavailable.')
    const replacement =
      input.nextDenominations.find(
        (denomination) => denomination.id === entry.currency.currencyId
      ) ?? input.nextDenominations[0]
    if (!replacement) throw new Error('Currency system needs at least one denomination.')
    if (replacement.id !== previous.id && entry.currency.amount > 0)
      throw new Error('A denomination with a positive Character balance cannot be removed.')
    const value = BigInt(entry.currency.amount) * BigInt(previous.scaleInReference)
    const scale = BigInt(replacement.scaleInReference)
    if (value % scale !== 0n)
      throw new Error('Character currency conversion must preserve every balance exactly.')
    const amount = value / scale
    if (amount > BigInt(Number.MAX_SAFE_INTEGER))
      throw new Error('Character currency amount is outside the supported range.')
    currencies.push({
      ...entry.currency,
      currencyId: replacement.id,
      amount: Number(amount),
      kind: 'CAMPAIGN',
      campaignCurrencySystemId: input.systemId
    })
  }
  if (!changed) return { group: input.group, changed: false }
  const rewrittenIdentities = new Set<string>()
  for (const currency of currencies) {
    const identity = resolveCharacterCurrencyIdentity(currency, input.options)
    const key = createCharacterCurrencyIdentityKey(identity)
    if (rewrittenIdentities.has(key))
      throw new Error('Character currency replacement would duplicate a balance.')
    rewrittenIdentities.add(key)
  }
  return { group: { ...input.group, currencies }, changed: true }
}

export async function prepareCampaignCharacterCurrencyRewrites(
  ctx: MutationCtx,
  input: CharacterCurrencyRewriteInput
): Promise<CharacterCurrencyRewrite[]> {
  const options = await readCampaignInventoryCurrencyOptions(ctx, input.campaign)
  const assignments: ReturnType<typeof campaignStoredAssignmentSchema.parse>[] = []
  const userIds = new Set<string>()
  const characterIds = new Set<string>()
  for await (const row of ctx.db
    .query('campaignCharacterAssignments')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', input.campaign.id))) {
    const { _id, _creationTime, ...stored } = row
    const assignment = campaignStoredAssignmentSchema.parse(stored)
    if (userIds.has(assignment.userId) || characterIds.has(assignment.characterId))
      throw new Error('Stored Campaign Character assignments must be unique.')
    userIds.add(assignment.userId)
    characterIds.add(assignment.characterId)
    assignments.push(assignment)
  }

  const rewrites: CharacterCurrencyRewrite[] = []
  for (const assignment of assignments) {
    const { membership } = await requireCampaignAuthority(ctx, input.campaign.id, assignment.userId)
    const assigned = await readCampaignAssignedCharacter(ctx, input.campaign, membership)
    if (!assigned || assigned.id !== assignment.characterId)
      throw new Error('Stored Campaign Character assignment mismatch.')
    const record = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', assignment.characterId))
      .unique()
    if (!record) throw new Error('Stored Campaign Character is unavailable.')
    const character = readCharacterRecord(record)
    const groups = character.state.currency.map((group) =>
      rewriteGroup({
        group,
        options,
        systemId: input.systemId,
        oldDenominations: input.oldDenominations,
        nextDenominations: input.nextDenominations,
        remove: input.remove
      })
    )
    if (!groups.some((group) => group.changed)) continue
    const priorUpdatedAt = Date.parse(record.updatedAt)
    if (!Number.isFinite(priorUpdatedAt))
      throw new Error('Stored Character update time is invalid.')
    rewrites.push({
      record,
      character: {
        ...character,
        state: {
          ...character.state,
          currency: groups
            .filter((group) => !group.changed || group.group.currencies.length > 0)
            .map((group) => group.group)
        }
      },
      streamVersion: requireSafeNextStreamVersion(record.streamVersion),
      updatedAt: new Date(Math.max(Date.now(), priorUpdatedAt + 1)).toISOString()
    })
  }
  return rewrites
}

export async function applyCampaignCharacterCurrencyRewrites(
  ctx: MutationCtx,
  rewrites: readonly CharacterCurrencyRewrite[]
) {
  for (const rewrite of rewrites) {
    const document: unknown = JSON.parse(JSON.stringify(rewrite.character))
    await ctx.db.patch(rewrite.record._id, {
      documentJson: canonicalizeRuleDocument(document),
      checksum: checksumRuleDocument(document),
      streamVersion: rewrite.streamVersion,
      updatedAt: rewrite.updatedAt
    })
  }
}
