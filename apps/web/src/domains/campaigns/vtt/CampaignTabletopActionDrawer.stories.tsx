import type { Meta, StoryObj } from '@storybook/react-vite'
import { useDisclosure } from '@mantine/hooks'
import { useState } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import type {
  EncounterCommandResultDto,
  EndHeldGrantInputDto,
  EscapeRelationshipInputDto,
  MoveHeldEffectInputDto,
  ReleaseRelationshipInputDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  encounterActionChoiceDtoSchema,
  encounterActionChoicesDtoSchema,
  encounterOptionalActionChoicesDtoSchema,
  type EncounterActionItemChoicesDto,
  type EncounterOptionalActionChoicesDto,
  type GetEncounterActionItemChoicesInputDto,
  type GetEncounterOptionalActionChoicesInputDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import { validated } from '../../../test/validatedFixture'
import { CampaignTabletopActionDrawer } from './CampaignTabletopActionDrawer'
import type { VttAreaAim } from './vttSceneRenderer.model'
import { tabletopGmEncounter, tabletopLiveScene } from './CampaignTabletop.stories.fixtures'

const resolveAction = fn()
const previewChanged = fn()
const sourceActor = tabletopGmEncounter.actors[0]!
const targetActor = tabletopGmEncounter.actors[1]!
const actorIdByTokenId = new Map([
  [tabletopLiveScene.tokens[0]!.id, sourceActor.id],
  [tabletopLiveScene.tokens[1]!.id, targetActor.id]
])
const validatedActions = validated(encounterActionChoicesDtoSchema.shape.actions)
const actions = validatedActions([
  {
    id: 'equipment-staff:attack',
    label: 'Quarterstaff',
    sourceLabel: 'Equipment',
    rangeLabel: '5 ft',
    attackBonus: 4,
    grip: { value: 'ONE_HANDED', attackKey: 'staff-instance:MELEE_WEAPON_ATTACK' },
    wieldConflict: null,
    warnings: [],
    target: { kind: 'ACTOR', self: 'ALLOWED' },
    attackSlot: null
  }
])
const shieldItemInstanceId = '77777777-7777-4777-8777-777777777721'
const greatswordActions = validatedActions([
  {
    id: 'equipment-greatsword:attack',
    label: 'Greatsword',
    sourceLabel: 'Equipment',
    rangeLabel: '5 ft',
    attackBonus: 5,
    grip: { value: 'TWO_HANDED', attackKey: 'greatsword-instance:MELEE_WEAPON_ATTACK' },
    wieldConflict: { kind: 'STOW_SHIELD', shieldItemInstanceId, armorClassDelta: -2 },
    warnings: [],
    target: { kind: 'ACTOR', self: 'ALLOWED' },
    attackSlot: null
  }
])
const longswordAttackKey = 'longsword-instance:MELEE_WEAPON_ATTACK'
const longswordActions = validatedActions([
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
    target: { kind: 'ACTOR', self: 'ALLOWED' },
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
    target: { kind: 'ACTOR', self: 'ALLOWED' },
    attackSlot: null
  }
])
const optionalRules = validated(encounterActionChoicesDtoSchema.shape.optionalRules)([
  { definitionId: '77777777-7777-4777-8777-777777777701', label: 'Disarm' }
])
const optionalChoices = validated(encounterOptionalActionChoicesDtoSchema)({
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
})
const loadOptionalChoices = fn(
  async (
    _request: GetEncounterOptionalActionChoicesInputDto
  ): Promise<EncounterOptionalActionChoicesDto> => optionalChoices
)
const loadItemChoices = fn(
  async (
    _request: GetEncounterActionItemChoicesInputDto
  ): Promise<EncounterActionItemChoicesDto> => ({
    items: []
  })
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

const basicActionChoices = validatedActions([
  {
    ...actions[0],
    id: 'dash-action',
    label: 'Dash',
    rulesText:
      'You gain extra movement for the current turn, equal to your speed after applying any modifiers.',
    grip: null,
    target: { kind: 'SELF' }
  },
  {
    ...actions[0],
    id: 'help-action',
    label: 'Help',
    rulesText: 'You aid an ally. Its next attack roll before your next turn has advantage.',
    grip: null,
    target: { kind: 'ACTOR', self: 'REFUSED' }
  },
  {
    ...actions[0],
    id: 'hide-action',
    label: 'Hide',
    rulesText: 'You make a Dexterity (Stealth) check to hide.',
    grip: null
  }
])

const escapeSent = fn()
const endHeldGrantSent = fn()
const releaseSent = fn()
const moveHeldEffectSent = fn()
const escapes = validated(encounterActionChoicesDtoSchema.shape.escapes)([
  {
    heldActorId: null,
    activeEffectId: '00000000-0000-4000-8000-000000000e01',
    label: 'Escape from Giant Toad',
    dc: 13,
    actionCost: 'ACTION',
    checks: [
      {
        checkDefinitionId: '00000000-0000-4000-8000-000000000e11',
        label: 'Dexterity (Acrobatics)'
      },
      { checkDefinitionId: '00000000-0000-4000-8000-000000000e12', label: 'Strength (Athletics)' }
    ],
    warnings: []
  }
])

function resolvedCommand(): EncounterCommandResultDto {
  return {
    projection: { ...tabletopGmEncounter, version: tabletopGmEncounter.version + 1 },
    roll: null,
    occurrence: null,
    evidenceRoll: null
  }
}

async function sendEscapeCommand(command: EscapeRelationshipInputDto) {
  escapeSent(command)
  return resolvedCommand()
}

async function sendEndHeldGrantCommand(command: EndHeldGrantInputDto) {
  endHeldGrantSent(command)
  return resolvedCommand()
}

async function sendMoveHeldEffectCommand(command: MoveHeldEffectInputDto) {
  moveHeldEffectSent(command)
  return resolvedCommand()
}

async function sendReleaseCommand(command: ReleaseRelationshipInputDto) {
  releaseSent(command)
  return resolvedCommand()
}

const meta = {
  component: CampaignTabletopActionDrawer,
  args: {
    isGm: false,
    opened: false,
    waitingOn: null,
    basicActionChoices: [],
    escapes: [],
    heldGrantEnds: [],
    effectOffers: [],
    releases: [],
    openAttackAction: null,
    defaultActionId: null,
    areaAim: null,
    onAreaAimChange: fn(),
    onAreaSizeChange: fn(),
    onActionPreviewChange: fn(),
    onPickAreaOrigin: fn(),
    onPickTargetOnMap: fn(),
    onTargetPick: fn(),
    pickedTargetActorId: undefined,
    onEscape: sendEscapeCommand,
    onEndHeldGrant: sendEndHeldGrantCommand,
    onMoveHeldEffect: sendMoveHeldEffectCommand,
    onRelease: sendReleaseCommand,
    onOpen: fn(),
    onClose: fn()
  },
  render: function Render(args) {
    const [opened, { open, close }] = useDisclosure(false)
    const [areaAim, setAreaAim] = useState<VttAreaAim | null>(args.areaAim)
    const [pickedTargetActorId, setPickedTargetActorId] = useState<string | null | undefined>(
      undefined
    )
    return (
      <CampaignTabletopActionDrawer
        {...args}
        areaAim={areaAim}
        opened={opened}
        pickedTargetActorId={pickedTargetActorId}
        onAreaAimChange={setAreaAim}
        onOpen={open}
        onClose={close}
        onTargetPick={setPickedTargetActorId}
      />
    )
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
    onLoadOptionalChoices: loadOptionalChoices,
    onLoadItemChoices: loadItemChoices
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
    onLoadOptionalChoices: loadOptionalChoices,
    onLoadItemChoices: loadItemChoices
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
        target: { kind: 'ACTOR', self: 'ALLOWED' },
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
    onLoadOptionalChoices: loadOptionalChoices,
    onLoadItemChoices: loadItemChoices
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
    onLoadOptionalChoices: loadSlowOptionalChoices,
    onLoadItemChoices: loadItemChoices
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
    onLoadOptionalChoices: loadOptionalChoices,
    onLoadItemChoices: loadItemChoices
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
    onLoadOptionalChoices: loadOptionalChoices,
    onLoadItemChoices: loadItemChoices
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
      complete: false,
      lastActionId: actions[0].id,
      lastTargetIds: [targetActor.id]
    },
    defaultActionId: actions[0].id
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
  args: { ...ResolveTargetedAction.args, basicActionChoices },
  play: async ({ canvasElement }) => {
    resolveAction.mockClear()
    const { page, drawer } = await openActions(canvasElement)
    const section = within(drawer.getByRole('region', { name: 'Basic actions' }))

    await expect(section.getByRole('button', { name: 'Use Help' })).toBeDisabled()
    await userEvent.click(section.getByRole('combobox', { name: 'Target of help' }))
    await userEvent.click(await page.findByRole('option', { name: 'Vault Warden' }))
    await expect(section.getByRole('button', { name: 'Use Help' })).toBeEnabled()
    await userEvent.click(section.getByRole('button', { name: 'Use Dash' }))

    await waitFor(() => expect(resolveAction).toHaveBeenCalledTimes(1))
    await expect(await section.findByText('Dash used.')).toBeVisible()
    await expect(resolveAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RESOLVE_ACTION',
        actorId: sourceActor.id,
        actionId: basicActionChoices[0].id,
        target: { kind: 'ACTOR', actorId: sourceActor.id }
      })
    )
  }
}

