import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import type {
  EncounterCommandResultDto,
  RemoveAreaTargetInputDto,
  ResolveRuleOccurrenceInputDto,
  RollRuleEvidenceInputDto,
  VoidRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { pendingEncounterRuleOccurrenceSummaryDtoSchema } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { offeredRollModes } from '../../../test/offeredRollModes'
import { validated } from '../../../test/validatedFixture'
import { CampaignTabletopDecisionDrawer } from './CampaignTabletopDecisionDrawer'
import { tabletopGmEncounter } from './CampaignTabletop.stories.fixtures'
import { reachByKeyboard } from './CampaignTabletop.stories.keyboard'

const occurrenceId = '77777777-7777-4777-8777-777777777790'
const resolveDecision = fn()
const appRollId = '77777777-7777-4777-8777-777777777795'

const d20Pending = validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
  kind: 'D20_EVIDENCE',
  occurrenceId,
  occurrenceVersion: 2,
  encounterVersion: tabletopGmEncounter.version,
  rollerActorId: tabletopGmEncounter.actors[1]!.id,
  request: {
    requestId: 'attack-roll',
    min: 1,
    max: 20,
    rollMode: 'ADVANTAGE',
    keep: 'HIGHER',
    rollModes: offeredRollModes,
    derivedRollModeReasons: ['Flanking']
  },
  allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
})

const areaPending = validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
  kind: 'AREA_SAVES',
  occurrenceId,
  occurrenceVersion: 2,
  encounterVersion: tabletopGmEncounter.version,
  casterActorId: tabletopGmEncounter.actors[0]!.id,
  caughtChecksum: 'e'.repeat(64),
  caught: ['Ember', 'Vault Warden'],
  saves: tabletopGmEncounter.actors.map((actor) => ({
    actorId: actor.id,
    targetActorId: actor.id,
    request: {
      requestId: `save-${actor.id}`,
      min: 1 as const,
      max: 20 as const,
      rollMode: 'NORMAL' as const,
      keep: 'FIRST' as const,
      rollModes: offeredRollModes,
      derivedRollModeReasons: []
    }
  })),
  legendaryResistance: [],
  allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL', 'AREA_LEGENDARY_RESISTANCE']
})

const reactionPending = validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
  kind: 'MOVEMENT_REACTION',
  occurrenceId,
  occurrenceVersion: 2,
  encounterVersion: tabletopGmEncounter.version,
  choice: {
    pathDistance: 5,
    reactorActorId: tabletopGmEncounter.actors[0]!.id,
    reactorTokenId: '77777777-7777-4777-8777-777777777791',
    options: [
      {
        optionId: 'a'.repeat(64),
        actionId: 'opportunity-attack',
        actionSourceKind: 'CHARACTER_ACTION'
      }
    ]
  },
  allowedResponses: ['DECLINE', 'OPTION']
})

const passagePending = validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
  kind: 'MOVEMENT_PASSAGE_CHOICE',
  occurrenceId,
  occurrenceVersion: 2,
  encounterVersion: tabletopGmEncounter.version,
  sourceActorId: tabletopGmEncounter.actors[0]!.id,
  options: [
    { optionId: 'a'.repeat(64), ruleKind: 'OVERRUN' as const, economy: 'ACTION' as const },
    { optionId: 'b'.repeat(64), ruleKind: 'TUMBLE' as const, economy: 'BONUS_ACTION' as const }
  ],
  allowedResponses: ['DECLINE', 'OPTION']
})

const initiativePending = validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
  kind: 'INITIATIVE_EVIDENCE',
  occurrenceId,
  occurrenceVersion: 2,
  encounterVersion: tabletopGmEncounter.version,
  request: { requestId: 'initiative-roll', min: 1, max: 20 },
  allowedResponses: ['ENTER_INTEGER', 'SYSTEM_ROLL']
})

