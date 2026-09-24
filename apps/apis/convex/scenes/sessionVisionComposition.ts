import type {
  SceneSessionVisionComposition,
  SceneSessionVisionScope,
  SceneSessionCharacterVisionInput
} from '@artificer-toolkit/schema/api/sceneSessionVision'
import {
  sceneSessionCharacterVisionResultSchema,
  sceneSessionVisionBindingsPageSchema,
  sceneSessionVisionCompositionSchema,
  sceneSessionVisionRunsPageSchema
} from '@artificer-toolkit/schema/api/sceneSessionVision'
import type { SceneToken } from '@artificer-toolkit/shared/vtt/scene'
import { internal } from '../_generated/api'
import type { ActionCtx } from '../_generated/server'

const pageSize = 4

export async function loadSceneSessionVision(
  ctx: Pick<ActionCtx, 'runQuery'>,
  scope: SceneSessionVisionScope,
  tokens: readonly SceneToken[]
): Promise<SceneSessionVisionComposition> {
  const selectedTokenIds = new Set(tokens.filter((token) => !token.vision).map((token) => token.id))
  if (selectedTokenIds.size === 0)
    return sceneSessionVisionCompositionSchema.parse({
      context: { encounterCharacterBindings: [], characterVisions: [] },
      characterRevisions: []
    })

  const bindingsByTokenId = new Map<string, SceneSessionCharacterVisionInput>()
  let runCursor: string | null = null
  do {
    const page = sceneSessionVisionRunsPageSchema.parse(
      await ctx.runQuery(internal.scenes.sessionVision.runs, {
        ...scope,
        paginationOpts: { cursor: runCursor, numItems: pageSize }
      })
    )
    if (page.pageStatus === 'SplitRequired')
      throw new Error('Scene vision Encounter pages require a smaller split.')

    for (const run of page.page) {
      let bindingCursor: string | null = null
      do {
        const bindingPage = sceneSessionVisionBindingsPageSchema.parse(
          await ctx.runQuery(internal.scenes.sessionVision.bindings, {
            ...run,
            paginationOpts: { cursor: bindingCursor, numItems: pageSize }
          })
        )
        if (bindingPage.pageStatus === 'SplitRequired')
          throw new Error('Scene vision actor binding pages require a smaller split.')
        for (const binding of bindingPage.page) {
          if (!selectedTokenIds.has(binding.tokenId)) continue
          const existing = bindingsByTokenId.get(binding.tokenId)
          if (!existing || binding.encounterId.localeCompare(existing.encounterId) >= 0)
            bindingsByTokenId.set(binding.tokenId, binding)
        }
        if (!bindingPage.isDone && bindingPage.continueCursor === bindingCursor)
          throw new Error('Scene vision actor binding pagination did not advance.')
        bindingCursor = bindingPage.isDone ? null : bindingPage.continueCursor
      } while (bindingCursor !== null)
    }

    if (!page.isDone && page.continueCursor === runCursor)
      throw new Error('Scene vision Encounter pagination did not advance.')
    runCursor = page.isDone ? null : page.continueCursor
  } while (runCursor !== null)

  const selectedBindings = tokens
    .filter((token) => selectedTokenIds.has(token.id))
    .map((token) => bindingsByTokenId.get(token.id))
    .filter((binding): binding is SceneSessionCharacterVisionInput => binding !== undefined)
  const characterResults = new Map<
    string,
    ReturnType<typeof sceneSessionCharacterVisionResultSchema.parse>
  >()
  for (const binding of selectedBindings) {
    if (characterResults.has(binding.characterId)) continue
    characterResults.set(
      binding.characterId,
      sceneSessionCharacterVisionResultSchema.parse(
        await ctx.runQuery(internal.scenes.sessionVision.character, binding)
      )
    )
  }

  return sceneSessionVisionCompositionSchema.parse({
    context: {
      encounterCharacterBindings: selectedBindings.map(
        ({ encounterId, actorId, characterId, tokenId }) => ({
          encounterId,
          actorId,
          characterId,
          tokenId
        })
      ),
      characterVisions: [...characterResults.values()].map(({ characterVision }) => characterVision)
    },
    characterRevisions: [...characterResults.values()].map(({ binding, characterRevision }) => ({
      characterId: binding.characterId,
      revision: characterRevision
    }))
  })
}
