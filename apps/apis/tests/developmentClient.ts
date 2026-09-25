import type { ConvexHttpClient } from 'convex/browser'
import {
  makeFunctionReference,
  type FunctionReference,
  type FunctionReturnType,
  type OptionalRestArgs
} from 'convex/server'
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
