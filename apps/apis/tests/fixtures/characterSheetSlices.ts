import type {
  CharacterSheetSlice,
  CharacterSheetSliceDtoMap,
  CharacterSheetSliceReadInput
} from '@artificer-toolkit/schema/api/characterSheetSlices'
import { api } from '../../convex/_generated/api.js'
import type { DevelopmentClient } from '../developmentClient'

type UnionToIntersection<Union> = (Union extends unknown ? (value: Union) => void : never) extends (
  value: infer Intersection
) => void
  ? Intersection
  : never

/** The picked parts of one Sheet DTO that the requested slices carry together. */
export type CharacterSheetSlicesData<Slices extends readonly CharacterSheetSlice[]> =
  UnionToIntersection<CharacterSheetSliceDtoMap[Slices[number]]>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Reads the requested Sheet slices concurrently, as the web does, and reassembles them into one
 * partial Sheet. Every slice picks from the same Sheet DTO, so a key several slices share carries
 * the same value in each; the objects they pick from (`meta`, `reference`, `resources`, `spells`)
 * are merged key by key. Returns null when any slice is unavailable to the reader.
 */
export async function readCharacterSheetSlices<const Slices extends readonly CharacterSheetSlice[]>(
  client: DevelopmentClient,
  input: Omit<CharacterSheetSliceReadInput, 'slice'>,
  slices: Slices
): Promise<CharacterSheetSlicesData<Slices> | null> {
  const responses = await Promise.all(
    slices.map((slice) => client.query(api.characters.sheetSlices.get, { ...input, slice }))
  )
  const merged: Record<string, unknown> = {}
  for (const response of responses) {
    if (!response) return null
    for (const [key, value] of Object.entries(response.data)) {
      const existing = merged[key]
      merged[key] = isRecord(existing) && isRecord(value) ? { ...existing, ...value } : value
    }
  }
  return merged as unknown as CharacterSheetSlicesData<Slices>
}
