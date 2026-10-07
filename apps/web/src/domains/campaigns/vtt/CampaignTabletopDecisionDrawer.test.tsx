import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type {
  EncounterCommandResultDto,
  EncounterEvidenceRollDto
} from '@artificer-toolkit/schema/api/encounters'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CampaignTabletopDecisionDrawer } from './CampaignTabletopDecisionDrawer'
import { tabletopGmEncounter } from './CampaignTabletop.stories.fixtures'

vi.mock('#app/settings/useGmRollVisibilityPreference', () => ({
  useGmRollVisibilityPreference: () => ({
    gmRollVisibility: 'PUBLIC',
    setGmRollVisibility: vi.fn()
  })
}))

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
  rollerActorId: null,
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
  rollerActorId: null,
  request: {
    requestId: 'attack-roll',
    min: 1,
    max: 20,
    rollMode: 'NORMAL' as const,
    derivedRollModeReasons: []
  },
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
      actionId: 'shimmering-shield',
      ownerFeatureId: '77777777-7777-4777-8777-777777777799',
      label: 'Shimmering Shield',
      featureCost: 2,
      targetActorIds: [tabletopGmEncounter.actors[0]!.id]
    },
    {
      optionId: 'd'.repeat(64),
      actionId: 'tail-attack',
      ownerFeatureId: '77777777-7777-4777-8777-777777777799',
      label: 'Tail Attack',
      featureCost: 1,
      // The second target is an actor this viewer cannot see.
      targetActorIds: [tabletopGmEncounter.actors[1]!.id, '99999999-9999-4999-8999-999999999903']
    }
  ],
  allowedResponses: ['DECLINE', 'LEGENDARY_OPTION']
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
    occurrence: {
      occurrenceId,
      occurrenceVersion,
      status: 'COMPLETE' as const,
      pending: null
    },
    evidenceRoll: null
  }
}

