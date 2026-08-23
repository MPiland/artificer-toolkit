import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CharacterSheetHero } from '../hero/CharacterSheetHero'
import { createSheet } from '../tests/sheetTestHarness'
import { CharacterSheetReference } from './CharacterSheetReference'

vi.mock('#app/components/MediaImage', () => ({ MediaImageControl: () => null }))

describe('Character Sheet reference', () => {
  it('keeps descriptive character prose out of the compact play header', () => {
    const sheet = createSheet()
    sheet.identity.description = '<p>A careful explorer with a dangerous curiosity.</p>'

    renderWithAppProviders(
      <CharacterSheetHero characterPublicId='character-1' editable hasDraft={false} sheet={sheet} />
    )

    const identity = screen.getByRole('region', { name: 'Character identity' })
    expect(within(identity).getByText('Character Sheet')).toBeInTheDocument()
    expect(
      within(identity).getByRole('heading', { name: sheet.identity.label })
    ).toBeInTheDocument()
    expect(screen.queryByText(/careful explorer/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/<p>a careful explorer/i)).not.toBeInTheDocument()
    expect(screen.queryByText(`Level ${sheet.identity.totalLevel}`)).not.toBeInTheDocument()
    expect(screen.getByText(sheet.identity.classSummary)).toBeInTheDocument()
  })

  it('renders reference feature descriptions as rules text', () => {
    const sheet = createSheet()
    sheet.reference.features = [
      {
        id: 'feature-1',
        label: 'Action Surge',
        sourceLabel: 'Fighter',
        source: { kind: 'CLASS', classId: 'fighter', classLevel: 2 },
        description: '<p>Take one additional action on your turn.</p>'
      }
    ]
    sheet.reference.proficiencies = [
      { kind: 'WEAPON', label: 'Quarterstaff', value: 'Equipment · Proficient' }
    ]
    sheet.reference.senses = [{ senseId: 'darkvision', label: 'Darkvision', value: '60 feet' }]

    renderWithAppProviders(
      <CharacterSheetReference
        pending={false}
        sheet={sheet}
        submitCommand={vi.fn().mockResolvedValue(true)}
      />
    )

    expect(screen.getByText(/action surge/i)).toBeInTheDocument()
    expect(screen.getByText(/take one additional action/i)).toBeInTheDocument()
    expect(screen.getByText(/quarterstaff/i)).toBeInTheDocument()
    expect(screen.getByText(/equipment · proficient/i)).toBeInTheDocument()
    expect(screen.getByText(/darkvision/i)).toBeInTheDocument()
    expect(screen.getByText(/60 feet/i)).toBeInTheDocument()
  })

  it('spends the linked item resource from an equipment feature', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)
    const sheet = createSheet()
    sheet.reference.features = [
      {
        id: 'warping-strike:item-1',
        label: 'Warping Strike',
        sourceLabel: 'The Astral Tear Awakened',
        source: {
          kind: 'EQUIPMENT_INSTANCE',
          equipmentId: 'equipment-1',
          itemInstanceId: 'item-1'
        },
        resourceGrantId: 'item-resource-1',
        resourceCost: 1
      }
    ]
    sheet.resources.items = [
      {
        id: 'item-resource-1',
        owner: {
          kind: 'ITEM_INSTANCE',
          chargeId: 'charges-1',
          itemInstanceId: 'item-1'
        },
        label: 'The Astral Tear Awakened charges',
        sourceLabel: 'The Astral Tear Awakened',
        used: 1,
        max: 3,
        remaining: 2,
        recoveries: [{ trigger: 'DAWN', amount: { kind: 'ALL' } }]
      }
    ]

    renderWithAppProviders(
      <CharacterSheetReference
        mode='features'
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )

    expect(screen.getByText('1 charge · 2 / 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Use Warping Strike' }))
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'USE_RESOURCE',
      expectedVersion: sheet.meta.streamVersion,
      resourceGrantId: 'item-resource-1'
    })
  })
})
