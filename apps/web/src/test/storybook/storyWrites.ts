import type { useMutation } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { fn } from 'storybook/test'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  createEncounterInputDtoSchema,
  encounterGmProjectionDtoSchema
} from '@artificer-toolkit/schema/api/encounterData'
import { lootDocumentSchema, saveLootInputSchema } from '@artificer-toolkit/schema/api/lootTables'
import { tabletopGmEncounter } from '#domains/campaigns/vtt/CampaignTabletop.stories.fixtures'

/** What `useMutation` accepts, which is also what the client's `mutation` takes. */
type MutationReference = Parameters<typeof useMutation>[0]

/**
 * What a recorded write answers: the response its client parses, built through the real response
 * schema from the recorded input, so the page sees a success and nothing reaches the seeded
 * deployment (D218). A write whose caller ignores the response answers null.
 */
function writeResponse(reference: MutationReference, input: unknown): unknown {
  if (getFunctionName(reference) === getFunctionName(api.loot.tables.save)) {
    const { owner, expectedVersion, tables } = saveLootInputSchema.parse(input)
    return lootDocumentSchema.parse({ owner, version: expectedVersion + 1, tables })
  }
  if (getFunctionName(reference) === getFunctionName(api.encounters.runs.create)) {
    const { campaignId, blueprintId } = createEncounterInputDtoSchema.parse(input)
    return encounterGmProjectionDtoSchema.parse({
      ...tabletopGmEncounter,
      id: crypto.randomUUID(),
      campaignId,
      blueprintId,
      status: 'PREPARED',
      currentActorId: null,
      round: 1,
      version: 1
    })
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
