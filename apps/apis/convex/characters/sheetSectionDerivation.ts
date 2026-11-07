import {
  characterSheetSliceSchema,
  type CharacterSheetSlice
} from '@artificer-toolkit/schema/api/characterSheetSlices'
import {
  projectCharacterSheetForViewer,
  type CharacterSheetCampaignContext
} from '@artificer-toolkit/rules-runtime/character/campaignCharacterSheet'
import { collectCharacterReferencedSpellIds } from '@artificer-toolkit/rules-runtime/character/contextPreparation'
import { listCharacterSheetPanelTargets } from '@artificer-toolkit/rules-runtime/character/sheetPanelTarget'
import { CharacterRequiresBuilderRepairError } from '@artificer-toolkit/rules-runtime/character/builderRepair'
import { projectCharacterSheetSlice } from '@artificer-toolkit/rules-runtime/character/sheetSlices'
import { v } from 'convex/values'
import type { MutationCtx } from '../_generated/server'
import type { CampaignInternalScope } from '../campaigns/authority'
import { internalMutation } from '../lib/mutations'
import { loadCharacterState } from './documents'
import { projectCharacterSheetPanel } from './panels'
import { projectCharacterPreparationOptions } from './preparationOptions'
import { loadCharacterSheetFacts } from './sheetFacts'
import { projectCharacterSheetFacts } from './sheetPreparation'
import {
  characterSheetSection,
  readCharacterSheetFingerprint,
  readCharacterSheetStoreState,
  type CharacterSheetFingerprintReads,
  writeCharacterSheetSections,
  type CharacterSheetSectionValue
} from './sheetSections'
import {
  cancelCharacterSheetPendingStore,
  readCharacterSheetPendingStore
} from './sheetSectionStores'
import type { CharacterRecordRow } from './stateDocuments'

const T33_LOADED = [Date.now(), performance.now()]
let t33Last = [0, 0]
function t33(label: string) {
  const now = [Date.now(), performance.now()]
  console.log(`T33 ${label} date=${now[0] - t33Last[0]} perf=${(now[1] - t33Last[1]).toFixed(1)}`)
  t33Last = now
}
// Notes are owner-only and read without derivation (`loadCharacterSheetNotes`).
function projectSlices(
  sheet: ReturnType<typeof projectCharacterSheetFacts>['sheet'],
  context: CharacterSheetCampaignContext
): CharacterSheetSectionValue[] {
  const viewed = projectCharacterSheetForViewer(sheet, context)
  return characterSheetSliceSchema.options
    .filter((slice): slice is Exclude<CharacterSheetSlice, 'NOTES'> => slice !== 'NOTES')
    .map((slice) => ({
      viewer: context.viewer,
      section: characterSheetSection.slice(slice),
      value: projectCharacterSheetSlice(viewed, slice)
    }))
}

/**
 * Projects every stored Sheet section from the facts this write evaluated, for each viewer that
 * can read the Character: its owner, the GM of its Campaign and, while "Party can view" is on, the
 * party. Rule evaluation does not depend on the viewer, so the write evaluates once (ADR 0041).
 * A derivation still queued by an earlier write would only find these sections current.
 */
