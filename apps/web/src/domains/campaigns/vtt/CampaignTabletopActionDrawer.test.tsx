import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type {
  EncounterCommandResultDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { EncounterActionChoiceDto } from '@artificer-toolkit/schema/api/encounterActionChoices'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CampaignTabletopActionDrawer } from './CampaignTabletopActionDrawer'
import { tabletopGmEncounter, tabletopLiveScene } from './CampaignTabletop.stories.fixtures'
import { LiveSessionCommandRejectedError } from './liveSessionClient'

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn()
  })
})

const actions = [
  {
    id: 'equipment-staff:attack',
    label: 'Quarterstaff',
    sourceLabel: 'Equipment',
    rangeLabel: '5 ft',
    attackBonus: 4,
    grip: null,
    wieldConflict: null
  }
] satisfies EncounterActionChoiceDto[]
const warnings = [
  { code: 'ACTION_ECONOMY_UNAVAILABLE' as const, message: 'No action left this turn.' },
  { code: 'TARGET_OUT_OF_RANGE' as const, message: 'The target is out of range.' }
]
const resolved: EncounterCommandResultDto = {
  projection: tabletopGmEncounter,
  roll: null,
  resolution: null,
  occurrence: null
}

function renderDrawer(onResolve: (command: ResolveEncounterActionInputDto) => Promise<unknown>) {
  renderWithAppProviders(
    <CampaignTabletopActionDrawer
      actionChoicesError={null}
      actions={actions}
      actionsLoading={false}
      actorIdByTokenId={new Map()}
      connected
      encounter={tabletopGmEncounter}
      opened
      optionalRules={[]}
      pending={false}
      scene={tabletopLiveScene}
      onClose={vi.fn()}
      onLoadOptionalChoices={vi.fn()}
      onOpen={vi.fn()}
      onResolve={async (command) => {
        await onResolve(command)
        return resolved
      }}
    />
  )
}

async function chooseActionAndTarget(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('combobox', { name: 'Action' }))
  await user.keyboard('{ArrowDown}{Enter}')
  await user.click(screen.getByRole('combobox', { name: 'Target' }))
  await user.keyboard('{ArrowDown}{Enter}')
  await user.click(screen.getByRole('button', { name: 'Resolve action' }))
}

describe('CampaignTabletopActionDrawer rule warnings', () => {
  it('shows the server warnings and resends with them acknowledged on "Do it anyway"', async () => {
    const user = userEvent.setup()
    const onResolve = vi
      .fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
      .mockImplementationOnce(async (command) => {
        throw new LiveSessionCommandRejectedError({
          code: 'DOMAIN_REJECTED',
          commandId: command.commandId,
          currentSequence: 3,
          message: 'This action breaks a rule. Do it anyway?',
          reason: 'RULE_WARNINGS',
          warnings
        })
      })
      .mockResolvedValue(resolved)
    renderDrawer(onResolve)

    await chooseActionAndTarget(user)
    const confirmation = await screen.findByRole('alert')
    expect(within(confirmation).getByText('No action left this turn.')).toBeVisible()
    expect(within(confirmation).getByText('The target is out of range.')).toBeVisible()
    expect(onResolve).toHaveBeenCalledWith(expect.objectContaining({ acknowledgedWarnings: [] }))

    await user.click(within(confirmation).getByRole('button', { name: 'Do it anyway' }))
    expect(onResolve).toHaveBeenCalledTimes(2)
    const [first, second] = onResolve.mock.calls.map(([command]) => command)
    expect(second).toMatchObject({
      actionId: first!.actionId,
      targetActorId: first!.targetActorId,
      acknowledgedWarnings: ['ACTION_ECONOMY_UNAVAILABLE', 'TARGET_OUT_OF_RANGE']
    })
    expect(second!.commandId).not.toBe(first!.commandId)
  })

  it('cancels without resending', async () => {
    const user = userEvent.setup()
    const onResolve = vi
      .fn<(command: ResolveEncounterActionInputDto) => Promise<unknown>>()
      .mockRejectedValueOnce(
        new LiveSessionCommandRejectedError({
          code: 'DOMAIN_REJECTED',
          commandId: crypto.randomUUID(),
          currentSequence: 3,
          message: 'This action breaks a rule. Do it anyway?',
          reason: 'RULE_WARNINGS',
          warnings: warnings.slice(0, 1)
        })
      )
    renderDrawer(onResolve)

    await chooseActionAndTarget(user)
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('button', { name: 'Do it anyway' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resolve action' })).toBeEnabled()
    expect(onResolve).toHaveBeenCalledTimes(1)
  })
})
