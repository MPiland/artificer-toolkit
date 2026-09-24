import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounters'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CampaignTabletopDecisionDrawer } from './CampaignTabletopDecisionDrawer'
import { tabletopGmEncounter } from './CampaignTabletop.stories.fixtures'

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn()
  })
})

const occurrenceId = '77777777-7777-4777-8777-777777777790'
const pending = {
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

const adjudicatedPending = {
  ...pending,
  primaryOptions: [
    {
      kind: 'GM_ADJUDICATED' as const,
      optionId: 'GM_ADJUDICATED',
      label: 'GM adjudication',
      selectionContract: 'c'.repeat(64)
    }
  ],
  bonusOptions: [],
  adjudicationFields: [
    {
      kind: 'SELECT' as const,
      key: 'actorSize' as const,
      label: 'Actor size',
      required: true as const,
      options: [
        { value: 'TINY', label: 'Tiny' },
        { value: 'SMALL', label: 'Small' },
        { value: 'MEDIUM', label: 'Medium' }
      ]
    },
    {
      kind: 'MULTI_SELECT' as const,
      key: 'actionFactors' as const,
      label: 'Action factors',
      minimumSelections: 0,
      maximumSelections: 4,
      options: [{ value: 'MELEE_HEAVY', label: 'Melee heavy' }]
    },
    {
      kind: 'NULLABLE_INTEGER' as const,
      key: 'spellLevel' as const,
      label: 'Spell level',
      minimum: 0,
      maximum: 12
    }
  ]
} satisfies PendingEncounterRuleOccurrenceSummaryDto

const actionOutcomePending = {
  kind: 'ACTION_OUTCOME_EVIDENCE',
  occurrenceId,
  occurrenceVersion: 2,
  encounterVersion: tabletopGmEncounter.version,
  request: { requestId: 'action-outcome', min: 0, max: 10 },
  allowedResponses: ['ENTER_INTEGER', 'SYSTEM_ROLL']
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

const d20Pending = {
  kind: 'D20_EVIDENCE',
  occurrenceId,
  occurrenceVersion: 3,
  encounterVersion: tabletopGmEncounter.version,
  request: { requestId: 'attack-roll', min: 1, max: 20, rollMode: 'NORMAL' as const },
  allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
} satisfies PendingEncounterRuleOccurrenceSummaryDto

const legendaryPending = {
  kind: 'LEGENDARY_ACTION_CHOICE',
  occurrenceId,
  occurrenceVersion: 4,
  encounterVersion: tabletopGmEncounter.version,
  ownerActorId: tabletopGmEncounter.actors[0]!.id,
  options: [
    {
      optionId: 'c'.repeat(64),
      actionId: 'tail-swipe',
      ownerFeatureId: '77777777-7777-4777-8777-777777777799',
      targetActorId: tabletopGmEncounter.actors[0]!.id
    }
  ],
  allowedResponses: ['DECLINE', 'OPTION']
} satisfies PendingEncounterRuleOccurrenceSummaryDto

const cleavingPending = {
  kind: 'OPTIONAL_COMBAT_CLEAVING',
  occurrenceId,
  occurrenceVersion: 5,
  encounterVersion: tabletopGmEncounter.version,
  sourceActorId: tabletopGmEncounter.actors[0]!.id,
  options: [{ optionId: 'd'.repeat(64), targetActorId: tabletopGmEncounter.actors[1]!.id }],
  allowedResponses: ['DECLINE', 'OPTION']
} satisfies PendingEncounterRuleOccurrenceSummaryDto

function resolved(occurrenceVersion = 3): EncounterCommandResultDto {
  return {
    projection: tabletopGmEncounter,
    roll: null,
    resolution: null,
    occurrence: {
      occurrenceId,
      occurrenceVersion,
      status: 'COMPLETE' as const,
      outcome: null,
      pending: null
    }
  }
}

describe('CampaignTabletopDecisionDrawer initiative declaration', () => {
  it('submits only the selected frozen primary and bonus identities', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn(async () => resolved())
    renderWithAppProviders(
      <CampaignTabletopDecisionDrawer
        connected
        encounter={tabletopGmEncounter}
        pending={pending}
        submitting={false}
        onResolve={onResolve}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    await user.click(await screen.findByRole('combobox', { name: 'Primary action' }))
    await user.keyboard('{ArrowDown}{Enter}')
    await user.click(screen.getByRole('combobox', { name: 'Bonus action' }))
    await user.keyboard('{ArrowDown}{Enter}')
    await user.click(screen.getByRole('button', { name: 'Declare actions' }))

    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: {
          kind: 'INITIATIVE_DECLARATION',
          requestId: 'speed-factor-declaration',
          primary: { kind: 'CHARACTER_ACTION', optionId: 'action:longsword' },
          bonus: { kind: 'CHARACTER_SPELL_CAST', optionId: 'spell:misty-step' }
        }
      })
    )
  })

  it('submits closed GM adjudication inputs and remains disabled while reconnecting', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn(async () => resolved())
    const { rerender } = renderWithAppProviders(
      <CampaignTabletopDecisionDrawer
        connected
        encounter={tabletopGmEncounter}
        pending={adjudicatedPending}
        submitting={false}
        onResolve={onResolve}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    await user.click(await screen.findByRole('combobox', { name: 'Primary action' }))
    await user.keyboard('{ArrowDown}{Enter}')
    await user.click(screen.getByRole('combobox', { name: 'Actor size' }))
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{Enter}')
    await user.click(screen.getByRole('combobox', { name: 'Action factors' }))
    await user.keyboard('{ArrowDown}{Enter}')
    await user.type(screen.getByLabelText('Spell level'), '3')
    await user.click(screen.getByRole('button', { name: 'Declare actions' }))

    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: {
          kind: 'INITIATIVE_DECLARATION',
          requestId: 'speed-factor-declaration',
          primary: {
            kind: 'GM_ADJUDICATED',
            optionId: 'GM_ADJUDICATED',
            actorSize: 'MEDIUM',
            actionFactors: ['MELEE_HEAVY'],
            spellLevel: 3
          },
          bonus: null
        }
      })
    )

    rerender(
      <CampaignTabletopDecisionDrawer
        connected={false}
        encounter={tabletopGmEncounter}
        pending={adjudicatedPending}
        submitting={false}
        onResolve={onResolve}
      />
    )
    expect(screen.getByRole('button', { name: 'Declare actions' })).toBeDisabled()
  })
})

