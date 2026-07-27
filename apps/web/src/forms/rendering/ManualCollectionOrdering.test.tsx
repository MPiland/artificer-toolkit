import { act, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TestRouterProvider } from '#test/TestRouterProvider'
import {
  ManualCollectionOrderingProvider,
  ManualCollectionOrderingRow
} from './ManualCollectionOrdering'

type SortableOperationItem = {
  id: string
  index: number
  initialIndex: number
}

type DragOperation = {
  source?: SortableOperationItem
  target?: SortableOperationItem
}

type CapturedProviderProps = {
  children: ReactNode
  onDragStart: (event: { operation: DragOperation }) => void
  onDragOver: (event: { operation: DragOperation }) => void
  onDragEnd: (event: { canceled: boolean; operation: DragOperation }) => void
}

const captured = vi.hoisted(() => ({
  providerProps: undefined as CapturedProviderProps | undefined
}))

vi.mock('@dnd-kit/react', () => ({
  DragDropProvider: (props: CapturedProviderProps) => {
    captured.providerProps = props
    return props.children
  }
}))

vi.mock('@dnd-kit/react/sortable', () => ({
  isSortable: () => true,
  useSortable: () => ({
    handleRef: vi.fn(),
    isDragging: false,
    ref: vi.fn()
  })
}))

const items = [
  { id: 'first', label: 'First option' },
  { id: 'second', label: 'Second option' }
] as const

describe('ManualCollectionOrdering', () => {
  beforeEach(() => {
    captured.providerProps = undefined
  })

  it('connects accessible keyboard instructions and announces reorder lifecycle events', () => {
    const onMove = vi.fn()

    renderOrdering({ disabled: false, onMove })

    const handle = screen.getByRole('button', { name: 'Reorder Second option' })
    const instructionsId = handle.getAttribute('aria-describedby')
    expect(instructionsId).toBeTruthy()
    expect(document.getElementById(instructionsId ?? '')).toHaveTextContent(
      /press Space or Enter.*arrow keys.*Escape to cancel/i
    )

    const provider = captured.providerProps
    if (!provider) throw new Error('Expected the drag provider callbacks to be registered.')

    act(() => {
      provider.onDragStart({
        operation: { source: { id: 'second', index: 1, initialIndex: 1 } }
      })
    })
    expect(screen.getByText('Picked up Second option, position 2 of 2.')).toBeInTheDocument()

    act(() => {
      provider.onDragOver({
        operation: {
          source: { id: 'second', index: 1, initialIndex: 1 },
          target: { id: 'first', index: 0, initialIndex: 0 }
        }
      })
    })
    expect(screen.getByText('Second option moved to position 1 of 2.')).toBeInTheDocument()

    act(() => {
      provider.onDragEnd({
        canceled: false,
        operation: {
          source: { id: 'second', index: 1, initialIndex: 1 },
          target: { id: 'first', index: 0, initialIndex: 0 }
        }
      })
    })
    expect(onMove).toHaveBeenCalledWith(1, 0)
    expect(screen.getByText('Second option placed at position 1 of 2.')).toBeInTheDocument()
  })

  it('announces cancellation and prevents moves while read-only', () => {
    const onMove = vi.fn()

    renderOrdering({ disabled: true, onMove })

    expect(screen.getByRole('button', { name: 'Reorder First option' })).toBeDisabled()
    const provider = captured.providerProps
    if (!provider) throw new Error('Expected the drag provider callbacks to be registered.')

    act(() => {
      provider.onDragEnd({
        canceled: true,
        operation: {
          source: { id: 'first', index: 0, initialIndex: 0 },
          target: { id: 'second', index: 1, initialIndex: 1 }
        }
      })
    })
    expect(onMove).not.toHaveBeenCalled()
    expect(
      screen.getByText('Reordering cancelled. The collection order was not changed.')
    ).toBeInTheDocument()
  })
})

function renderOrdering({ disabled, onMove }: { disabled: boolean; onMove: () => void }) {
  render(
    <TestRouterProvider>
      <ManualCollectionOrderingProvider disabled={disabled} enabled items={items} onMove={onMove}>
        {items.map((item, index) => (
          <ManualCollectionOrderingRow
            disabled={disabled}
            id={item.id}
            index={index}
            key={item.id}
            label={item.label}
          >
            <span>{item.label}</span>
          </ManualCollectionOrderingRow>
        ))}
      </ManualCollectionOrderingProvider>
    </TestRouterProvider>
  )
}
