import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useNavigate } from '@tanstack/react-router'
import type { AuthoredDraftDto } from '@artificer-toolkit/schema/api/content'
import { vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { useAuthoredDetailActions } from './useAuthoredDetailActions'

const detailSubjectQueryKey = ['content', 'races', 'detail', 'race-1'] as const
const domainQueryKey = ['content', 'races'] as const
const draftQueryKey = ['content', 'races', 'draft', 'race-1'] as const

interface Deferred<T> {
  promise: Promise<T>
  reject: (reason?: unknown) => void
  resolve: (value: T) => void
}

function createDeferred<T>(): Deferred<T> {
  let reject!: (reason?: unknown) => void
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })

  return { promise, reject, resolve }
}

function createCopiedDraft(): AuthoredDraftDto {
  return {
    subjectKind: 'RACE',
    subjectId: 'race-copy',
    publicId: 'dragonborn-copy',
    userId: 'user-1',
    systemId: 'system-5e',
    label: 'Dragonborn Copy',
    status: 'DRAFT',
    draftState: 'DRAFT_ONLY',
    baseActiveUpdatedAt: null,
    payload: {
      id: 'race-copy',
      label: 'Dragonborn Copy'
    }
  }
}

function DetailActionsHarness({
  duplicate,
  navigateEdit,
  onDuplicatePromise
}: {
  duplicate: (id: string) => Promise<AuthoredDraftDto | null>
  navigateEdit: (subject: { id: string; publicId: string; label: string }) => Promise<void>
  onDuplicatePromise?: (promise: Promise<void>) => void
}) {
  const navigate = useNavigate()
  const actions = useAuthoredDetailActions({
    deleteActive: async () => undefined,
    discard: async () => undefined,
    detailSubjectQueryKey,
    domainLabel: 'Race',
    domainQueryKey,
    draftQueryKey,
    duplicate,
    hasActiveContent: true,
    id: 'race-1',
    navigateEdit,
    navigateList: async () => undefined
  })

  return (
    <>
      <button
        disabled={actions.isDetailOperationPending}
        type='button'
        onClick={() => {
          const promise = actions.duplicateToDraft()
          onDuplicatePromise?.(promise)
          void promise
        }}
      >
        Duplicate
      </button>
      <button disabled={actions.isDetailOperationPending} type='button'>
        Create New
      </button>
      <button type='button' onClick={() => navigate({ to: '/backgrounds' })}>
        Leave route
      </button>
      {actions.pendingOperation ? <p role='status'>{actions.pendingOperation.title}</p> : null}
      {actions.deleteConfirmation}
    </>
  )
}

describe('useAuthoredDetailActions duplicate lifecycle', () => {
  it('exposes pending state and navigates to the copied draft when still current', async () => {
    const user = userEvent.setup()
    const deferred = createDeferred<AuthoredDraftDto | null>()
    const duplicate = vi.fn(() => deferred.promise)
    const navigateEdit = vi.fn(async () => undefined)
    let duplicatePromise: Promise<void> | null = null

    renderWithAppProviders(
      <DetailActionsHarness
        duplicate={duplicate}
        navigateEdit={navigateEdit}
        onDuplicatePromise={(promise) => {
          duplicatePromise = promise
        }}
      />,
      { initialPath: '/races/dragonborn' }
    )

    await user.click(screen.getByRole('button', { name: /duplicate/i }))

    expect(duplicate).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('Creating draft...')
    expect(screen.getByRole('button', { name: /duplicate/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /create new/i })).toBeDisabled()

    deferred.resolve(createCopiedDraft())

    await act(async () => {
      await duplicatePromise
    })

    expect(navigateEdit).toHaveBeenCalledWith({
      id: 'race-copy',
      publicId: 'dragonborn-copy',
      label: 'Dragonborn Copy'
    })
  })

  it('does not navigate after the source detail page has unmounted', async () => {
    const user = userEvent.setup()
    const deferred = createDeferred<AuthoredDraftDto | null>()
    const duplicate = vi.fn(() => deferred.promise)
    const navigateEdit = vi.fn(async () => undefined)
    let duplicatePromise: Promise<void> | null = null

    const { unmount } = renderWithAppProviders(
      <DetailActionsHarness
        duplicate={duplicate}
        navigateEdit={navigateEdit}
        onDuplicatePromise={(promise) => {
          duplicatePromise = promise
        }}
      />,
      { initialPath: '/races/dragonborn' }
    )

    await user.click(screen.getByRole('button', { name: /duplicate/i }))
    unmount()
    deferred.resolve(createCopiedDraft())

    await act(async () => {
      await duplicatePromise
    })

    expect(navigateEdit).not.toHaveBeenCalled()
  })

  it('does not navigate after the current route changes while duplicate is pending', async () => {
    const user = userEvent.setup()
    const deferred = createDeferred<AuthoredDraftDto | null>()
    const duplicate = vi.fn(() => deferred.promise)
    const navigateEdit = vi.fn(async () => undefined)
    let duplicatePromise: Promise<void> | null = null

    renderWithAppProviders(
      <DetailActionsHarness
        duplicate={duplicate}
        navigateEdit={navigateEdit}
        onDuplicatePromise={(promise) => {
          duplicatePromise = promise
        }}
      />,
      { initialPath: '/races/dragonborn' }
    )

    await user.click(screen.getByRole('button', { name: /duplicate/i }))
    await user.click(screen.getByRole('button', { name: /leave route/i }))
    deferred.resolve(createCopiedDraft())

    await act(async () => {
      await duplicatePromise
    })

    expect(navigateEdit).not.toHaveBeenCalled()
  })

  it('clears pending state after a duplicate error', async () => {
    const user = userEvent.setup()
    const deferred = createDeferred<AuthoredDraftDto | null>()
    const duplicate = vi.fn(() => deferred.promise)
    const navigateEdit = vi.fn(async () => undefined)
    let duplicatePromise: Promise<void> | null = null

    renderWithAppProviders(
      <DetailActionsHarness
        duplicate={duplicate}
        navigateEdit={navigateEdit}
        onDuplicatePromise={(promise) => {
          duplicatePromise = promise
        }}
      />,
      { initialPath: '/races/dragonborn' }
    )

    await user.click(screen.getByRole('button', { name: /duplicate/i }))
    deferred.reject(new Error('Duplicate failed.'))

    await act(async () => {
      await duplicatePromise
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /duplicate/i })).toBeEnabled()
    expect(navigateEdit).not.toHaveBeenCalled()
  })
})
