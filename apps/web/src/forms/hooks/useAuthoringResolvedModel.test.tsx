import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useAuthoringResolvedModel } from './useAuthoringResolvedModel'

describe('useAuthoringResolvedModel', () => {
  it('never serves an embedded copy of the node map when no resolved model is provided', () => {
    const client = new QueryClient()
    const { result } = renderHook(
      () =>
        useAuthoringResolvedModel({
          mapId: 'charges',
          resolveModel: false,
          values: { limitKind: 'CLASS_LEVEL' }
        }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        )
      }
    )

    expect(result.current.model).toBeUndefined()
    expect(result.current.steps).toEqual([])
  })
})
