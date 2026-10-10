import type { Meta, StoryObj } from '@storybook/react-vite'
import { useDisclosure } from '@mantine/hooks'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import type {
  EncounterCommandResultDto,
  ResolveEncounterActionInputDto,
  UseEncounterBasicActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  EncounterActionChoiceDto,
  EncounterActionChoicesDto,
  EncounterBasicActionChoiceDto,
  EncounterOptionalActionChoicesDto,
  GetEncounterOptionalActionChoicesInputDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import { CampaignTabletopActionDrawer } from './CampaignTabletopActionDrawer'
import { tabletopGmEncounter, tabletopLiveScene } from './CampaignTabletop.stories.fixtures'

const resolveAction = fn()
const sourceActor = tabletopGmEncounter.actors[0]!
const targetActor = tabletopGmEncounter.actors[1]!
const actorIdByTokenId = new Map([
  [tabletopLiveScene.tokens[0]!.id, sourceActor.id],
  [tabletopLiveScene.tokens[1]!.id, targetActor.id]
])
const actions = [
  {
    id: 'equipment-staff:attack',
    label: 'Quarterstaff',
    sourceLabel: 'Equipment',
    rangeLabel: '5 ft',
    attackBonus: 4,
    grip: { value: 'ONE_HANDED', attackKey: 'staff-instance:MELEE_WEAPON_ATTACK' },
    wieldConflict: null,
    warnings: [],
    attackSlot: null
  }
] satisfies EncounterActionChoiceDto[]
const shieldItemInstanceId = '77777777-7777-4777-8777-777777777721'
const greatswordActions = [
  {
    id: 'equipment-greatsword:attack',
    label: 'Greatsword',
    sourceLabel: 'Equipment',
    rangeLabel: '5 ft',
    attackBonus: 5,
    grip: { value: 'TWO_HANDED', attackKey: 'greatsword-instance:MELEE_WEAPON_ATTACK' },
    wieldConflict: { kind: 'STOW_SHIELD', shieldItemInstanceId, armorClassDelta: -2 },
    warnings: [],
    attackSlot: null
  }
] satisfies EncounterActionChoiceDto[]
const longswordAttackKey = 'longsword-instance:MELEE_WEAPON_ATTACK'
const longswordActions = [
  {
    id: 'equipment-longsword:one-hand',
    label: 'Longsword',
    sourceLabel: 'Equipment',
    rangeLabel: '5 ft',
    attackBonus: 5,
    damageLabel: '1d8 Slashing',
    grip: { value: 'ONE_HANDED', attackKey: longswordAttackKey },
    wieldConflict: null,
    warnings: [],
    attackSlot: null
  },
  {
    id: 'equipment-longsword:two-hand',
    label: 'Longsword',
    sourceLabel: 'Equipment',
    rangeLabel: '5 ft',
    attackBonus: 5,
    damageLabel: '1d10 Slashing',
    grip: { value: 'TWO_HANDED', attackKey: longswordAttackKey },
    wieldConflict: { kind: 'STOW_SHIELD', shieldItemInstanceId, armorClassDelta: -2 },
    warnings: [],
    attackSlot: null
  }
] satisfies EncounterActionChoiceDto[]
const optionalRules = [
  { definitionId: '77777777-7777-4777-8777-777777777701', label: 'Disarm' }
] satisfies EncounterActionChoicesDto['optionalRules']
const optionalChoices = {
  definitionId: optionalRules[0].definitionId,
  optionId: 'c'.repeat(64),
  selectionContract: 'd'.repeat(64),
  label: 'Disarm',
  fields: [
    {
      fieldId: 'a'.repeat(64),
      kind: 'ENTITY',
      label: 'Held item',
      options: [{ id: '77777777-7777-4777-8777-777777777711', label: 'Warden sword' }]
    },
    {
      fieldId: 'b'.repeat(64),
      kind: 'ENTITY',
      label: 'Defender check',
      options: [{ id: '77777777-7777-4777-8777-777777777712', label: 'Athletics' }]
    }
  ]
} satisfies EncounterOptionalActionChoicesDto
const loadOptionalChoices = fn(
  async (
    _request: GetEncounterOptionalActionChoicesInputDto
  ): Promise<EncounterOptionalActionChoicesDto> => optionalChoices
)
const pendingOptionalChoiceResponses: Array<(value: EncounterOptionalActionChoicesDto) => void> = []
const loadSlowOptionalChoices = fn(
  (_request: GetEncounterOptionalActionChoicesInputDto) =>
    new Promise<EncounterOptionalActionChoicesDto>((resolve) => {
      pendingOptionalChoiceResponses.push(resolve)
    })
)

async function resolveActionCommand(
  command: ResolveEncounterActionInputDto
): Promise<EncounterCommandResultDto> {
  resolveAction(command)
  return {
    projection: { ...tabletopGmEncounter, version: tabletopGmEncounter.version + 1 },
    roll: null,
    occurrence: {
      occurrenceId: '77777777-7777-4777-8777-777777777799',
      occurrenceVersion: 0,
      status: 'COMPLETE',
      pending: null
    },
    evidenceRoll: null
  }
}

const basicActionSent = fn()
const basicActions = [
  {
    definitionId: '00000000-0000-4000-8000-000000000b01',
    label: 'Dash',
    rulesText:
      'You gain extra movement for the current turn, equal to your speed after applying any modifiers.',
    actionCost: 'ACTION',
    target: null,
    warnings: []
  },
  {
    definitionId: '00000000-0000-4000-8000-000000000b04',
    label: 'Help',
    rulesText: 'You aid an ally. Its next attack roll before your next turn has advantage.',
    actionCost: 'ACTION',
    target: 'ALLY',
    warnings: []
  },
  {
    definitionId: '00000000-0000-4000-8000-000000000b05',
    label: 'Hide',
    rulesText: 'You make a Dexterity (Stealth) check to hide.',
    actionCost: 'ACTION',
    target: null,
    warnings: []
  }
] satisfies EncounterBasicActionChoiceDto[]

async function sendBasicActionCommand(
  command: UseEncounterBasicActionInputDto
): Promise<EncounterCommandResultDto> {
  basicActionSent(command)
  return {
    projection: { ...tabletopGmEncounter, version: tabletopGmEncounter.version + 1 },
    roll: null,
    occurrence: null,
    evidenceRoll: null
  }
}

const meta = {
  component: CampaignTabletopActionDrawer,
  args: {
    isGm: false,
    opened: false,
    waitingOn: null,
    basicActions: [],
    openAttackAction: null,
    onUseBasicAction: sendBasicActionCommand,
    onOpen: fn(),
    onClose: fn()
  },
  render: function Render(args) {
    const [opened, { open, close }] = useDisclosure(false)
    return <CampaignTabletopActionDrawer {...args} opened={opened} onOpen={open} onClose={close} />
  },
  parameters: {
    a11y: { test: 'error' },
    layout: 'padded'
  },
  title: 'Domains/Campaigns/VTT/Tabletop Actions'
} satisfies Meta<typeof CampaignTabletopActionDrawer>

export default meta
type Story = StoryObj<typeof meta>

async function openActions(canvasElement: HTMLElement) {
  const page = within(canvasElement.ownerDocument.body)
  await userEvent.click(await page.findByRole('button', { name: 'Open actions' }))
  const dialog = await page.findByRole('dialog', { name: 'Actions' })
  await waitFor(() => expect(dialog).toBeVisible())
  await waitFor(() => expect(getComputedStyle(dialog).opacity).toBe('1'))
  await waitFor(() => expect(dialog.getAnimations()).toHaveLength(0))
  return { page, drawer: within(dialog) }
}

export const ResolveTargetedAction: Story = {
  args: {
    actions,
    actionsLoading: false,
    actionChoicesError: null,
    actorIdByTokenId,
    connected: true,
    encounter: tabletopGmEncounter,
    pending: false,
    scene: tabletopLiveScene,
    onResolve: resolveActionCommand,
    optionalRules,
    unavailableActions: [],
    onLoadOptionalChoices: loadOptionalChoices
  },
  play: async ({ canvasElement }) => {
    resolveAction.mockClear()
    const { page, drawer } = await openActions(canvasElement)

    await userEvent.click(drawer.getByRole('combobox', { name: 'Action' }))
    await userEvent.click(await page.findByRole('option', { name: 'Quarterstaff · Equipment' }))
    await userEvent.click(drawer.getByRole('combobox', { name: 'Target' }))
    await userEvent.click(await page.findByRole('option', { name: 'Vault Warden' }))
    await expect(drawer.getByText('5 ft · +4 to hit')).toBeVisible()
    await userEvent.click(drawer.getByRole('button', { name: 'Resolve action' }))

    await waitFor(() => expect(resolveAction).toHaveBeenCalledTimes(1))
    await expect(await drawer.findByText('Action resolved.')).toBeVisible()
    await expect(resolveAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RESOLVE_ACTION',
        actorId: sourceActor.id,
        actionId: 'equipment-staff:attack',
        target: { kind: 'ACTOR', actorId: targetActor.id },
        acceptedWieldConflict: null,
        sceneContext: {
          sceneId: tabletopLiveScene.id,
          expectedSceneVersion: tabletopLiveScene.version,
          sourceTokenId: tabletopLiveScene.tokens[0]!.id,
          targetTokenId: tabletopLiveScene.tokens[1]!.id
        }
      })
    )
  }
}

