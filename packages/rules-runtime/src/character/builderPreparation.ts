import type {
  CharacterAuthored,
  ParentClassAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import { createEmptyCharacterAuthored } from '@artificer-toolkit/shared/character'
import { resolveFeatureOptionEligibility } from './builderEligibility.js'
import { resolveCharacterBuilder } from './builderResolution.js'
import { evaluateCharacterRules } from './characterRuleEvaluation.js'
import { prepareCharacterRuleSources } from './characterRuleSnapshot.js'
import { reconcileCharacterBuilderCharacter } from './builderReconciliation.js'
import { materializeCharacterStartingEquipment } from './characterStartingEquipmentState.js'
import type { CharacterBuilderContext } from './builderTypes.js'

/** Preview and finalization evaluate the same current sources and server-owned Sheet state. */
export async function prepareCharacterBuilderFromContext<
  TContext extends CharacterBuilderContext
>(input: {
  character: CharacterAuthored
  current: CharacterAuthored | null
  mode: 'create' | 'edit'
  finalize?: boolean
  context: TContext
  sourcePreparation?: ReturnType<typeof prepareCharacterRuleSources>
  reloadContextAfterMaterialization?: (
    character: CharacterAuthored,
    context: TContext
  ) => Promise<TContext>
}) {
  const candidate = {
    ...input.character,
    state: input.current?.state ?? createEmptyCharacterAuthored(input.character).state
  }
  let context = input.context
  let sourcePreparation = input.sourcePreparation ?? prepareCharacterRuleSources(context)
  let character = await reconcileCharacterBuilderCharacter({
    character: candidate,
    existingCharacter: input.current,
    context,
    evaluate: async (nextCharacter, options) =>
      evaluateCharacterRules(
        {
          ...options,
          character: nextCharacter,
          context,
          spellDocumentsById: context.spellDocumentsById
        },
        sourcePreparation
      )
  })
  const resolve = () =>
    resolveCharacterBuilder({
      character,
      mode: input.mode,
      context,
      previousCharacter: input.current,
      resolveFeatureOptions: (options) =>
        resolveFeatureOptionEligibility({
          ...options,
          evaluate: async (nextCharacter, eligibilityFacets) =>
            evaluateCharacterRules(
              {
                character: nextCharacter,
                context,
                eligibilityFacets,
                spellDocumentsById: context.spellDocumentsById
              },
              sourcePreparation
            )
        })
    })
  let resolution = await resolve()
  if (input.finalize && resolution.readiness.ready) {
    // Inventory becomes Sheet-owned after activation, regardless of client-supplied markers.
    for (const decision of [
      character.intent.startingEquipment?.class,
      character.intent.startingEquipment?.background
    ]) {
      if (decision) decision.applied = input.current !== null
    }
    if (!input.current) {
      const primaryClass = resolution.registry.classes.find(
        (row): row is ParentClassAuthored =>
          row.category === 'BASE' && row.id === character.intent.classes[0]?.classId
      )
      const background = resolution.registry.backgrounds.find(
        (row) => row.id === character.intent.background.backgroundId
      )
      const materialized = materializeCharacterStartingEquipment(character, {
        classStartingEquipment: primaryClass?.startingEquipment,
        classStartingGold: primaryClass?.startingGold,
        backgroundStartingEquipment: background?.startingEquipment
      })
      character = materialized.character
      if (materialized.changed) {
        // GRANTED equipment may not have appeared among chosen IDs before materialization.
        if (!input.reloadContextAfterMaterialization)
          throw new Error('Materialized Character equipment requires a fresh source context.')
        context = await input.reloadContextAfterMaterialization(character, context)
        sourcePreparation = prepareCharacterRuleSources(context)
        resolution = await resolve()
      }
    }
  }
  return { candidate, character, context, resolution, sourcePreparation }
}
