import { api } from '@artificer-toolkit/apis/convex/api'
import { screen } from '@testing-library/react'
import { getFunctionName } from 'convex/server'
import { Suspense } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CharacterSheetPage } from './CharacterSheetPage'

// The platform boundary: Convex answers by function name; the adapters and page are real.
const answers = new Map<string, unknown>()

vi.mock('@convex-dev/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convex-dev/react-query')>()),
  convexQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => ({
    queryKey: ['convexQuery', getFunctionName(reference), args],
    queryFn: async () => answers.get(getFunctionName(reference)) ?? null
  })
}))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  getRouteApi: () => ({
    useLoaderData: () => ({ characterPublicId: 'repair-route-id' }),
    useRouteContext: () => ({ user: undefined })
  })
}))

function renderPage() {
  renderWithAppProviders(
    <Suspense fallback={null}>
      <CharacterSheetPage />
    </Suspense>
  )
}

describe('CharacterSheetPage', () => {
  beforeEach(() => answers.clear())

  it('opens a Character needing Builder repair on the draft state with a way into the Builder, with no draft row', async () => {
    answers.set(getFunctionName(api.characters.sheetSlices.get), {
      slice: 'REPAIR_REQUIRED',
      data: { publicId: 'abc12', label: 'Departed Hero' }
    })

    renderPage()

    expect(await screen.findByText(/builder draft in progress/i)).toBeInTheDocument()
    expect(screen.getByText(/departed hero/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resume builder/i })).toBeInTheDocument()
    expect(screen.queryByText(/could not be found/i)).not.toBeInTheDocument()
  })

  it('still reports a Character that is neither readable nor a draft as not found', async () => {
    renderPage()

    expect(await screen.findByText(/could not be found/i)).toBeInTheDocument()
  })
})
