import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { getFunctionName } from 'convex/server'
import type { EncounterGmProjectionDto } from '@artificer-toolkit/schema/api/encounters'
import { campaignClockDtoSchema } from '@artificer-toolkit/schema/api/campaignSessions'
import type { HeldEncounterSession } from '../vtt/useCampaignLiveSession'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import {
  createTabletopCampaign,
  tabletopGmEncounter
} from '../vtt/CampaignTabletop.stories.fixtures'

const mocks = vi.hoisted(() => ({
  advanceClock: vi.fn(),
  commandReady: true,
  convexQuery: vi.fn(),
  encounterSession: null as HeldEncounterSession | null,
  pendingDecision: null as object | null,
  sendEncounterCommand: vi.fn(),
  useMutation: vi.fn(),
  useQuery: vi.fn()
}))

vi.mock('@convex-dev/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convex-dev/react-query')>()),
  convexQuery: mocks.convexQuery
}))
vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useConvex: () => ({}),
  useMutation: () => mocks.advanceClock
}))
vi.mock('../vtt/useCampaignLiveSession', () => ({
  useCampaignLiveSession: () => ({
    commandReady: mocks.commandReady,
    encounterSession: mocks.encounterSession,
    error: null,
    readEncounter: () => Promise.reject(new Error('Live play is not connected.')),
    sendEncounterCommand: mocks.sendEncounterCommand
  })
}))
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useMutation: mocks.useMutation,
  useQuery: mocks.useQuery
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

const clock = campaignClockDtoSchema.parse({
  campaignId: createTabletopCampaign('OWNER').id,
  day: 2,
  minuteOfDay: 480,
  running: true,
  runningSince: '2026-08-15T22:25:00.000Z',
  dawnMinute: 360,
  duskMinute: 1080,
  processedBoundaryAbsoluteMinute: 0,
  pausedForCombat: false,
  version: 4,
  updatedAt: '2026-08-15T22:25:00.000Z'
})

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
    mocks.encounterSession = null
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
      if (options.queryKey[0] === getFunctionName(convexApi.campaigns.clock.get)) {
        return { data: clock, error: null, isPending: false }
      }
      if (options.queryKey.some((item) => item === 'creatures')) {
        return { data: [], error: null, isPending: false }
      }
      return { data: { entries: [] }, error: null, isPending: false }
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

  it('commands the held Run at the version the room pushed', async () => {
    const roomEncounter = { ...encounterWithThirdActor(), version: tabletopGmEncounter.version + 5 }
    mocks.encounterSession = {
      held: true,
      version: roomEncounter.version,
      state: {
        encounter: roomEncounter,
        pending: null,
        waitingOn: null,
        turnMovement: [],
        halfSpeedFields: [],
        auras: [],
        movementCostZones: [],
        placedZones: []
      },
      preparedPending: [],
      actorSides: null,
      settlement: null,
      timeline: { entries: [], nextCursor: null }
    }
    const user = userEvent.setup()
    renderWorkspace(tabletopGmEncounter)

    await user.click(screen.getByRole('button', { name: 'Move Third enemy earlier' }))

    expect(mocks.sendEncounterCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        encounterId: tabletopGmEncounter.id,
        expectedVersion: roomEncounter.version,
        type: 'REORDER'
      })
    )
  })

  describe('completing the Encounter (SPELLS-5.13)', () => {
    async function complete(rounds: number) {
      mocks.sendEncounterCommand.mockResolvedValue({
        projection: { ...tabletopGmEncounter, status: 'COMPLETED', round: rounds },
        roll: null
      })
      mocks.advanceClock.mockResolvedValue(clock)
      const user = userEvent.setup()
      renderWorkspace(tabletopGmEncounter)
      await user.click(screen.getByRole('button', { name: 'Encounter actions' }))
      await user.click(await screen.findByRole('menuitem', { name: 'Complete encounter' }))
      const dialog = await screen.findByRole('dialog', { name: 'Complete encounter?' })
      await user.click(within(dialog).getByRole('button', { name: 'Complete encounter' }))
      await screen.findByText('Advance world time?')
      return user
    }

    it("offers the GM to advance the Campaign clock by the Encounter's elapsed rounds", async () => {
      const user = await complete(12)

      expect(mocks.sendEncounterCommand).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'COMPLETE', encounterId: tabletopGmEncounter.id })
      )
      expect(screen.getByText(/lasted 12 rounds/)).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Advance 2 minutes' }))

      expect(mocks.advanceClock).toHaveBeenCalledWith(
        expect.objectContaining({ campaignId: clock.campaignId, expectedVersion: 4, minutes: 2 })
      )
      await waitFor(() => expect(screen.queryByText('Advance world time?')).not.toBeInTheDocument())
    })

    it('leaves the clock alone when the GM declines', async () => {
      const user = await complete(1)

      await user.click(screen.getByRole('button', { name: 'Not now' }))

      expect(screen.queryByText('Advance world time?')).not.toBeInTheDocument()
      expect(mocks.advanceClock).not.toHaveBeenCalled()
    })
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

  describe('area history lines', () => {
    function holdTimeline(gmLines: string[]) {
      const roomEncounter = encounterWithThirdActor()
      mocks.encounterSession = {
        held: true,
        version: roomEncounter.version,
        state: {
          encounter: roomEncounter,
          pending: null,
          waitingOn: null,
          turnMovement: [],
          halfSpeedFields: [],
          auras: [],
          movementCostZones: [],
          placedZones: []
        },
        preparedPending: [],
        actorSides: null,
        settlement: null,
        timeline: {
          entries: [
            {
              id: '99999999-9999-4999-8999-999999999a01',
              version: roomEncounter.version,
              commandType: 'RESOLVE_ACTION',
              visibility: 'ISSUER',
              actorUserId: '22222222-2222-4222-8222-222222222222',
              createdAt: '2026-10-10T12:00:00.000Z',
              roll: null,
              label: 'Fireball',
              ruleOverrides: [],
              issuerLines: ['Goblin failed its save', 'An unperceived creature failed its save'],
              gmLines
            }
          ],
          nextCursor: null
        }
      }
    }

    it('shows a GM read of an area entry with its issuer lines and GM-only lines marked', () => {
      holdTimeline(['GM removed Ogre from the area'])
      renderWorkspace()

      expect(screen.getByText('Goblin failed its save')).toBeInTheDocument()
      expect(screen.getByText('An unperceived creature failed its save')).toBeInTheDocument()
      expect(screen.getByText('GM removed Ogre from the area')).toBeInTheDocument()
      expect(screen.getAllByText('GM only')).toHaveLength(1)
    })

    it('shows a player read of an area entry with issuer lines and no GM-only marker', () => {
      holdTimeline([])
      renderWorkspace(encounterWithThirdActor(), 'PLAYER')

      expect(screen.getByText('Goblin failed its save')).toBeInTheDocument()
      expect(screen.queryByText('GM only')).not.toBeInTheDocument()
    })
  })
})
