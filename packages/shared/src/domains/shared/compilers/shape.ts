import type { ShapeKind, ShapePayloadByType } from '#core'

export type CompiledShape = {
  [K in ShapeKind]: {
    shapeKind: K
  } & ShapePayloadByType[K]
}[ShapeKind]
