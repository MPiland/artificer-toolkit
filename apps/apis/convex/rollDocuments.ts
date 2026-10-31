import {
  rollRecordDtoSchema,
  type ExecuteRollInputDto,
  type GmCampaignRollDto,
  type RollRecordDto,
  type AddAfterRollDieInputDto
} from '@artificer-toolkit/schema/api/rolls'
import {
  createRollRecord,
  withAfterRollDie,
  withoutAfterRollOffers
} from '@artificer-toolkit/rules-runtime/character/rollRecord'
import { nextRollInt } from './lib/rollRandom'
import {
  carriedTestDice,
  resolveCharacterSheetRoll
} from '@artificer-toolkit/rules-runtime/character/sheetRoll'
import { projectCharacterSheetForViewer } from '@artificer-toolkit/rules-runtime/character/campaignCharacterSheet'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { createConvexEncounterStore } from './lib/convexEncounterStore'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { readCharacterRecord, resolveCharacterId } from './characters/documents'
import { readCharacterRow } from './characters/stateDocuments'
import { loadCharacterSheet } from './characters/sheetPreparation'
import { readCharacterCampaign } from './characters/context'
import { requireCampaignCharacterAuthority } from './campaigns/characterState'
import { presentRoll } from '@artificer-toolkit/rules-runtime/character/rollPresentation'
import { requireSystem } from './content/systemDocuments'

export { nextRollInt } from './lib/rollRandom'

/** The content maturity a Character's rolls are presented at; null when it has no Campaign. */
export async function readRollMaturity(ctx: QueryCtx, characterId: string | null) {
  const active = characterId ? await readCharacterRow(ctx, characterId) : null
  // Caller-owned snapshots can come from an explicitly scoped GM roll too.
  const campaign = active
    ? await readCharacterCampaign(ctx, readCharacterRecord(active), active.userId)
    : null
  return campaign?.contentMaturity ?? null
}

/** Campaign access is explicit; the personal endpoint never inherits GM authority. */
export async function evaluateCharacterRoll(
  ctx: MutationCtx,
  userId: string,
  input: ExecuteRollInputDto,
  campaignId?: string
) {
  const id = await resolveCharacterId(ctx, input.characterId)
  if (!id) throw new Error('Character not found.')
  const active = await readCharacterRow(ctx, id)
  if (!active) throw new Error('Character not found.')
  if (campaignId) await requireCampaignCharacterAuthority(ctx, campaignId, id, userId)
  else if (active.userId !== userId) throw new Error('Character not found.')
  const character = readCharacterRecord(active)
  if (active.status !== 'ACTIVE')
    throw new Error('Character requires Builder repair before rolling.')
  const system = await requireSystem(ctx, character.systemId)
  const sheet =
    input.source.kind === 'MANUAL' ? null : await loadCharacterSheet(ctx, userId, id, campaignId)
  if (input.source.kind !== 'MANUAL' && !sheet) throw new Error('Character not found.')
  const maturity = sheet
    ? sheet.contentMaturity
    : ((await readCharacterCampaign(ctx, character, character.userId))?.contentMaturity ?? null)
  const resolved = sheet
    ? resolveCharacterSheetRoll(
        input,
        sheet.sheet,
        projectCharacterSheetForViewer(sheet.sheet, sheet.campaignContext)
      )
    : {
        expression: input.expression,
        rollMode: input.rollMode,
        source: { kind: 'MANUAL' as const, label: 'Manual roll' }
      }
  // A carried die (Guidance, Resistance) joins a check or save and is spent with it, in the roll's transaction;
  // an attack or damage roll adds the dice its Sheet row carries (Bless, Divine Favor).
  const { addedDice, spent, minimumRoll, afterRollOffers } = sheet
    ? carriedTestDice(resolved, sheet.activeEffects, {
        grantFold: sheet.ruleEvaluation.output.grantFold,
        registry: sheet.ruleEvaluation.registry
      })
    : { addedDice: [], spent: [], minimumRoll: null, afterRollOffers: [] }
  const effectStore = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
  for (const effect of spent)
    await effectStore.deleteCas({
      id: effect.id,
      owner: effect.owner,
      expectedVersion: effect.version,
      removal: 'ENDED'
    })
  const record = createRollRecord({
    characterId: character.id,
    label: character.label,
    system: {
      id: system.id,
      rulesetCode: system.rulesetCode,
      rulesetVersion: system.rulesetVersion
    },
    resolved,
    addedDice,
    minimumRoll: minimumRoll ?? undefined,
    afterRollOffers,
    nextInt: nextRollInt
  })
  return { record, maturity }
}

