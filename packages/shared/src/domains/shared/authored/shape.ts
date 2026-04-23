import {
  type ShapePayloadByType,
  type ShapeKind
} from '#core'

export type ShapeAuthored = {
  [K in ShapeKind]: {
    id: string
    shapeKind: K
  } & ShapePayloadByType[K]
}[ShapeKind]
