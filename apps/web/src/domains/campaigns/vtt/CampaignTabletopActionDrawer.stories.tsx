import type { Meta, StoryObj } from '@storybook/react-vite'
import { useDisclosure } from '@mantine/hooks'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import type {
  EncounterCommandResultDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  EncounterActionChoiceDto,
  EncounterActionChoicesDto,
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
    attackBonus: 4
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
    resolution: null,
    occurrence: {
      occurrenceId: '77777777-7777-4777-8777-777777777799',
      occurrenceVersion: 0,
      status: 'COMPLETE',
      outcome: null,
      pending: null
    }
  }
}

const meta = {
  component: CampaignTabletopActionDrawer,
  args: { opened: false, onOpen: fn(), onClose: fn() },
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
        targetActorId: targetActor.id,
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
    actions: [{ id: 'creature-claw', label: 'Claw', rangeLabel: '5 ft', attackBonus: 5 }],
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
        targetActorId: sourceActor.id,
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
