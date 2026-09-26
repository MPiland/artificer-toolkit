import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import {
  makeFunctionReference,
  type FunctionReference,
  type FunctionReturnType,
  type OptionalRestArgs
} from 'convex/server'
import { ConvexError } from 'convex/values'
import {
  domainRejectionErrorDataSchema,
  type DomainRejectionReasonDto
} from '@artificer-toolkit/schema/api/domainRejections'
import type {
  EncounterCommandResultDto,
  EncounterExecuteInput
} from '@artificer-toolkit/schema/api/encounters'

// Shared call surface for the real HTTP client and the local transactional test adapter.
export type DevelopmentClient = Pick<ConvexHttpClient, 'query'> & {
  mutation<Reference extends FunctionReference<'mutation'>>(
    reference: Reference,
    ...args: OptionalRestArgs<Reference>
  ): Promise<FunctionReturnType<Reference>>
}

// Names an Encounter command a development client sends through the Campaign's Session room,
// as a browser does: DevelopmentHttpClient (developmentHttpClient.ts) over its socket, and the
// in-process test client (`inProcessDevelopmentClient`) through the room's dispatcher.
export const executeEncounterCommand = makeFunctionReference<
  'mutation',
  EncounterExecuteInput,
  EncounterCommandResultDto
>('encounters/commands:execute')

/**
 * Asserts an expected Encounter domain rejection by reason. Both clients surface it as
 * `ConvexError` data: the in-process client from the room's dispatcher, DevelopmentHttpClient from
 * the room's `COMMAND_REJECTED`. Returns `true` so it also serves as an `assert.rejects` validator.
 */
export function assertDomainRejection(error: unknown, reason: DomainRejectionReasonDto): true {
  assert.ok(error instanceof ConvexError, String(error))
  assert.equal(domainRejectionErrorDataSchema.parse(error.data).reason, reason)
  return true
}