export async function storeCharacterSheetSections(
  ctx: MutationCtx,
  facts: NonNullable<Awaited<ReturnType<typeof loadCharacterSheetFacts<CharacterRecordRow>>>>,
  authorityScope?: CampaignInternalScope,
  /** The fingerprint of the inputs these facts were loaded from, when the caller already read it. */
  inputsFingerprint?: string
) {
  const characterId = facts.active.id
  const pending = await readCharacterSheetPendingStore(ctx, characterId)
  if (pending) {
    await cancelCharacterSheetPendingStore(ctx, pending)
    await ctx.db.delete('characterSheetPendingStores', pending._id)
  }
  const campaign = facts.sourceContext.context.sourceAccess.campaign
  const ownerContext: CharacterSheetCampaignContext = {
    ...facts.campaignContext,
    viewer: 'CHARACTER_OWNER',
    isCampaignOwner: campaign?.ownerUserId === facts.active.userId
  }
  const contexts: CharacterSheetCampaignContext[] =
    campaign && campaign.ownerUserId !== facts.active.userId
      ? [
          ownerContext,
          { ...facts.campaignContext, viewer: 'CAMPAIGN_OWNER', isCampaignOwner: true }
        ]
      : [ownerContext]
  const referencedSpellIds = collectCharacterReferencedSpellIds(
    facts.prepared.character,
    facts.sourceContext.context
  )
  const values: CharacterSheetSectionValue[] = []
  t33('facts')
  for (const campaignContext of contexts) {
    const current = projectCharacterSheetFacts({ ...facts, campaignContext })
    t33(`sheetProjection ${campaignContext.viewer}`)
    values.push(...projectSlices(current.sheet, campaignContext))
    t33(`viewerSlices ${campaignContext.viewer}`)
    const viewed = projectCharacterSheetForViewer(current.sheet, campaignContext)
    for (const target of listCharacterSheetPanelTargets(viewed)) {
      // The Sheet evaluates only the Spells it references; another listed Spell's panel (a
      // full-list Spell not yet learned or prepared) derives live with that Spell loaded.
      if (target.kind === 'SPELL' && !referencedSpellIds.has(target.source.spellId)) continue
      values.push({
        viewer: campaignContext.viewer,
        section: characterSheetSection.panel(target),
        value: projectCharacterSheetPanel(current, target)
      })
    }
    t33(`panels ${campaignContext.viewer}`)
    values.push({
      viewer: campaignContext.viewer,
      section: characterSheetSection.preparation,
      value: await projectCharacterPreparationOptions(ctx, current)
    })
    t33(`preparation ${campaignContext.viewer}`)
    if (campaign && campaignContext === ownerContext && facts.sheetState.partyVisibility.sheet)
      values.push(...projectSlices(current.sheet, { ...ownerContext, viewer: 'PARTY_MEMBER' }))
    t33(`partySlices ${campaignContext.viewer}`)
  }
  // The facts carry the Character row as this transaction wrote it, and the sources and effects
  // they were derived from.
  const fingerprint =
    inputsFingerprint ??
    (await readCharacterSheetFingerprint(
      ctx,
      { active: facts.active, hasDraft: facts.draft !== null, publicId: facts.route.publicId },
      authorityScope,
      {
        sources: facts.sourceContext.context.sourceAccess,
        activeEffects: facts.activeEffects,
        carriedEffects: facts.concentrationEffects ?? []
      }
    ))
  t33('fingerprint')
  await writeCharacterSheetSections(ctx, characterId, fingerprint, values)
  t33(
    `write sections=${values.length} bytes=${values.reduce((n, v) => n + JSON.stringify(v.value).length, 0)}`
  )
}

/** Derives the Sheet once over its own sources and stores its sections. */
export async function deriveAndStoreCharacterSheet(
  ctx: MutationCtx,
  characterId: string,
  token: string
) {
  t33Last = T33_LOADED
  t33('moduleLoad->handler')
  // A newer write queued its own derivation; this one began before it could be cancelled.
  const pending = await readCharacterSheetPendingStore(ctx, characterId)
  if (pending && pending.token !== token) return null
  if (pending) await ctx.db.delete('characterSheetPendingStores', pending._id)
  const { active } = await loadCharacterState(ctx, characterId)
  // A deleted Character, or one that needs Builder repair, has no Sheet to store. Repair is either
  // recorded (a reconciled loss leaves it a draft) or found below, when a replaced publication left
  // an active Character short of a required choice; its Sheet reads report the repair.
  if (active?.status !== 'ACTIVE') return null
  // A later write may already have stored the Sheet over the same inputs.
  const reads: Partial<CharacterSheetFingerprintReads> = {}
  const state = await readCharacterSheetStoreState(ctx, active.userId, characterId, reads)
  t33('fingerprintRead')
  if (state?.current) return null
  // The facts reuse the System, sources and effects the fingerprint just read.
  const facts = await loadCharacterSheetFacts(
    ctx,
    active.userId,
    characterId,
    undefined,
    undefined,
    undefined,
    undefined,
    active,
    undefined,
    reads
  ).catch((error: unknown) => {
    if (error instanceof CharacterRequiresBuilderRepairError) return null
    throw error
  })
  if (facts) await storeCharacterSheetSections(ctx, facts, undefined, state?.fingerprint)
  return null
}

export const store = internalMutation({
  args: { characterId: v.string(), token: v.string() },
  returns: v.null(),
  handler: (ctx, { characterId, token }) => deriveAndStoreCharacterSheet(ctx, characterId, token)
})
