import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  encounterCommandResultDtoSchema,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { pendingEncounterRuleOccurrenceSummaryDtoSchema } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { getFunctionName, type FunctionReference } from 'convex/server'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { tabletopGmEncounter } from '../vtt/CampaignTabletop.stories.fixtures'
import type { HeldEncounterSession } from '../vtt/useCampaignLiveSession'

const occurrenceId = '77777777-7777-4777-8777-777777777790'
const pending = pendingEncounterRuleOccurrenceSummaryDtoSchema.parse({
  kind: 'INITIATIVE_DECLARATION',
  occurrenceId,
  occurrenceVersion: 2,
  encounterVersion: tabletopGmEncounter.version,
  actorId: tabletopGmEncounter.actors[0]!.id,
  requestId: 'speed-factor-declaration',
  primaryOptions: [
    {
      kind: 'CHARACTER_ACTION',
      optionId: 'action:longsword',
      label: 'Longsword',
      selectionContract: 'a'.repeat(64)
    }
  ],
  bonusOptions: [],
  adjudicationFields: [],
  allowedResponses: ['INITIATIVE_DECLARATION']
})

const result = encounterCommandResultDtoSchema.parse({
  projection: tabletopGmEncounter,
  roll: null,
  occurrence: null,
  evidenceRoll: null
})

const heldRoom: HeldEncounterSession = {
  held: true,
  version: tabletopGmEncounter.version,
  state: {
    encounter: tabletopGmEncounter,
    pending,
    waitingOn: null,
    turnMovement: [],
    halfSpeedFields: [],
    auras: [],
    movementCostZones: [],
    placedZones: [],
    pendingZoneSightings: []
  },
  preparedPending: [],
  actorSides: null,
  settlement: null,
  timeline: null
}

const mocks = vi.hoisted(() => ({
  readEncounter: vi.fn(),
  sendCommand: vi.fn(),
  convexQuery: vi.fn(),
  useMutation: vi.fn(),
  useQuery: vi.fn()
}))

vi.mock('@convex-dev/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convex-dev/react-query')>()),
  convexQuery: mocks.convexQuery
}))
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useMutation: mocks.useMutation,
  useQuery: mocks.useQuery
}))

import { CampaignEncounterDecision } from './CampaignEncounterDecision'

describe('CampaignEncounterDecision', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.convexQuery.mockImplementation((reference: FunctionReference<'query'>) => ({
      queryKey: [getFunctionName(reference)]
    }))
    mocks.useQuery.mockReturnValue({ data: null })
    mocks.useMutation.mockImplementation((options) => ({
      isPending: false,
      mutateAsync: async (command: ResolveRuleOccurrenceInputDto) => {
        const next = await options.mutationFn(command)
        options.onSuccess?.(next)
        return next
      }
    }))
    mocks.sendCommand.mockResolvedValue(result)
  })

  it('submits the actual initiative declaration and disappears after the reactive pending update', async () => {
    const user = userEvent.setup()
    const view = renderWithAppProviders(
      <CampaignEncounterDecision
        canVoid
        connected
        encounter={tabletopGmEncounter}
        pending={pending}
        readEncounter={mocks.readEncounter}
        room={null}
        sendCommand={mocks.sendCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    await user.click(await screen.findByRole('combobox', { name: 'Primary action' }))
    await user.keyboard('{ArrowDown}{Enter}')
    await user.click(screen.getByRole('button', { name: 'Declare actions' }))

    await waitFor(() =>
      expect(mocks.sendCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'RESOLVE_RULE_OCCURRENCE',
          encounterId: tabletopGmEncounter.id,
          occurrenceId,
          expectedOccurrenceVersion: 2,
          resolution: {
            kind: 'INITIATIVE_DECLARATION',
            requestId: 'speed-factor-declaration',
            primary: { kind: 'CHARACTER_ACTION', optionId: 'action:longsword' },
            bonus: null
          }
        })
      )
    )

    view.rerender(
      <CampaignEncounterDecision
        canVoid
        connected
        encounter={tabletopGmEncounter}
        pending={null}
        readEncounter={mocks.readEncounter}
        room={null}
        sendCommand={mocks.sendCommand}
      />
    )
    expect(screen.queryByRole('button', { name: 'Open pending decision' })).not.toBeInTheDocument()
  })

  it('keeps declaration controls readonly while disconnected', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <CampaignEncounterDecision
        canVoid
        connected={false}
        encounter={tabletopGmEncounter}
        pending={pending}
        readEncounter={mocks.readEncounter}
        room={null}
        sendCommand={mocks.sendCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    expect(screen.getByRole('button', { name: 'Declare actions' })).toBeDisabled()
  })

  it('reads the latest evidence roll from the held room instead of Convex', async () => {
    mocks.readEncounter.mockResolvedValue({
      version: heldRoom.version,
      result: { kind: 'LATEST_EVIDENCE_ROLLS', result: [] }
    })
    renderWithAppProviders(
      <CampaignEncounterDecision
        canVoid
        connected
        encounter={tabletopGmEncounter}
        pending={pending}
        readEncounter={mocks.readEncounter}
        room={heldRoom}
        sendCommand={mocks.sendCommand}
      />
    )

    await waitFor(() =>
      expect(mocks.readEncounter).toHaveBeenCalledWith({
        kind: 'LATEST_EVIDENCE_ROLLS',
        input: { encounterId: tabletopGmEncounter.id }
      })
    )
    expect(
      mocks.convexQuery.mock.calls.filter(
        ([, args]) => args?.encounterId === tabletopGmEncounter.id
      )
    ).toHaveLength(0)
  })
})
