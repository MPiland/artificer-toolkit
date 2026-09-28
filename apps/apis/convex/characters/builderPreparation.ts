import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { createEmptyCharacterAuthored } from '@artificer-toolkit/shared/character'
import { prepareCharacterBuilderFromContext } from '@artificer-toolkit/rules-runtime/character/builderPreparation'
import { toCharacterBuilderSpellCatalogRecord } from '@artificer-toolkit/rules-runtime/character/builderCatalog'
import type { prepareCharacterRuleSources } from '@artificer-toolkit/rules-runtime/character/characterRuleSnapshot'
import type { QueryCtx } from '../_generated/server'
import { loadCharacterBuilderContext } from './builderContext'
import { loadCharacterRuleContext, type CharacterReferencedReads } from './context'
import { loadCharacterReferencedContext } from './referencedContext'

/** Load authorized sources for the portable Builder preparation. */
export async function prepareCharacterBuilder(
  ctx: QueryCtx,
  input: {
    character: CharacterAuthored
    current: CharacterAuthored | null
    mode: 'create' | 'edit'
    finalize?: boolean
    catalogScope?: 'resolution' | 'active'
    sourceContext?: Awaited<ReturnType<typeof loadCharacterBuilderContext>>
    sourcePreparation?: ReturnType<typeof prepareCharacterRuleSources>
    authorityScope?: import('../campaigns/authority').CampaignInternalScope
    /** Commit: read only referenced content (ADR 0036 S7), with verified feature hints. */
    referenced?: CharacterReferencedReads
  }
) {
  const candidate = {
    ...input.character,
    state: input.current?.state ?? createEmptyCharacterAuthored(input.character).state
  }
  const reads = input.referenced
  const context: Awaited<ReturnType<typeof loadCharacterBuilderContext>> =
    input.sourceContext ??
    (reads
      ? await loadCharacterReferencedContext(ctx, candidate, candidate.userId, reads)
      : await loadCharacterBuilderContext(
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
      if (reads) {
        // Materialized Equipment joins the referenced catalogue; earlier reads are reused.
        const currentContext = await loadCharacterReferencedContext(
          ctx,
          character,
          character.userId,
          reads
        )
        return {
          ...currentContext,
          sourceIdentities: new Map([
            ...previousContext.sourceIdentities,
            ...currentContext.sourceIdentities
          ])
        }
      }
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