const actionOutcomePending = validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
  kind: 'ACTION_OUTCOME_EVIDENCE',
  occurrenceId,
  occurrenceVersion: 2,
  encounterVersion: tabletopGmEncounter.version,
  rollerActorId: null,
  request: { requestId: 'action-outcome', min: 0, max: 10 },
  allowedResponses: ['ENTER_INTEGER', 'SYSTEM_ROLL']
})

const declarationPending = validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
  kind: 'INITIATIVE_DECLARATION',
  occurrenceId,
  occurrenceVersion: 2,
  encounterVersion: tabletopGmEncounter.version,
  actorId: tabletopGmEncounter.actors[0]!.id,
  requestId: 'speed-factor-declaration',
  primaryOptions: [
    {
      kind: 'CHARACTER_ACTION' as const,
      optionId: 'action:longsword',
      label: 'Longsword',
      selectionContract: 'a'.repeat(64)
    }
  ],
  bonusOptions: [
    {
      kind: 'CHARACTER_SPELL_CAST' as const,
      optionId: 'spell:misty-step',
      label: 'Misty Step',
      selectionContract: 'b'.repeat(64)
    }
  ],
  adjudicationFields: [],
  allowedResponses: ['INITIATIVE_DECLARATION']
})

async function resolveDecisionCommand(
  command:
    | RemoveAreaTargetInputDto
    | ResolveRuleOccurrenceInputDto
    | RollRuleEvidenceInputDto
    | VoidRuleOccurrenceInputDto
): Promise<EncounterCommandResultDto> {
  resolveDecision(command)
  if (command.type === 'ROLL_RULE_EVIDENCE')
    return {
      projection: tabletopGmEncounter,
      roll: null,
      occurrence: null,
      evidenceRoll: {
        rollId: appRollId,
        occurrenceId: command.occurrenceId,
        occurrenceVersion: command.expectedOccurrenceVersion,
        requestId: command.requestId,
        attempt: 1,
        faces: [14],
        value: 14,
        rollMode: command.rollMode,
        keep: offeredRollModes.find(({ code }) => code === command.rollMode)?.keep ?? null,
        derivedRollMode: command.rollMode
      }
    }
  return {
    projection: { ...tabletopGmEncounter, version: tabletopGmEncounter.version + 1 },
    roll: null,
    occurrence: {
      occurrenceId: command.occurrenceId,
      occurrenceVersion: command.expectedOccurrenceVersion + 1,
      status: 'COMPLETE',
      pending: null
    },
    evidenceRoll: null
  }
}

const meta = {
  component: CampaignTabletopDecisionDrawer,
  args: {
    canVoid: true,
    connected: true,
    encounter: tabletopGmEncounter,
    latestRoll: null,
    pending: d20Pending,
    skipped: null,
    submitting: false,
    onResolve: resolveDecisionCommand
  },
  parameters: { a11y: { test: 'error' }, layout: 'padded' },
  title: 'Domains/Campaigns/VTT/Tabletop Decisions'
} satisfies Meta<typeof CampaignTabletopDecisionDrawer>

export default meta
type Story = StoryObj<typeof meta>

export const PhysicalD20: Story = {
  play: async ({ canvasElement }) => {
    resolveDecision.mockClear()
    const page = within(canvasElement.ownerDocument.body)
    const drawer = await openDecision(page)
    await userEvent.type(drawer.getByLabelText('Die 1'), '18')
    await userEvent.type(drawer.getByLabelText('Die 2'), '7')
    await userEvent.click(drawer.getByRole('button', { name: 'Submit roll' }))

    await waitFor(() => expect(resolveDecision).toHaveBeenCalledTimes(1))
    await expect(await drawer.findByText('Decision resolved.')).toBeVisible()
    await expect(resolveDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RESOLVE_RULE_OCCURRENCE',
        occurrenceId,
        expectedOccurrenceVersion: 2,
        resolution: {
          kind: 'ENTER_DICE',
          requestId: 'attack-roll',
          rawFaces: [18, 7],
          rollMode: 'ADVANTAGE'
        }
      })
    )
  }
}

