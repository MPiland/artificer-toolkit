import { ConvexClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'
import type {
  CharacterSheetSlice,
  CharacterSheetSliceDtoMap,
  CharacterSheetSliceReadInput
} from '@artificer-toolkit/schema/api/characterSheetSlices'
import { api } from '../../convex/_generated/api.js'
import type { DevelopmentClient } from '../developmentClient'
import { developmentTarget } from '../developmentTarget'

// Internal fixture query (`characters/development.ts`), reached with the local admin key.
const sheetSectionsState = makeFunctionReference<
  'query',
  { characterId: string },
  'CURRENT' | 'NO_SHEET' | 'QUEUED' | 'MISSING' | 'FAILED'
>('characters/development:sheetSectionsState')

/**
 * Subscribes until a Character's stored Sheet sections are current, so slice reads after a write
 * serve stored sections as a settled Sheet does instead of all deriving the fallback at once (D214).
 * Sections that are stale with no store queued, or whose queued store failed, fail the proof. The
 * in-process convex-test client runs no scheduled store, so only the self-hosted backend waits.
 */
async function awaitCurrentCharacterSheet(characterId: string) {
  const url = process.env.CONVEX_SELF_HOSTED_URL
  const adminKey = process.env.CONVEX_SELF_HOSTED_ADMIN_KEY
  if (!url && !adminKey) return
  const target = developmentTarget(process.env)
  if (target.mode !== 'local' || url !== target.deploymentUrl.origin || !adminKey)
    throw new Error('Sheet section waits require the selected local backend and key.')
  const subscriber = new ConvexClient(url, { logger: false })
  try {
    // Convex exposes admin auth on the socket client at runtime but strips it from public types.
    const socket: unknown = Reflect.get(subscriber, 'client')
    const setAdminAuth: unknown =
      typeof socket === 'object' && socket !== null ? Reflect.get(socket, 'setAdminAuth') : null
    if (typeof setAdminAuth !== 'function') throw new Error('Native admin socket is unavailable.')
    setAdminAuth.call(socket, adminKey)
    // Closing the client ends the subscription once the state settles.
    await new Promise<void>((resolve, reject) => {
      subscriber.onUpdate(
        sheetSectionsState,
        { characterId },
        (state) => {
          if (state === 'CURRENT' || state === 'NO_SHEET') resolve()
          else if (state !== 'QUEUED')
            reject(
              new Error(
                `Character ${characterId} Sheet sections are stale: ${
                  state === 'MISSING' ? 'no store is queued' : 'its queued store failed'
                }.`
              )
            )
        },
        reject
      )
    })
  } finally {
    await subscriber.close()
  }
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
 * are merged key by key. Returns null when any slice is unavailable to the reader.
 */
export async function readCharacterSheetSlices<const Slices extends readonly CharacterSheetSlice[]>(
  client: DevelopmentClient,
  input: Omit<CharacterSheetSliceReadInput, 'slice'>,
  slices: Slices
): Promise<CharacterSheetSlicesData<Slices> | null> {
  await awaitCurrentCharacterSheet(input.id)
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
