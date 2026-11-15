import type { QueryClient } from '@tanstack/react-query'
import type { useMutation } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { fn } from 'storybook/test'
import { api } from '@artificer-toolkit/apis/convex/api'
import { definitionReferences } from '@artificer-toolkit/apis/convex/definition-references'
import {
  getReusableDefinitionInputDtoSchema,
  reusableDefinitionWorkspaceDtoSchema
} from '@artificer-toolkit/schema/api/reusableDefinitions'
import { lootDocumentSchema, saveLootInputSchema } from '@artificer-toolkit/schema/api/lootTables'
import { getSystemDefinition } from '#app/data/systems/queries'

/** What `useMutation` accepts, which is also what the client's `mutation` takes. */
type MutationReference = Parameters<typeof useMutation>[0]

/** The query client of the story that is running, which a write answers from. */
let storyQueryClient: QueryClient | null = null

/** Points the write spy at the running story's query client. The preview sets it before each story. */
export function bindStoryQueryClient(queryClient: QueryClient) {
  storyQueryClient = queryClient
}

function boundStoryQueryClient(): QueryClient {
  if (!storyQueryClient) throw new Error('The write spy is not bound to a story query client.')
  return storyQueryClient
}

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
  if (
    getFunctionName(reference) === getFunctionName(definitionReferences.saveDraft) ||
    getFunctionName(reference) === getFunctionName(definitionReferences.publish)
  ) {
    // Nothing was written, so the answer is the definition as the page loaded it.
    const { definitionId } = getReusableDefinitionInputDtoSchema.parse(input)
    return reusableDefinitionWorkspaceDtoSchema.parse(
      boundStoryQueryClient().getQueryData(getSystemDefinition(definitionId).queryKey)
    )
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