describe('CampaignTabletopDecisionDrawer action outcome evidence', () => {
  it('submits the entered result and disables controls while disconnected', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn(async () => resolved())
    const { rerender } = renderWithAppProviders(
      <CampaignTabletopDecisionDrawer
        connected
        encounter={tabletopGmEncounter}
        pending={actionOutcomePending}
        submitting={false}
        onResolve={onResolve}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    expect(screen.getByText('Action outcome required')).toBeVisible()
    await user.type(screen.getByLabelText('Result'), '7')
    await user.click(screen.getByRole('button', { name: 'Submit result' }))

    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        occurrenceId,
        resolution: { kind: 'ENTER_INTEGER', requestId: 'action-outcome', value: 7 }
      })
    )

    rerender(
      <CampaignTabletopDecisionDrawer
        connected={false}
        encounter={tabletopGmEncounter}
        pending={actionOutcomePending}
        submitting={false}
        onResolve={onResolve}
      />
    )
    expect(screen.getByRole('button', { name: 'Submit result' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Roll in VTT' })).toBeDisabled()

    rerender(
      <CampaignTabletopDecisionDrawer
        connected
        encounter={tabletopGmEncounter}
        pending={actionOutcomePending}
        submitting
        onResolve={onResolve}
      />
    )
    expect(screen.getByRole('button', { name: 'Submit result' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Roll in VTT' })).toBeDisabled()
  })
})

describe('CampaignTabletopDecisionDrawer passage choice', () => {
  it('submits passage options and decline with the existing command envelope', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn(async () => resolved())
    renderWithAppProviders(
      <CampaignTabletopDecisionDrawer
        connected
        encounter={tabletopGmEncounter}
        pending={passagePending}
        submitting={false}
        onResolve={onResolve}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    expect(screen.getByText('Passage choice')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Overrun · Action' }))
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({ resolution: { kind: 'PASSAGE_OPTION', optionId: 'a'.repeat(64) } })
    )

    await user.click(screen.getByRole('button', { name: 'Decline passage' }))
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({ resolution: { kind: 'PASSAGE_DECLINE' } })
    )
  })

  it('disables passage controls while disconnected or submitting and follows a paused result', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn(async () => resolved())
    const { rerender } = renderWithAppProviders(
      <CampaignTabletopDecisionDrawer
        connected={false}
        encounter={tabletopGmEncounter}
        pending={passagePending}
        submitting={false}
        onResolve={onResolve}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    expect(screen.getByRole('button', { name: 'Overrun · Action' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Decline passage' })).toBeDisabled()

    rerender(
      <CampaignTabletopDecisionDrawer
        connected
        encounter={tabletopGmEncounter}
        pending={passagePending}
        submitting
        onResolve={onResolve}
      />
    )
    expect(screen.getByRole('button', { name: 'Tumble · Bonus action' })).toBeDisabled()

    rerender(
      <CampaignTabletopDecisionDrawer
        connected
        encounter={tabletopGmEncounter}
        pending={d20Pending}
        submitting={false}
        onResolve={onResolve}
      />
    )
    expect(screen.getByRole('button', { name: 'Roll in VTT' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Submit physical roll' })).toBeDisabled()
  })
})

describe('CampaignTabletopDecisionDrawer Legendary and Cleaving choices', () => {
  it('submits canonical option selections and disables Cleaving while closed', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn(async () => resolved())
    const { rerender } = renderWithAppProviders(
      <CampaignTabletopDecisionDrawer
        connected
        encounter={tabletopGmEncounter}
        pending={legendaryPending}
        submitting={false}
        onResolve={onResolve}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    await user.click(screen.getByRole('button', { name: /^tail-swipe · / }))
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({ resolution: { kind: 'OPTION', optionId: 'c'.repeat(64) } })
    )

    rerender(
      <CampaignTabletopDecisionDrawer
        connected={false}
        encounter={tabletopGmEncounter}
        pending={cleavingPending}
        submitting={false}
        onResolve={onResolve}
      />
    )
    expect(screen.getByText('Cleaving choice')).toBeVisible()
    expect(screen.getByRole('button', { name: /^Cleave / })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Decline cleaving' })).toBeDisabled()

    rerender(
      <CampaignTabletopDecisionDrawer
        connected
        encounter={tabletopGmEncounter}
        pending={cleavingPending}
        submitting
        onResolve={onResolve}
      />
    )
    expect(screen.getByRole('button', { name: /^Cleave / })).toBeDisabled()
  })
})
