import type * as Pixi from 'pixi.js'
import type { Graphics } from 'pixi.js'
import type { SceneIlluminationLevel, ScenePoint } from '@artificer-toolkit/shared/vtt'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import { dashedPolygonSegments, darknessZoneStyle } from './vttSceneRenderer.model'

export const darknessZoneLabelPrefix = 'darkness-zone:'
export const obscurementLabelPrefix = 'obscurement:'

/** A dashed closed outline, drawn as one round-capped stroke. */
export function dashedOutline(
  pixi: typeof Pixi,
  points: readonly ScenePoint[],
  dash: number,
  gap: number,
  stroke: { color: number; width: number }
): Graphics {
  const outline = new pixi.Graphics()
  for (const [from, to] of dashedPolygonSegments(points, dash, gap)) {
    outline.moveTo(from.x, from.y).lineTo(to.x, to.y)
  }
  return outline.stroke({ ...stroke, cap: 'round' })
}

/** What a darkness zone shows beyond its class: a visual-only fill, and non-colour outlines. */
export function darknessZoneCues(
  pixi: typeof Pixi,
  zone: CampaignSceneStateDto['darknessZones'][number],
  illuminationLevels: readonly SceneIlluminationLevel[],
  colors: { arcane: number; barrier: number; darkness: number }
): Graphics[] {
  const { illuminationOutline, obscurementOutline } = darknessZoneStyle(zone, illuminationLevels)
  const points = zone.polygon.points
  const cues: Graphics[] = []
  if (zone.mechanicalIllumination === null) {
    const fill = new pixi.Graphics()
      .poly(points.flatMap((point) => [point.x, point.y]))
      .fill({ alpha: zone.opacity, color: colors.darkness })
    fill.label = `${darknessZoneLabelPrefix}VISUAL`
    cues.push(fill)
  }
  if (obscurementOutline) {
    const outline =
      obscurementOutline.dash === null
        ? new pixi.Graphics()
            .poly(points.flatMap((point) => [point.x, point.y]))
            .stroke({ color: colors.barrier, width: obscurementOutline.width })
        : dashedOutline(pixi, points, obscurementOutline.dash, obscurementOutline.gap, {
            color: colors.barrier,
            width: obscurementOutline.width
          })
    outline.label = `${obscurementLabelPrefix}${zone.mechanicalObscurement}`
    cues.push(outline)
  }
  if (illuminationOutline) {
    cues.push(
      dashedOutline(pixi, points, illuminationOutline.dash, illuminationOutline.gap, {
        color: colors.arcane,
        width: illuminationOutline.width
      })
    )
  }
  return cues
}
