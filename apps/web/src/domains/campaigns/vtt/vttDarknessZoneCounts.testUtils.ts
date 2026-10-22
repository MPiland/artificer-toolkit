import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'

type SceneDarknessZone = CampaignSceneStateDto['darknessZones'][number]

interface VttDarknessZoneCounts {
  dim: number
  heavyObscured: number
  lightObscured: number
  magical: number
  ordinary: number
  unspecified: number
}

/** Counts zones by illumination and obscurement; a zone without illumination is "unspecified". */
export function countDarknessZones(
  zones: readonly Pick<SceneDarknessZone, 'mechanicalIllumination' | 'mechanicalObscurement'>[]
): VttDarknessZoneCounts {
  const count = (predicate: (zone: (typeof zones)[number]) => boolean) =>
    zones.filter(predicate).length
  return {
    dim: count((zone) => zone.mechanicalIllumination === 'DIM'),
    heavyObscured: count((zone) => zone.mechanicalObscurement === 'HEAVY'),
    lightObscured: count((zone) => zone.mechanicalObscurement === 'LIGHT'),
    magical: count((zone) => zone.mechanicalIllumination === 'MAGICAL_DARKNESS'),
    ordinary: count((zone) => zone.mechanicalIllumination === 'ORDINARY_DARKNESS'),
    unspecified: count((zone) => zone.mechanicalIllumination === null)
  }
}
