import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { v } from 'convex/values'
import { presentCampaignCharacterText } from '@artificer-toolkit/rules-runtime/character/campaignCharacterPresentation'
import { characterSheetReadInputSchema } from '@artificer-toolkit/schema/api/characterSheetData'
import {
  characterPreparationOptionsResponseDtoSchema,
  type CharacterPreparationOptionsResponseDto
} from '@artificer-toolkit/schema/api/characterPreparationOptions'
import {
  buildCharacterPreparationOptions,
  collectCharacterSpellPreparationEligibility
} from '@artificer-toolkit/rules-runtime/character/characterSpellPreparationEligibility'
import { query } from '../lib/queries'
import { requireIdentity } from '../lib/identity'
import { loadCharacterSheet } from './sheetPreparation'
import { characterSheetSection, readStoredCharacterSheetSection } from './sheetSections'
import { readContentSnapshotManifest } from '../contentSnapshots/manifest'
import { readCharacterSources } from './sourceReads'
import type { QueryCtx } from '../_generated/server'

export async function projectCharacterPreparationOptions(
  ctx: QueryCtx,
  current: NonNullable<Awaited<ReturnType<typeof loadCharacterSheet>>>
) {
  const summaries = current.evaluationInput.context.catalog.spells
  const eligibility = collectCharacterSpellPreparationEligibility({
    rulePolicyInput: current.ruleEvaluation.facts,
    rulePolicyOutput: current.ruleEvaluation.output
  })
  const eligibleIds = new Set(eligibility.flatMap((source) => source.eligibleSpellIds))
  const committedById = new Map(current.sheet.spells.spells.map((spell) => [spell.id, spell]))
  const catalogue: CharacterPreparationOptionsResponseDto['catalogue'] =
    current.campaignContext.viewer === 'CHARACTER_OWNER'
      ? {
          kind: 'SNAPSHOTS',
          manifest: await readContentSnapshotManifest(
            ctx,
            current.character.systemId,
            current.sourceContext.context.sourceAccess
          )
        }
      : {
          kind: 'INLINE',
          spells: summaries
            .filter((spell) => eligibleIds.has(spell.id))
            .map((spell) => {
              const committed = committedById.get(spell.id)
              return {
                spellId: spell.id,
                label: committed?.label ?? spell.label,
                level: committed?.level ?? spell.level
              }
            })
        }
  return characterPreparationOptionsResponseDtoSchema.parse(
    presentCampaignCharacterText(
      buildCharacterPreparationOptions({
        characterId: current.character.id,
        streamVersion: current.sheet.meta.streamVersion,
        eligibility,
        summaries,
        catalogue,
        classes: current.resolution.registry.classes
      }),
      current.contentMaturity,
      current.campaignContext.viewer
    )
  )
}

/**
 * The stored preparation options while they are current. Snapshot builds finish without a
 * Character write, so an owner's manifest is read from the current heads (ADR 0040).
 */
export async function readStoredCharacterPreparationOptions(
  ctx: QueryCtx,
  input: { userId: string; lookupId: string; campaignId?: string }
) {
  const stored = await readStoredCharacterSheetSection(ctx, {
    ...input,
    section: characterSheetSection.preparation
  })
  if (stored === undefined) return undefined
  const options = characterPreparationOptionsResponseDtoSchema.parse(stored)
  if (options.catalogue.kind !== 'SNAPSHOTS') return options
  const { systemId } = options.catalogue.manifest
  const access = await readCharacterSources(
    ctx,
    { id: options.characterId, systemId, userId: input.userId },
    input.userId
  )
  return {
    ...options,
    catalogue: {
      ...options.catalogue,
      manifest: await readContentSnapshotManifest(ctx, systemId, access)
    }
  }
}

export const get = query({
  args: zodToConvexFields(characterSheetReadInputSchema.shape),
  returns: v.union(v.null(), zodToConvex(characterPreparationOptionsResponseDtoSchema)),
  handler: async (ctx, args): Promise<CharacterPreparationOptionsResponseDto | null> => {
    const { userId } = await requireIdentity(ctx)
    const { id } = characterSheetReadInputSchema.parse(args)
    const stored = await readStoredCharacterPreparationOptions(ctx, { userId, lookupId: id })
    if (stored) return stored
    const current = await loadCharacterSheet(ctx, userId, id)
    if (!current) return null
    return projectCharacterPreparationOptions(ctx, current)
  }
})