export const EscapeFromGrapple: Story = {
  args: { ...ResolveTargetedAction.args, escapes },
  play: async ({ canvasElement }) => {
    escapeSent.mockClear()
    const { page, drawer } = await openActions(canvasElement)
    const section = within(drawer.getByRole('region', { name: 'Escape' }))

    await userEvent.click(
      section.getByRole('combobox', { name: 'Check for escape from giant toad' })
    )
    await userEvent.click(await page.findByRole('option', { name: 'Strength (Athletics)' }))
    await userEvent.click(section.getByRole('button', { name: 'Escape from Giant Toad' }))

    await waitFor(() => expect(escapeSent).toHaveBeenCalledTimes(1))
    await expect(await section.findByText('Escape attempted.')).toBeVisible()
    await expect(escapeSent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ESCAPE',
        actorId: sourceActor.id,
        activeEffectId: escapes[0].activeEffectId,
        checkDefinitionId: escapes[0].checks[1].checkDefinitionId
      })
    )
  }
}

const releases = validated(encounterActionChoicesDtoSchema.shape.releases)([
  {
    heldActorId: targetActor.id,
    activeEffectId: '00000000-0000-4000-8000-000000000e21',
    label: `Release ${targetActor.label}`
  }
])

/** The grappler lets go of the creature it holds, for no action (D152). */
export const ReleaseHeldCreature: Story = {
  args: { ...ResolveTargetedAction.args, releases },
  play: async ({ canvasElement }) => {
    releaseSent.mockClear()
    const { drawer } = await openActions(canvasElement)
    const section = within(drawer.getByRole('region', { name: 'Holding' }))

    await userEvent.click(section.getByRole('button', { name: releases[0].label }))

    await waitFor(() => expect(releaseSent).toHaveBeenCalledTimes(1))
    await expect(await section.findByText('Released.')).toBeVisible()
    await expect(releaseSent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RELEASE_RELATIONSHIP',
        actorId: sourceActor.id,
        heldActorId: targetActor.id,
        activeEffectId: releases[0].activeEffectId
      })
    )
  }
}

