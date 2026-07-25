import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, vi } from 'vitest'

import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { server } from '#test/msw/server'
import { characterSheetFixture } from '../character.fixtures'
import { CharacterSheetAdjustmentEditor } from '../components/sheet/panels/CharacterSheetAdjustmentEditor'
import { CharacterSheetInspector } from '../components/sheet/panels/CharacterSheetInspector'
import {
  abilityPanelFixture,
  savingThrowPanelFixture
} from '../components/sheet/panels/characterSheetPanel.fixtures'
import { CharacterSheetView } from '../components/sheet/CharacterSheetView'

function panelResponse(panel: unknown) {
  return HttpResponse.json([{ result: { data: panel } }])
}

describe('Character Sheet inspector', () => {
  it('opens as an overlay from the existing ability card', async () => {
    server.use(
      http.get('*/api/trpc/characters.panel', () => panelResponse(abilityPanelFixture))
    )
    const user = userEvent.setup()

    renderWithAppProviders(
      <CharacterSheetView
        characterPublicId='character-owned'
        hasDraft={false}
        sheet={characterSheetFixture}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Inspect STR ability' }))

    const inspector = await screen.findByRole('dialog', { name: 'Strength' })
    expect(inspector).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Astra Vale' })).toBeVisible()
    expect(screen.queryByRole('button', { name: /save sheet/i })).not.toBeInTheDocument()
  })

  it('commits numeric fields on blur', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn().mockResolvedValue(true)

    renderWithAppProviders(
      <CharacterSheetAdjustmentEditor
        editor={abilityPanelFixture.editors[0]}
        pending={false}
        onClear={vi.fn().mockResolvedValue(true)}
        onCommit={onCommit}
      />
    )

    const input = screen.getByRole('textbox', { name: 'Other modifier' })
    await user.type(input, '3')
    await user.tab()

    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceCategory: 'MANUAL',
        value: 3
      })
    )
  })

  it('announces command failures inside the overlay', async () => {
    server.use(
      http.get('*/api/trpc/characters.panel', () => panelResponse(abilityPanelFixture))
    )

    renderWithAppProviders(
      <CharacterSheetInspector
        characterId='character-owned'
        commandError='The server rejected this change.'
        expectedVersion={4}
        pending={false}
        submitCommand={vi.fn().mockResolvedValue(false)}
        target={{ kind: 'ABILITY', ability: 'STRENGTH' }}
        onClose={vi.fn()}
        onTargetChange={vi.fn()}
      />
    )

    const inspector = await screen.findByRole('dialog', { name: 'Strength' })
    expect(
      within(inspector).getByRole('alert', {
        name: 'Character sheet update failed'
      })
    ).toHaveTextContent('The server rejected this change.')
  })

  it('commits select changes immediately', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn().mockResolvedValue(true)

    renderWithAppProviders(
      <CharacterSheetAdjustmentEditor
        editor={savingThrowPanelFixture.proficiencyEditor}
        pending={false}
        onClear={vi.fn().mockResolvedValue(true)}
        onCommit={onCommit}
      />
    )

    await user.click(screen.getByRole('combobox', { name: 'Proficiency' }))
    const option = await waitFor(() => {
      const element = document.querySelector<HTMLElement>(
        '[role="option"][value="FULL"]'
      )
      if (!element) throw new Error('Proficient option is not available')
      return element
    })
    await user.click(option)

    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceCategory: 'MANUAL',
        value: 'FULL'
      })
    )
  })

  it('shows a field error when the server rejects an edit', async () => {
    const user = userEvent.setup()

    renderWithAppProviders(
      <CharacterSheetAdjustmentEditor
        editor={abilityPanelFixture.editors[0]}
        pending={false}
        onClear={vi.fn().mockResolvedValue(true)}
        onCommit={vi.fn().mockResolvedValue(false)}
      />
    )

    const input = screen.getByRole('textbox', { name: 'Other modifier' })
    await user.type(input, '2')
    await user.tab()

    expect(
      await screen.findByText(
        'The adjustment could not be saved. The server value was restored.'
      )
    ).toBeVisible()
    expect(input).toHaveValue('')
  })
})
