import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getFunctionName } from 'convex/server'
import { describe, expect, it } from 'vitest'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  nodeRuntimeResolveRequestDtoSchema,
  type NodeRuntimePathDto,
  type NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import { compactNodeRuntimeResponse } from '@artificer-toolkit/schema/api/nodeRuntimeTransport'
import { useResolvedNodeModel } from './useResolvedNodeModel'

const initialModel = createModel('Initial', [['initialPath']])
const nextModel = createModel('Next', [['freshPath']])

describe('useResolvedNodeModel', () => {
  it('keeps the previous model unchanged while a resolver refresh is pending', async () => {
    const user = userEvent.setup()
    let requestCount = 0
    let releaseNextResolve: (() => void) | undefined

    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          queryFn: async ({ queryKey }) => {
            expect(queryKey.slice(0, 2)).toEqual([
              'convexQuery',
              getFunctionName(api.authoring.nodeRuntime.resolve)
            ])
            nodeRuntimeResolveRequestDtoSchema.parse(queryKey[2])
            requestCount += 1
            if (requestCount === 1) return compactNodeRuntimeResponse(initialModel)

            await new Promise<void>((resolve) => {
              releaseNextResolve = resolve
            })
            return compactNodeRuntimeResponse(nextModel)
          }
        }
      }
    })
    render(<ResolvedModelHarness />, {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('model-label')).toHaveTextContent('Initial')
    })
    expect(screen.getByTestId('clear-path-count')).toHaveTextContent('1')

    await user.click(screen.getByRole('button', { name: /change structural value/i }))
    await waitFor(() => expect(requestCount).toBe(2))

    expect(screen.getByTestId('model-label')).toHaveTextContent('Initial')
    expect(screen.getByTestId('clear-path-count')).toHaveTextContent('1')

    releaseNextResolve?.()

    await waitFor(() => {
      expect(screen.getByTestId('model-label')).toHaveTextContent('Next')
    })
    expect(screen.getByTestId('clear-path-count')).toHaveTextContent('1')
    client.clear()
  })

  it('keeps the resolved request when only copy fields change', async () => {
    const user = userEvent.setup()
    const requests: unknown[] = []
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          queryFn: async ({ queryKey }) => {
            requests.push(nodeRuntimeResolveRequestDtoSchema.parse(queryKey[2]).values)
            return compactNodeRuntimeResponse(initialModel)
          }
        }
      }
    })
    render(<ResolvedModelHarness />, {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('model-label')).toHaveTextContent('Initial')
    })
    await user.click(screen.getByRole('button', { name: /rename/i }))
    await user.click(screen.getByRole('button', { name: /change structural value/i }))

    await waitFor(() => expect(requests).toHaveLength(2))
    expect(requests).toEqual([
      { label: 'Initial name', mode: 'initial' },
      { label: 'Renamed', mode: 'next' }
    ])
    client.clear()
  })
})

function ResolvedModelHarness() {
  const [mode, setMode] = useState('initial')
  const [label, setLabel] = useState('Initial name')
  const { model } = useResolvedNodeModel({
    mapId: 'feature',
    systemId: 'system-1',
    values: { label, mode }
  })

  return (
    <div>
      <button type='button' onClick={() => setMode('next')}>
        Change structural value
      </button>
      <button type='button' onClick={() => setLabel('Renamed')}>
        Rename
      </button>
      <div data-testid='model-label'>{model?.steps[0]?.label ?? 'none'}</div>
      <div data-testid='clear-path-count'>{model?.clearPaths.length ?? 0}</div>
    </div>
  )
}

function createModel(
  label: string,
  clearPaths: NodeRuntimePathDto[]
): NodeRuntimeResolveResponseDto {
  return {
    clearPaths,
    mapId: 'feature',
    scopes: [],
    steps: [
      {
        id: label.toLowerCase(),
        label,
        order: 1,
        sections: []
      }
    ]
  }
}
