import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CompiledCreature } from '@artificer-toolkit/shared/subjects/compilers'
import type { CharacterSheetState } from '@artificer-toolkit/schema/projections/characterSheetState'
import type { CharacterBuilderContext } from './builderTypes.js'
import { prepareCharacterBuilderFromContext } from './builderPreparation.js'
import { evaluateCharacterRules } from './characterRuleEvaluation.js'
import type { prepareCharacterRuleSources } from './characterRuleSnapshot.js'
import {
  mergeCampaignSheetAdjustments,
  type CharacterSheetCampaignContext
} from './campaignCharacterSheet.js'
import { getPreparedAndKnownSpellIds } from './sheetSpellIds.js'

/**
 * A Builder preparation keyed by the Character document it reconciled. Preparation reads only that
 * document and its context, so an evaluation over the same document and context object reuses it.
 */
export type CharacterSheetBuilderPreparation<TContext extends CharacterBuilderContext> = {
  document: string
  prepared: Awaited<ReturnType<typeof prepareCharacterBuilderFromContext<TContext>>>
}

/** Evaluates already-authorized current inputs without accessing persistence. */
export async function prepareCharacterSheetFromContext<
  TContext extends CharacterBuilderContext & {
    creaturesById: ReadonlyMap<string, CompiledCreature>
  }
>(input: {
  character: CharacterAuthored
  context: TContext
  sheetState: CharacterSheetState
  campaignContext: CharacterSheetCampaignContext
  sourcePreparation?: ReturnType<typeof prepareCharacterRuleSources>
  referenceSpellIds?: readonly string[]
  /** An earlier preparation in this transaction, reused while its document and context match. */
  builderPreparation?: CharacterSheetBuilderPreparation<TContext>
}) {
  const { character, context, sheetState, campaignContext } = input
  const document = JSON.stringify(character)
  const reusable = input.builderPreparation
  const prepared =
    reusable?.document === document && reusable.prepared.context === context
      ? reusable.prepared
      : await prepareCharacterBuilderFromContext({
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
    ruleEvaluation,
    builderPreparation: { document, prepared }
  }
}