const effectOffers = validated(encounterActionChoicesDtoSchema.shape.effectOffers)([
  {
    effectId: '00000000-0000-4000-8000-000000000e31',
    offerIndex: 0,
    kind: 'MOVE_HELD_EFFECT',
    holderActorId: targetActor.id,
    activation: 'BONUS_ACTION',
    range: { amount: 90, unit: 'FEET' },
    warnings: []
  }
])

/** A held effect offers its source a move, with the cost and how far the pick reaches (D160). */
export const EffectOfferListed: Story = {
  args: { ...ResolveTargetedAction.args, effectOffers },
  play: async ({ canvasElement }) => {
    const { drawer } = await openActions(canvasElement)
    const section = within(drawer.getByRole('region', { name: 'Effect choices' }))

    await expect(section.getByText(/Move effect on Vault Warden/)).toBeVisible()
    await expect(section.getByText(/Bonus action · within 90 feet/i)).toBeVisible()
    await expect(section.queryByRole('combobox', { name: 'New holder' })).toBeNull()
  }
}

/** Choosing the offer opens the new-holder pick, which is also made on the map; Move needs a holder. */
export const EffectOfferPickingNewHolder: Story = {
  args: { ...ResolveTargetedAction.args, effectOffers },
  play: async ({ canvasElement }) => {
    moveHeldEffectSent.mockClear()
    const { page, drawer } = await openActions(canvasElement)
    const section = within(drawer.getByRole('region', { name: 'Effect choices' }))

    await userEvent.click(section.getByRole('button', { name: /Move effect on Vault Warden/ }))
    await expect(section.getByRole('button', { name: 'Pick on map' })).toBeEnabled()
    await expect(section.getByRole('button', { name: 'Move' })).toBeDisabled()

    await userEvent.click(section.getByRole('combobox', { name: 'New holder' }))
    await userEvent.click(await page.findByRole('option', { name: sourceActor.label }))
    await userEvent.click(section.getByRole('button', { name: 'Move' }))

    await waitFor(() => expect(moveHeldEffectSent).toHaveBeenCalledTimes(1))
    await expect(await section.findByText('Effect moved.')).toBeVisible()
    await expect(moveHeldEffectSent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'MOVE_HELD_EFFECT',
        actorId: sourceActor.id,
        effectId: effectOffers[0].effectId,
        offerIndex: 0,
        target: { kind: 'ACTOR', actorId: sourceActor.id }
      })
    )
  }
}

const repeatOffers = validated(encounterActionChoicesDtoSchema.shape.effectOffers)([
  {
    effectId: '00000000-0000-4000-8000-000000000e32',
    offerIndex: 0,
    kind: 'REPEAT_SOURCE_PATH',
    target: 'HOLDER',
    holderActorId: targetActor.id,
    activation: 'BONUS_ACTION',
    actionId: `${sourceActor.id}:REPEAT_PATH:00000000-0000-4000-8000-000000000e32:0`,
    label: 'Heat Metal',
    castLevel: 3,
    dc: 15,
    warnings: []
  }
])

