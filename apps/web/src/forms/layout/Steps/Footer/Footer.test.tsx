import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { Footer } from './Footer'

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  useAuthoringForm: vi.fn(),
  useAuthoringLayout: vi.fn()
}))

vi.mock('../../AuthoringFormContext', () => ({
  useAuthoringForm: mocks.useAuthoringForm
}))

vi.mock('../../AuthoringLayoutContext', () => ({
  useAuthoringLayout: mocks.useAuthoringLayout
}))

describe('authoring rail Cancel action', () => {
  beforeEach(() => {
    mocks.cancel.mockReset()
    mocks.useAuthoringLayout.mockReturnValue({
      visibleSteps: [{ id: 'basics' }]
    })
    mocks.useAuthoringForm.mockReturnValue(createAuthoringState({ stagedEditorOpen: false }))
  })

  it('renders a real collection link and routes normal clicks through the provider action', () => {
    render(
      <TestRouterProvider>
        <Footer />
      </TestRouterProvider>
    )

    const cancelLink = screen.getByRole('link', { name: 'Cancel' })
    expect(cancelLink).toHaveAttribute('href', '/races')

    fireEvent.click(cancelLink)

    expect(mocks.cancel).toHaveBeenCalledOnce()
  })

  it('preserves modified link clicks', () => {
    render(
      <TestRouterProvider>
        <Footer />
      </TestRouterProvider>
    )

    window.addEventListener('click', (event) => event.preventDefault(), { once: true })
    fireEvent.click(screen.getByRole('link', { name: 'Cancel' }), { ctrlKey: true })

    expect(mocks.cancel).not.toHaveBeenCalled()
  })

  it('disables Cancel while a staged editor is open', () => {
    mocks.useAuthoringForm.mockReturnValue(createAuthoringState({ stagedEditorOpen: true }))

    render(
      <TestRouterProvider>
        <Footer />
      </TestRouterProvider>
    )

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.queryByRole('link', { name: 'Cancel' })).not.toBeInTheDocument()
  })
})

function createAuthoringState({ stagedEditorOpen }: { stagedEditorOpen: boolean }) {
  return {
    cancel: mocks.cancel,
    cancelHref: '/races',
    cancelLabel: 'Cancel',
    hasChanges: false,
    mode: 'create',
    progressSummary: {
      completeCount: 1,
      errorCount: 0,
      incompleteCount: 0,
      stepCount: 1,
      warningCount: 0
    },
    stagedEditorOpen,
    stepStatuses: { basics: 'complete' },
    visitedStepIds: new Set(['basics'])
  }
}
