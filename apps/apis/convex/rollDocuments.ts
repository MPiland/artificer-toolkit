import {
  type ExecuteRollInputDto,
  type GmCampaignRollDto,
  type RollRecordDto
} from '@artificer-toolkit/schema/api/rolls'
import { createRollRecord } from '@artificer-toolkit/rules-runtime/character/rollRecord'
import { nextRollInt } from './lib/rollRandom'
import {
  carriedTestDice,
  resolveCharacterSheetRoll
} from '@artificer-toolkit/rules-runtime/character/sheetRoll'
import { projectCharacterSheetForViewer } from '@artificer-toolkit/rules-runtime/character/campaignCharacterSheet'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { createConvexEncounterStore } from './lib/convexEncounterStore'
import type { MutationCtx } from './_generated/server'
import { readCharacterRecord, resolveCharacterId } from './characters/documents'
import { readCharacterRow } from './characters/stateDocuments'
import { loadCharacterSheet } from './characters/sheetPreparation'
import { readCharacterCampaign } from './characters/context'
import { requireCampaignCharacterAuthority } from './campaigns/characterState'
import { requireSystem } from './content/systemDocuments'

export { nextRollInt } from './lib/rollRandom'

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
  // an attack adds the dice its Sheet row carries (Bless).
  const { addedDice, spent, minimumRoll } = sheet
    ? carriedTestDice(resolved, sheet.activeEffects, {
        grantFold: sheet.ruleEvaluation.output.grantFold,
        registry: sheet.ruleEvaluation.registry
      })
    : { addedDice: [], spent: [], minimumRoll: null }
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
    nextInt: nextRollInt
  })
  return { record, maturity }
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
