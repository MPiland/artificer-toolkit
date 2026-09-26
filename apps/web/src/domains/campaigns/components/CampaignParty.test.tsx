import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getFunctionName } from 'convex/server'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CampaignParty } from './CampaignParty'

const mocks = vi.hoisted(() => ({
  page: {
    results: [] as { id: string; assignedCharacter: { id: string } | null }[],
    status: 'Exhausted',
    loadMore: vi.fn()
  },
  characters: {
    data: {
      items: [
        { id: 'character-1', label: 'Aria', status: 'ACTIVE' },
        { id: 'character-2', label: 'Borin', status: 'ACTIVE' }
      ]
    },
    isLoading: false
  },
  paginatedQuery: vi.fn(),
  uuid: vi.fn<() => ReturnType<typeof crypto.randomUUID>>(),
  assign: vi.fn(),
  unassign: vi.fn(),
  leave: vi.fn(),
  remove: vi.fn(),
  personalSheet: vi.fn(),
  campaignSheet: vi.fn(),
  queryData: vi.fn<(queryKey: unknown[]) => unknown>(() => undefined),
  portrait: vi.fn()
}))
vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  usePaginatedQuery: (...args: unknown[]) => {
    mocks.paginatedQuery(...args)
    return mocks.page
  },
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    switch (getFunctionName(reference)) {
      case 'campaigns/assignments:assign':
        return mocks.assign
      case 'campaigns/assignments:unassign':
        return mocks.unassign
      case 'campaigns/membershipDeparture:leave':
        return mocks.leave
      case 'campaigns/membershipDeparture:removeMember':
        return mocks.remove
      default:
        throw new Error('Unexpected mutation')
    }
  }
}))
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQueries: ({ queries }: { queries: { queryKey: unknown[] }[] }) =>
    queries.map((query) => ({ data: mocks.queryData(query.queryKey) }))
}))
vi.mock('@convex-dev/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convex-dev/react-query')>()),
  convexQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
    mocks.campaignSheet(reference, args)
    return { queryKey: [getFunctionName(reference), args] }
  }
}))
vi.mock('#app/data/characters/queries', () => ({
  useGetCharacterList: () => mocks.characters,
  getCharacterSheet: (...args: unknown[]) => {
    mocks.personalSheet(...args)
    return { queryKey: ['personal-sheet'] }
  }
}))
vi.mock('#app/data/media', () => ({
  useMediaImage: (target: { lookup: unknown }) => {
    mocks.portrait(target.lookup)
    return { data: null }
  }
}))
vi.mock('#domains/characters/sheet/core/CharacterSheetView', () => ({
  CharacterSheetView: () => null
}))

const campaign = {
  id: '11111111-1111-4111-8111-111111111111',
  publicId: 'ashen-road',
  name: 'The Ashen Road',
  description: null,
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  toneDetails: null,
  contentMaturity: 'STANDARD',
  gameSystemId: '00000000-0000-4000-8000-000000000001',
  primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
  additionalRulesCatalogueIds: [],
  status: 'ACTIVE',
  role: 'OWNER',
  version: 1,
  memberCount: 1,
  playerCount: 0,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  attunementSlotOverride: null,
  assignedCharacter: null,
  memberships: [],
  capabilities: {
    edit: true,
    archive: true,
    delete: true,
    invite: true,
    manageMembers: true,
    manageCharacters: true,
    assignOwnCharacter: false,
    manageSharedContent: true,
    shareOwnedContent: true,
    managePartyInventory: true,
    transferOwnInventory: true,
    manageNotes: true,
    contributeSessionNotes: true,
    readTableChat: true,
    readPartyChat: true
  }
} satisfies CampaignDetailDto

const convexQueryNames = () =>
  mocks.campaignSheet.mock.calls.map(([reference]) =>
    getFunctionName(reference as Parameters<typeof getFunctionName>[0])
  )

const playerId = '22222222-2222-4222-8222-222222222222'
const accessStartedAt = '2026-09-02T00:00:00.000Z'
const playerMembership = {
  userId: playerId,
  username: 'aria',
  role: 'PLAYER' as const,
  accessStartedAt,
  acceptedAt: accessStartedAt,
  assignedCharacter: null
}
const playerCampaign: CampaignDetailDto = {
  ...campaign,
  role: 'PLAYER',
  memberships: [playerMembership],
  capabilities: {
    ...campaign.capabilities,
    manageMembers: false,
    assignOwnCharacter: true
  }
}

