import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'

/** A drawn overlay: its label, stroked circles and stroke colours. */
interface VttDrawnOverlay {
  circles: { center: ScenePoint; radius: number }[]
  label: string
  strokeColors: number[]
}

/** What the Scene renderer has drawn, read back from its display objects for stories and tests. */
export interface VttSceneRendererDiagnostics {
  /** The in-progress token drag: its path length, where the token is drawn and the route line drawn. */
  activeDrag: { pointCount: number; position: ScenePoint; route: ScenePoint[] } | null
  /** The area drawn under the pointer while an area or a zone is aimed; null otherwise. */
  areaAimOverlay: VttDrawnOverlay | null
  doorVisualCreateCount: number
  /** How many route lines are drawn: one during a token drag, none otherwise. */
  dragRouteLabel: string | null
  dragRouteLineCount: number
  facingIndicatorCount: number
  fogRenderCount: number
  lighting: {
    ambientIllumination: CampaignSceneStateDto['ambientIllumination'] | null
    brightLightCount: number
    /** The zone graphics drawn, by kind: darkening and magical zones in the overlay, cues above it. */
    darknessZones: {
      dim: number
      heavyObscured: number
      lightObscured: number
      magical: number
      ordinary: number
      unspecified: number
    }
    dimLightCount: number
    /** The tint polygons drawn, in order: each one's fill colour, alpha and polygon count. */
    lightTints: { alpha: number; color: number; polygonCount: number; radius: 'bright' | 'dim' }[]
    /** The sight polygons cut out of the vision mask. */
    visionCount: number
    /** The fill alpha of each visual-only darkness zone graphic. */
    visualZoneAlphas: number[]
  }
  loadedMapAssetCount: number
  mapLoadComplete: boolean
  overlayCount: number
  /** The drawn presentation overlays. */
  overlays: VttDrawnOverlay[]
  sceneVersion: number | null
  tokenArtCount: number
  tokenOverflowCount: number
  tokenStatusCount: number
  tokenVisualCount: number
  /** What is drawn per Token: its body footprint, position and rotations (the body stays upright). */
  tokens: {
    /** The colour of the drawn body fill. */
    bodyFillColor: number | null
    /** Whether the current-turn crosshair is drawn, the shape cue that tells it from a reaction halo. */
    crosshairDrawn: boolean
    /** The drawn facing arcs, by arc name, with the sampled outline of each wedge. */
    facingArcs: { arc: string; polygon: ScenePoint[] }[]
    facingRotationDegrees: number | null
    footprint: { height: number; width: number }
    /** Whether the ring that marks the token as pickable while targeting is drawn. */
    targetableDrawn: boolean
    /** The drawn turn or reaction halo. */
    halo: { color: number; label: string } | null
    id: string
    /** The bounds of the drawn inner disposition ring, in the token's own space. */
    innerRing: { height: number; width: number; x: number; y: number }
    /** The bounds of the drawn outer status ring, in the token's own space. */
    outerRing: { height: number; width: number; x: number; y: number }
    position: ScenePoint
    /** The colour of the drawn inner ring. */
    ringColor: number | null
    rotationDegrees: number
    /** The drawn selection outline: its colour and how many dashes it is made of. */
    selection: { color: number; dashSegmentCount: number } | null
    /** The drawn outer-ring segments in order; the overflow segment is the hollow one. */
    statusSegments: { color: number; overflow: boolean }[]
    /** False while darkness conceals the token from the view token's senses. */
    visible: boolean
  }[]
  transientVisualCount: number
  zoomScale: number
}
