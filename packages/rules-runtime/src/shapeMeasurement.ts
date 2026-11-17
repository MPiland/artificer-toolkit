import {
  shapeDtoSchema,
  shapeMeasurementDtoSchema,
  type ShapeDto
} from '@artificer-toolkit/schema/shared/shape'

import { selectScalingRow } from './scalingRowSelection.js'

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

/**
 * A shape with each measurement scaled by the spell's cast level (Create or Destroy Water's cube, 5
 * feet more per slot level above 1st) at the row `spellCastLevel` reaches, or its authored amount
 * below every row. Any other measurement is as authored.
 */
export function shapeAtSpellCastLevel(shape: ShapeDto, spellCastLevel: number): ShapeDto {
  if (
    !scaledShapeMeasurements(shape).some(
      ({ scalingSource }) => scalingSource === 'SPELL_CAST_LEVEL'
    )
  )
    return shape
  return shapeDtoSchema.parse(
    Object.fromEntries(
      Object.entries(shape).map(([name, value]: [string, unknown]) => {
        const measurement = shapeMeasurementDtoSchema.safeParse(value)
        if (!measurement.success) return [name, value]
        const { scaling, ...authored } = measurement.data
        if (scaling?.scalingSource !== 'SPELL_CAST_LEVEL') return [name, value]
        return [name, selectScalingRow(scaling.breakpoints, spellCastLevel)?.value ?? authored]
      })
    )
  )
}
