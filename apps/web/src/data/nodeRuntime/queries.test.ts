import type { NodeRuntimeResolveRequestDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { compactNodeRuntimeResponse } from '@artificer-toolkit/schema/api/nodeRuntimeTransport'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getNodeRuntimeResolve,
  fingerprintNodeRuntimeRequest,
  useNodeRuntimeResolve
} from './queries'

const mocks = vi.hoisted(() => ({ convexQuery: vi.fn() }))

vi.mock('@convex-dev/react-query', () => ({ convexQuery: mocks.convexQuery }))

beforeEach(() => {
  mocks.convexQuery.mockClear()
  mocks.convexQuery.mockImplementation((reference, args) => ({
    queryKey: ['convex', reference, args]
  }))
})

describe('fingerprintNodeRuntimeRequest', () => {
  it('expands native cached responses and observes subsequent subscription updates', async () => {
    const expand = vi.spyOn(
      await import('@artificer-toolkit/schema/api/nodeRuntimeTransport'),
      'expandNodeRuntimeResponse'
    )
    const input = { mapId: 'class', systemId: 'system-5e', values: {} }
    const compact = compactNodeRuntimeResponse({
      mapId: 'class',
      steps: [],
      clearPaths: [],
      scopes: [{ mapId: 'feature', path: ['features', 0], steps: [], clearPaths: [] }]
    })
    const client = new QueryClient({
      defaultOptions: { queries: { queryFn: () => compact, retry: false } }
    })
    const { result, unmount, rerender } = renderHook(() => useNodeRuntimeResolve(input), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client }, children)
    })
    try {
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data?.scopes).toEqual([
        { mapId: 'feature', path: ['features', 0], steps: [], clearPaths: [] }
      ])
      const expansions = expand.mock.calls.length
      rerender()
      expect(expand).toHaveBeenCalledTimes(expansions)
      act(() =>
        client.setQueryData(getNodeRuntimeResolve(input).queryKey, {
          ...compact,
          models: [{ ...compact.models[0]!, clearPaths: [['hidden']] }]
        })
      )
      await waitFor(() => expect(result.current.data?.scopes[0]?.clearPaths).toEqual([['hidden']]))
      expect(client.getQueryData(getNodeRuntimeResolve(input).queryKey)).toHaveProperty('models')
    } finally {
      unmount()
      client.clear()
      expand.mockRestore()
    }
  })

  it('ignores copy-only field changes that do not affect node visibility or options', () => {
    const base = {
      mapId: 'race',
      systemId: 'system-5e',
      values: {
        id: 'race-1',
        category: 'BASE',
        label: 'Dragonborn',
        description: '<p>Original copy.</p>',
        ancestry: {
          id: 'ancestry-1',
          label: 'Draconic Ancestry',
          description: '<p>Choose a dragon type.</p>',
          options: [
            {
              id: 'black',
              label: 'Black',
              description: 'Acid line.'
            }
          ]
        }
      }
    } satisfies NodeRuntimeResolveRequestDto

    const editedCopy = {
      ...base,
      values: {
        ...base.values,
        label: 'Dragonborn Copy',
        description: '<p>Edited copy.</p>',
        ancestry: {
          ...base.values.ancestry,
          description: '<p>Edited ancestry copy.</p>',
          options: [
            {
              id: 'black',
              label: 'Black Dragon',
              description: 'Edited option copy.'
            }
          ]
        }
      }
    } satisfies NodeRuntimeResolveRequestDto

    expect(fingerprintNodeRuntimeRequest(editedCopy)).toBe(fingerprintNodeRuntimeRequest(base))
  })

  it('keeps structural field changes in the node-runtime fingerprint', () => {
    const base = {
      mapId: 'race',
      systemId: 'system-5e',
      values: {
        category: 'BASE',
        selectionMode: 'DIRECT'
      }
    } satisfies NodeRuntimeResolveRequestDto

    const changedStructure = {
      ...base,
      values: {
        ...base.values,
        category: 'SUBRACE'
      }
    } satisfies NodeRuntimeResolveRequestDto

    expect(fingerprintNodeRuntimeRequest(changedStructure)).not.toBe(
      fingerprintNodeRuntimeRequest(base)
    )
  })

  it.each([
    'background',
    'class',
    'feat',
    'equipment',
    'race',
    'creature',
    'spell',
    'vehicle',
    'proficiencyGrant',
    'facetCondition'
  ] as const)('uses the native %s query with JSON-compatible validated arguments', (mapId) => {
    const input = {
      mapId,
      systemId: 'system-5e',
      values: { category: 'BASE', optional: undefined }
    } satisfies NodeRuntimeResolveRequestDto

    const options = getNodeRuntimeResolve(input)

    expect(mocks.convexQuery).toHaveBeenCalledOnce()
    expect(options.queryFn).toBeUndefined()
    expect(options.staleTime).toBe(Infinity)
    expect(mocks.convexQuery.mock.calls[0]?.[1]).toEqual({
      mapId,
      systemId: 'system-5e',
      values: { category: 'BASE' }
    })
  })

  it('skips native Background resolution while disabled or without a System', () => {
    const input = {
      mapId: 'background',
      systemId: '',
      values: {}
    } satisfies NodeRuntimeResolveRequestDto

    const options = getNodeRuntimeResolve(input, false)

    expect(mocks.convexQuery).toHaveBeenCalledOnce()
    expect(mocks.convexQuery.mock.calls[0]?.[1]).toBe('skip')
    expect(options.enabled).toBe(false)
  })

  it('resolves a nested feature natively with its parent and ancestor context', () => {
    const input = {
      mapId: 'feature',
      systemId: 'system-5e',
      values: {},
      parentValues: { category: 'BASE' },
      ancestors: [{ category: 'BASE' }]
    } satisfies NodeRuntimeResolveRequestDto

    const options = getNodeRuntimeResolve(input)

    expect(mocks.convexQuery).toHaveBeenCalledOnce()
    expect(mocks.convexQuery.mock.calls[0]?.[1]).toEqual(input)
    expect(options.queryFn).toBeUndefined()
  })
})