export const ResolveDisarm: Story = {
  args: {
    actions,
    actionsLoading: false,
    actionChoicesError: null,
    actorIdByTokenId,
    connected: true,
    encounter: tabletopGmEncounter,
    pending: false,
    scene: tabletopLiveScene,
    onResolve: resolveActionCommand,
    optionalRules,
    unavailableActions: [],
    onLoadOptionalChoices: loadOptionalChoices
  },
  play: async ({ canvasElement }) => {
    resolveAction.mockClear()
    loadOptionalChoices.mockClear()
    const { page, drawer } = await openActions(canvasElement)
    await userEvent.click(drawer.getByRole('combobox', { name: 'Action' }))
    await userEvent.click(await page.findByRole('option', { name: 'Quarterstaff · Equipment' }))
    await userEvent.click(drawer.getByRole('combobox', { name: 'Target' }))
    await userEvent.click(await page.findByRole('option', { name: 'Vault Warden' }))
    await userEvent.click(drawer.getByRole('combobox', { name: 'Optional rule' }))
    await userEvent.click(await page.findByRole('option', { name: 'Disarm' }))
    await userEvent.click(await drawer.findByRole('combobox', { name: 'Held item' }))
    await userEvent.click(await page.findByRole('option', { name: 'Warden sword' }))
    await userEvent.click(drawer.getByRole('combobox', { name: 'Defender check' }))
    await userEvent.click(await page.findByRole('option', { name: 'Athletics' }))
    await userEvent.click(drawer.getByRole('button', { name: 'Resolve action' }))

    await waitFor(() => expect(resolveAction).toHaveBeenCalledTimes(1))
    await expect(resolveAction).toHaveBeenCalledWith(
      expect.objectContaining({
        optionalCombatIntent: {
          definitionId: optionalChoices.definitionId,
          optionId: optionalChoices.optionId,
          selectionContract: optionalChoices.selectionContract,
          selections: [
            {
              fieldId: optionalChoices.fields[0].fieldId,
              value: { kind: 'ENTITY', entityId: optionalChoices.fields[0].options[0].id }
            },
            {
              fieldId: optionalChoices.fields[1].fieldId,
              value: { kind: 'ENTITY', entityId: optionalChoices.fields[1].options[0].id }
            }
          ]
        }
      })
    )
  }
}

