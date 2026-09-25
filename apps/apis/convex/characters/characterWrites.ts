import type { z } from 'zod'
import { characterStoredRecordSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import type { CharacterSheetState } from '@artificer-toolkit/schema/projections/characterSheetState'
import { resolveCharacterEffectiveMaximumHitPoints } from '@artificer-toolkit/shared/character'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import type { CampaignInternalScope } from '../campaigns/authority'
import { loadCharacterSheetFacts, type CharacterSheetSourceContext } from './sheetFacts'

type CharacterStoredRecord = z.infer<typeof characterStoredRecordSchema>
type CharacterRecordFields = Omit<
  CharacterStoredRecord,
  'documentJson' | 'checksum' | 'sheetState' | 'maximumHitPoints'
>

/**
 * The single writer of a Character row. It stores the document, Sheet state and stream version the
 * caller supplies, then evaluates the written Character and stores its effective maximum hit points
 * in the same transaction. A caller that already evaluated the written Character passes
 * `maximumHitPoints` instead; `evaluateAs` lets a caller reuse the returned facts for its own Sheet
 * response. Callers own authority, replay, receipts and advancing the stream once per transaction.
 */
export async function writeCharacterRecord(
  ctx: MutationCtx,
  input: {
    current: Doc<'characters'> | null
    fields: Partial<CharacterRecordFields> &
      Pick<CharacterRecordFields, 'streamVersion' | 'updatedAt'>
    document?: unknown
    sheetState?: CharacterSheetState
    maximumHitPoints?: number
    sourceContext?: CharacterSheetSourceContext
    evaluateAs?: {
      userId: string
      campaignId?: string
      catalogScope?: 'active' | 'resolution'
      authorityScope?: CampaignInternalScope
    }
  }
) {
  const { current } = input
  const encodedSheetState: unknown = input.sheetState
    ? JSON.parse(JSON.stringify(input.sheetState))
    : undefined
  // Native writes drop the cutover-only catalogue field that old records may still carry.
  const {
    _id: _rowId,
    _creationTime: _created,
    primaryRulesCatalogueId: _retiredCatalogue,
    ...stored
  } = current ?? { _id: null, _creationTime: null, primaryRulesCatalogueId: undefined }
  const record = characterStoredRecordSchema.parse({
    ...stored,
    ...input.fields,
    ...(input.document === undefined
      ? {}
      : {
          documentJson: canonicalizeRuleDocument(input.document),
          checksum: checksumRuleDocument(input.document)
        }),
    ...(encodedSheetState === undefined
      ? {}
      : {
          sheetState: {
            documentJson: canonicalizeRuleDocument(encodedSheetState),
            checksum: checksumRuleDocument(encodedSheetState)
          }
        }),
    // Replaced below once the written Character has been evaluated.
    maximumHitPoints: input.maximumHitPoints ?? current?.maximumHitPoints ?? 0
  })
  // A refresh after a Campaign-owned change rewrites nothing unless the maximum moves.
  if (current && checksumCanonicalJson(stored) !== checksumCanonicalJson(record))
    await ctx.db.replace(current._id, record)
  const rowId = current ? current._id : await ctx.db.insert('characters', record)
  // A DRAFT Character needs Builder repair and has no readable Sheet; it keeps its last maximum.
  if (record.status !== 'ACTIVE' || input.maximumHitPoints !== undefined)
    return { row: (await ctx.db.get(rowId))!, facts: null }
  const reader = input.evaluateAs ?? { userId: record.userId }
  const facts = await loadCharacterSheetFacts(
    ctx,
    reader.userId,
    record.id,
    reader.campaignId,
    input.sourceContext,
    reader.catalogScope,
    reader.authorityScope
  )
  if (!facts) throw new Error('Written Character is unavailable for evaluation.')
  const maximumHitPoints = resolveCharacterEffectiveMaximumHitPoints(
    facts.ruleEvaluation.output.derivedStats.maxHitPoints.effective
  )
  if (maximumHitPoints === record.maximumHitPoints) return { row: facts.active, facts }
  await ctx.db.patch(rowId, { maximumHitPoints })
  const row = { ...facts.active, maximumHitPoints }
  return { row, facts: { ...facts, active: row } }
}
