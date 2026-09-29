import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { getFunctionName } from 'convex/server'
import type {
  EncounterGmProjectionDto,
  EncounterSummaryDto
} from '@artificer-toolkit/schema/api/encounters'
import { summarizeEncounterProjection } from '#app/data/encounters/summaries'
import { queryKeys } from '#app/lib/queryKeys'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import {
  createTabletopCampaign,
  tabletopGmEncounter
} from '../vtt/CampaignTabletop.stories.fixtures'

const mocks = vi.hoisted(() => ({
  commandReady: true,
  convexQuery: vi.fn(),
  pendingDecision: null as object | null,
  sendEncounterCommand: vi.fn(),
  useMutation: vi.fn(),
  useQuery: vi.fn(),
  useQueryClient: vi.fn()
}))

vi.mock('@convex-dev/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convex-dev/react-query')>()),
  convexQuery: mocks.convexQuery
}))
vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useConvex: () => ({})
}))
vi.mock('../vtt/useCampaignLiveSession', () => ({
  useCampaignLiveSession: () => ({
    commandReady: mocks.commandReady,
    error: null,
    sendEncounterCommand: mocks.sendEncounterCommand
  })
}))
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useMutation: mocks.useMutation,
  useQuery: mocks.useQuery,
  useQueryClient: mocks.useQueryClient
}))
vi.mock('#app/data/contentSnapshots/useContentCatalogue', () => ({
  useContentCatalogue: () => ({
    items: [],
    summary: undefined,
    updating: false,
    isPending: false,
    isError: false
  })
}))
vi.mock('#app/data/systems/useSystemList', () => ({
  useSystemList: () => ({ data: [], isPending: false })
}))
vi.mock('./EncounterActorCard', () => ({
  EncounterActorCard: () => null
}))
vi.mock('./EncounterReminders', () => ({
  EncounterReminders: () => null
}))

import { CampaignEncounterWorkspace } from './CampaignEncounterWorkspace'

const thirdActor = {
  ...tabletopGmEncounter.actors[1]!,
  id: '99999999-9999-4999-8999-999999999904',
  label: 'Third enemy'
}

function encounterWithThirdActor(): EncounterGmProjectionDto {
  return { ...tabletopGmEncounter, actors: [...tabletopGmEncounter.actors, thirdActor] }
}

function renderWorkspace(
  encounter: EncounterGmProjectionDto = encounterWithThirdActor(),
  role: 'OWNER' | 'PLAYER' = 'OWNER'
) {
  return renderWithAppProviders(
    <CampaignEncounterWorkspace
      campaign={createTabletopCampaign(role)}
      currentUserId='22222222-2222-4222-8222-222222222222'
      encounter={encounter}
      onUpdated={vi.fn()}
    />
  )
}