export const CreatureSource: Story = {
  args: {
    actions: [
      {
        id: 'creature-claw',
        label: 'Claw',
        rangeLabel: '5 ft',
        attackBonus: 5,
        grip: null,
        wieldConflict: null,
        warnings: [],
        attackSlot: null
      }
    ],
    actionsLoading: false,
    actionChoicesError: null,
    actorIdByTokenId: new Map([
      [tabletopLiveScene.tokens[0]!.id, targetActor.id],
      [tabletopLiveScene.tokens[1]!.id, sourceActor.id]
    ]),
    connected: true,
    encounter: {
      ...tabletopGmEncounter,
      currentActorId: targetActor.id
    },
    pending: false,
    scene: tabletopLiveScene,
    onResolve: resolveActionCommand,
    optionalRules: [],
    unavailableActions: [],
    onLoadOptionalChoices: loadOptionalChoices
  },
  play: async ({ canvasElement }) => {
    resolveAction.mockClear()
    const { page, drawer } = await openActions(canvasElement)
    await userEvent.click(drawer.getByRole('combobox', { name: 'Action' }))
    await userEvent.click(await page.findByRole('option', { name: 'Claw' }))
    await userEvent.click(drawer.getByRole('combobox', { name: 'Target' }))
    await userEvent.click(await page.findByRole('option', { name: "Ember's Wake" }))
    await userEvent.click(drawer.getByRole('button', { name: 'Resolve action' }))
    await waitFor(() => expect(resolveAction).toHaveBeenCalledTimes(1))
    await expect(resolveAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: targetActor.id,
        target: { kind: 'ACTOR', actorId: sourceActor.id },
        actionId: 'creature-claw',
        optionalCombatIntent: null
      })
    )
  }
}

