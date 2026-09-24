import { orient2d } from 'robust-predicates'

import type { ScenePoint } from './scene.js'

const EPSILON = 1e-9

function pointOnSegment(point: ScenePoint, a: ScenePoint, b: ScenePoint): boolean {
  return (
    point.x >= Math.min(a.x, b.x) - EPSILON &&
    point.x <= Math.max(a.x, b.x) + EPSILON &&
    point.y >= Math.min(a.y, b.y) - EPSILON &&
    point.y <= Math.max(a.y, b.y) + EPSILON
  )
}

export function segmentsIntersect(
  a: ScenePoint,
  b: ScenePoint,
  c: ScenePoint,
  d: ScenePoint
): boolean {
  const abC = orient2d(a.x, a.y, b.x, b.y, c.x, c.y)
  const abD = orient2d(a.x, a.y, b.x, b.y, d.x, d.y)
  const cdA = orient2d(c.x, c.y, d.x, d.y, a.x, a.y)
  const cdB = orient2d(c.x, c.y, d.x, d.y, b.x, b.y)
  if (abC === 0 && pointOnSegment(c, a, b)) return true
  if (abD === 0 && pointOnSegment(d, a, b)) return true
  if (cdA === 0 && pointOnSegment(a, c, d)) return true
  if (cdB === 0 && pointOnSegment(b, c, d)) return true
  return Math.sign(abC) !== Math.sign(abD) && Math.sign(cdA) !== Math.sign(cdB)
}