export const MovementReaction: Story = {
  args: { pending: reactionPending },
  play: async ({ canvasElement }) => {
    resolveDecision.mockClear()
    const page = within(canvasElement.ownerDocument.body)
    const drawer = await openDecision(page)
    await userEvent.click(drawer.getByRole('button', { name: 'Use opportunity-attack' }))
    await waitFor(() => expect(resolveDecision).toHaveBeenCalledTimes(1))
    await expect(resolveDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: { kind: 'OPTION', optionId: 'a'.repeat(64) }
      })
    )
  }
}

export const PassageChoice: Story = {
  args: { pending: passagePending },
  play: async ({ canvasElement }) => {
    resolveDecision.mockClear()
    const page = within(canvasElement.ownerDocument.body)
    const drawer = await openDecision(page)
    await userEvent.click(drawer.getByRole('button', { name: 'Overrun · Action' }))
    await waitFor(() => expect(resolveDecision).toHaveBeenCalledTimes(1))
    await expect(resolveDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: { kind: 'PASSAGE_OPTION', optionId: 'a'.repeat(64) }
      })
    )
  }
}

export const InitiativeAppRoll: Story = {
  args: { pending: initiativePending },
  play: async ({ canvasElement }) => {
    resolveDecision.mockClear()
    const page = within(canvasElement.ownerDocument.body)
    const drawer = await openDecision(page)
    await userEvent.click(drawer.getByRole('button', { name: 'Roll dice' }))
    await waitFor(() => expect(resolveDecision).toHaveBeenCalledTimes(1))
    await expect(resolveDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ROLL_RULE_EVIDENCE',
        requestId: 'initiative-roll',
        rollMode: null
      })
    )
    await expect(await drawer.findByText('Rolled by the app · attempt 1')).toBeVisible()
    await userEvent.click(drawer.getByRole('button', { name: 'Submit roll' }))
    await waitFor(() => expect(resolveDecision).toHaveBeenCalledTimes(2))
    await expect(resolveDecision).toHaveBeenLastCalledWith(
      expect.objectContaining({
        resolution: { kind: 'SYSTEM_ROLL', requestId: 'initiative-roll', rollId: appRollId }
      })
    )
  }
}

export const AreaSaves: Story = {
  args: { pending: areaPending },
  play: async ({ canvasElement }) => {
    resolveDecision.mockClear()
    const page = within(canvasElement.ownerDocument.body)
    const drawer = await openDecision(page)
    await expect(drawer.getByText('Caught in the area: Ember, Vault Warden')).toBeVisible()
    const row = within(drawer.getByRole('group', { name: 'Vault Warden' }))
    await userEvent.type(row.getByLabelText('Die 1'), '9')
    await userEvent.click(row.getByRole('button', { name: 'Submit roll' }))
    await waitFor(() => expect(resolveDecision).toHaveBeenCalledTimes(1))
    await expect(resolveDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: {
          kind: 'ENTER_DICE',
          requestId: `save-${tabletopGmEncounter.actors[1]!.id}`,
          rawFaces: [9],
          rollMode: 'NORMAL'
        }
      })
    )
  }
}

export const ActionOutcome: Story = {
  args: { pending: actionOutcomePending },
  play: async ({ canvasElement }) => {
    resolveDecision.mockClear()
    const page = within(canvasElement.ownerDocument.body)
    const drawer = await openDecision(page)
    await userEvent.type(drawer.getByLabelText('Result'), '7')
    await userEvent.click(drawer.getByRole('button', { name: 'Submit roll' }))
    await waitFor(() => expect(resolveDecision).toHaveBeenCalledTimes(1))
    await expect(resolveDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: { kind: 'ENTER_INTEGER', requestId: 'action-outcome', value: 7 }
      })
    )
  }
}