export const StaleOptionalScope: Story = {
  args: {
    actions,
    actionsLoading: false,
    actionChoicesError: null,
    actorIdByTokenId,
    connected: true,
    encounter: tabletopGmEncounter,
    pending: false,
    scene: tabletopLiveScene,
    onResolve: resolveActionCommand,
    optionalRules,
    unavailableActions: [],
    onLoadOptionalChoices: loadSlowOptionalChoices
  },
  play: async ({ canvasElement }) => {
    resolveAction.mockClear()
    loadSlowOptionalChoices.mockClear()
    pendingOptionalChoiceResponses.splice(0)
    const { page, drawer } = await openActions(canvasElement)
    await userEvent.click(drawer.getByRole('combobox', { name: 'Action' }))
    await userEvent.click(await page.findByRole('option', { name: 'Quarterstaff · Equipment' }))
    await userEvent.click(drawer.getByRole('combobox', { name: 'Target' }))
    await userEvent.click(await page.findByRole('option', { name: 'Vault Warden' }))
    await userEvent.click(drawer.getByRole('combobox', { name: 'Optional rule' }))
    await userEvent.click(await page.findByRole('option', { name: 'Disarm' }))
    await waitFor(() => expect(loadSlowOptionalChoices).toHaveBeenCalledTimes(1))
    await userEvent.click(drawer.getByRole('combobox', { name: 'Target' }))
    await userEvent.click(await page.findByRole('option', { name: "Ember's Wake" }))
    await waitFor(() => expect(loadSlowOptionalChoices).toHaveBeenCalledTimes(2))
    const firstResponse = pendingOptionalChoiceResponses.shift()
    if (!firstResponse) throw new Error('The first optional choice request did not start.')
    firstResponse(optionalChoices)
    await expect(drawer.getByRole('button', { name: 'Resolve action' })).toBeDisabled()
    await expect(drawer.queryByRole('combobox', { name: 'Held item' })).not.toBeInTheDocument()
    await expect(resolveAction).not.toHaveBeenCalled()
    const currentResponse = pendingOptionalChoiceResponses.shift()
    if (!currentResponse) throw new Error('The current optional choice request did not start.')
    currentResponse({ ...optionalChoices, optionId: 'd'.repeat(64) })
    await expect(await drawer.findByRole('combobox', { name: 'Held item' })).toBeVisible()
    await expect(drawer.getByRole('button', { name: 'Resolve action' })).toBeDisabled()
  }
}

