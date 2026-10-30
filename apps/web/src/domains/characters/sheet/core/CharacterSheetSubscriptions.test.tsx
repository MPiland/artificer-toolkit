import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { getFunctionName } from 'convex/server'
import { api } from '@artificer-toolkit/apis/convex/api'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CharacterSheetFixtureView } from '../fixtures/CharacterSheetFixtureView'
import { createSheet } from '../tests/sheetTestHarness'

vi.mock('../dice/useCharacterSheetRollController', () => ({
  useCharacterSheetRollController: () => ({
    destinations: {},
    presentation: {},
    rolls: { pending: false }
  })
}))
vi.mock('../dice/CharacterSheetManualRoll', () => ({ CharacterSheetManualRoll: () => null }))
vi.mock('../dice/CharacterSheetRollHistory', () => ({ CharacterSheetRollHistory: () => null }))
vi.mock('#app/components/dice/DiceRollPresentation', () => ({ DiceRollPresentation: () => null }))
vi.mock('../hero/CharacterSheetHero', () => ({ CharacterSheetHero: () => null }))
vi.mock('#app/data/characters/mutations', () => ({
  useCharacterSheetCommandMutation: () => ({ isPending: false }),
  useCharacterRestPreviewMutation: () => ({ isPending: false })
}))

const sheetSliceQueryName = getFunctionName(api.characters.sheetSlices.get)
let queryClient: QueryClient
const createdSlices: unknown[] = []
function Sheet() {
  queryClient = useQueryClient()
  const [unsubscribe] = useState(() =>
    queryClient.getQueryCache().subscribe((event) => {
      const args = event.query.queryKey[2]
      if (
        event.type === 'added' &&
        event.query.queryKey[1] === sheetSliceQueryName &&
        args &&
        typeof args === 'object' &&
        'slice' in args
      )
        createdSlices.push(args.slice)
    })
  )
  useEffect(() => unsubscribe, [unsubscribe])
  return (
    <CharacterSheetFixtureView
      characterPublicId='character-1'
      hasDraft={false}
      sheet={createSheet()}
    />
  )
}
function mountedSlices() {
  return queryClient
    .getQueryCache()
    .findAll()
    .filter((query) => query.queryKey[1] === sheetSliceQueryName && query.getObserversCount() > 0)
    .map((query) => {
      const args = query.queryKey[2]
      return args && typeof args === 'object' && 'slice' in args ? args.slice : null
    })
}

afterEach(() => vi.restoreAllMocks())
beforeEach(() => {
  createdSlices.length = 0
})

describe('Character Sheet collection subscriptions', () => {
  it('mounts only desktop Actions, then releases it when Inventory opens', async () => {
    renderWithAppProviders(<Sheet />)
    await waitFor(() => expect(mountedSlices()).toEqual(['ACTIONS']))
    await userEvent.click(screen.getByRole('tab', { name: 'Inventory' }))
    await waitFor(() => expect(mountedSlices()).toEqual(['INVENTORY']))
    await waitFor(() =>
      expect(
        queryClient
          .getQueryCache()
          .findAll()
          .some((query) => {
            const args = query.queryKey[2]
            return args && typeof args === 'object' && 'slice' in args && args.slice === 'ACTIONS'
          })
      ).toBe(false)
    )
  })

  it('does not load desktop Actions behind the mobile Overview', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((media) => ({
      matches: media === '(max-width: 760px)',
      media,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    }))
    renderWithAppProviders(<Sheet />)
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: 'Character sheet mobile pages' })).getAllByRole(
          'heading',
          { name: 'Overview' }
        ).length
      ).toBeGreaterThan(0)
    )
    expect(mountedSlices()).toEqual([])
    expect(createdSlices).toEqual([])
    await userEvent.click(screen.getByRole('tab', { name: 'Inventory' }))
    await waitFor(() => expect(mountedSlices()).toEqual(['INVENTORY']))
    expect(createdSlices).toEqual(['INVENTORY'])
  })
})
