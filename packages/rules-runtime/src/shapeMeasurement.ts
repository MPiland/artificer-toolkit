/** A shape measurement, authored or compiled: an amount that may scale by breakpoints. */
type ShapeMeasurement = { amount: number; scaling?: { scalingSource: string } }

/**
 * The measurement that sizes a shape: a cube's edge, a cone, line or wall's length, or a sphere,
 * cylinder or circle's radius. Null for a shape no one measurement sizes (a dome).
 */
export function shapeExtent<M extends ShapeMeasurement>(shape: {
  shapeKind: string
  edgeLength?: M
  length?: M
  radius?: M
}): M | null {
  switch (shape.shapeKind) {
    case 'CUBE':
      return shape.edgeLength ?? null
    case 'CONE':
    case 'LINE':
    case 'WALL':
      return shape.length ?? null
    case 'SPHERE':
    case 'CYLINDER':
    case 'CIRCLE':
      return shape.radius ?? null
    default:
      return null
  }
}

/** Each measurement of a shape that scales, by its name and the source it scales by. */
export function scaledShapeMeasurements(
  shape: object
): { measurement: string; scalingSource: string }[] {
  return Object.entries(shape).flatMap(([measurement, value]: [string, unknown]) =>
    typeof value === 'object' &&
    value !== null &&
    'scaling' in value &&
    typeof value.scaling === 'object' &&
    value.scaling !== null &&
    'scalingSource' in value.scaling &&
    typeof value.scaling.scalingSource === 'string'
      ? [{ measurement, scalingSource: value.scaling.scalingSource }]
      : []
  )
}
