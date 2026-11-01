import { useMemo } from 'react'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import {
  authoredLengthInSceneCoordinates,
  directedAreaSizeInSceneCoordinates,
  pointAreaInSceneCoordinates,
  type SpatialWallSide,
  spatialTokensInsideArea,
  wallAreaBoundsInSceneCoordinates
} from '@artificer-toolkit/shared/vtt'
import { summonPicks } from '#app/components/summonPicks/summonPicks.model'
import { aimedAreaShape, type VttAreaAim, type VttAreaSize } from './vttSceneRenderer.model'

type CommandTarget = ResolveEncounterActionInputDto['target']
type WallOrRingArea = Parameters<typeof wallAreaBoundsInSceneCoordinates>[0]
type SideBand = { distance: Parameters<typeof authoredLengthInSceneCoordinates>[0] }

/** An area the caster aims by placing an origin: a point area or a directed one. */
type AimedAreaTarget =
  | { kind: 'POINT'; area: Parameters<typeof pointAreaInSceneCoordinates>[0] }
  | { kind: 'DIRECTED'; area: Parameters<typeof directedAreaSizeInSceneCoordinates>[0] }

/** A wall or ring the caster draws on the map, optionally with a band beside it (D154). */
type DrawnAreaTarget =
  | {
      kind: 'WALL'
      area: Omit<Extract<WallOrRingArea, { kind: 'WALL' }>, 'kind'>
      sideBand?: SideBand
    }
  | {
      kind: 'RING'
      area: Omit<Extract<WallOrRingArea, { kind: 'RING' }>, 'kind'>
      sideBand?: SideBand
    }

/** What the caster's aim picks up on the Scene: the area's measure, who it catches, and the target it sends. */
export function useAimedArea({
  scene,
  sceneTokens,
  sourceTokenId,
  areaAim,
  areaTarget,
  drawnTarget,
  bandSide,
  needsBandSide,
  zoneChoices,
  sparedChoice,
  summonChoices
}: {
  scene: CampaignSceneStateDto | null
  sceneTokens: CampaignSceneStateDto['tokens']
  sourceTokenId: string | null
  areaAim: VttAreaAim | null
  areaTarget: AimedAreaTarget | null
  drawnTarget: DrawnAreaTarget | null
  bandSide: SpatialWallSide | null
  needsBandSide: boolean
  zoneChoices: { choiceOptionId?: string; unaffectedActorIds?: string[] }
  sparedChoice: { unaffectedActorIds?: string[] }
  summonChoices: ReturnType<typeof summonPicks>
}) {
  const sceneGrid = scene?.grid ?? null
  // A directed area starts on the caster's own token, so it cannot be drawn without one.
  const areaSize = useMemo<VttAreaSize | null>(() => {
    console.log('AIMDBG size', JSON.stringify({ sceneGrid, areaTarget, sourceTokenId, drawnTarget }))
    if (!sceneGrid) return null
    if (drawnTarget) {
      const bounds = wallAreaBoundsInSceneCoordinates(
        drawnTarget.kind === 'WALL'
          ? { kind: 'WALL', ...drawnTarget.area }
          : { kind: 'RING', ...drawnTarget.area },
        sceneGrid
      )
      const bandDistance =
        drawnTarget.sideBand &&
        authoredLengthInSceneCoordinates(drawnTarget.sideBand.distance, sceneGrid)
      if (!bounds || bandDistance === null) return null
      return {
        kind: drawnTarget.kind,
        ...bounds,
        ...(bandDistance && bandSide ? { band: { distance: bandDistance, side: bandSide } } : {})
      }
    }
    if (!areaTarget) return null
    if (areaTarget.kind === 'POINT') return pointAreaInSceneCoordinates(areaTarget.area, sceneGrid)
    return sourceTokenId ? directedAreaSizeInSceneCoordinates(areaTarget.area, sceneGrid) : null
  }, [areaTarget, bandSide, drawnTarget, sceneGrid, sourceTokenId])
  const tokensInArea = useMemo(() => {
    const shape = areaSize && areaAim ? aimedAreaShape(areaSize, areaAim) : null
    if (!areaAim || !shape) return []
    const caught = spatialTokensInsideArea({
      origin: areaAim.origin,
      shape,
      tokens: sceneTokens,
      casterTokenId: sourceTokenId
    })
    const inside = new Set(caught)
    return sceneTokens.filter((token) => inside.has(token.id)).map((token) => token.label)
  }, [areaAim, areaSize, sceneTokens, sourceTokenId])
  const drawnShape = drawnTarget && areaSize && areaAim ? aimedAreaShape(areaSize, areaAim) : null
  const drawnCommandTarget: CommandTarget | null =
    !scene || !areaAim || !drawnShape || (needsBandSide && !bandSide)
      ? null
      : drawnShape.kind === 'WALL'
        ? {
            kind: 'WALL',
            sceneId: scene.id,
            expectedSceneVersion: scene.version,
            from: areaAim.origin,
            to: drawnShape.to,
            ...(bandSide === 'LEFT' || bandSide === 'RIGHT' ? { side: bandSide } : {}),
            ...zoneChoices
          }
        : drawnShape.kind === 'RING'
          ? {
              kind: 'RING',
              sceneId: scene.id,
              expectedSceneVersion: scene.version,
              center: areaAim.origin,
              outerRadius: drawnShape.outerRadius,
              ...(bandSide === 'INSIDE' || bandSide === 'OUTSIDE' ? { side: bandSide } : {}),
              ...zoneChoices
            }
          : null
  const areaCommandTarget: CommandTarget | null =
    !areaTarget || !scene || !areaAim || !areaSize
      ? null
      : areaTarget.kind === 'POINT'
        ? {
            kind: 'POINT',
            sceneId: scene.id,
            expectedSceneVersion: scene.version,
            point: areaAim.origin,
            ...zoneChoices,
            ...summonChoices
          }
        : areaAim.toward
          ? {
              kind: 'DIRECTED',
              sceneId: scene.id,
              expectedSceneVersion: scene.version,
              origin: areaAim.origin,
              toward: areaAim.toward,
              ...sparedChoice
            }
          : null
  return { areaSize, tokensInArea, drawnCommandTarget, areaCommandTarget }
}
