import { fireEvent, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { ConvexReactClient } from 'convex/react'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { useAuthoredExportAction } from './useAuthoredExportAction'

const mocks = vi.hoisted(() => ({ exportAuthoredContent: vi.fn() }))
const client = new ConvexReactClient('https://unit-test.convex.cloud')
vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useConvex: () => client
}))
vi.mock('#app/data/imports/importClient', async () => {
  const { artificerPortableContentDtoSchema } =
    await import('@artificer-toolkit/schema/api/imports')
  return {
    exportAuthoredContent: async (...args: unknown[]) =>
      artificerPortableContentDtoSchema.parse(await mocks.exportAuthoredContent(...args))
  }
})

describe('useAuthoredExportAction', () => {
  beforeEach(() => {
    mocks.exportAuthoredContent.mockResolvedValue({
      format: 'artificer-content',
      version: 1,
      item: { kind: 'SPELL', data: {} },
      references: []
    })
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:export'), revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  })

  afterEach(() => vi.unstubAllGlobals())

  it.each(['active', 'draft'] as const)('exports the owned %s view', async (view) => {
    renderWithAppProviders(<ExportButton canExport view={view} />)
    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }))
    await waitFor(() =>
      expect(mocks.exportAuthoredContent).toHaveBeenCalledWith(
        {
          id: 'spell-1',
          subjectKind: 'SPELL',
          view
        },
        client
      )
    )
  })

  it('does not expose export for non-owned content', () => {
    renderWithAppProviders(<ExportButton canExport={false} view='active' />)
    expect(screen.queryByRole('button', { name: 'Export JSON' })).not.toBeInTheDocument()
  })
})

function ExportButton({ canExport, view }: { canExport: boolean; view: 'active' | 'draft' }) {
  const action = useAuthoredExportAction({
    canExport,
    id: 'spell-1',
    label: 'Sea Step',
    subjectKind: 'SPELL',
    view
  })
  return action ? <button onClick={action.onClick}>{action.label}</button> : null
}
