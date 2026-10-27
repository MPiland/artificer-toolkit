import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type { VttTokenPresentation } from './vttSceneRenderer.model'
import { buildVttTokenPresentations } from './vttTokenPresentation.model'
import { targetableTokenIds, type VttTargetEntry } from './vttTargeting.model'

type Input = Parameters<typeof buildVttTokenPresentations>[0]

/**
 * The tokens' presentations. Actor conditions arrive as type IDs, so the Campaign's System
 * vocabulary names them, and its cover tiers label the GM's cover choice; tokens show neither
 * until it loads.
 */
export function useVttTokenPresentations({
  actorIdByTokenId,
  artUrls,
  boundTokenControl,
  currentUserId,
  encounter,
  gameSystemId,
  lootActorIds,
  pending,
  scene,
  selectedTokenId,
  targetEntries
}: Omit<Input, 'encounter' | 'scene' | 'conditionTypes' | 'coverTiers' | 'targetableTokenIds'> & {
  encounter: Input['encounter'] | undefined
  gameSystemId: string
  scene: Input['scene'] | null | undefined
  targetEntries: readonly VttTargetEntry[] | null | undefined
}): Record<string, VttTokenPresentation> | undefined {
  const conditionTypes = useQuery({
    ...convexQuery(convexApi.content.systems.get, { id: gameSystemId }),
    select: (system) => system?.conditionTypes
  }).data
  const coverTiers = useQuery({
    ...convexQuery(convexApi.content.systems.get, { id: gameSystemId }),
    select: (system) => system?.cover?.tiers
  }).data
  return useMemo(
    () =>
      scene && encounter
        ? buildVttTokenPresentations({
            actorIdByTokenId,
            artUrls,
            boundTokenControl,
            conditionTypes,
            coverTiers,
            currentUserId,
            encounter,
            lootActorIds,
            pending,
            scene,
            selectedTokenId,
            targetableTokenIds: targetEntries ? targetableTokenIds(targetEntries) : undefined
          })
        : undefined,
    [
      actorIdByTokenId,
      artUrls,
      boundTokenControl,
      conditionTypes,
      coverTiers,
      currentUserId,
      encounter,
      lootActorIds,
      pending,
      scene,
      selectedTokenId,
      targetEntries
    ]
  )
}
