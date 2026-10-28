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
  scheduleCharacterSheetSections,
  writeCharacterSheetSections,
  type CharacterSheetSectionValue
} from './sheetSections'
import type { CharacterRecordRow } from './stateDocuments'

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

type CharacterSheetFacts = NonNullable<
  Awaited<ReturnType<typeof loadCharacterSheetFacts<CharacterRecordRow>>>
>

/**
 * Projects the stored Sheet sections from evaluated facts, for each viewer that can read the
 * Character: its owner, the GM of its Campaign and, while "Party can view" is on, the party. Rule
 * evaluation does not depend on the viewer, so one evaluation serves them all (ADR 0040).
 */
async function storeSections(
  ctx: MutationCtx,
  facts: CharacterSheetFacts,
  authorityScope: CampaignInternalScope | undefined,
  panels: boolean
) {
  const characterId = facts.active.id
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
  for (const campaignContext of contexts) {
    const current = projectCharacterSheetFacts({ ...facts, campaignContext })
    values.push(...projectSlices(current.sheet, campaignContext))
    const viewed = projectCharacterSheetForViewer(current.sheet, campaignContext)
    for (const target of panels ? listCharacterSheetPanelTargets(viewed) : []) {
      // The Sheet evaluates only the Spells it references; another listed Spell's panel (a
      // full-list Spell not yet learned or prepared) derives live with that Spell loaded.
      if (target.kind === 'SPELL' && !referencedSpellIds.has(target.source.spellId)) continue
      values.push({
        viewer: campaignContext.viewer,
        section: characterSheetSection.panel(target),
        value: projectCharacterSheetPanel(current, target)
      })
    }
    values.push({
      viewer: campaignContext.viewer,
      section: characterSheetSection.preparation,
      value: await projectCharacterPreparationOptions(ctx, current)
    })
    if (campaign && campaignContext === ownerContext && facts.sheetState.partyVisibility.sheet)
      values.push(...projectSlices(current.sheet, { ...ownerContext, viewer: 'PARTY_MEMBER' }))
  }
  // Fingerprint the Character as stored, after every write this call made.
  const { active } = await loadCharacterState(ctx, characterId)
  if (!active) throw new Error('Written Character is unavailable for its Sheet sections.')
  const fingerprint = await readCharacterSheetFingerprint(
    ctx,
    { active, hasDraft: facts.draft !== null, publicId: facts.route.publicId },
    authorityScope
  )
  await writeCharacterSheetSections(ctx, characterId, fingerprint, values, panels)
}

/**
 * Stores the sections of the write that evaluated these facts, except the panels: they are most of
 * the projection, so the queued derivation stores them after the write has returned.
 */
export async function storeCharacterSheetSections(
  ctx: MutationCtx,
  facts: CharacterSheetFacts,
  authorityScope?: CampaignInternalScope
) {
  await storeSections(ctx, facts, authorityScope, false)
  await scheduleCharacterSheetSections(ctx, facts.active.id)
}

/** Derives the Sheet once over its own sources and stores its sections. */
export const store = internalMutation({
  args: { characterId: v.string() },
  returns: v.null(),
  handler: async (ctx, { characterId }) => {
    const { active } = await loadCharacterState(ctx, characterId)
    // A deleted Character, or one that needs Builder repair, has no Sheet to store.
    if (active?.status !== 'ACTIVE') return null
    const facts = await loadCharacterSheetFacts(ctx, active.userId, characterId)
    if (facts) await storeSections(ctx, facts, undefined, true)
    return null
  }
})
