import type { useMutation } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { fn } from 'storybook/test'
import { api } from '@artificer-toolkit/apis/convex/api'
import { lootDocumentSchema, saveLootInputSchema } from '@artificer-toolkit/schema/api/lootTables'
import { executeRollInputDtoSchema, rollRecordDtoSchema } from '@artificer-toolkit/schema/api/rolls'
import { evaluateRollExpression, parseRollExpression } from '@artificer-toolkit/shared/rolls'

/** What `useMutation` accepts, which is also what the client's `mutation` takes. */
type MutationReference = Parameters<typeof useMutation>[0]

/** Every die lands in the middle of its faces, so a spied roll is the same on every run. */
const middleOfEachDie = { nextInt: (maxExclusive: number) => Math.floor(maxExclusive / 2) }

/**
 * What a recorded write answers: the response its client parses, built through the real response
 * schema from the recorded input, so the page sees a success and nothing reaches the seeded
 * deployment (D218). A roll is the record the roller presents, evaluated by the product's roll
 * expression with fixed dice. A write whose caller ignores the response answers null.
 */
function writeResponse(reference: MutationReference, input: unknown): unknown {
  if (getFunctionName(reference) === getFunctionName(api.loot.tables.save)) {
    const { owner, expectedVersion, tables } = saveLootInputSchema.parse(input)
    return lootDocumentSchema.parse({ owner, version: expectedVersion + 1, tables })
  }
  if (getFunctionName(reference) === getFunctionName(api.rolls.execute)) {
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
