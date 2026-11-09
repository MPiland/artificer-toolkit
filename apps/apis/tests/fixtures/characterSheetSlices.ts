import { makeFunctionReference } from 'convex/server'
import type {
  CharacterSheetSlice,
  CharacterSheetSliceDtoMap,
  CharacterSheetSliceReadInput
} from '@artificer-toolkit/schema/api/characterSheetSlices'
import { api } from '../../convex/_generated/api.js'
import type { DevelopmentClient } from '../developmentClient'
import { awaitInternalQuery } from './internalQueryWait'

// Internal fixture query (`characters/development.ts`), reached with the local admin key.
const sheetSectionsState = makeFunctionReference<
  'query',
  { characterId: string },
  'CURRENT' | 'NO_SHEET' | 'QUEUED' | 'MISSING' | 'FAILED'
>('characters/development:sheetSectionsState')

/**
 * Waits until a Character's stored Sheet sections are current, so slice reads after a write serve
 * stored sections as a settled Sheet does instead of all deriving the fallback at once (D214).
 * Sections that are stale with no store queued, or whose queued store failed, fail the proof. A
 * fixture that seeds content directly in-process queues no store, so a MISSING Sheet there derives
 * live.
 */
export function awaitCurrentCharacterSheet(characterId: string, client?: DevelopmentClient) {
  return awaitInternalQuery({
    query: sheetSectionsState,
    args: { characterId },
    label: `Character ${characterId} Sheet store`,
    client,
    judge: (state, native) => {
      if (state === 'FAILED' || (native && state === 'MISSING'))
        return new Error(
          `Character ${characterId} Sheet sections are stale: ${
            state === 'MISSING' ? 'no store is queued' : 'its queued store failed'
          }.`
        )
      return state === 'QUEUED' ? 'WAITING' : 'SETTLED'
    }
  })
}

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
 * are merged key by key. Waits for current stored sections first. Returns null when any slice is
 * unavailable to the reader.
 */
export async function readCharacterSheetSlices<const Slices extends readonly CharacterSheetSlice[]>(
  client: DevelopmentClient,
  input: Omit<CharacterSheetSliceReadInput, 'slice'>,
  slices: Slices
): Promise<CharacterSheetSlicesData<Slices> | null> {
  await awaitCurrentCharacterSheet(input.id, client)
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
