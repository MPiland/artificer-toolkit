import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import type {
  EncounterCommandResultDto,
  ResolveRuleOccurrenceInputDto,
  VoidRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { CampaignTabletopDecisionDrawer } from './CampaignTabletopDecisionDrawer'
import { tabletopGmEncounter } from './CampaignTabletop.stories.fixtures'

const occurrenceId = '77777777-7777-4777-8777-777777777790'
const resolveDecision = fn()

const d20Pending = {
  kind: 'D20_EVIDENCE',
  occurrenceId,
  occurrenceVersion: 2,
  encounterVersion: tabletopGmEncounter.version,
  request: { requestId: 'attack-roll', min: 1, max: 20, rollMode: 'ADVANTAGE' },
  allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
} satisfies PendingEncounterRuleOccurrenceSummaryDto

const reactionPending = {
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
} satisfies PendingEncounterRuleOccurrenceSummaryDto

const passagePending = {
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
} satisfies PendingEncounterRuleOccurrenceSummaryDto

const initiativePending = {
  kind: 'INITIATIVE_EVIDENCE',
  occurrenceId,
  occurrenceVersion: 2,
  encounterVersion: tabletopGmEncounter.version,
  request: { requestId: 'initiative-roll', min: 1, max: 20 },
  allowedResponses: ['ENTER_INTEGER', 'SYSTEM_ROLL']
} satisfies PendingEncounterRuleOccurrenceSummaryDto

const actionOutcomePending = {
  kind: 'ACTION_OUTCOME_EVIDENCE',
  occurrenceId,
  occurrenceVersion: 2,
  encounterVersion: tabletopGmEncounter.version,
  request: { requestId: 'action-outcome', min: 0, max: 10 },
  allowedResponses: ['ENTER_INTEGER', 'SYSTEM_ROLL']
} satisfies PendingEncounterRuleOccurrenceSummaryDto

const declarationPending = {
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
} satisfies PendingEncounterRuleOccurrenceSummaryDto

async function resolveDecisionCommand(
  command: ResolveRuleOccurrenceInputDto | VoidRuleOccurrenceInputDto
): Promise<EncounterCommandResultDto> {
  resolveDecision(command)
  return {
    projection: { ...tabletopGmEncounter, version: tabletopGmEncounter.version + 1 },
    roll: null,
    resolution: null,
    occurrence: {
      occurrenceId: command.occurrenceId,
      occurrenceVersion: command.expectedOccurrenceVersion + 1,
      status: 'COMPLETE',
      outcome: null,
      pending: null
    }
  }
}

const meta = {
  component: CampaignTabletopDecisionDrawer,
  args: {
    canVoid: true,
    connected: true,
    encounter: tabletopGmEncounter,
    pending: d20Pending,
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
    await userEvent.click(drawer.getByRole('button', { name: 'Submit physical roll' }))

    await waitFor(() => expect(resolveDecision).toHaveBeenCalledTimes(1))
    await expect(await drawer.findByText('Decision resolved.')).toBeVisible()
    await expect(resolveDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RESOLVE_RULE_OCCURRENCE',
        occurrenceId,
        expectedOccurrenceVersion: 2,
        resolution: { kind: 'ENTER_DICE', requestId: 'attack-roll', rawFaces: [18, 7] }
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

export const InitiativeSystemRoll: Story = {
  args: { pending: initiativePending },
  play: async ({ canvasElement }) => {
    resolveDecision.mockClear()
    const page = within(canvasElement.ownerDocument.body)
    const drawer = await openDecision(page)
    await userEvent.click(drawer.getByRole('button', { name: 'Roll in VTT' }))
    await waitFor(() => expect(resolveDecision).toHaveBeenCalledTimes(1))
    await expect(resolveDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: { kind: 'SYSTEM_ROLL', requestId: 'initiative-roll' }
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
    await userEvent.click(drawer.getByRole('button', { name: 'Submit result' }))
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
    await expect(drawer.getByRole('button', { name: 'Roll in VTT' })).toBeDisabled()
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
    const trigger = await page.findByRole('button', { name: 'Open pending decision' })
    trigger.focus()
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    const dialog = await page.findByRole('dialog', { name: 'Pending decision' })
    await waitFor(() => expect(dialog).toBeVisible())
    await waitFor(() => expect(getComputedStyle(dialog).opacity).toBe('1'))
    await waitFor(() => expect(dialog.getAnimations()).toHaveLength(0))
    const drawer = within(dialog)
    await userEvent.click(drawer.getByRole('button', { name: 'Roll in VTT' }))
    await expect(
      await drawer.findByText('This decision changed before it could be resolved.')
    ).toBeVisible()
  }
}

async function openDecision(page: ReturnType<typeof within>) {
  await userEvent.click(await page.findByRole('button', { name: 'Open pending decision' }))
  const dialog = await page.findByRole('dialog', { name: 'Pending decision' })
  await waitFor(() => expect(dialog).toBeVisible())
  await waitFor(() => expect(getComputedStyle(dialog).opacity).toBe('1'))
  await waitFor(() => expect(dialog.getAnimations()).toHaveLength(0))
  return within(dialog)
}
