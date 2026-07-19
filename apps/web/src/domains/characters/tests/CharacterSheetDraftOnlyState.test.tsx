import { screen } from '@testing-library/react'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CharacterSheetDraftOnlyState } from '../components/sheet/CharacterSheetDraftOnlyState'

describe('CharacterSheetDraftOnlyState', () => {
  it('routes draft-only characters back into the builder instead of showing not found', () => {
    renderWithAppProviders(
      <CharacterSheetDraftOnlyState characterPublicId='character-draft' label='' />
    )

    expect(screen.getByText(/builder draft in progress/i)).toBeInTheDocument()
    expect(screen.getByText(/untitled character/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resume builder/i })).toBeInTheDocument()
    expect(screen.queryByText(/could not be found/i)).not.toBeInTheDocument()
  })
})
