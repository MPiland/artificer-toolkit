import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { server } from '#test/msw/server'
import { CharacterSheetView } from './CharacterSheetView'
import {
  createSheet,
  mockTabletLandscapeViewport,
  openHpControls,
  readBatchedInput,
  trpcErrorJson,
  trpcJson
} from '../tests/sheetTestHarness'

describe('Character Sheet shell', () => {
  it('submits sheet commands through the production command mutation path', async () => {
    const user = userEvent.setup()
    let submittedCommand: unknown

    server.use(
      http.post('*/api/trpc/characters.command', async ({ request }) => {
        const body = await request.json()
        submittedCommand = readBatchedInput<{ id: string; input: unknown }>(body).input
        const sheet = createSheet()
        sheet.meta.streamVersion = 5

        return trpcJson({
          characterId: sheet.meta.characterId,
          streamVersion: sheet.meta.streamVersion,
          sheet
        })
      })
    )

    renderWithAppProviders(
      <CharacterSheetView characterPublicId='character-1' hasDraft={false} sheet={createSheet()} />
    )

    await openHpControls(user)
    await user.click(screen.getByRole('button', { name: /^damage$/i }))

    await waitFor(() =>
      expect(submittedCommand).toMatchObject({
        type: 'ADJUST_HIT_POINTS',
        expectedVersion: 4
      })
    )
  })

  it('shows sheet command errors from the production command mutation path', async () => {
    const user = userEvent.setup()

    server.use(
      http.post('*/api/trpc/characters.command', () =>
        trpcErrorJson(
          'This character changed in another tab. Refresh the sheet, then try again.',
          409
        )
      )
    )

    renderWithAppProviders(
      <CharacterSheetView characterPublicId='character-1' hasDraft sheet={createSheet()} />
    )

    expect(screen.getByText(/builder draft work/i)).toBeInTheDocument()
    await openHpControls(user)
    await user.click(screen.getByRole('button', { name: /^damage$/i }))

    expect(await screen.findByText(/changed in another tab/i)).toBeInTheDocument()
  })

  it('reacts when the requested initial sheet tab changes', () => {
    const { rerender } = renderWithAppProviders(
      <CharacterSheetView
        characterPublicId='character-1'
        hasDraft={false}
        initialTab='spells'
        sheet={createSheet()}
      />
    )

    expect(screen.getByRole('tab', { name: /spells/i })).toHaveAttribute('aria-selected', 'true')

    rerender(
      <CharacterSheetView
        characterPublicId='character-1'
        hasDraft={false}
        initialTab='inventory'
        sheet={createSheet()}
      />
    )

    expect(screen.getByRole('tab', { name: /^equipment$/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })

  it('keeps skills and proficiencies in the tablet overview instead of duplicating tabs', () => {
    renderWithAppProviders(
      <CharacterSheetView characterPublicId='character-1' hasDraft={false} sheet={createSheet()} />
    )

    const tabList = screen.getByRole('tablist')
    expect(within(tabList).queryByRole('tab', { name: /^skills$/i })).not.toBeInTheDocument()
    expect(within(tabList).queryByRole('tab', { name: /^proficiencies$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: /^skills$/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /^proficiencies$/i })).toBeInTheDocument()
  })

  it('keeps skills persistent beside the tablet landscape workspace', async () => {
    const restoreViewport = mockTabletLandscapeViewport()
    const user = userEvent.setup()

    try {
      renderWithAppProviders(
        <CharacterSheetView
          characterPublicId='character-1'
          hasDraft={false}
          sheet={createSheet()}
        />
      )

      const tabList = screen.getByRole('tablist')
      expect(within(tabList).queryByRole('tab', { name: /^skills$/i })).not.toBeInTheDocument()
      expect(
        within(tabList).queryByRole('tab', { name: /^proficiencies$/i })
      ).not.toBeInTheDocument()
      expect(screen.getByRole('region', { name: /^skills$/i })).toBeInTheDocument()
      expect(screen.getByRole('region', { name: /overview facts/i })).toBeInTheDocument()

      await user.click(within(tabList).getByRole('tab', { name: /^actions$/i }))

      expect(screen.getByRole('region', { name: /^skills$/i })).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: /overview facts/i })).not.toBeInTheDocument()
      expect(screen.getByRole('region', { name: /^actions$/i })).toBeInTheDocument()
    } finally {
      restoreViewport()
    }
  })
})
