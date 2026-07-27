import { useState } from 'react'
import { HttpResponse, http } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type {
  NodeRuntimePathDto,
  NodeRuntimeResolveRequestDto,
  NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import { server } from '#test/msw/server'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { useResolvedNodeModel } from './useResolvedNodeModel'

const initialModel = createModel('Initial', [['stalePath']])
const nextModel = createModel('Next', [['freshPath']])

describe('useResolvedNodeModel', () => {
  it('keeps the previous model mounted while a resolver refresh is pending', async () => {
    const user = userEvent.setup()
    const onClearPaths = vi.fn()
    let requestCount = 0
    let releaseNextResolve: (() => void) | undefined

    server.use(
      http.post('*/api/trpc/nodeRuntime.resolve', async ({ request }) => {
        readBatchedInput<NodeRuntimeResolveRequestDto>(await request.json())
        requestCount += 1

        if (requestCount === 1) return trpcJson(initialModel)

        await new Promise<void>((resolve) => {
          releaseNextResolve = resolve
        })

        return trpcJson(nextModel)
      })
    )

    renderWithAppProviders(<ResolvedModelHarness onClearPaths={onClearPaths} />)

    await waitFor(() => {
      expect(screen.getByTestId('model-label')).toHaveTextContent('Initial')
    })
    expect(screen.getByTestId('clear-path-count')).toHaveTextContent('1')
    expect(onClearPaths).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /change structural value/i }))
    await waitFor(() => expect(requestCount).toBe(2))

    expect(screen.getByTestId('model-label')).toHaveTextContent('Initial')
    expect(screen.getByTestId('clear-path-count')).toHaveTextContent('0')
    expect(onClearPaths).toHaveBeenCalledTimes(1)

    releaseNextResolve?.()

    await waitFor(() => {
      expect(screen.getByTestId('model-label')).toHaveTextContent('Next')
    })
    expect(screen.getByTestId('clear-path-count')).toHaveTextContent('1')
    expect(onClearPaths).toHaveBeenCalledTimes(2)
    expect(onClearPaths).toHaveBeenLastCalledWith([['freshPath']])
  })
})

function ResolvedModelHarness({
  onClearPaths
}: {
  onClearPaths: (paths: readonly NodeRuntimePathDto[]) => void
}) {
  const [mode, setMode] = useState('initial')
  const model = useResolvedNodeModel({
    debounceMs: 0,
    mapId: 'test-form',
    onClearPaths,
    systemId: 'system-1',
    values: { mode }
  })

  return (
    <div>
      <button type='button' onClick={() => setMode('next')}>
        Change structural value
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
    mapId: 'test-form',
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

function trpcJson(data: unknown) {
  return HttpResponse.json([{ result: { data } }])
}

function readBatchedInput<TInput>(body: unknown): TInput {
  if (typeof body !== 'object' || body === null || !('0' in body)) {
    throw new Error('Expected batched tRPC input.')
  }

  return (body as { 0: TInput })[0]
}
