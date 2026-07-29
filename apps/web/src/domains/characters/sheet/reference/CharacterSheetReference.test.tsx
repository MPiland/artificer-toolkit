import { screen } from '@testing-library/react'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CharacterSheetHero } from '../hero/CharacterSheetHero'
import { createSheet } from '../tests/sheetTestHarness'
import { CharacterSheetReference } from './CharacterSheetReference'

describe('Character Sheet reference', () => {
  it('keeps descriptive character prose out of the compact play header', () => {
    const sheet = createSheet()
    sheet.identity.description = '<p>A careful explorer with a dangerous curiosity.</p>'

    renderWithAppProviders(
      <CharacterSheetHero characterPublicId='character-1' hasDraft={false} sheet={sheet} />
    )

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

    renderWithAppProviders(<CharacterSheetReference sheet={sheet} />)

    expect(screen.getByText(/action surge/i)).toBeInTheDocument()
    expect(screen.getByText(/take one additional action/i)).toBeInTheDocument()
    expect(screen.getByText(/quarterstaff/i)).toBeInTheDocument()
    expect(screen.getByText(/equipment · proficient/i)).toBeInTheDocument()
    expect(screen.getByText(/darkvision/i)).toBeInTheDocument()
    expect(screen.getByText(/60 feet/i)).toBeInTheDocument()
  })
})