describe('CampaignParty native transport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.queryData.mockImplementation(() => undefined)
    mocks.page.results = []
    mocks.page.status = 'Exhausted'
    mocks.characters.isLoading = false
    mocks.assign.mockResolvedValue({ ok: true })
    mocks.unassign.mockResolvedValue({ ok: true })
    mocks.uuid.mockReturnValue('77777777-7777-4777-8777-777777777777')
    vi.spyOn(crypto, 'randomUUID').mockImplementation(mocks.uuid)
  })
  afterEach(() => vi.restoreAllMocks())

  it('loads the Campaign catalogue only while the Character picker is open', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(<CampaignParty campaign={playerCampaign} currentUserId={playerId} />)

    expect(mocks.paginatedQuery).toHaveBeenLastCalledWith(expect.anything(), 'skip', {
      initialNumItems: 8
    })
    await user.click(screen.getByRole('button', { name: 'Add Character' }))
    await waitFor(() =>
      expect(mocks.paginatedQuery).toHaveBeenLastCalledWith(
        expect.anything(),
        {},
        {
          initialNumItems: 8
        }
      )
    )
  })

  it('waits for both catalogues and excludes a Character assigned on a later Campaign page', async () => {
    const user = userEvent.setup()
    mocks.page.status = 'CanLoadMore'
    const view = renderWithAppProviders(
      <CampaignParty campaign={playerCampaign} currentUserId={playerId} openCharacterPicker />
    )
    expect(screen.getByRole('button', { name: 'Add Character' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /Aria/ })).not.toBeInTheDocument()
    mocks.page.status = 'LoadingMore'
    view.rerender(
      <CampaignParty campaign={playerCampaign} currentUserId={playerId} openCharacterPicker />
    )
    mocks.page.results = [{ id: 'another-campaign', assignedCharacter: { id: 'character-1' } }]
    mocks.page.status = 'Exhausted'
    mocks.characters.isLoading = true
    view.rerender(
      <CampaignParty campaign={playerCampaign} currentUserId={playerId} openCharacterPicker />
    )
    expect(screen.getByRole('button', { name: 'Add Character' })).toBeDisabled()
    mocks.characters.isLoading = false
    view.rerender(
      <CampaignParty campaign={playerCampaign} currentUserId={playerId} openCharacterPicker />
    )
    expect(screen.getByRole('button', { name: 'Add Character' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /Aria/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Borin/ }))
    await waitFor(() =>
      expect(mocks.assign).toHaveBeenCalledWith({
        campaignId: campaign.id,
        characterId: 'character-2'
      })
    )
  })

  it.each(['REMOVE', 'LEAVE'] as const)(
    'captures %s authority at confirmation and replays the exact input after the membership disappears',
    async (kind) => {
      const user = userEvent.setup()
      const command = kind === 'REMOVE' ? mocks.remove : mocks.leave
      command.mockRejectedValue(new Error('Departure acknowledgement unavailable.'))
      const initial: CampaignDetailDto =
        kind === 'REMOVE' ? { ...campaign, memberships: [playerMembership] } : playerCampaign
      const label = kind === 'REMOVE' ? 'Remove player' : 'Leave Campaign'
      const view = renderWithAppProviders(
        <CampaignParty campaign={initial} currentUserId={playerId} />
      )
      await user.click(screen.getByRole('button', { name: label }))
      expect(command).not.toHaveBeenCalled()
      const confirmedEpoch = '2026-09-03T00:00:00.000Z'
      view.rerender(
        <CampaignParty
          campaign={{
            ...initial,
            version: 2,
            memberships: [{ ...playerMembership, accessStartedAt: confirmedEpoch }]
          }}
          currentUserId={playerId}
        />
      )
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: label }))
      await waitFor(() => expect(command).toHaveBeenCalledTimes(1))
      const expected = {
        campaignId: campaign.id,
        expectedCampaignVersion: 2,
        expectedMembershipAccessStartedAt: confirmedEpoch,
        commandId: '77777777-7777-4777-8777-777777777777',
        ...(kind === 'REMOVE' ? { userId: playerId } : {})
      }
      expect(command).toHaveBeenLastCalledWith(expected)
      const originalInput: unknown = command.mock.calls[0]?.[0]
      view.rerender(
        <CampaignParty
          campaign={{ ...initial, version: 3, memberships: [] }}
          currentUserId={playerId}
        />
      )
      await waitFor(
        () =>
          expect(screen.getByText('Departure acknowledgement unavailable.')).toBeInTheDocument(),
        { timeout: 2500 }
      )
      expect(command).toHaveBeenCalledTimes(2)
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: label }))
      await waitFor(() => expect(command).toHaveBeenCalledTimes(4), {
        timeout: 2500
      })
      for (const [input] of command.mock.calls) {
        expect(input).toBe(originalInput)
        expect(input).toEqual(expected)
      }
      expect(mocks.uuid).toHaveBeenCalledTimes(1)
    }
  )

  it('forwards Player unassignment once and displays the native refusal', async () => {
    const user = userEvent.setup()
    const character = {
      id: 'character-1',
      publicId: 'aria',
      label: 'Aria',
      systemId: campaign.gameSystemId
    }
    mocks.unassign.mockRejectedValue(new Error('Archived Campaigns are read-only.'))
    renderWithAppProviders(
      <CampaignParty
        campaign={{
          ...playerCampaign,
          memberships: [{ ...playerMembership, assignedCharacter: character }]
        }}
        currentUserId={playerId}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Remove Character' }))
    await waitFor(() =>
      expect(screen.getByText('Archived Campaigns are read-only.')).toBeInTheDocument()
    )
    expect(mocks.unassign).toHaveBeenCalledTimes(1)
    expect(mocks.unassign).toHaveBeenCalledWith({ campaignId: campaign.id })
  })

  it('uses the private Campaign Sheet endpoint for GM roster inspection', () => {
    const character = {
      id: 'character-1',
      publicId: 'aria',
      label: 'Aria',
      systemId: campaign.gameSystemId
    }
    renderWithAppProviders(
      <CampaignParty
        campaign={{
          ...campaign,
          memberships: [{ ...playerMembership, assignedCharacter: character }]
        }}
        currentUserId='owner-1'
      />
    )
    expect(mocks.campaignSheet).toHaveBeenCalledWith(convexApi.campaigns.characterSheet.get, {
      campaignId: campaign.id,
      characterId: character.id
    })
    expect(mocks.personalSheet).not.toHaveBeenCalled()
  })

  it('retains personal Sheet reads for Player roster views', () => {
    const character = {
      id: 'character-1',
      publicId: 'aria',
      label: 'Aria',
      systemId: campaign.gameSystemId
    }
    renderWithAppProviders(
      <CampaignParty
        campaign={{
          ...playerCampaign,
          memberships: [{ ...playerMembership, assignedCharacter: character }]
        }}
        currentUserId={playerId}
      />
    )
    expect(mocks.personalSheet).toHaveBeenCalledWith(character.id)
    expect(convexQueryNames()).toEqual(['campaigns/characterSheet:basics'])
  })

  it.each([true, false])(
    'shows another player only roster basics, with View Sheet only when Party can view is %s',
    (sheetVisible) => {
      const own = {
        id: 'character-1',
        publicId: 'aria',
        label: 'Aria',
        systemId: campaign.gameSystemId
      }
      const other = {
        id: 'character-2',
        publicId: 'borin',
        label: 'Borin',
        systemId: campaign.gameSystemId
      }
      mocks.queryData.mockImplementation(([name, args]) =>
        name === 'campaigns/characterSheet:basics' &&
        (args as { characterId: string }).characterId === other.id
          ? {
              characterId: other.id,
              label: 'Borin',
              classSummary: 'Cleric 3',
              totalLevel: 3,
              sheetVisible
            }
          : undefined
      )
      renderWithAppProviders(
        <CampaignParty
          campaign={{
            ...playerCampaign,
            memberships: [
              { ...playerMembership, assignedCharacter: own },
              {
                ...playerMembership,
                userId: '33333333-3333-4333-8333-333333333333',
                username: 'borin',
                assignedCharacter: other
              }
            ]
          }}
          currentUserId={playerId}
        />
      )
      // Roster basics for everyone; another player's full Sheet query waits for View Sheet.
      expect(convexQueryNames()).toEqual([
        'campaigns/characterSheet:basics',
        'campaigns/characterSheet:basics',
        'campaigns/characterSheet:get'
      ])
      // Portraits use the Campaign-scoped read, which only covers Characters assigned here.
      for (const character of [own, other])
        expect(mocks.portrait).toHaveBeenCalledWith({
          type: 'CHARACTER_PORTRAIT',
          characterId: character.id,
          campaignId: campaign.id
        })
      const card = screen.getByText('Borin').closest('article')!
      expect(within(card).getByText('Cleric 3 · Level 3')).toBeInTheDocument()
      expect(within(card).queryByText(/HP/)).not.toBeInTheDocument()
      expect(within(card).queryByRole('button', { name: 'View Sheet' }) !== null).toBe(sheetVisible)
    }
  )
})
