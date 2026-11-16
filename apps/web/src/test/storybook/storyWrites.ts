import type { QueryClient } from '@tanstack/react-query'
import type { ConvexReactClient, useMutation } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { z } from 'zod'
import { fn } from 'storybook/test'
import { api } from '@artificer-toolkit/apis/convex/api'
import { definitionReferences } from '@artificer-toolkit/apis/convex/definition-references'
import {
  getReusableDefinitionInputDtoSchema,
  reusableDefinitionWorkspaceDtoSchema
} from '@artificer-toolkit/schema/api/reusableDefinitions'
import { lootDocumentSchema, saveLootInputSchema } from '@artificer-toolkit/schema/api/lootTables'
import { executeRollInputDtoSchema, rollRecordDtoSchema } from '@artificer-toolkit/schema/api/rolls'
import { evaluateRollExpression, parseRollExpression } from '@artificer-toolkit/shared/rolls'
import {
  socialEligibilityDtoSchema,
  socialListingDtoSchema,
  socialListingVersionInputSchema,
  updateSocialContentPreferenceInputSchema,
  updateSocialListingInputSchema
} from '@artificer-toolkit/schema/api/socialHub'
import { getSystemDefinition } from '#app/data/systems/queries'

/** What `useMutation` accepts, which is also what the client's `mutation` takes. */
type MutationReference = Parameters<typeof useMutation>[0]

/** Every die lands in the middle of its faces, so a spied roll is the same on every run. */
const middleOfEachDie = { nextInt: (maxExclusive: number) => Math.floor(maxExclusive / 2) }

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
 * The story's own read client, for a write whose caller parses a stored record: that write answers
 * with the record as the deployment holds it. The preview binds it for each story.
 */
let storyReads: Pick<ConvexReactClient, 'query'> | undefined

export function bindStoryReads(client: Pick<ConvexReactClient, 'query'>) {
  storyReads = client
}

/** The Social listing a listing write targets, exactly as `getOwned` returns it. */
async function readOwnedListing(listingPublicId: string) {
  if (!storyReads) throw new Error('A story write ran before its read client was bound.')
  return socialListingDtoSchema.parse(
    await storyReads.query(api.social.listings.getOwned, { listingPublicId })
  )
}

/**
 * What a recorded write answers: the response its client parses, built through the real response
 * schema from the recorded input, so the page sees a success and nothing reaches the seeded
 * deployment (D218). A roll is the record the roller presents, evaluated by the product's roll
 * expression with fixed dice. A write whose caller ignores the response answers null.
 */
async function writeResponse(reference: MutationReference, input: unknown): Promise<unknown> {
  const name = getFunctionName(reference)
  // A story ends at its write (D218): each listing write answers with the listing as read, which
  // is all the editor needs (its id). The state after the write is a seeded variant, not simulated.
  if (name === getFunctionName(api.social.listings.update))
    return readOwnedListing(
      z.object({ input: updateSocialListingInputSchema }).parse(input).input.listingPublicId
    )
  if (
    name === getFunctionName(api.social.listings.open) ||
    name === getFunctionName(api.social.listings.close)
  )
    return readOwnedListing(socialListingVersionInputSchema.parse(input).listingPublicId)
  if (name === getFunctionName(api.loot.tables.save)) {
    const { owner, expectedVersion, tables } = saveLootInputSchema.parse(input)
    return lootDocumentSchema.parse({ owner, version: expectedVersion + 1, tables })
  }
  if (name === getFunctionName(api.rolls.execute)) {
    const { characterId, expression, source } = executeRollInputDtoSchema.parse(input)
    return rollRecordDtoSchema.parse({
      id: crypto.randomUUID(),
      ...evaluateRollExpression(parseRollExpression(expression), middleOfEachDie),
      characterId,
      characterLabel: 'Story roller',
      source,
      ruleset: { systemId: 'story', code: 'DND5E_2014', version: '1' },
      createdAt: new Date().toISOString()
    })
  }
  if (name === getFunctionName(api.social.profiles.updatePreference)) {
    const { input: preference } = z
      .object({ input: updateSocialContentPreferenceInputSchema })
      .parse(input)
    // Settings can only write after a Mature attestation, so every reachable answer carries one.
    return socialEligibilityDtoSchema.parse({
      eligible: true,
      profilePublicId: null,
      adultAttestedAt: new Date().toISOString(),
      contentPreference: preference.contentPreference,
      status: 'ACTIVE'
    })
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