export const InitiativeDeclaration: Story = {
  args: { pending: declarationPending },
  play: async ({ canvasElement }) => {
    resolveDecision.mockClear()
    const page = within(canvasElement.ownerDocument.body)
    const drawer = await openDecision(page)
    await userEvent.click(drawer.getByRole('combobox', { name: 'Primary action' }))
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await userEvent.click(drawer.getByRole('combobox', { name: 'Bonus action' }))
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await userEvent.click(drawer.getByRole('button', { name: 'Declare actions' }))
    await waitFor(() => expect(resolveDecision).toHaveBeenCalledTimes(1))
    await expect(resolveDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: {
          kind: 'INITIATIVE_DECLARATION',
          requestId: 'speed-factor-declaration',
          primary: { kind: 'CHARACTER_ACTION', optionId: 'action:longsword' },
          bonus: { kind: 'CHARACTER_SPELL_CAST', optionId: 'spell:misty-step' }
        }
      })
    )
  }
}

export const Reconnecting: Story = {
  args: { connected: false },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    const drawer = await openDecision(page)
    await expect(drawer.getByText(/controls will return when live play reconnects/i)).toBeVisible()
    await expect(drawer.getByRole('button', { name: 'Roll dice' })).toBeDisabled()
  }
}

export const KeyboardConflict: Story = {
  args: {
    onResolve: async () => {
      throw new Error('This decision changed before it could be resolved.')
    }
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    const drawer = await openDecisionByKeyboard(page)
    await userEvent.click(drawer.getByRole('button', { name: 'Roll dice' }))
    await expect(
      await drawer.findByText('This decision changed before it could be resolved.')
    ).toBeVisible()
  }
}

// VTT_UI-4.2: an evidence roll is rolled, announced and submitted with the keyboard alone.
export const KeyboardOnlyEvidenceRoll: Story = {
  args: { pending: initiativePending },
  play: async ({ canvasElement }) => {
    resolveDecision.mockClear()
    const page = within(canvasElement.ownerDocument.body)
    const drawer = await openDecisionByKeyboard(page)
    await reachByKeyboard(drawer.getByRole('button', { name: 'Roll dice' }), () => userEvent.tab())
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(resolveDecision).toHaveBeenCalledTimes(1))
    const announcement = await drawer.findByText('Rolled by the app · attempt 1')
    await expect(announcement).toHaveAttribute('aria-live', 'polite')
    await reachByKeyboard(drawer.getByRole('button', { name: 'Submit roll' }), () =>
      userEvent.tab()
    )
    await userEvent.keyboard(' ')
    await waitFor(() => expect(resolveDecision).toHaveBeenCalledTimes(2))
    await expect(resolveDecision).toHaveBeenLastCalledWith(
      expect.objectContaining({
        resolution: { kind: 'SYSTEM_ROLL', requestId: 'initiative-roll', rollId: appRollId }
      })
    )
    await expect(await drawer.findByText('Decision resolved.')).toBeVisible()
  }
}

async function openDecisionByKeyboard(page: ReturnType<typeof within>) {
  const trigger = await page.findByRole('button', { name: 'Open pending decision' })
  await reachByKeyboard(trigger, () => userEvent.tab())
  await userEvent.keyboard('{Enter}')
  const dialog = await page.findByRole('dialog', { name: 'Pending decision' })
  await waitFor(() => expect(dialog).toBeVisible())
  await waitFor(() => expect(getComputedStyle(dialog).opacity).toBe('1'))
  await waitFor(() => expect(dialog.getAnimations()).toHaveLength(0))
  return within(dialog)
}

async function openDecision(page: ReturnType<typeof within>) {
  await userEvent.click(await page.findByRole('button', { name: 'Open pending decision' }))
  const dialog = await page.findByRole('dialog', { name: 'Pending decision' })
  await waitFor(() => expect(dialog).toBeVisible())
  await waitFor(() => expect(getComputedStyle(dialog).opacity).toBe('1'))
  await waitFor(() => expect(dialog.getAnimations()).toHaveLength(0))
  return within(dialog)
}
