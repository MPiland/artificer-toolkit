import type {
  CharacterAuthored,
  CreatureAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterSheetState } from '@artificer-toolkit/schema/projections/characterSheetState'
import type { CharacterBuilderContext } from './builderTypes.js'
import type { CharacterPresentationLookup } from './characterRuleContext.js'
import { prepareCharacterBuilderFromContext } from './builderPreparation.js'
import { evaluateCharacterRules } from './characterRuleEvaluation.js'
import type { prepareCharacterRuleSources } from './characterRuleSnapshot.js'
import {
  mergeCampaignSheetAdjustments,
  type CharacterSheetCampaignContext
} from './campaignCharacterSheet.js'
import { getPreparedAndKnownSpellIds } from './sheetSpellIds.js'

/** Evaluates already-authorized current inputs without accessing persistence. */
export async function prepareCharacterSheetFromContext<
  TContext extends CharacterBuilderContext & {
    creaturesById: ReadonlyMap<string, CreatureAuthored>
    /** Sheet views read prose by id (D163). */
    presentation: CharacterPresentationLookup
  }
>(input: {
  character: CharacterAuthored
  context: TContext
  sheetState: CharacterSheetState
  campaignContext: CharacterSheetCampaignContext
  sourcePreparation?: ReturnType<typeof prepareCharacterRuleSources>
  referenceSpellIds?: readonly string[]
}) {
  const { character, context, sheetState, campaignContext } = input
  const prepared = await prepareCharacterBuilderFromContext({
    character,
    current: character,
    mode: 'edit',
    context,
    sourcePreparation: input.sourcePreparation
  })
  if (!prepared.resolution.readiness.ready)
    throw new Error('Character requires Builder repair before the Sheet can be read.')
  const adjustments = mergeCampaignSheetAdjustments(
    sheetState.adjustments,
    campaignContext.adjustments
  )
  const { learned, prepared: preparedSpellIds } = getPreparedAndKnownSpellIds(prepared.character)
  const referenceSpellIds = new Set([
    ...learned,
    ...preparedSpellIds,
    ...(input.referenceSpellIds ?? [])
  ])
  const evaluationInput = {
    character: prepared.character,
    context: prepared.context,
    spellsById: prepared.context.spellsById,
    creaturesById: prepared.context.creaturesById,
    adjustments,
    attunementSlotOverride: campaignContext.attunementSlotOverride,
    resourceUsage: sheetState.resourceUsage,
    movementDisplayPreference: sheetState.movementDisplayPreference
  }
  const ruleEvaluation = evaluateCharacterRules(
    { ...evaluationInput, referenceSpellIds: [...referenceSpellIds] },
    prepared.sourcePreparation
  )
  return {
    prepared,
    adjustments,
    evaluationInput: { ...evaluationInput, referenceSpellIds: [...referenceSpellIds] },
    ruleEvaluation
  }
}
