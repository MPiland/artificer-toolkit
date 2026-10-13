/** A new Feet or Meters grid starts at 5 units per cell; a Squares cell is always 1. */
export const DEFAULT_DISTANCE_PER_CELL = 5

export const acceptedMapTypes = ['image/jpeg', 'image/png', 'image/webp'] as const
type AcceptedMapType = (typeof acceptedMapTypes)[number]

export function acceptedMapType(value: string): AcceptedMapType | null {
  return acceptedMapTypes.find((candidate) => candidate === value) ?? null
}

export function validateMapFile(file: File | null): string | null {
  if (!file) return null
  if (!acceptedMapType(file.type)) return 'Maps must be JPEG, PNG, or WebP images.'
  if (file.size > 25 * 1024 * 1024) return 'Maps must be 25 MiB or smaller.'
  return null
}

export function asNumber(value: number | string, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function asPositiveNumber(value: number | string, fallback: number): number {
  const parsed = asNumber(value, fallback)
  return parsed > 0 ? parsed : fallback
}
