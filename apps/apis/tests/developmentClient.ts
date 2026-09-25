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

// Native Encounter commands are internal: browsers reach them only through the Session room. The
// transactional test adapter calls these references directly; DevelopmentHttpClient
// (developmentHttpClient.ts) sends them through the Campaign's Session room like the browser.
export const executeEncounterCommand = makeFunctionReference<
  'mutation',
  EncounterExecuteInput,
  EncounterCommandResultDto
>('encounters/commands:execute')
export const executeEncounterCommandAction = makeFunctionReference<
  'action',
  EncounterExecuteInput,
  EncounterCommandResultDto
>('encounters/commandActions:execute')

/**
 * Asserts an expected Encounter domain rejection by reason. Both clients surface it as `ConvexError`
 * data: the test adapter directly, DevelopmentHttpClient from the room's `COMMAND_REJECTED`. Returns
 * `true` so it also serves as an `assert.rejects` validator.
 */
export function assertDomainRejection(error: unknown, reason: DomainRejectionReasonDto): true {
  assert.ok(error instanceof ConvexError, String(error))
  assert.equal(domainRejectionErrorDataSchema.parse(error.data).reason, reason)
  return true
}