describe('CampaignEncounterWorkspace controls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.commandReady = true
    mocks.pendingDecision = null
    mocks.convexQuery.mockImplementation((reference: unknown) => ({
      queryKey: [getFunctionName(reference as Parameters<typeof getFunctionName>[0])]
    }))
    mocks.useQuery.mockImplementation((options: { queryKey: readonly unknown[] }) => {
      if (
        options.queryKey[0] ===
        getFunctionName(convexApi.encounters.pendingReads.pendingRuleOccurrence)
      ) {
        return { data: mocks.pendingDecision, error: null, isPending: false }
      }
      if (
        options.queryKey[0] === getFunctionName(convexApi.encounters.projectionReads.actorSides)
      ) {
        return {
          data: {
            encounterId: tabletopGmEncounter.id,
            version: tabletopGmEncounter.version,
            actors: encounterWithThirdActor().actors.map((actor) => ({
              id: actor.id,
              sideId:
                actor.kind === 'CHARACTER'
                  ? '11111111-1111-4111-8111-111111111110'
                  : '11111111-1111-4111-8111-111111111111'
            }))
          },
          error: null,
          isPending: false
        }
      }
      if (options.queryKey.some((item) => item === 'creatures')) {
        return { data: [], error: null, isPending: false }
      }
      return { data: { entries: [] }, error: null, isPending: false }
    })
    mocks.useQueryClient.mockReturnValue({
      invalidateQueries: vi.fn(),
      setQueryData: vi.fn()
    })
    mocks.sendEncounterCommand.mockResolvedValue({ projection: tabletopGmEncounter, roll: null })
    mocks.useMutation.mockImplementation(
      (options: {
        mutationFn: (input: unknown) => Promise<unknown>
        onSuccess: (result: unknown) => void
      }) => ({
        error: null,
        isPending: false,
        mutate: (input: unknown) => {
          void options.mutationFn(input).then(options.onSuccess)
        }
      })
    )
  })

  it('reorders the remaining cohort with the current version and full actor order', async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await user.click(screen.getByRole('button', { name: 'Move Third enemy earlier' }))

    expect(mocks.sendEncounterCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        encounterId: tabletopGmEncounter.id,
        expectedVersion: tabletopGmEncounter.version,
        type: 'REORDER',
        actorIds: [
          tabletopGmEncounter.actors[0]!.id,
          thirdActor.id,
          tabletopGmEncounter.actors[1]!.id
        ]
      })
    )
  })

  it('writes a command result into the Run detail and its list summary', async () => {
    const setQueryData = vi.fn()
    mocks.useQueryClient.mockReturnValue({ invalidateQueries: vi.fn(), setQueryData })
    const user = userEvent.setup()
    renderWorkspace()

    await user.click(screen.getByRole('button', { name: 'Move Third enemy earlier' }))

    await waitFor(() => expect(setQueryData).toHaveBeenCalledTimes(2))
    const [[detailKey, updateDetail], [listKey, updateList]] = setQueryData.mock.calls as [
      [unknown, (current: EncounterGmProjectionDto | undefined) => EncounterGmProjectionDto],
      [unknown, (current: EncounterSummaryDto[] | undefined) => EncounterSummaryDto[]]
    ]
    expect(detailKey).toEqual(queryKeys.encounters.detail(tabletopGmEncounter.id))
    expect(updateDetail(undefined)).toEqual(tabletopGmEncounter)
    const newer = { ...tabletopGmEncounter, version: tabletopGmEncounter.version + 1 }
    expect(updateDetail(newer)).toBe(newer)

    expect(listKey).toEqual(queryKeys.encounters.list(createTabletopCampaign('OWNER').id))
    const other = {
      ...summarizeEncounterProjection(tabletopGmEncounter),
      id: '99999999-9999-4999-8999-999999999905'
    }
    const stale = {
      ...summarizeEncounterProjection(tabletopGmEncounter),
      name: 'Stale name',
      version: tabletopGmEncounter.version - 1
    }
    expect(updateList([other, stale])).toEqual([
      other,
      summarizeEncounterProjection(tabletopGmEncounter)
    ])
  })

  it('disables command controls until the live table is command-ready', () => {
    mocks.commandReady = false
    renderWorkspace()

    expect(screen.getByText('Connecting to the table…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add enemy' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Third enemy earlier' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove Third enemy' })).toBeDisabled()
  })

  it('keeps SIDE_ROLL reorder inside the settled side group', () => {
    const encounter = encounterWithThirdActor()
    encounter.currentActorId = null
    encounter.initiativePolicy = {
      definitionId: '11111111-1111-4111-8111-111111111112',
      label: 'Side roll',
      procedure: 'SIDE_ROLL',
      cadence: 'ENCOUNTER_START',
      tieResolverDefinitionId: '11111111-1111-4111-8111-111111111113',
      tieResolverLabel: 'Stable order'
    }
    renderWorkspace(encounter)
    expect(
      screen.getByRole('button', { name: 'Move ' + encounter.actors[1]!.label + ' earlier' })
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Third enemy earlier' })).toBeEnabled()
  })
  it('disables structure controls while a rule occurrence is pending', () => {
    mocks.pendingDecision = { kind: 'INITIATIVE_DECLARATION' }
    renderWorkspace()

    expect(screen.getByRole('button', { name: 'Add enemy' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Third enemy earlier' })).toBeDisabled()
  })

  it('submits a custom reinforcement and hides controls for a player', async () => {
    const user = userEvent.setup()
    const ownerView = renderWorkspace()
    await user.click(screen.getByRole('button', { name: 'Add enemy' }))
    await user.click(screen.getByRole('combobox', { name: 'Enemy type' }))
    await user.click(await screen.findByRole('option', { name: 'Custom enemy' }))
    await user.type(screen.getByLabelText('Custom enemy name'), 'Brass Defender')
    await user.clear(screen.getByLabelText('Max HP'))
    await user.type(screen.getByLabelText('Max HP'), '80')
    await user.type(screen.getByLabelText('Initiative'), '16')
    await user.click(screen.getAllByRole('button', { name: 'Add enemy' }).at(-1)!)

    expect(mocks.sendEncounterCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        encounterId: tabletopGmEncounter.id,
        expectedVersion: tabletopGmEncounter.version,
        type: 'REINFORCE',
        enemy: { kind: 'CUSTOM', label: 'Brass Defender', maxHitPoints: 80 },
        initiative: 16
      })
    )

    ownerView.unmount()
    renderWorkspace(tabletopGmEncounter, 'PLAYER')
    expect(screen.queryByRole('button', { name: 'Add enemy' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Move .* earlier/ })).not.toBeInTheDocument()
  })
})
