import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getFunctionName, type FunctionReference } from 'convex/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReusableDefinitionWorkspaceDto } from '@artificer-toolkit/schema/api/reusableDefinitions'
import { getSystemDefinition, getSystemDefinitions } from '#app/data/systems/queries'
import { SystemDefinitionWorkspace } from './SystemDefinitionWorkspace'
import {
  createDefinitionWorkspace,
  senseDocument,
  withDefinitionDraft,
  withDefinitionPublication
} from './SystemDefinitionWorkspace.fixtures'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  saveDraft: vi.fn(),
  publish: vi.fn()
}))

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useMutation: (reference: FunctionReference<'mutation'>) => {
    switch (getFunctionName(reference)) {
      case 'content/definitions:create':
        return mocks.create
      case 'content/definitions:saveDraft':
        return mocks.saveDraft
      case 'content/definitions:publish':
        return mocks.publish
      default:
        throw new Error(`Unexpected mutation: ${getFunctionName(reference)}`)
    }
  }
}))

function renderWorkspace(
  workspace = createDefinitionWorkspace(),
  next?: ReusableDefinitionWorkspaceDto
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { current: _current, draft: _draft, ...summary } = workspace
  const firstPage = vi.fn(async () => ({
    page: [summary],
    isDone: !next,
    continueCursor: next ? 'page-2' : ''
  }))
  const nextPage = vi.fn(async () => {
    if (!next) throw new Error('No second fixture page.')
    const { current: _nextCurrent, draft: _nextDraft, ...nextSummary } = next
    return { page: [nextSummary], isDone: true, continueCursor: '' }
  })
  const list = getSystemDefinitions(workspace.gameSystemId)
  expect(list.queryKey).toEqual([
    'convexQuery',
    'content/definitions:list',
    { gameSystemId: workspace.gameSystemId, cursor: null, limit: 10 }
  ])
  expect(list.queryFn).toBeUndefined()
  expect(getSystemDefinition(workspace.id).queryKey).toEqual([
    'convexQuery',
    'content/definitions:get',
    { definitionId: workspace.id }
  ])
  queryClient.setQueryDefaults(list.queryKey, { queryFn: firstPage })
  queryClient.setQueryDefaults(getSystemDefinitions(workspace.gameSystemId, 'page-2').queryKey, {
    queryFn: nextPage
  })
  queryClient.setQueryDefaults(getSystemDefinition(workspace.id).queryKey, {
    queryFn: async () => workspace
  })
  render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <SystemDefinitionWorkspace
          gameSystemId={workspace.gameSystemId}
          definitionFamilyKeys={['sense']}
        />
      </QueryClientProvider>
    </MantineProvider>
  )
  return { queryClient, firstPage, nextPage }
}

