/**
 * Performance measures the product emits so browser journeys can record client latency under CPU
 * throttling (PERF-6.3). Each is one `performance.measure` per unit of work, cheap enough to ship.
 */
export const CLIENT_PERFORMANCE_MEASURE = {
  /** Decoding and parsing one verified content snapshot object, once per hash per store. */
  CONTENT_SNAPSHOT_PARSE: 'artificer:content-snapshot-parse',
  /** One tabletop redraw, from its scene update to the frame Pixi submits; cleared as it is recorded. */
  VTT_SCENE_RENDER: 'artificer:vtt-scene-render'
} as const
