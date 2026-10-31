import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterSheetCampaignContext } from '@artificer-toolkit/rules-runtime/character/campaignCharacterSheet'
import type { prepareCharacterRuleSources } from '@artificer-toolkit/rules-runtime/character/characterRuleSnapshot'
import type { CharacterSheetBuilderPreparation } from '@artificer-toolkit/rules-runtime/character/sheetPreparation'
import type { QueryCtx } from '../_generated/server'
import { readCampaignCurrencyOptions } from '../campaigns/currencySystemDocuments'
import {
  readCampaignCharacterState,
  requireCampaignCharacterAuthority
} from '../campaigns/characterState'
import { readVisibleAuthoredRouteId } from '../content/routeIds'
import {
  loadCharacterState,
  readCharacterRecord,
  readCharacterSheetState,
  resolveCharacterId
} from './documents'
import type { CharacterRecordRow, CharacterRow } from './stateDocuments'
import { loadCharacterBuilderContext, type CharacterSourceContext } from './builderContext'
import {
  collectCharacterReferencedSpellIds,
  hydrateCharacterRuleSpell,
  toCharacterRulePublication
} from '@artificer-toolkit/rules-runtime/character/contextPreparation'
import {
  type CharacterReferencedReads,
  readCharacterPublication,
  readCharacterStoredCompilation,
  readReferencedRoot
} from './context'

/** Reuse only within one transaction while source-backed record membership is unchanged. */
export type CharacterSheetSourceContext = {
  characterId: string
  ownerUserId: string
  context: CharacterSourceContext
  sourcePreparation?: ReturnType<typeof prepareCharacterRuleSources>
  builderPreparation?: CharacterSheetBuilderPreparation<CharacterSourceContext>
}

/**
 * The ACTIVE Character the caller may read on the Sheet, its draft and route, without source reads:
 * its owner, or the GM of its Campaign when `campaignId` is given. Null when it is not theirs.
 */
export async function readAuthorizedCharacterSheetState<
  TRow extends CharacterRecordRow = CharacterRow
>(
  ctx: QueryCtx,
  userId: string,
  lookupId: string,
  campaignId?: string,
  authorityScope?: import('../campaigns/authority').CampaignInternalScope,
  /** The row this transaction just wrote, evaluated without reading it back. */
  written?: TRow
) {
  const id = await resolveCharacterId(ctx, lookupId)
  if (!id) return null
  const stored = await loadCharacterState(ctx, id, written === undefined)
  const active: TRow | CharacterRow | null = written ?? stored.active
  const { draft } = stored
  if (!active) return null
  if (written && written.id !== id) throw new Error('Written Character row identity mismatch.')
  if (campaignId) {
    const { assignment } = await requireCampaignCharacterAuthority(
      ctx,
      campaignId,
      id,
      userId,
      authorityScope
    )
    if (assignment.userId !== active.userId)
      throw new Error('Stored Campaign Character assignment mismatch.')
  } else if (active.userId !== userId) return null
  if (draft && draft.userId !== active.userId)
    throw new Error('Stored Character draft ownership mismatch.')
  const route = await readVisibleAuthoredRouteId(ctx, { subjectId: id })
  if (!route || route.subjectKind !== 'CHARACTER' || route.ownerUserId !== active.userId)
    throw new Error('Stored Character route identity mismatch.')
  if (active.status !== 'ACTIVE')
    throw new Error('Character requires Builder repair before the Sheet can be read.')
  return { id, active, draft, route }
}

