import {
  rollRecordDtoSchema,
  type ExecuteRollInputDto,
  type GmCampaignRollDto,
  type RollHistoryEntryDto,
  type RollRecordDto
} from '@artificer-toolkit/schema/api/rolls'
import { evaluateRollExpression, parseRollExpression } from '@artificer-toolkit/shared/rolls'
import { nextRollInt } from './lib/rollRandom'
import { resolveCharacterSheetRoll } from '@artificer-toolkit/rules-runtime/character/sheetRoll'
import { projectCharacterSheetForViewer } from '@artificer-toolkit/rules-runtime/character/campaignCharacterSheet'
import {
  presentCampaignPlainText,
  type CampaignContentMaturity
} from '@artificer-toolkit/shared/campaign/textPolicy'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { readCharacterRecord, resolveCharacterId } from './characters/documents'
import { loadCharacterSheet } from './characters/sheetPreparation'
import { readCharacterCampaign } from './characters/context'
import { requireCampaignCharacterAuthority } from './campaigns/characterState'
import { requireSystem } from './content/systemDocuments'

export function presentRoll(
  record: RollRecordDto,
  maturity: CampaignContentMaturity | null
): RollRecordDto {
  if (maturity !== 'STANDARD') return record
  return {
    ...record,
    characterLabel: presentCampaignPlainText(record.characterLabel, maturity),
    source: {
      ...record.source,
      label: presentCampaignPlainText(record.source.label, maturity).slice(0, 80)
    }
  }
}

export { nextRollInt } from './lib/rollRandom'

/** Campaign access is explicit; the personal endpoint never inherits GM authority. */
export async function evaluateCharacterRoll(
  ctx: QueryCtx,
  userId: string,
  input: ExecuteRollInputDto,
  campaignId?: string
) {
  const id = await resolveCharacterId(ctx, input.characterId)
  if (!id) throw new Error('Character not found.')
  const active = await ctx.db
    .query('characters')
    .withIndex('by_publicId', (q) => q.eq('id', id))
    .unique()
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
        rollMode: input.rollMode ?? 'NORMAL',
        source: { kind: 'MANUAL' as const, label: 'Manual roll' }
      }
  const record = rollRecordDtoSchema.parse({
    id: crypto.randomUUID(),
    characterId: character.id,
    characterLabel: character.label,
    source: resolved.source,
    ruleset: {
      systemId: system.id,
      code: system.rulesetCode,
      version: system.rulesetVersion
    },
    ...evaluateRollExpression(
      parseRollExpression(resolved.expression),
      { nextInt: nextRollInt },
      resolved.rollMode
    ),
    createdAt: new Date().toISOString()
  })
  return { record, maturity }
}

export function presentRetainedRoll(
  { gmCampaignRoll, ...record }: RollRecordDto & { gmCampaignRoll: GmCampaignRollDto | null },
  maturity: CampaignContentMaturity | null
): RollHistoryEntryDto {
  const presented = presentRoll(record, maturity)
  if (!gmCampaignRoll) return { ...presented, gmCampaignRoll: null }
  return gmCampaignRoll.blind && gmCampaignRoll.revealedAt === null
    ? {
        ...presented,
        evidence: null,
        gmCampaignRoll: { ...gmCampaignRoll, blind: true, revealedAt: null }
      }
    : { ...presented, gmCampaignRoll }
}

export async function retainUserRoll(
  ctx: MutationCtx,
  userId: string,
  record: RollRecordDto,
  gmCampaignRoll: GmCampaignRollDto | null
) {
  await ctx.db.insert('userRollHistory', { ...record, userId, consumedAt: null, gmCampaignRoll })
  const retained = await ctx.db
    .query('userRollHistory')
    .withIndex('by_userId_createdAt_id', (q) => q.eq('userId', userId))
    .order('desc')
    .take(21)
  // Every writer preserves the existing twenty-record per-user history bound.
  for (const expired of retained.slice(20)) await ctx.db.delete(expired._id)
}
