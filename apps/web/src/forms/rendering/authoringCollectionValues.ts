import { isRecord } from '../utils/valueGuards'

/** Copies a complete authored subtree while replacing every nested identity. */

export function cloneAuthoringGroupValue(value: unknown, rootOrder: number): unknown {
  return cloneValue(value, rootOrder, true)
}

function cloneValue(value: unknown, rootOrder: number, isRoot: boolean): unknown {
  if (Array.isArray(value)) return value.map((item) => cloneValue(item, rootOrder, false))
  if (!isRecord(value)) return value

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (key === 'id') return [key, crypto.randomUUID()]
      if (isRoot && key === 'order') return [key, rootOrder]
      return [key, cloneValue(item, rootOrder, false)]
    })
  )
}
