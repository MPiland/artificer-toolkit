import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useConvex } from 'convex/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type {
  EncounterGmProjectionDto,
  EncounterPlayerProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import type { ImageLookupInput } from '@artificer-toolkit/schema/api/media'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'

/** Thumbnail URLs by token id for the Encounter's Character portraits and Creature art. */
export function useVttTokenArtUrls({
  actorIdByTokenId,
  campaignId,
  encounter,
  scene
}: {
  actorIdByTokenId: ReadonlyMap<string, string>
  campaignId: string
  encounter: EncounterGmProjectionDto | EncounterPlayerProjectionDto | null | undefined
  scene: Pick<CampaignSceneStateDto, 'tokens'> | null | undefined
}): Record<string, string> {
  const convex = useConvex()
  const actors = encounter?.actors
  const tokens = scene?.tokens
  const lookups = useMemo(() => {
    const actorsById = new Map((actors ?? []).map((actor) => [actor.id, actor] as const))
    return (tokens ?? []).flatMap((token) => {
      const actorId = actorIdByTokenId.get(token.id)
      const actor = actorId === undefined ? undefined : actorsById.get(actorId)
      if (!actor?.sourceId || (actor.kind !== 'CHARACTER' && actor.kind !== 'CREATURE')) return []
      const target: ImageLookupInput['target'] =
        actor.kind === 'CHARACTER'
          ? { campaignId, characterId: actor.sourceId, type: 'CHARACTER_PORTRAIT' }
          : {
              scope: 'ACTIVE',
              subjectId: actor.sourceId,
              subjectKind: 'CREATURE',
              type: 'AUTHORED_IMAGE'
            }
      return [{ target, tokenAssetId: token.assetId, tokenId: token.id }]
    })
  }, [actors, actorIdByTokenId, campaignId, tokens])
  return useQueries({
    queries: lookups.map((lookup) => ({
      queryFn: () =>
        lookup.target.type === 'CHARACTER_PORTRAIT'
          ? convex.action(convexApi.media.characterPortraitActions.getImage, {
              target: lookup.target,
              variantKind: 'THUMBNAIL'
            })
          : convex.action(convexApi.media.authoredActions.getImage, {
              target: lookup.target,
              variantKind: 'THUMBNAIL'
            }),
      queryKey: ['media', lookup.target, 'THUMBNAIL'] as const,
      refetchOnReconnect: 'always' as const,
      refetchOnWindowFocus: false,
      staleTime: 4 * 60_000
    })),
    combine: (results) =>
      Object.fromEntries(
        lookups.flatMap((lookup, index) => {
          const image = results[index]?.data
          return image && (!lookup.tokenAssetId || lookup.tokenAssetId === image.assetId)
            ? [[lookup.tokenId, image.url]]
            : []
        })
      )
  })
}