/** Loads authorized stored inputs without Builder readiness or Character rule evaluation. */
export async function loadCharacterSheetInputs<TRow extends CharacterRecordRow = CharacterRow>(
  ctx: QueryCtx,
  userId: string,
  lookupId: string,
  campaignId?: string,
  sourceContext?: CharacterSheetSourceContext,
  catalogScope: 'active' | 'resolution' = 'active',
  authorityScope?: import('../campaigns/authority').CampaignInternalScope,
  /** The row this transaction just wrote, evaluated without reading it back. */
  written?: TRow,
  referenceSpellIds: readonly string[] = [],
  ruleInputs?: CharacterReferencedReads['ruleInputs']
) {
  const authorized = await readAuthorizedCharacterSheetState(
    ctx,
    userId,
    lookupId,
    campaignId,
    authorityScope,
    written
  )
  if (!authorized) return null
  const { id, active, draft, route } = authorized
  // Validated DTOs use literal starting-equipment sources for the authored string enum.
  const character = readCharacterRecord(active) as CharacterAuthored
  if (
    sourceContext &&
    (sourceContext.characterId !== id ||
      sourceContext.ownerUserId !== active.userId ||
      sourceContext.context.registry.system?.id !== character.systemId ||
      (campaignId !== undefined &&
        sourceContext.context.sourceAccess.campaign?.id !== campaignId.toLowerCase()))
  )
    throw new Error('Character Sheet source context binding mismatch.')
  const sheetState = readCharacterSheetState(active)
  let reusableSources = sourceContext
  if (sourceContext) {
    const requiredSpellIds = new Set([
      ...collectCharacterReferencedSpellIds(character, sourceContext.context),
      ...referenceSpellIds
    ])
    const missingSpellIds = [...requiredSpellIds].filter(
      (spellId) =>
        sourceContext.context.spellCatalogueEntries.some((entry) => entry.id === spellId) &&
        !sourceContext.context.currentSpellsById.has(spellId)
    )
    if (missingSpellIds.length > 0) {
      const context = sourceContext.context
      const currentSpellsById = new Map(context.currentSpellsById)
      const spellsById = new Map(context.spellsById)
      const publications = new Map(context.publications)
      const sourceIdentities = new Map(context.sourceIdentities)
      for (const spellId of missingSpellIds) {
        const root = await readReferencedRoot(ctx, spellId)
        if (!root) throw new Error('Referenced Character Spell root is missing.')
        const published = await readCharacterPublication(
          ctx,
          root,
          character.systemId,
          character.userId,
          context.sourceAccess,
          sourceIdentities
        )
        if (published?.subjectKind !== 'SPELL')
          throw new Error('Referenced Character Spell is unavailable.')
        const spell = toCharacterRulePublication(
          published,
          await readCharacterStoredCompilation(ctx, root),
          {},
          true
        )
        if (spell.subjectKind !== 'SPELL')
          throw new Error('Referenced Character Spell is unavailable.')
        currentSpellsById.set(spellId, spell)
        spellsById.set(spellId, hydrateCharacterRuleSpell(character, spell))
        publications.set(spellId, published)
      }
      reusableSources = {
        ...sourceContext,
        sourcePreparation: undefined,
        builderPreparation: undefined,
        context: {
          ...context,
          currentSpellsById,
          spellsById,
          publications,
          sourceIdentities
        }
      }
    }
  }
  const context =
    reusableSources?.context ??
    (await loadCharacterBuilderContext(
      ctx,
      character,
      character.userId,
      catalogScope,
      authorityScope,
      referenceSpellIds,
      ruleInputs
    ))
  const campaign = context.sourceAccess.campaign
  const campaignState = campaign
    ? (await readCampaignCharacterState(ctx, campaign.id, id)).state
    : { adjustments: [], conditions: [] }
  const campaignContext: CharacterSheetCampaignContext = {
    currencyOptions: campaign ? await readCampaignCurrencyOptions(ctx, campaign) : [],
    viewer: active.userId === userId ? 'CHARACTER_OWNER' : 'CAMPAIGN_OWNER',
    isCampaignOwner: campaign?.ownerUserId === userId,
    campaignId: campaign?.id ?? null,
    campaignStatus: campaign?.status ?? null,
    contentMaturity: campaign?.contentMaturity ?? null,
    attunementSlotOverride: campaign?.attunementSlotOverride ?? null,
    adjustments: campaignState.adjustments.map((record) => ({
      ...record.adjustment,
      id: record.id,
      characterId: id,
      createdBy: record.createdBy,
      updatedBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    })),
    secretAdjustmentIds: new Set(
      campaignState.adjustments
        .filter((record) => record.visibility === 'SECRET')
        .map((record) => record.id)
    ),
    conditions: campaignState.conditions
  }
  return {
    active,
    draft,
    route,
    character,
    sourceContext: reusableSources ?? { characterId: id, ownerUserId: active.userId, context },
    sheetState,
    campaignContext
  }
}