export const ConfirmShieldStow: Story = {
  args: {
    actions: greatswordActions,
    actionsLoading: false,
    actionChoicesError: null,
    actorIdByTokenId,
    connected: true,
    encounter: tabletopGmEncounter,
    pending: false,
    scene: tabletopLiveScene,
    onResolve: resolveActionCommand,
    optionalRules: [],
    unavailableActions: [],
    onLoadOptionalChoices: loadOptionalChoices
  },
  play: async ({ canvasElement }) => {
    resolveAction.mockClear()
    const { page, drawer } = await openActions(canvasElement)
    await userEvent.click(drawer.getByRole('combobox', { name: 'Action' }))
    await userEvent.click(await page.findByRole('option', { name: 'Greatsword · Equipment' }))
    await userEvent.click(drawer.getByRole('combobox', { name: 'Target' }))
    await userEvent.click(await page.findByRole('option', { name: 'Vault Warden' }))

    await userEvent.click(drawer.getByRole('button', { name: 'Resolve action' }))
    await expect(
      drawer.getByText(
        'Attacking with this weapon stows your shield. AC −2 until you equip it again.'
      )
    ).toBeVisible()
    await userEvent.click(drawer.getByRole('button', { name: 'Cancel' }))
    await expect(
      drawer.queryByRole('button', { name: 'Stow shield and attack' })
    ).not.toBeInTheDocument()
    await expect(resolveAction).not.toHaveBeenCalled()

    await userEvent.click(drawer.getByRole('button', { name: 'Resolve action' }))
    await userEvent.click(drawer.getByRole('button', { name: 'Stow shield and attack' }))
    await waitFor(() => expect(resolveAction).toHaveBeenCalledTimes(1))
    await expect(resolveAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'equipment-greatsword:attack',
        acceptedWieldConflict: { kind: 'STOW_SHIELD', shieldItemInstanceId }
      })
    )
  }
}

export const ChooseVersatileGrip: Story = {
  args: {
    actions: longswordActions,
    actionsLoading: false,
    actionChoicesError: null,
    actorIdByTokenId,
    connected: true,
    encounter: tabletopGmEncounter,
    pending: false,
    scene: tabletopLiveScene,
    onResolve: resolveActionCommand,
    optionalRules: [],
    unavailableActions: [],
    onLoadOptionalChoices: loadOptionalChoices
  },
  play: async ({ canvasElement }) => {
    resolveAction.mockClear()
    const { page, drawer } = await openActions(canvasElement)
    await userEvent.click(drawer.getByRole('combobox', { name: 'Action' }))
    await expect(
      await page.findAllByRole('option', { name: 'Longsword · Equipment' })
    ).toHaveLength(1)
    await userEvent.click(await page.findByRole('option', { name: 'Longsword · Equipment' }))
    await userEvent.click(drawer.getByRole('combobox', { name: 'Target' }))
    await userEvent.click(await page.findByRole('option', { name: 'Vault Warden' }))
    await expect(drawer.getByRole('radio', { name: 'One hand · 1d8 Slashing' })).toBeChecked()

    await userEvent.click(drawer.getByText('Two hands · 1d10 Slashing'))
    await userEvent.click(drawer.getByRole('button', { name: 'Resolve action' }))
    await userEvent.click(drawer.getByRole('button', { name: 'Stow shield and attack' }))
    await waitFor(() => expect(resolveAction).toHaveBeenCalledTimes(1))
    await expect(resolveAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'equipment-longsword:two-hand',
        acceptedWieldConflict: { kind: 'STOW_SHIELD', shieldItemInstanceId }
      })
    )

    await userEvent.click(drawer.getByText('One hand · 1d8 Slashing'))
    await userEvent.click(drawer.getByRole('button', { name: 'Resolve action' }))
    await waitFor(() => expect(resolveAction).toHaveBeenCalledTimes(2))
    await expect(resolveAction).toHaveBeenLastCalledWith(
      expect.objectContaining({
        actionId: 'equipment-longsword:one-hand',
        acceptedWieldConflict: null
      })
    )
  }
}

