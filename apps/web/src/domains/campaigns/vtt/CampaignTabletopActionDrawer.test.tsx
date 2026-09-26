import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type {
  EncounterCommandResultDto,
  ResolveEncounterActionInputDto,
  UseEncounterBasicActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  EncounterActionChoiceDto,
  EncounterBasicActionChoiceDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
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
    wieldConflict: null,
    warnings: []
  }
] satisfies EncounterActionChoiceDto[]
const warnings = [
  { code: 'ACTION_ECONOMY_UNAVAILABLE' as const, message: 'No action left this turn.' },
  { code: 'TARGET_OUT_OF_RANGE' as const, message: 'The target is out of range.' }
]
const resolved: EncounterCommandResultDto = {
  projection: tabletopGmEncounter,
  roll: null,
  occurrence: null,
  evidenceRoll: null
}

function renderDrawer(
  onResolve: (command: ResolveEncounterActionInputDto) => Promise<unknown>,
  {
    choices = actions,
    basicActions = [],
    onUseBasicAction = vi.fn(),
    waitingOn = null
  }: {
    choices?: EncounterActionChoiceDto[]
    basicActions?: EncounterBasicActionChoiceDto[]
    onUseBasicAction?: (command: UseEncounterBasicActionInputDto) => Promise<unknown>
    waitingOn?: 'GM' | 'PLAYER' | null
  } = {}
) {
  return renderWithAppProviders(
    <CampaignTabletopActionDrawer
      actionChoicesError={null}
      actions={choices}
      basicActions={basicActions}
      actionsLoading={false}
      actorIdByTokenId={new Map()}
      connected
      encounter={tabletopGmEncounter}
      opened
      optionalRules={[]}
      pending={false}
      scene={tabletopLiveScene}
      waitingOn={waitingOn}
      onClose={vi.fn()}
      onLoadOptionalChoices={vi.fn()}
      onOpen={vi.fn()}
      onResolve={async (command) => {
        await onResolve(command)
        return resolved
      }}
      onUseBasicAction={async (command) => {
        await onUseBasicAction(command)
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

describe('CampaignTabletopActionDrawer availability', () => {
  it('shows why an action already breaks a rule before it is chosen', async () => {
    const user = userEvent.setup()
    renderDrawer(vi.fn(), {
      choices: [
        {
          ...actions[0]!,
          warnings: [
            { code: 'ACTION_ECONOMY_UNAVAILABLE', message: 'No bonus action left this turn.' }
          ]
        }
      ]
    })

    await user.click(await screen.findByRole('combobox', { name: 'Action' }))
    expect(await screen.findByText('No bonus action left this turn.')).toBeInTheDocument()
    await user.keyboard('{ArrowDown}{Enter}')
    expect(screen.getByRole('listitem')).toHaveTextContent('No bonus action left this turn.')
  })

  it('waits on whoever the server says must answer the pending decision', async () => {
    const { unmount } = renderDrawer(vi.fn(), { waitingOn: 'GM' })
    expect(screen.getByText('Waiting on the GM')).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Action' })).toBeDisabled()
    unmount()

    renderDrawer(vi.fn(), { waitingOn: 'PLAYER' })
    expect(screen.getByText('Waiting on another player')).toBeVisible()
  })
})

const basicActionChoices = [
  {
    definitionId: '00000000-0000-4000-8000-000000000b01',
    label: 'Dash',
    rulesText: 'You gain extra movement for the current turn.',
    actionCost: 'ACTION',
    needsAlly: false,
    warnings: []
  },
  {
    definitionId: '00000000-0000-4000-8000-000000000b04',
    label: 'Help',
    rulesText: 'You aid an ally.',
    actionCost: 'ACTION',
    needsAlly: true,
    warnings: []
  }
] satisfies EncounterBasicActionChoiceDto[]

describe('CampaignTabletopActionDrawer basic actions', () => {
  it('lists the System basic actions in their own section, apart from feature actions', async () => {
    renderDrawer(vi.fn(), { basicActions: basicActionChoices })

    const section = await screen.findByRole('region', { name: 'Basic actions' })
    expect(within(section).getByText('Dash')).toBeVisible()
    expect(within(section).getByText('Help')).toBeVisible()
    expect(within(section).queryByText('Quarterstaff')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Action' })).toBeVisible()
  })

  it('uses a basic action for the current actor', async () => {
    const user = userEvent.setup()
    const onUseBasicAction = vi.fn().mockResolvedValue(resolved)
    renderDrawer(vi.fn(), { basicActions: basicActionChoices, onUseBasicAction })

    await user.click(await screen.findByRole('button', { name: 'Use Dash' }))
    expect(onUseBasicAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'USE_BASIC_ACTION',
        encounterId: tabletopGmEncounter.id,
        expectedVersion: tabletopGmEncounter.version,
        actorId: tabletopGmEncounter.currentActorId,
        definitionId: basicActionChoices[0].definitionId,
        allyActorId: null,
        acknowledgedWarnings: []
      })
    )
    expect(await screen.findByText('Dash used.')).toBeVisible()
  })

  it('asks for the ally a helping action aids before it can be used', async () => {
    const user = userEvent.setup()
    const onUseBasicAction = vi.fn().mockResolvedValue(resolved)
    renderDrawer(vi.fn(), { basicActions: basicActionChoices, onUseBasicAction })

    const use = await screen.findByRole('button', { name: 'Use Help' })
    expect(use).toBeDisabled()
    await user.click(screen.getByRole('combobox', { name: 'Ally to help' }))
    await user.click(await screen.findByRole('option', { name: 'Vault Warden' }))
    await user.click(use)
    expect(onUseBasicAction).toHaveBeenCalledWith(
      expect.objectContaining({
        definitionId: basicActionChoices[1].definitionId,
        allyActorId: '99999999-9999-4999-8999-999999999902'
      })
    )
  })

  it('resends a basic action with its warnings acknowledged on "Do it anyway"', async () => {
    const user = userEvent.setup()
    const onUseBasicAction = vi
      .fn<(command: UseEncounterBasicActionInputDto) => Promise<unknown>>()
      .mockImplementationOnce(async (command) => {
        throw new LiveSessionCommandRejectedError({
          code: 'DOMAIN_REJECTED',
          commandId: command.commandId,
          currentSequence: 3,
          message: 'This action breaks a rule. Do it anyway?',
          reason: 'RULE_WARNINGS',
          warnings: warnings.slice(0, 1)
        })
      })
      .mockResolvedValue(resolved)
    renderDrawer(vi.fn(), { basicActions: basicActionChoices, onUseBasicAction })

    await user.click(await screen.findByRole('button', { name: 'Use Dash' }))
    await user.click(await screen.findByRole('button', { name: 'Do it anyway' }))
    expect(onUseBasicAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ acknowledgedWarnings: ['ACTION_ECONOMY_UNAVAILABLE'] })
    )
  })
})
