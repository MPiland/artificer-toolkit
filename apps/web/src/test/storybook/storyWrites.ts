import type { ConvexReactClient, useMutation } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { fn } from 'storybook/test'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  createEncounterInputDtoSchema,
  encounterGmProjectionDtoSchema
} from '@artificer-toolkit/schema/api/encounterData'
import { lootDocumentSchema, saveLootInputSchema } from '@artificer-toolkit/schema/api/lootTables'

/** What `useMutation` accepts, which is also what the client's `mutation` takes. */
type MutationReference = Parameters<typeof useMutation>[0]

/** The story's read client, bound by the preview, for responses that echo a record the deployment holds. */
let storyReads: ConvexReactClient | undefined

export function bindStoryReads(client: ConvexReactClient) {
  storyReads = client
}

/**
 * What a recorded write answers: the response its client parses, built through the real response
 * schema from the recorded input, so the page sees a success and nothing reaches the seeded
 * deployment (D218). A write whose caller ignores the response answers null.
 */
async function writeResponse(reference: MutationReference, input: unknown): Promise<unknown> {
  if (getFunctionName(reference) === getFunctionName(api.loot.tables.save)) {
    const { owner, expectedVersion, tables } = saveLootInputSchema.parse(input)
    return lootDocumentSchema.parse({ owner, version: expectedVersion + 1, tables })
  }
  if (getFunctionName(reference) === getFunctionName(api.encounters.runs.create)) {
    if (!storyReads) throw new Error('A story wrote before its preview bound the read client.')
    const { campaignId, blueprintId } = createEncounterInputDtoSchema.parse(input)
    // The created Run answers as the Campaign's seeded prepared Run: its real projection.
    const runs = await storyReads.query(api.encounters.projectionReads.list, { campaignId })
    const prepared = runs.find(({ status }) => status === 'PREPARED')
    if (!prepared) throw new Error('The story Campaign has no prepared Run to answer a create.')
    const projection = await storyReads.query(api.encounters.projectionReads.get, {
      encounterId: prepared.id
    })
    return encounterGmProjectionDtoSchema.parse({ ...projection, campaignId, blueprintId })
  }
  return null
}

/** Every backend-story write, from `convex.mutation` and from the `useMutation` hook, lands here. */
export const storyMutation = fn(async (reference: MutationReference, input?: unknown) =>
  writeResponse(reference, input)
)

/** A `useMutation` result that records into `storyMutation`. */
export function storyMutationHook(reference: MutationReference): ReturnType<typeof useMutation> {
  const write: ReturnType<typeof useMutation> = Object.assign(
    (input?: unknown) => storyMutation(reference, input),
    { withOptimisticUpdate: () => write }
  )
  return write
}

/** The inputs this story wrote to `reference`, in call order. */
export function writesTo(reference: MutationReference): unknown[] {
  return storyMutation.mock.calls
    .filter(([called]) => getFunctionName(called) === getFunctionName(reference))
    .map(([, input]) => input)
}
