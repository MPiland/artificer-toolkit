import type * as Pixi from 'pixi.js'
import type { Container, Graphics } from 'pixi.js'
import type { FacingArcSector, ScenePoint } from '@artificer-toolkit/shared/vtt'
import { facingArcColours, facingArcRadius, facingArcWedge } from './vttSceneRenderer.model'

export const tokenFacingLabel = 'token-facing'
const facingArcLabelPrefix = 'token-facing-arc:'

type TokenSize = { height: number; rotationDegrees: number; width: number }

/** The mark on a token's edge that turns with its facing. */
export function createFacingIndicator(pixi: typeof Pixi, token: TokenSize): Container {
  const facing = new pixi.Container()
  facing.addChild(
    new pixi.Graphics()
      .arc(0, 0, Math.max(token.width, token.height) / 2 + 12, (-3 * Math.PI) / 4, -Math.PI / 4)
      .stroke({ alpha: 0.9, color: 0xffffff, width: 3 })
  )
  facing.addChild(
    new pixi.Graphics()
      .moveTo(0, -token.height / 2 - 10)
      .lineTo(-7, -token.height / 2 + 1)
      .lineTo(7, -token.height / 2 + 1)
      .closePath()
      .fill(0xffffff)
      .stroke({ color: 0x101315, width: 2 })
  )
  facing.label = tokenFacingLabel
  facing.rotation = (token.rotationDegrees * Math.PI) / 180
  return facing
}

/** One wedge per Facing arc, which sits under the token so only the part past its footprint shows. */
export function createFacingArcWedges(
  pixi: typeof Pixi,
  token: TokenSize,
  sectors: readonly FacingArcSector[]
): Graphics[] {
  return sectors.map((sector) => {
    const color = facingArcColours[sector.arc]
    const wedge = new pixi.Graphics()
      .poly(facingArcWedge(sector, facingArcRadius(token)).flatMap(({ x, y }) => [x, y]))
      .fill({ alpha: 0.22, color })
      .stroke({ alpha: 0.8, color, width: 2 })
    wedge.label = `${facingArcLabelPrefix}${sector.arc}`
    return wedge
  })
}

/** The wedges drawn on a token's visual, by arc name, with each one's sampled outline. */
export function facingArcDiagnostics(
  visual: Container,
  outlineOf: (wedge: Container) => ScenePoint[]
): { arc: string; polygon: ScenePoint[] }[] {
  return visual.children
    .filter((child) => child.label?.startsWith(facingArcLabelPrefix))
    .map((wedge) => ({
      arc: wedge.label.slice(facingArcLabelPrefix.length),
      polygon: outlineOf(wedge)
    }))
}
