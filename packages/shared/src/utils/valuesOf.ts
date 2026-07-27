export const valuesOf = <T extends Record<PropertyKey, unknown>>(o: T) =>
  Object.values(o) as ReadonlyArray<T[keyof T]>