describe('native definition workspace', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates an owned definition through the native endpoint and selects the returned UUID', async () => {
    const initial = createDefinitionWorkspace()
    const created = createDefinitionWorkspace({
      id: '77777777-7777-4777-8777-777777777778',
      label: 'Private vision'
    })
    mocks.create.mockResolvedValue(created)
    renderWorkspace(initial)
    const user = userEvent.setup()
    await screen.findByRole('combobox', { name: 'Channel' })
    await user.click(screen.getByRole('button', { name: 'New definition' }))
    await user.type(await screen.findByRole('textbox', { name: 'Label' }), 'Private vision')
    await user.click(screen.getByRole('button', { name: 'Create definition' }))
    await screen.findByRole('heading', { name: 'Private vision' })
    expect(mocks.create).toHaveBeenCalledWith({
      gameSystemId: initial.gameSystemId,
      definitionFamilyKey: 'sense',
      label: 'Private vision',
      description: null
    })
  })

  it('saves the first draft at version zero and publishes through native mutations only', async () => {
    const workspace = createDefinitionWorkspace()
    const saved = withDefinitionDraft(workspace)
    const published = withDefinitionPublication(saved)
    mocks.saveDraft.mockResolvedValue(saved)
    mocks.publish.mockResolvedValue(published)
    const { queryClient } = renderWorkspace(workspace)
    const user = userEvent.setup()
    await screen.findByRole('combobox', { name: 'Channel' })
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled())
    expect(mocks.saveDraft).toHaveBeenCalledWith({
      definitionId: workspace.id,
      expectedDefinitionVersion: 0,
      expectedDraftVersion: null,
      document: senseDocument
    })
    await user.click(screen.getByRole('button', { name: 'Publish' }))
    await waitFor(() =>
      expect(queryClient.getQueryData(getSystemDefinition(workspace.id).queryKey)).toEqual(
        published
      )
    )
    expect(mocks.publish).toHaveBeenCalledWith({
      definitionId: workspace.id,
      expectedDefinitionVersion: 0,
      expectedDraftVersion: 0
    })
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
  })

  it('uses separate native cursor pages with working Previous and Next controls', async () => {
    const workspace = createDefinitionWorkspace()
    const next = createDefinitionWorkspace({
      id: '77777777-7777-4777-8777-777777777778',
      label: 'Second sense'
    })
    const { firstPage, nextPage } = renderWorkspace(workspace, next)
    const user = userEvent.setup()
    await screen.findByRole('button', { name: /Keen sight/ })
    expect(screen.getByRole('button', { name: 'Previous definitions page' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Next definitions page' }))
    await screen.findByRole('button', { name: /Second sense/ })
    expect(screen.getByRole('button', { name: 'Next definitions page' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Previous definitions page' }))
    await screen.findByRole('button', { name: /Keen sight/ })
    expect(firstPage).toHaveBeenCalledTimes(1)
    expect(nextPage).toHaveBeenCalledTimes(1)
  })

  it('keeps local text and frozen versions when a subscription delivers a newer draft', async () => {
    const saved = withDefinitionDraft(createDefinitionWorkspace())
    const newer = withDefinitionDraft(saved)
    const { queryClient } = renderWorkspace(saved)
    const user = userEvent.setup()
    await screen.findByRole('combobox', { name: 'Channel' })
    await user.click(screen.getByText('Advanced', { exact: true }))
    const text = `${JSON.stringify(senseDocument)}\n`
    fireEvent.change(screen.getByRole('textbox', { name: 'Reusable definition document' }), {
      target: { value: text }
    })
    await act(async () => {
      queryClient.setQueryData(getSystemDefinition(saved.id).queryKey, newer)
    })
    expect(
      await screen.findByText('This definition changed elsewhere. Your local edits have been kept.')
    ).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Reusable definition document' })).toHaveValue(text)
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Discard local edits and reload' }))
    expect(screen.getByRole('textbox', { name: 'Reusable definition document' })).toHaveValue(
      JSON.stringify(senseDocument, null, 2)
    )
    expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled()
    expect(mocks.saveDraft).not.toHaveBeenCalled()
  })

  it('retains invalid local text and cannot publish behind unsaved edits', async () => {
    renderWorkspace(withDefinitionDraft(createDefinitionWorkspace()))
    const user = userEvent.setup()
    await screen.findByRole('combobox', { name: 'Channel' })
    await user.click(screen.getByText('Advanced', { exact: true }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Reusable definition document' }), {
      target: { value: '{' }
    })
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('textbox', { name: 'Reusable definition document' })).toHaveValue('{')
    expect(mocks.saveDraft).not.toHaveBeenCalled()
    expect(mocks.publish).not.toHaveBeenCalled()
  })

  it('preserves additional Sense capabilities when editing the first guided capability', async () => {
    const document = {
      ...senseDocument,
      capabilities: [...senseDocument.capabilities, ...senseDocument.capabilities]
    }
    const saved = withDefinitionDraft(createDefinitionWorkspace(), document)
    mocks.saveDraft.mockResolvedValue(withDefinitionDraft(saved, document))
    renderWorkspace(saved)
    const user = userEvent.setup()
    await user.click(await screen.findByLabelText('Perceives invisible subjects'))
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() =>
      expect(mocks.saveDraft).toHaveBeenCalledWith({
        definitionId: saved.id,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: 0,
        document: {
          ...document,
          capabilities: [
            { ...document.capabilities[0], perceivesInvisible: true },
            document.capabilities[1]
          ]
        }
      })
    )
  })

  it('keeps platform publications read-only in both editor modes', async () => {
    const published = withDefinitionPublication(withDefinitionDraft(createDefinitionWorkspace()))
    renderWorkspace({ ...published, sourceKind: 'PLATFORM', editable: false })
    const user = userEvent.setup()
    await screen.findByText('Platform definitions are readable here but cannot be edited.')
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument()
    await user.click(screen.getByText('Advanced', { exact: true }))
    expect(screen.getByRole('textbox', { name: 'Reusable definition document' })).toBeDisabled()
    expect(mocks.saveDraft).not.toHaveBeenCalled()
    expect(mocks.publish).not.toHaveBeenCalled()
  })
})