/**
 * The user's retained roll that still offers a held die (D168). Only the latest roll does: a die
 * added after a newer roll was seen would be added in hindsight.
 */
async function readRollOffering(ctx: MutationCtx, userId: string, id: string) {
  const record = await ctx.db
    .query('userRollHistory')
    .withIndex('by_userId_id', (q) => q.eq('userId', userId).eq('id', id))
    .unique()
  const [latest] = await ctx.db
    .query('userRollHistory')
    .withIndex('by_userId_createdAt_id', (q) => q.eq('userId', userId))
    .order('desc')
    .take(1)
  if (!record?.afterRollOffers || latest?._id !== record._id)
    throw new Error('This roll holds no die to add.')
  return record
}

async function replaceRoll(
  ctx: MutationCtx,
  { _id, userId, consumedAt, gmCampaignRoll }: Awaited<ReturnType<typeof readRollOffering>>,
  record: RollRecordDto
) {
  await ctx.db.replace(_id, { ...record, userId, consumedAt, gmCampaignRoll })
}

/** Adds one offered die to the user's latest roll and spends the effect that held it. */
export async function addAfterRollDieToRoll(
  ctx: MutationCtx,
  userId: string,
  { id, effectId, grantId }: AddAfterRollDieInputDto
) {
  const row = await readRollOffering(ctx, userId, id)
  const offer = row.afterRollOffers?.find(
    (candidate) => candidate.effectId === effectId && candidate.grantId === grantId
  )
  if (!offer || !row.characterId) throw new Error('That die is not offered for this roll.')
  const effectStore = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
  const effect = await effectStore.findById(
    { kind: 'CHARACTER', characterId: row.characterId },
    effectId
  )
  if (!effect) throw new Error('That die is no longer held.')
  await effectStore.deleteCas({
    id: effect.id,
    owner: effect.owner,
    expectedVersion: effect.version,
    removal: 'ENDED'
  })
  const used = withAfterRollDie(rollRecordDtoSchema.parse(row), offer, nextRollInt)
  await replaceRoll(ctx, row, used)
  return presentRoll(used, await readRollMaturity(ctx, row.characterId))
}

/** Keeps the user's latest roll as rolled: it offers its held dice no more. */
export async function declineRollOffers(ctx: MutationCtx, userId: string, id: string) {
  const row = await readRollOffering(ctx, userId, id)
  const kept = withoutAfterRollOffers(rollRecordDtoSchema.parse(row))
  await replaceRoll(ctx, row, kept)
  return presentRoll(kept, await readRollMaturity(ctx, row.characterId))
}

export async function retainUserRoll(
  ctx: MutationCtx,
  userId: string,
  record: RollRecordDto,
  gmCampaignRoll: GmCampaignRollDto | null
) {
  return retainUserRolls(ctx, userId, [{ record, gmCampaignRoll }])
}

export async function retainUserRolls(
  ctx: MutationCtx,
  userId: string,
  records: readonly { record: RollRecordDto; gmCampaignRoll: GmCampaignRollDto | null }[]
) {
  if (records.length === 0) return
  for (const { record, gmCampaignRoll } of records)
    await ctx.db.insert('userRollHistory', { ...record, userId, consumedAt: null, gmCampaignRoll })
  const retained = await ctx.db
    .query('userRollHistory')
    .withIndex('by_userId_createdAt_id', (q) => q.eq('userId', userId))
    .order('desc')
    .take(20 + records.length)
  // Every writer preserves the existing twenty-record per-user history bound.
  for (const expired of retained.slice(20)) await ctx.db.delete(expired._id)
}
