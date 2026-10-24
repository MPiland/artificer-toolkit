import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider, type QueryFunctionContext } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getFunctionName } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import { api } from '@artificer-toolkit/apis/convex/api'
import { characterSheetExtraCatalogReadInputSchema } from '@artificer-toolkit/schema/api/characterSheetData'
import { characterSheetFixture } from '../fixtures/characterSheet.fixtures'
import { CharacterSheetExtras } from './CharacterSheetExtras'

describe('CharacterSheetExtras native catalogue', () => {
  it('skips closed or unselected drawers and queries the selected native catalogue and search', async () => {
    const user = userEvent.setup()
    const query = vi.fn(async ({ queryKey }: QueryFunctionContext) => {
      expect(queryKey[1]).toBe(getFunctionName(api.characters.extraOptions.list))
      const input = characterSheetExtraCatalogReadInputSchema.parse(queryKey[2])
      expect(input.id).toBe(characterSheetFixture.meta.characterId)
      return {
        items: [
          {
            id: '00000000-0000-4000-8000-000000000504',
            label: input.kind === 'CREATURE' ? 'Owl' : 'Sailing Ship'
          }
        ],
        nextCursor: null
      }
    })
    const client = new QueryClient({
      defaultOptions: { queries: { queryFn: query, retry: false } }
    })
    const { unmount } = render(
      <MantineProvider>
        <QueryClientProvider client={client}>
          <CharacterSheetExtras
            pending={false}
            sheet={{
              ...characterSheetFixture,
              extras: {
                ...characterSheetFixture.extras,
                kindOptions: [
                  { code: 'COMPANION', label: 'Companion' },
                  { code: 'VEHICLE', label: 'Vehicle' }
                ]
              }
            }}
            submitCommand={vi.fn()}
          />
        </QueryClientProvider>
      </MantineProvider>
    )
    expect(query).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Add Extra' }))
    const drawer = await screen.findByRole('dialog', { name: 'Add Extra' })
    expect(query).not.toHaveBeenCalled()
    await user.click(within(drawer).getByRole('combobox', { name: 'Kind' }))
    await user.click(await screen.findByRole('option', { hidden: true, name: 'Companion' }))
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    expect(query.mock.calls[0]?.[0].queryKey[2]).toEqual({
      id: characterSheetFixture.meta.characterId,
      kind: 'CREATURE',
      limit: 25
    })
    const creature = within(drawer).getByRole('combobox', { name: 'Creature' })
    await user.type(creature, 'owl')
    await waitFor(() =>
      expect(query.mock.lastCall?.[0].queryKey[2]).toMatchObject({ kind: 'CREATURE', query: 'owl' })
    )
    await user.click(within(drawer).getByRole('combobox', { name: 'Kind' }))
    await user.click(await screen.findByRole('option', { hidden: true, name: 'Vehicle' }))
    await waitFor(() =>
      expect(query.mock.lastCall?.[0].queryKey[2]).toEqual({
        id: characterSheetFixture.meta.characterId,
        kind: 'VEHICLE',
        limit: 25
      })
    )
    await user.click(within(drawer).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(drawer).not.toBeInTheDocument())
    const count = query.mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Add Extra' }))
    expect(query).toHaveBeenCalledTimes(count)
    unmount()
    client.clear()
  })
})

describe('CharacterSheetExtras spell summons (D190)', () => {
  it('tracks a summon’s hit points and dismisses it from the Extras list', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn(async () => true)
    const summonId = '00000000-0000-4000-8000-000000000a01'
    render(
      <MantineProvider>
        <QueryClientProvider client={new QueryClient()}>
          <CharacterSheetExtras
            pending={false}
            sheet={{
              ...characterSheetFixture,
              extras: {
                ...characterSheetFixture.extras,
                items: [
                  {
                    kind: 'SPELL_SUMMON',
                    kindLabel: 'Spell Summon',
                    id: summonId,
                    spellId: 'arcane-hand',
                    originKind: 'SUMMONED',
                    originLabel: 'Summoned',
                    authoredName: 'Arcane Hand',
                    displayName: 'Arcane Hand',
                    isActive: true,
                    concentration: true,
                    armorClass: 20,
                    speedLabel: 'Fly 60 ft.',
                    hitPoints: { current: 40, maximum: 40, temp: 0 },
                    statBlock: {},
                    actions: [],
                    features: [],
                    equipmentItemIds: []
                  }
                ]
              }
            }}
            submitCommand={submitCommand}
          />
        </QueryClientProvider>
      </MantineProvider>
    )
    const summons = screen.getByRole('region', { name: 'Summons' })
    expect(within(summons).getByText('Concentration')).toBeInTheDocument()
    expect(within(summons).getByText('20')).toBeInTheDocument()
    expect(within(summons).getByText('Fly 60 ft.')).toBeInTheDocument()
    expect(within(summons).queryByText(/attack/i)).not.toBeInTheDocument()

    const hitPoints = within(summons).getByRole('textbox', {
      name: 'Arcane Hand current hit points'
    })
    await user.clear(hitPoints)
    await user.type(hitPoints, '12')
    await user.tab()
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'UPDATE_SHEET_EXTRA',
      expectedVersion: characterSheetFixture.meta.streamVersion,
      extra: { kind: 'SPELL_SUMMON', extraId: summonId, currentHitPoints: 12 }
    })

    await user.click(within(summons).getByRole('button', { name: 'Dismiss' }))
    expect(submitCommand).toHaveBeenLastCalledWith({
      type: 'REMOVE_SHEET_EXTRA',
      expectedVersion: characterSheetFixture.meta.streamVersion,
      extra: { kind: 'SPELL_SUMMON', extraId: summonId }
    })
  })
})
