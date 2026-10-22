export function isObjectValue(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** The option equal to an untrusted value (select value, URL param, storage), or undefined. */
export function findOption<const TOption extends string | number>(
  options: readonly TOption[],
  value: unknown
): TOption | undefined {
  return options.find((option) => option === value)
}

/** The options contained in a list of untrusted values (multi-select values). */
export function filterOptions<const TOption extends string | number>(
  options: readonly TOption[],
  values: readonly unknown[]
): TOption[] {
  return options.filter((option) => values.includes(option))
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return isObjectValue(value) && !Array.isArray(value)
}
