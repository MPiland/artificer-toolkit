import type { ReusableDefinitionWorkspaceDto } from '@artificer-toolkit/schema/api/reusableDefinitions'
import { getFunctionName, type ApiFromModules, type FunctionReturnType } from 'convex/server'
import { describe, expect, expectTypeOf, it } from 'vitest'

import { api } from '../_generated/api'
import { definitionReferences } from './definitionReferences'
import type * as definitions from './definitions'

/** The API Convex infers from the handlers themselves, not from their return validators. */
type HandlerApi = ApiFromModules<{
  'content/definitions': typeof definitions
}>['content']['definitions']
type HandlerReturn<Name extends keyof typeof definitionReferences> = FunctionReturnType<
  HandlerApi[Name]
>
type ReferenceReturn<Name extends keyof typeof definitionReferences> = FunctionReturnType<
  (typeof definitionReferences)[Name]
>

describe('Reusable Definition references pair with their handlers (D194)', () => {
  it.each(['get', 'create', 'saveDraft', 'publish'] as const)(
    'names the generated %s function',
    (name) => {
      expect(getFunctionName(definitionReferences[name])).toBe(
        getFunctionName(api.content.definitions[name])
      )
    }
  )

  it('returns the workspace DTO each handler declares', () => {
    expectTypeOf<HandlerReturn<'get'>>().toEqualTypeOf<ReusableDefinitionWorkspaceDto>()
    expectTypeOf<HandlerReturn<'create'>>().toEqualTypeOf<ReusableDefinitionWorkspaceDto>()
    expectTypeOf<HandlerReturn<'saveDraft'>>().toEqualTypeOf<ReusableDefinitionWorkspaceDto>()
    expectTypeOf<HandlerReturn<'publish'>>().toEqualTypeOf<ReusableDefinitionWorkspaceDto>()
    expectTypeOf<ReferenceReturn<'get'>>().toEqualTypeOf<HandlerReturn<'get'>>()
    expectTypeOf<ReferenceReturn<'create'>>().toEqualTypeOf<HandlerReturn<'create'>>()
    expectTypeOf<ReferenceReturn<'saveDraft'>>().toEqualTypeOf<HandlerReturn<'saveDraft'>>()
    expectTypeOf<ReferenceReturn<'publish'>>().toEqualTypeOf<HandlerReturn<'publish'>>()
  })
})