/** The Heat Metal repeat: the offer names the frozen cast level and DC, and one press resolves it against the holder (D166). */
export const RepeatOfferResolved: Story = {
  args: { ...ResolveTargetedAction.args, effectOffers: repeatOffers },
  play: async ({ canvasElement }) => {
    resolveAction.mockClear()
    const { drawer } = await openActions(canvasElement)
    const section = within(drawer.getByRole('region', { name: 'Effect choices' }))

    await expect(section.getByText(/Repeat Heat Metal on Vault Warden/)).toBeVisible()
    await expect(section.getByText(/Bonus Action · cast at level 3 · DC 15/i)).toBeVisible()
    await userEvent.click(section.getByRole('button', { name: /Repeat Heat Metal on/ }))

    await expect(await section.findByText('Repeated.')).toBeVisible()
    await expect(resolveAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RESOLVE_ACTION',
        actorId: sourceActor.id,
        actionId: repeatOffers[0].actionId,
        target: { kind: 'ACTOR', actorId: targetActor.id }
      })
    )
  }
}

const fireball = validated(encounterActionChoiceDtoSchema)({
  id: 'spell-fireball:cast',
  label: 'Fireball',
  sourceLabel: 'Spell',
  rangeLabel: '150 ft',
  grip: null,
  wieldConflict: null,
  warnings: [],
  target: { kind: 'POINT', area: { kind: 'RADIUS', radius: { amount: 20, unit: 'FEET' } } },
  attackSlot: null
})
const longbow = validated(encounterActionChoiceDtoSchema)({
  ...actions[0],
  id: 'equipment-longbow:attack',
  label: 'Longbow',
  rangeLabel: '150/600 ft',
  range: {
    kind: 'RANGED',
    normal: { amount: 150, unit: 'FEET' },
    long: { amount: 600, unit: 'FEET' }
  }
})

/** The chosen action's range and target are handed to the stage, and withdrawn when cleared. */
export const PreviewRangeAndTarget: Story = {
  args: {
    ...ResolveTargetedAction.args,
    actions: [longbow],
    optionalRules: [],
    onActionPreviewChange: previewChanged
  },
  play: async ({ canvasElement }) => {
    previewChanged.mockClear()
    const { page, drawer } = await openActions(canvasElement)

    await userEvent.click(drawer.getByRole('combobox', { name: 'Action' }))
    await userEvent.click(await page.findByRole('option', { name: 'Longbow · Equipment' }))
    await waitFor(() =>
      expect(previewChanged).toHaveBeenLastCalledWith({
        range: longbow.range,
        sourceTokenId: tabletopLiveScene.tokens[0]!.id,
        targetTokenId: null
      })
    )
    await userEvent.click(drawer.getByRole('combobox', { name: 'Target' }))
    await userEvent.click(await page.findByRole('option', { name: 'Vault Warden' }))
    await waitFor(() =>
      expect(previewChanged).toHaveBeenLastCalledWith({
        range: longbow.range,
        sourceTokenId: tabletopLiveScene.tokens[0]!.id,
        targetTokenId: tabletopLiveScene.tokens[1]!.id
      })
    )
  }
}

/** An area action asks for its center, lists who stands in it, and sends the point. */
export const ResolveAreaAction: Story = {
  args: { ...ResolveTargetedAction.args, actions: [fireball], optionalRules: [] },
  play: async ({ canvasElement }) => {
    resolveAction.mockClear()
    const { page, drawer } = await openActions(canvasElement)

    await userEvent.click(drawer.getByRole('combobox', { name: 'Action' }))
    await userEvent.click(await page.findByRole('option', { name: 'Fireball · Spell' }))
    await expect(drawer.getByText('Area origin')).toBeVisible()
    await expect(drawer.getByRole('button', { name: 'Resolve action' })).toBeDisabled()
    await userEvent.click(drawer.getByRole('combobox', { name: 'Center on token' }))
    await userEvent.click(await page.findByRole('option', { name: 'Ember' }))
    await expect(await drawer.findByText('In the area: Ember')).toBeVisible()
    await userEvent.click(drawer.getByRole('button', { name: 'Resolve action' }))

    await waitFor(() => expect(resolveAction).toHaveBeenCalledTimes(1))
    await expect(resolveAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: fireball.id,
        sceneContext: null,
        target: {
          kind: 'POINT',
          sceneId: tabletopLiveScene.id,
          expectedSceneVersion: tabletopLiveScene.version,
          point: tabletopLiveScene.tokens[0]!.position
        }
      })
    )
  }
}