describe('CampaignTabletopDecisionDrawer initiative declaration', () => {
  it('submits only the selected frozen primary and bonus identities', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn(async () => resolved())
    renderWithAppProviders(
      <CampaignTabletopDecisionDrawer
        skipped={null}
        canVoid={false}
        connected
        encounter={tabletopGmEncounter}
        latestRoll={null}
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
        skipped={null}
        canVoid={false}
        connected
        encounter={tabletopGmEncounter}
        latestRoll={null}
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
        skipped={null}
        canVoid={false}
        connected={false}
        encounter={tabletopGmEncounter}
        latestRoll={null}
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
        skipped={null}
        canVoid={false}
        connected
        encounter={tabletopGmEncounter}
        latestRoll={null}
        pending={actionOutcomePending}
        submitting={false}
        onResolve={onResolve}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    expect(screen.getByText('Action outcome required')).toBeVisible()
    await user.type(screen.getByLabelText('Result'), '7')
    await user.click(screen.getByRole('button', { name: 'Submit roll' }))

    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        occurrenceId,
        resolution: { kind: 'ENTER_INTEGER', requestId: 'action-outcome', value: 7 }
      })
    )

    rerender(
      <CampaignTabletopDecisionDrawer
        skipped={null}
        canVoid={false}
        connected={false}
        encounter={tabletopGmEncounter}
        latestRoll={null}
        pending={actionOutcomePending}
        submitting={false}
        onResolve={onResolve}
      />
    )
    expect(screen.getByRole('button', { name: 'Submit roll' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Roll dice' })).toBeDisabled()

    rerender(
      <CampaignTabletopDecisionDrawer
        skipped={null}
        canVoid={false}
        connected
        encounter={tabletopGmEncounter}
        latestRoll={null}
        pending={actionOutcomePending}
        submitting
        onResolve={onResolve}
      />
    )
    expect(screen.getByRole('button', { name: 'Submit roll' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Roll dice' })).toBeDisabled()
  })
})

describe('CampaignTabletopDecisionDrawer void', () => {
  it('lets the GM void the pending decision and hides the control from players', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn(async () => resolved())
    const { rerender } = renderWithAppProviders(
      <CampaignTabletopDecisionDrawer
        skipped={null}
        canVoid
        connected
        encounter={tabletopGmEncounter}
        latestRoll={null}
        pending={actionOutcomePending}
        submitting={false}
        onResolve={onResolve}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    await user.click(screen.getByRole('button', { name: 'Void decision' }))

    expect(onResolve).toHaveBeenCalledWith({
      type: 'VOID_RULE_OCCURRENCE',
      encounterId: tabletopGmEncounter.id,
      commandId: expect.any(String),
      expectedVersion: actionOutcomePending.encounterVersion,
      occurrenceId,
      expectedOccurrenceVersion: actionOutcomePending.occurrenceVersion
    })
    expect(await screen.findByText('Decision voided.')).toBeVisible()

    rerender(
      <CampaignTabletopDecisionDrawer
        skipped={null}
        canVoid={false}
        connected
        encounter={tabletopGmEncounter}
        latestRoll={null}
        pending={actionOutcomePending}
        submitting={false}
        onResolve={onResolve}
      />
    )
    expect(screen.queryByRole('button', { name: 'Void decision' })).not.toBeInTheDocument()
  })
})

describe('CampaignTabletopDecisionDrawer movement skip', () => {
  it('offers the GM Skip decision on a pending movement choice (D26)', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn(async () => resolved())
    renderWithAppProviders(
      <CampaignTabletopDecisionDrawer
        skipped={null}
        canVoid
        connected
        encounter={tabletopGmEncounter}
        latestRoll={null}
        pending={passagePending}
        submitting={false}
        onResolve={onResolve}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    expect(screen.queryByRole('button', { name: 'Void decision' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Skip decision' }))
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'VOID_RULE_OCCURRENCE',
        occurrenceId: passagePending.occurrenceId,
        expectedOccurrenceVersion: passagePending.occurrenceVersion
      })
    )
    expect(await screen.findByText('Decision skipped.')).toBeVisible()
  })

  it('tells the waiting player the GM skipped their decision, and closing dismisses it (D39)', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    renderWithAppProviders(
      <CampaignTabletopDecisionDrawer
        skipped={{ onDismiss }}
        canVoid={false}
        connected
        encounter={tabletopGmEncounter}
        latestRoll={null}
        pending={passagePending}
        submitting
        onResolve={vi.fn(async () => resolved())}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    expect(await screen.findByText('The GM skipped this decision.')).toBeVisible()
    expect(screen.queryByRole('button', { name: /Overrun|Tumble/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Decline passage' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close pending decision' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})

describe('CampaignTabletopDecisionDrawer passage choice', () => {
  it('submits passage options and decline with the existing command envelope', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn(async () => resolved())
    renderWithAppProviders(
      <CampaignTabletopDecisionDrawer
        skipped={null}
        canVoid={false}
        connected
        encounter={tabletopGmEncounter}
        latestRoll={null}
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
        skipped={null}
        canVoid={false}
        connected={false}
        encounter={tabletopGmEncounter}
        latestRoll={null}
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
        skipped={null}
        canVoid={false}
        connected
        encounter={tabletopGmEncounter}
        latestRoll={null}
        pending={passagePending}
        submitting
        onResolve={onResolve}
      />
    )
    expect(screen.getByRole('button', { name: 'Tumble · Bonus action' })).toBeDisabled()

    rerender(
      <CampaignTabletopDecisionDrawer
        skipped={null}
        canVoid={false}
        connected
        encounter={tabletopGmEncounter}
        latestRoll={null}
        pending={d20Pending}
        submitting={false}
        onResolve={onResolve}
      />
    )
    expect(screen.getByRole('button', { name: 'Roll dice' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Submit roll' })).toBeDisabled()
  })
})

describe('CampaignTabletopDecisionDrawer Legendary and Cleaving choices', () => {
  it('picks the target of a Legendary Action that runs an attack (D51)', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn(async () => resolved())
    const target = tabletopGmEncounter.actors[1]!
    renderWithAppProviders(
      <CampaignTabletopDecisionDrawer
        skipped={null}
        canVoid={false}
        connected
        encounter={tabletopGmEncounter}
        latestRoll={null}
        pending={legendaryPending}
        submitting={false}
        onResolve={onResolve}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    await user.click(screen.getByRole('combobox', { name: 'Legendary Action' }))
    await user.click(screen.getByRole('option', { name: 'Tail Attack · 1 action' }))
    expect(screen.getByRole('button', { name: 'Use Legendary Action' })).toBeDisabled()
    await user.click(screen.getByRole('combobox', { name: 'Target' }))
    expect(screen.getByRole('option', { name: 'Hidden combatant' })).toBeVisible()
    await user.click(screen.getByRole('option', { name: target.label }))
    await user.click(screen.getByRole('button', { name: 'Use Legendary Action' }))
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: { kind: 'LEGENDARY_OPTION', optionId: 'd'.repeat(64), targetActorId: target.id }
      })
    )
  })

  it('submits canonical option selections and disables Cleaving while closed', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn(async () => resolved())
    const { rerender } = renderWithAppProviders(
      <CampaignTabletopDecisionDrawer
        skipped={null}
        canVoid={false}
        connected
        encounter={tabletopGmEncounter}
        latestRoll={null}
        pending={legendaryPending}
        submitting={false}
        onResolve={onResolve}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    await user.click(screen.getByRole('combobox', { name: 'Legendary Action' }))
    await user.click(screen.getByRole('option', { name: 'Shimmering Shield · 2 actions' }))
    // A self action needs no target.
    expect(screen.queryByRole('combobox', { name: 'Target' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Use Legendary Action' }))
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: {
          kind: 'LEGENDARY_OPTION',
          optionId: 'c'.repeat(64),
          targetActorId: tabletopGmEncounter.actors[0]!.id
        }
      })
    )

    rerender(
      <CampaignTabletopDecisionDrawer
        skipped={null}
        canVoid={false}
        connected={false}
        encounter={tabletopGmEncounter}
        latestRoll={null}
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
        skipped={null}
        canVoid={false}
        connected
        encounter={tabletopGmEncounter}
        latestRoll={null}
        pending={cleavingPending}
        submitting
        onResolve={onResolve}
      />
    )
    expect(screen.getByRole('button', { name: /^Cleave / })).toBeDisabled()
  })
})

describe('CampaignTabletopDecisionDrawer roll rows', () => {
  const advantagePending = {
    ...d20Pending,
    rollerActorId: tabletopGmEncounter.actors[1]!.id,
    request: {
      ...d20Pending.request,
      rollMode: 'ADVANTAGE' as const,
      derivedRollModeReasons: ['Flanking', 'Reckless Attack']
    }
  } satisfies PendingEncounterRuleOccurrenceSummaryDto

  function appRoll(attempt: number, faces: number[]): EncounterEvidenceRollDto {
    return {
      rollId: `77777777-7777-4777-8777-77777777780${attempt}`,
      occurrenceId,
      occurrenceVersion: advantagePending.occurrenceVersion,
      requestId: advantagePending.request.requestId,
      attempt,
      faces,
      value: Math.max(...faces),
      rollMode: 'ADVANTAGE',
      derivedRollMode: 'ADVANTAGE'
    }
  }

  function rollingResolver(rolls: EncounterEvidenceRollDto[]) {
    return vi.fn(async (command: { type: string }): Promise<EncounterCommandResultDto> => {
      if (command.type !== 'ROLL_RULE_EVIDENCE') return resolved()
      return { ...resolved(), occurrence: null, evidenceRoll: rolls.shift() ?? null }
    })
  }

  it('names the actor and the damage behind a Concentration check', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <CampaignTabletopDecisionDrawer
        skipped={null}
        canVoid={false}
        connected
        encounter={tabletopGmEncounter}
        latestRoll={null}
        pending={{
          ...advantagePending,
          trigger: {
            kind: 'CONCENTRATION',
            damage: { amount: 12, typeLabel: 'Fire' },
            sourceLabel: 'Fire Bolt',
            dc: 10
          }
        }}
        submitting={false}
        onResolve={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    expect(screen.getByText('Concentration check')).toBeVisible()
    expect(
      screen.getByText('Concentration check for Vault Warden: took 12 fire from Fire Bolt (DC 10)')
    ).toBeVisible()
  })

  it('recommends the derived mode, rolls without settling and settles by the latest roll id', async () => {
    const user = userEvent.setup()
    const onResolve = rollingResolver([appRoll(1, [4, 17]), appRoll(2, [12, 9])])
    renderWithAppProviders(
      <CampaignTabletopDecisionDrawer
        skipped={null}
        canVoid={false}
        connected
        encounter={tabletopGmEncounter}
        latestRoll={null}
        pending={advantagePending}
        submitting={false}
        onResolve={onResolve}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    expect(screen.getByText('Roll for Vault Warden')).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Advantage' })).toBeChecked()
    expect(screen.getByText('Recommended: Advantage: Flanking, Reckless Attack')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Submit roll' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Roll dice' }))
    expect(onResolve).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'ROLL_RULE_EVIDENCE',
        occurrenceId,
        requestId: 'attack-roll',
        rollMode: 'ADVANTAGE'
      })
    )
    expect(await screen.findByText('Rolled by the app · attempt 1')).toBeVisible()
    expect(screen.getByLabelText('Die 2')).toHaveValue('17')
    expect(screen.getByText('Kept')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Roll dice' }))
    expect(await screen.findByText('Rolled by the app · attempt 2')).toBeVisible()
    expect(screen.getByLabelText('Die 1')).toHaveValue('12')
    await user.click(screen.getByRole('button', { name: 'Submit roll' }))

    expect(onResolve).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'RESOLVE_RULE_OCCURRENCE',
        resolution: { kind: 'SYSTEM_ROLL', requestId: 'attack-roll', rollId: appRoll(2, []).rollId }
      })
    )
  })

  it('sends the GM visibility with "Roll dice" and none for a player', async () => {
    const user = userEvent.setup()
    const onResolve = rollingResolver([appRoll(1, [4, 17]), appRoll(2, [12, 9])])
    for (const canVoid of [true, false]) {
      const { unmount } = renderWithAppProviders(
        <CampaignTabletopDecisionDrawer
          skipped={null}
          canVoid={canVoid}
          connected
          encounter={tabletopGmEncounter}
          latestRoll={null}
          pending={advantagePending}
          submitting={false}
          onResolve={onResolve}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
      expect(screen.queryByRole('radio', { name: 'Public' }) !== null).toBe(canVoid)
      await user.click(screen.getByRole('button', { name: 'Roll dice' }))
      const command = onResolve.mock.lastCall![0]
      if (canVoid)
        expect(command).toMatchObject({ type: 'ROLL_RULE_EVIDENCE', visibility: 'PUBLIC' })
      else expect(command).not.toHaveProperty('visibility')
      unmount()
    }
  })

  it('switches to entered faces once the roller edits the row or changes its mode', async () => {
    const user = userEvent.setup()
    const onResolve = rollingResolver([])
    renderWithAppProviders(
      <CampaignTabletopDecisionDrawer
        skipped={null}
        canVoid={false}
        connected
        encounter={tabletopGmEncounter}
        latestRoll={appRoll(3, [6, 15])}
        pending={advantagePending}
        submitting={false}
        onResolve={onResolve}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    expect(screen.getByText('Rolled by the app · attempt 3')).toBeVisible()
    await user.clear(screen.getByLabelText('Die 1'))
    await user.type(screen.getByLabelText('Die 1'), '19')
    expect(screen.getByText('Your entered values replace the app roll.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Submit roll' }))
    expect(onResolve).toHaveBeenLastCalledWith(
      expect.objectContaining({
        resolution: {
          kind: 'ENTER_DICE',
          requestId: 'attack-roll',
          rawFaces: [19, 15],
          rollMode: 'ADVANTAGE'
        }
      })
    )

    await user.click(screen.getByRole('radio', { name: 'Normal' }))
    expect(screen.getByText('Changed from Advantage, the recommended mode')).toBeVisible()
    expect(screen.queryByLabelText('Die 2')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Submit roll' }))
    expect(onResolve).toHaveBeenLastCalledWith(
      expect.objectContaining({
        resolution: {
          kind: 'ENTER_DICE',
          requestId: 'attack-roll',
          rawFaces: [19],
          rollMode: 'NORMAL'
        }
      })
    )
  })
})
