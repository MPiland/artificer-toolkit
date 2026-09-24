import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { createEmptyCharacterAuthored } from '@artificer-toolkit/shared/character'
import { prepareCharacterBuilderFromContext } from '@artificer-toolkit/rules-runtime/character/builderPreparation'
import { toCharacterBuilderSpellCatalogRecord } from '@artificer-toolkit/rules-runtime/character/builderCatalog'
import type { prepareCharacterRuleSources } from '@artificer-toolkit/rules-runtime/character/characterRuleSnapshot'
import type { QueryCtx } from '../_generated/server'
import { loadCharacterBuilderContext } from './builderContext'
import { loadCharacterRuleContext } from './context'

/** Load authorized sources for the portable Builder preparation. */
export async function prepareCharacterBuilder(
  ctx: QueryCtx,
  input: {
    character: CharacterAuthored
    current: CharacterAuthored | null
    mode: 'create' | 'edit'
    finalize?: boolean
    catalogScope?: 'selectors' | 'resolution' | 'active'
    sourceContext?: Awaited<ReturnType<typeof loadCharacterBuilderContext>>
    sourcePreparation?: ReturnType<typeof prepareCharacterRuleSources>
    authorityScope?: import('../campaigns/authority').CampaignInternalScope
  }
) {
  const candidate = {
    ...input.character,
    state: input.current?.state ?? createEmptyCharacterAuthored(input.character).state
  }
  const context =
    input.sourceContext ??
    (await loadCharacterBuilderContext(
      ctx,
      candidate,
      candidate.userId,
      input.catalogScope ?? 'resolution',
      input.authorityScope
    ))
  return prepareCharacterBuilderFromContext({
    character: input.character,
    current: input.current,
    mode: input.mode,
    finalize: input.finalize,
    context,
    sourcePreparation: input.sourcePreparation,
    reloadContextAfterMaterialization: async (character, previousContext) => {
      const previouslyLoadedSpellDocumentsById = previousContext.currentSpellDocumentsById
      const currentContext = await loadCharacterRuleContext(
        ctx,
        character,
        character.userId,
        previouslyLoadedSpellDocumentsById && previouslyLoadedSpellDocumentsById.size > 0
          ? {
              spellDocumentsById: previouslyLoadedSpellDocumentsById,
              sourceIdentities: previousContext.sourceIdentities
            }
          : undefined,
        input.authorityScope
      )
      return {
        ...currentContext,
        sourceIdentities: new Map([
          ...previousContext.sourceIdentities,
          ...currentContext.sourceIdentities
        ]),
        catalog: {
          ...previousContext.catalog,
          spells: [...currentContext.currentSpellDocumentsById.values()]
            .sort(
              (left, right) =>
                left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
            )
            .map(toCharacterBuilderSpellCatalogRecord)
        }
      }
    }
  })
}
