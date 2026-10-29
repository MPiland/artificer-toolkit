import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  characterSheetPanelInputSchema,
  characterSheetPanelDtoSchema,
  type CharacterSheetPanelTargetDto
} from '@artificer-toolkit/schema/api/characterSheetPanel'
import { buildCharacterSheetPanel } from '@artificer-toolkit/rules-runtime/character/sheetPanel'
import { getCharacterSpellKnownEligibleIdsByClass } from '@artificer-toolkit/rules-runtime/character/characterSpellPreparationEligibility'
import { presentCampaignCharacterText } from '@artificer-toolkit/rules-runtime/character/campaignCharacterPresentation'
import { projectCharacterSheetForViewer } from '@artificer-toolkit/rules-runtime/character/campaignCharacterSheet'
import { query } from '../lib/queries'
import { requireIdentity } from '../lib/identity'
import { loadCharacterSheet } from './sheetPreparation'
import { characterSheetSection, readStoredCharacterSheetSection } from './sheetSections'

export function projectCharacterSheetPanel(
  current: NonNullable<Awaited<ReturnType<typeof loadCharacterSheet>>>,
  target: CharacterSheetPanelTargetDto
) {
  const { viewer, campaignStatus, contentMaturity } = current.campaignContext
  const panel = buildCharacterSheetPanel({
    character: current.evaluationInput.character,
    resolution: current.resolution,
    presentation: current.presentation,
    // Strip private/secret fields before composition; present text only after editor originals exist.
    sheet: projectCharacterSheetForViewer(current.sheet, {
      ...current.campaignContext,
      contentMaturity: null
    }),
    ruleProjection: current.ruleProjection,
    knownSpellEligibleIdsByClass: getCharacterSpellKnownEligibleIdsByClass({
      rulePolicyInput: current.ruleEvaluation.facts,
      rulePolicyOutput: current.ruleEvaluation.output
    }),
    adjustments: current.displayAdjustments,
    movementDisplayPreference: current.sheetState.movementDisplayPreference,
    target,
    editable: viewer === 'CHARACTER_OWNER' || campaignStatus === 'ACTIVE'
  })
  const allowedCommands =
    viewer === 'CHARACTER_OWNER'
      ? panel.allowedCommands
      : campaignStatus !== 'ACTIVE'
        ? []
        : panel.allowedCommands.filter(
            (command) =>
              command !== 'UPSERT_ADJUSTMENT' &&
              command !== 'REMOVE_ADJUSTMENT' &&
              command !== 'RESET_ADJUSTMENTS' &&
              command !== 'SET_MOVEMENT_DISPLAY_PREFERENCE' &&
              command !== 'SET_SPELL_MECHANIC_CUSTOMIZATION' &&
              command !== 'REMOVE_SPELL_MECHANIC_CUSTOMIZATION'
          )
  return characterSheetPanelDtoSchema.parse(
    presentCampaignCharacterText(
      {
        ...panel,
        allowedCommands,
        editable: panel.editable && allowedCommands.length > 0,
        ...(viewer === 'CAMPAIGN_OWNER' && 'textEditors' in panel
          ? { textEditors: panel.textEditors.filter((editor) => editor.field !== 'NOTES') }
          : {})
      },
      contentMaturity,
      viewer
    )
  )
}

export const get = query({
  args: zodToConvexFields(characterSheetPanelInputSchema.shape),
  returns: zodToConvex(characterSheetPanelDtoSchema),
  handler: async (ctx, args) => {
    const { userId } = await requireIdentity(ctx)
    const input = characterSheetPanelInputSchema.parse(args)
    const stored = await readStoredCharacterSheetSection(ctx, {
      userId,
      lookupId: input.id,
      section: characterSheetSection.panel(input.target)
    })
    if (stored !== undefined) return characterSheetPanelDtoSchema.parse(stored)
    const current = await loadCharacterSheet(
      ctx,
      userId,
      input.id,
      undefined,
      undefined,
      input.target.kind === 'PROFICIENCIES' ? 'resolution' : 'active',
      undefined,
      input.target.kind === 'SPELL' ? [input.target.source.spellId] : []
    )
    if (!current) throw new Error('Character Sheet panel is unavailable for the current user.')
    return projectCharacterSheetPanel(current, input.target)
  }
})
