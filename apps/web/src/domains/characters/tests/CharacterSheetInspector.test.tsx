import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterAll, beforeAll, expect, vi } from 'vitest'

import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { server } from '#test/msw/server'
import { characterSheetFixture } from '../character.fixtures'
import { CharacterSheetAdjustmentEditor } from '../components/sheet/panels/CharacterSheetAdjustmentEditor'
import { CharacterSheetInspector } from '../components/sheet/panels/CharacterSheetInspector'
import { CharacterSheetItemPanelContent } from '../components/sheet/panels/CharacterSheetItemPanel'
import { CharacterSheetSpellCustomizationEditor } from '../components/sheet/panels/CharacterSheetSpellCustomizationEditor'
import {
  abilityPanelFixture,
  itemPanelFixture,
  savingThrowPanelFixture,
  spellPanelAttackDamageFixture,
  spellPanelConfiguredCustomizationsFixture
} from '../components/sheet/panels/characterSheetPanel.fixtures'
import { CharacterSheetView } from '../components/sheet/CharacterSheetView'

function panelResponse(panel: unknown) {
  return HttpResponse.json([{ result: { data: panel } }])
}

const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'scrollIntoView'
)

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

afterAll(() => {
  if (scrollIntoViewDescriptor) {
    Object.defineProperty(Element.prototype, 'scrollIntoView', scrollIntoViewDescriptor)
  } else {
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  }
})

describe('Character Sheet inspector', () => {
  it('opens as an overlay from the existing ability card', async () => {
    server.use(http.get('*/api/trpc/characters.panel', () => panelResponse(abilityPanelFixture)))
    const user = userEvent.setup()

    renderWithAppProviders(
      <CharacterSheetView
        characterPublicId='character-owned'
        hasDraft={false}
        sheet={characterSheetFixture}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Inspect Strength ability' }))

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
        value: 3
      })
    )
  })

  it('announces command failures inside the overlay', async () => {
    server.use(http.get('*/api/trpc/characters.panel', () => panelResponse(abilityPanelFixture)))

    renderWithAppProviders(
      <CharacterSheetInspector
        characterId='character-owned'
        commandError='The server rejected this change.'
        expectedVersion={4}
        pending={false}
        submitCommand={vi.fn().mockResolvedValue(false)}
        target={{ kind: 'ABILITY', ability: 'STRENGTH' }}
        onClose={vi.fn()}
        onOpenBuilder={vi.fn()}
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
      const element = document.querySelector<HTMLElement>('[role="option"][value="FULL"]')
      if (!element) throw new Error('Proficient option is not available')
      return element
    })
    await user.click(option)

    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
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
      await screen.findByText('The adjustment could not be saved. The server value was restored.')
    ).toBeVisible()
    expect(input).toHaveValue('')
  })

  it('opens a contextual spell customization without persisting until its value commits', async () => {
    const user = userEvent.setup()
    const onSet = vi.fn().mockResolvedValue(true)

    renderWithAppProviders(
      <CharacterSheetSpellCustomizationEditor
        options={spellPanelAttackDamageFixture.customizationOptions}
        pending={false}
        onRemove={vi.fn().mockResolvedValue(true)}
        onSet={onSet}
      />
    )

    await user.click(screen.getByRole('combobox', { name: 'Add customization' }))
    await user.click(await screen.findByRole('option', { hidden: true, name: 'Spell attack' }))

    expect(onSet).not.toHaveBeenCalled()
    const value = screen.getByRole('textbox', { name: 'Value' })
    await user.type(value, '7')
    await user.tab()

    expect(onSet).toHaveBeenCalledWith({
      category: 'TO_HIT',
      mode: 'BONUS',
      value: 7
    })
  })

  it('replaces an existing spell customization mode immediately with its value and note', async () => {
    const user = userEvent.setup()
    const onSet = vi.fn().mockResolvedValue(true)

    renderWithAppProviders(
      <CharacterSheetSpellCustomizationEditor
        options={[spellPanelConfiguredCustomizationsFixture.customizationOptions[0]!]}
        pending={false}
        onRemove={vi.fn().mockResolvedValue(true)}
        onSet={onSet}
      />
    )

    await user.click(screen.getByRole('combobox', { name: 'Mode' }))
    await user.click(await screen.findByRole('option', { hidden: true, name: 'Override' }))

    expect(onSet).toHaveBeenCalledWith({
      category: 'TO_HIT',
      mode: 'OVERRIDE',
      value: 2,
      sourceNote: 'Wand of the War Mage'
    })
  })

  it('commits owned-item resource, quantity, and removal commands immediately', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)
    const onClose = vi.fn()
    const panel = {
      ...itemPanelFixture,
      facts: itemPanelFixture.facts.map((fact) =>
        fact.label === 'Quantity' ? { ...fact, value: '2' } : fact
      )
    }

    renderWithAppProviders(
      <CharacterSheetItemPanelContent
        expectedVersion={4}
        panel={panel}
        pending={false}
        submitCommand={submitCommand}
        onClose={onClose}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Use' }))
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'USE_SHEET_RESOURCE',
      expectedVersion: 4,
      owner: itemPanelFixture.resources[0]!.target.owner
    })

    await user.click(screen.getByRole('button', { name: 'Customize' }))
    await user.click(await screen.findByRole('button', { name: '−' }))
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'UPDATE_INVENTORY_ITEM',
      expectedVersion: 4,
      itemId: itemPanelFixture.itemInstanceId,
      quantity: 1
    })

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(
      await screen.findByRole('dialog', { name: 'Remove Moon-Touched Longsword?' })
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove item' }))
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'REMOVE_INVENTORY_ITEM',
      expectedVersion: 4,
      itemId: itemPanelFixture.itemInstanceId
    })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
