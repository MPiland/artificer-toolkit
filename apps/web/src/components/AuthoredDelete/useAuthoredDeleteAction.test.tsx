import { useEffect } from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { useAuthoredDeleteAction } from './useAuthoredDeleteAction'

const detailRoot = ['content', 'races', 'detail', 'race-1'] as const
const detailKey = ['content', 'races', 'detail', 'race-1', { includeDraft: true, view: 'draft' }] as const
const domainKey = ['content', 'races'] as const
const draftKey = ['content', 'races', 'draft', 'race-1'] as const

function requireQueryClient(queryClient: QueryClient | null): QueryClient {
  if (!queryClient) {
    throw new Error('Expected query client to be exposed.')
  }

  return queryClient
}

function DeleteHarness({
  deleteActive,
  deleteDraft,
  exposeClient
}: {
  deleteActive: (id: string) => Promise<void>
  deleteDraft: (id: string) => Promise<void>
  exposeClient: (queryClient: QueryClient) => void
}) {
  const queryClient = useQueryClient()
  const deleteAction = useAuthoredDeleteAction({
    deleteActive,
    deleteDraft,
    detailSubjectQueryKey: detailRoot,
    domainLabel: 'Race',
    domainQueryKey: domainKey,
    draftQueryKey: draftKey
  })

  useEffect(() => {
    queryClient.setQueryData(detailKey, { label: 'Dragonborn Copy' })
    queryClient.setQueryData(draftKey, { label: 'Dragonborn Draft' })
    exposeClient(queryClient)
  }, [exposeClient, queryClient])

  return (
    <>
      <button
        type='button'
        onClick={() => deleteAction.requestDelete({ id: 'race-1', kind: 'draft', label: 'Dragonborn Copy' })}
      >
        Delete draft
      </button>
      <button
        type='button'
        onClick={() => deleteAction.requestDelete({ id: 'race-1', kind: 'active', label: 'Dragonborn Copy' })}
      >
        Delete active
      </button>
      {deleteAction.confirmation}
    </>
  )
}

describe('useAuthoredDeleteAction', () => {
  it('confirms draft deletion and removes optioned detail plus draft caches', async () => {
    const user = userEvent.setup()
    const deleteActive = vi.fn(async () => undefined)
    const deleteDraft = vi.fn(async () => undefined)
    let queryClient: QueryClient | null = null

    renderWithAppProviders(
      <DeleteHarness
        deleteActive={deleteActive}
        deleteDraft={deleteDraft}
        exposeClient={(client) => {
          queryClient = client
        }}
      />
    )

    await user.click(screen.getByRole('button', { name: /delete draft/i }))
    expect(await screen.findByText(/delete the draft for dragonborn copy/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => expect(deleteDraft).toHaveBeenCalledWith('race-1'))
    expect(deleteActive).not.toHaveBeenCalled()
    expect(requireQueryClient(queryClient).getQueryData(detailKey)).toBeUndefined()
    expect(requireQueryClient(queryClient).getQueryData(draftKey)).toBeUndefined()
  })

  it('confirms active deletion and leaves the same-subject draft cache available', async () => {
    const user = userEvent.setup()
    const deleteActive = vi.fn(async () => undefined)
    const deleteDraft = vi.fn(async () => undefined)
    let queryClient: QueryClient | null = null

    renderWithAppProviders(
      <DeleteHarness
        deleteActive={deleteActive}
        deleteDraft={deleteDraft}
        exposeClient={(client) => {
          queryClient = client
        }}
      />
    )

    await user.click(screen.getByRole('button', { name: /delete active/i }))
    expect(await screen.findByText(/any draft for this race will stay available/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => expect(deleteActive).toHaveBeenCalledWith('race-1'))
    expect(deleteDraft).not.toHaveBeenCalled()
    expect(requireQueryClient(queryClient).getQueryData(detailKey)).toBeUndefined()
    expect(requireQueryClient(queryClient).getQueryData(draftKey)).toEqual({ label: 'Dragonborn Draft' })
  })
})
