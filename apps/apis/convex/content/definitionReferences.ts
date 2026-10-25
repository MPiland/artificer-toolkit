import type { ReusableDefinitionWorkspaceDto } from '@artificer-toolkit/schema/api/reusableDefinitions'
import { makeFunctionReference, type FunctionArgs } from 'convex/server'

import type { api } from '../_generated/api'

type Definitions = typeof api.content.definitions

/**
 * Typed references to the Reusable Definition workspace functions (D194). Their return validator
 * leaves facets, effect paths and follow-up outcomes as `v.any()`, so the generated API types those
 * leaves `any`; each reference returns the `ReusableDefinitionWorkspaceDto` its handler declares.
 * `definitionReferences.test.ts` pairs each reference with its handler.
 */
export const definitionReferences = {
  get: makeFunctionReference<
    'query',
    FunctionArgs<Definitions['get']>,
    ReusableDefinitionWorkspaceDto
  >('content/definitions:get'),
  create: makeFunctionReference<
    'mutation',
    FunctionArgs<Definitions['create']>,
    ReusableDefinitionWorkspaceDto
  >('content/definitions:create'),
  saveDraft: makeFunctionReference<
    'mutation',
    FunctionArgs<Definitions['saveDraft']>,
    ReusableDefinitionWorkspaceDto
  >('content/definitions:saveDraft'),
  publish: makeFunctionReference<
    'mutation',
    FunctionArgs<Definitions['publish']>,
    ReusableDefinitionWorkspaceDto
  >('content/definitions:publish')
}