/** An action a soft rule already warns about stays selectable, dimmed with its reason. */
export const UnavailableAction: Story = {
  args: {
    ...ResolveTargetedAction.args,
    actions: [
      {
        ...actions[0],
        warnings: [
          { code: 'ACTION_ECONOMY_UNAVAILABLE' as const, message: 'No action left this turn.' }
        ]
      }
    ]
  },
  play: async ({ canvasElement }) => {
    const { page, drawer } = await openActions(canvasElement)
    await userEvent.click(drawer.getByRole('combobox', { name: 'Action' }))
    await expect(await page.findByText('No action left this turn.')).toBeVisible()
  }
}

/** Attack 1 of 2 is made: the drawer offers Attack 2 of 2 with the weapon and target kept. */
export const SecondAttackPreselected: Story = {
  args: {
    ...ResolveTargetedAction.args,
    actions: [{ ...actions[0], attackSlot: { number: 2, total: 2 } }],
    openAttackAction: {
      made: 1,
      total: 2,
      lastActionId: actions[0].id,
      lastTargetIds: [targetActor.id]
    }
  },
  play: async ({ canvasElement }) => {
    resolveAction.mockClear()
    const { drawer } = await openActions(canvasElement)
    await expect(drawer.getByRole('combobox', { name: 'Action' })).toHaveValue(
      'Quarterstaff · Equipment'
    )
    await expect(drawer.getByRole('combobox', { name: 'Target' })).toHaveValue('Vault Warden')
    // The closed option list stays mounted; the selected action's own label is the one outside it.
    const slotLabels = drawer
      .getAllByText('Attack 2 of 2')
      .filter((node) => !node.closest('[role="listbox"]'))
    await expect(slotLabels).toHaveLength(1)
    await expect(slotLabels[0]).toBeVisible()
    await expect(resolveAction).not.toHaveBeenCalled()

    await userEvent.click(drawer.getByRole('button', { name: 'Resolve action' }))
    await waitFor(() => expect(resolveAction).toHaveBeenCalledTimes(1))
    await expect(resolveAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: actions[0].id,
        target: { kind: 'ACTOR', actorId: targetActor.id }
      })
    )
  }
}

/** The GM owes an answer to a decision this player's action raised; controls wait for it. */
export const WaitingOnGm: Story = {
  args: { ...ResolveTargetedAction.args, waitingOn: 'GM' },
  play: async ({ canvasElement }) => {
    const { drawer } = await openActions(canvasElement)
    await expect(drawer.getByText('Waiting on the GM')).toBeVisible()
    await expect(drawer.getByRole('button', { name: 'Resolve action' })).toBeDisabled()
  }
}

export const UseBasicActions: Story = {
  args: { ...ResolveTargetedAction.args, basicActions },
  play: async ({ canvasElement }) => {
    basicActionSent.mockClear()
    const { page, drawer } = await openActions(canvasElement)
    const section = within(drawer.getByRole('region', { name: 'Basic actions' }))

    await expect(section.getByRole('button', { name: 'Use Help' })).toBeDisabled()
    await userEvent.click(section.getByRole('combobox', { name: 'Ally to help' }))
    await userEvent.click(await page.findByRole('option', { name: 'Vault Warden' }))
    await expect(section.getByRole('button', { name: 'Use Help' })).toBeEnabled()
    await userEvent.click(section.getByRole('button', { name: 'Use Dash' }))

    await waitFor(() => expect(basicActionSent).toHaveBeenCalledTimes(1))
    await expect(await section.findByText('Dash used.')).toBeVisible()
    await expect(basicActionSent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'USE_BASIC_ACTION',
        actorId: sourceActor.id,
        definitionId: basicActions[0].definitionId,
        targetActorId: null
      })
    )
  }
}
