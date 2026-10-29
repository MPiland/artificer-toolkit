import type { ComponentProps } from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto,
  type EncounterEvidenceRollDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  pendingEncounterRuleOccurrenceSummaryDtoSchema,
  type PendingEncounterRuleOccurrenceSummaryDto
} from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { offeredRollModes } from '../../../test/offeredRollModes'
import { validated } from '../../../test/validatedFixture'
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
const pending = validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
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

const adjudicatedPending = validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
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
      key: 'factorIds' as const,
      label: 'Action factors',
      minimumSelections: 0,
      maximumSelections: 4,
      options: [{ value: '00000000-0000-4000-8000-0000000004e4', label: 'Melee heavy' }]
    },
    {
      kind: 'NULLABLE_INTEGER' as const,
      key: 'spellLevel' as const,
      label: 'Spell level',
      minimum: 0,
      maximum: 12
    }
  ]
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

const passagePending = validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
  kind: 'MOVEMENT_PASSAGE_CHOICE',
  occurrenceId,
  occurrenceVersion: 2,
  encounterVersion: tabletopGmEncounter.version,
  sourceActorId: tabletopGmEncounter.actors[0]!.id,
  options: [
    {
      optionId: 'a'.repeat(64),
      ruleKind: 'OVERRUN' as const,
      economy: 'ACTION' as const,
      initiatorCheckLabel: 'Strength (Athletics)'
    },
    {
      optionId: 'b'.repeat(64),
      ruleKind: 'TUMBLE' as const,
      economy: 'BONUS_ACTION' as const,
      initiatorCheckLabel: 'Dexterity (Acrobatics)'
    },
    {
      optionId: 'c'.repeat(64),
      ruleKind: 'CLIMB_ONTO_LARGER_CREATURE' as const,
      economy: 'ACTION' as const,
      initiatorCheckLabel: 'Strength (Athletics)'
    },
    {
      optionId: 'd'.repeat(64),
      ruleKind: 'CLIMB_ONTO_LARGER_CREATURE' as const,
      economy: 'ACTION' as const,
      initiatorCheckLabel: 'Dexterity (Acrobatics)'
    }
  ],
  allowedResponses: ['DECLINE', 'OPTION']
})

const d20Pending = validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
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
    keep: 'FIRST' as const,
    rollModes: offeredRollModes,
    derivedRollModeReasons: []
  },
  allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
})

const legendaryPending = validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
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
})

const cleavingPending = validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
  kind: 'OPTIONAL_COMBAT_CLEAVING',
  occurrenceId,
  occurrenceVersion: 5,
  encounterVersion: tabletopGmEncounter.version,
  sourceActorId: tabletopGmEncounter.actors[0]!.id,
  options: [{ optionId: 'd'.repeat(64), targetActorId: tabletopGmEncounter.actors[1]!.id }],
  allowedResponses: ['DECLINE', 'OPTION']
})

const retargetPending = validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
  kind: 'ATTACK_RETARGET_CHOICE',
  occurrenceId,
  occurrenceVersion: 6,
  encounterVersion: tabletopGmEncounter.version,
  attackerActorId: tabletopGmEncounter.actors[0]!.id,
  options: [{ optionId: 'e'.repeat(64), targetActorId: tabletopGmEncounter.actors[1]!.id }],
  allowedResponses: ['DECLINE', 'OPTION']
})

function resolved(occurrenceVersion = 3): EncounterCommandResultDto {
  return validated(encounterCommandResultDtoSchema)({
    projection: tabletopGmEncounter,
    roll: null,
    occurrence: {
      occurrenceId,
      occurrenceVersion,
      status: 'COMPLETE' as const,
      pending: null
    },
    evidenceRoll: null
  })
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
            factorIds: ['00000000-0000-4000-8000-0000000004e4'],
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
    await user.click(
      screen.getByRole('button', { name: 'Overrun · Strength (Athletics) · Action' })
    )
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({ resolution: { kind: 'PASSAGE_OPTION', optionId: 'a'.repeat(64) } })
    )
    await user.click(
      screen.getByRole('button', { name: 'Climb onto · Dexterity (Acrobatics) · Action' })
    )
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({ resolution: { kind: 'PASSAGE_OPTION', optionId: 'd'.repeat(64) } })
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
    expect(
      screen.getByRole('button', { name: 'Overrun · Strength (Athletics) · Action' })
    ).toBeDisabled()
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
    expect(
      screen.getByRole('button', { name: 'Tumble · Dexterity (Acrobatics) · Bonus action' })
    ).toBeDisabled()

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

describe('CampaignTabletopDecisionDrawer attack retarget', () => {
  function renderRetarget(
    onResolve: ComponentProps<typeof CampaignTabletopDecisionDrawer>['onResolve']
  ) {
    renderWithAppProviders(
      <CampaignTabletopDecisionDrawer
        skipped={null}
        canVoid={false}
        connected
        encounter={tabletopGmEncounter}
        latestRoll={null}
        pending={retargetPending}
        submitting={false}
        onResolve={onResolve}
      />
    )
  }

  it('turns the lost action on the chosen creature', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn(async () => resolved())
    renderRetarget(onResolve)

    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    await user.click(
      screen.getByRole('button', { name: `Target ${tabletopGmEncounter.actors[1]!.label}` })
    )
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({ resolution: { kind: 'OPTION', optionId: 'e'.repeat(64) } })
    )
  })

  it('loses the action on a decline', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn(async () => resolved())
    renderRetarget(onResolve)

    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    await user.click(screen.getByRole('button', { name: 'Lose the action' }))
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({ resolution: { kind: 'DECLINE' } })
    )
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
  const advantagePending = validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
    ...d20Pending,
    rollerActorId: tabletopGmEncounter.actors[1]!.id,
    request: {
      ...d20Pending.request,
      rollMode: 'ADVANTAGE' as const,
      keep: 'HIGHER' as const,
      derivedRollModeReasons: ['Flanking', 'Reckless Attack']
    }
  })

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
      keep: 'HIGHER',
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

  it('says before the roll that a save fails automatically, and names the conditions', async () => {
    const user = userEvent.setup()
    const autoFailPending = validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
      ...d20Pending,
      rollerActorId: tabletopGmEncounter.actors[1]!.id,
      request: {
        ...d20Pending.request,
        autoFail: [
          { conditionId: '77777777-7777-4777-8777-777777777801', label: 'Paralyzed' },
          { conditionId: '77777777-7777-4777-8777-777777777802', label: 'Stunned' }
        ]
      }
    })
    renderWithAppProviders(
      <CampaignTabletopDecisionDrawer
        skipped={null}
        canVoid={false}
        connected
        encounter={tabletopGmEncounter}
        latestRoll={null}
        pending={autoFailPending}
        submitting={false}
        onResolve={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    expect(screen.getByText('Fails automatically: Paralyzed, Stunned')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Roll dice' })).toBeEnabled()
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

  it('asks for each added die beside the d20 and submits its faces with the entered d20 (D156)', async () => {
    const user = userEvent.setup()
    const onResolve = rollingResolver([])
    renderWithAppProviders(
      <CampaignTabletopDecisionDrawer
        skipped={null}
        canVoid={false}
        connected
        encounter={tabletopGmEncounter}
        latestRoll={null}
        pending={validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
          ...d20Pending,
          request: {
            ...d20Pending.request,
            addedDice: [
              { label: 'Bane', count: 1, faces: 4, sign: 'SUBTRACT' as const },
              { label: 'Bless', count: 1, faces: 4, sign: 'ADD' as const }
            ]
          }
        })}
        submitting={false}
        onResolve={onResolve}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    await user.type(screen.getByLabelText('Die 1'), '11')
    await user.type(screen.getByLabelText('−d4 Bane'), '2')
    expect(screen.getByRole('button', { name: 'Submit roll' })).toBeDisabled()
    await user.type(screen.getByLabelText('+d4 Bless'), '3')
    await user.click(screen.getByRole('button', { name: 'Submit roll' }))
    expect(onResolve).toHaveBeenLastCalledWith(
      expect.objectContaining({
        resolution: {
          kind: 'ENTER_DICE',
          requestId: 'attack-roll',
          rawFaces: [11],
          rollMode: 'NORMAL',
          addedFaces: [2, 3]
        }
      })
    )
  })

  it('asks for one more d20 beside the held die and submits only the new face', async () => {
    const user = userEvent.setup()
    const onResolve = rollingResolver([])
    const heldPending = validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
      ...d20Pending,
      request: {
        ...d20Pending.request,
        heldD20: { faces: [12], caption: "Advantage: the target can't see you" }
      }
    })
    renderWithAppProviders(
      <CampaignTabletopDecisionDrawer
        skipped={null}
        canVoid={false}
        connected
        encounter={tabletopGmEncounter}
        latestRoll={null}
        pending={heldPending}
        submitting={false}
        onResolve={onResolve}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    expect(screen.getByText('Die 1: 12')).toBeVisible()
    expect(screen.getByText("Advantage: the target can't see you")).toBeVisible()
    expect(screen.queryByRole('radio', { name: 'Advantage' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Die 1')).not.toBeInTheDocument()
    expect(screen.getAllByRole('textbox')).toHaveLength(1)

    await user.type(screen.getByLabelText('One more d20'), '5')
    await user.click(screen.getByRole('button', { name: 'Submit roll' }))
    expect(onResolve).toHaveBeenLastCalledWith(
      expect.objectContaining({
        resolution: {
          kind: 'ENTER_DICE',
          requestId: 'attack-roll',
          rawFaces: [5],
          rollMode: 'NORMAL'
        }
      })
    )
  })
})

describe('CampaignTabletopDecisionDrawer contest check', () => {
  const contestPending = validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
    kind: 'CONTEST_CHECK',
    occurrenceId,
    occurrenceVersion: 2,
    encounterVersion: tabletopGmEncounter.version,
    rollerActorId: tabletopGmEncounter.actors[1]!.id,
    actionLabel: 'Grapple',
    requestId: 'target_d20',
    rollModes: offeredRollModes,
    checks: [
      {
        checkDefinitionId: '77777777-7777-4777-8777-777777777791',
        label: 'Strength (Athletics)',
        rollMode: 'NORMAL' as const,
        keep: 'FIRST' as const,
        derivedRollModeReasons: []
      },
      {
        checkDefinitionId: '77777777-7777-4777-8777-777777777792',
        label: 'Dexterity (Acrobatics)',
        rollMode: 'ADVANTAGE' as const,
        keep: 'HIGHER' as const,
        derivedRollModeReasons: ['Bless']
      }
    ],
    allowedResponses: ['CONTEST_CHECK']
  })
  const contestRoll: EncounterEvidenceRollDto = {
    rollId: '77777777-7777-4777-8777-777777777793',
    occurrenceId,
    occurrenceVersion: 2,
    requestId: 'target_d20',
    attempt: 1,
    faces: [6, 15],
    value: 15,
    rollMode: 'ADVANTAGE',
    keep: 'HIGHER',
    derivedRollMode: 'ADVANTAGE'
  }

  it('rolls the picked check in its mode and answers with that check (D152)', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn(async (command: { type: string }) =>
      command.type === 'ROLL_RULE_EVIDENCE'
        ? { ...resolved(), occurrence: null, evidenceRoll: contestRoll }
        : resolved()
    )
    renderWithAppProviders(
      <CampaignTabletopDecisionDrawer
        skipped={null}
        canVoid={false}
        connected
        encounter={tabletopGmEncounter}
        latestRoll={null}
        pending={contestPending}
        submitting={false}
        onResolve={onResolve}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    expect(screen.getByText('Contest check')).toBeVisible()
    expect(screen.getByText('Grapple: roll for Vault Warden')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Roll dice' })).toBeNull()
    await user.click(screen.getByRole('combobox', { name: 'Check' }))
    await user.click(screen.getByRole('option', { name: 'Dexterity (Acrobatics)' }))
    expect(screen.getByRole('radio', { name: 'Advantage' })).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Roll dice' }))
    expect(onResolve).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'ROLL_RULE_EVIDENCE',
        requestId: 'target_d20',
        rollMode: 'ADVANTAGE'
      })
    )
    expect(await screen.findByText('Rolled by the app · attempt 1')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Submit roll' }))
    expect(onResolve).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'RESOLVE_RULE_OCCURRENCE',
        resolution: {
          kind: 'CONTEST_CHECK',
          requestId: 'target_d20',
          checkDefinitionId: '77777777-7777-4777-8777-777777777792',
          roll: { kind: 'SYSTEM_ROLL', requestId: 'target_d20', rollId: contestRoll.rollId }
        }
      })
    )
  })
})

describe('CampaignTabletopDecisionDrawer area saves', () => {
  const [ember, warden] = tabletopGmEncounter.actors
  const saveRequest = (requestId: string) => ({
    requestId,
    min: 1 as const,
    max: 20 as const,
    rollMode: 'NORMAL' as const,
    keep: 'FIRST' as const,
    rollModes: offeredRollModes,
    derivedRollModeReasons: []
  })
  // Not a contract-valid summary alone (no save, choice or caught creature); every derived area is parsed in openArea.
  const areaBase: Extract<PendingEncounterRuleOccurrenceSummaryDto, { kind: 'AREA_SAVES' }> = {
    kind: 'AREA_SAVES',
    occurrenceId,
    occurrenceVersion: 6,
    encounterVersion: tabletopGmEncounter.version,
    casterActorId: ember!.id,
    caughtChecksum: null,
    caught: [],
    saves: [],
    legendaryResistance: [],
    allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL', 'AREA_LEGENDARY_RESISTANCE']
  }
  const gmArea = validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
    ...areaBase,
    caughtChecksum: 'e'.repeat(64),
    caught: ['Ember', 'Vault Warden', 'Phantom Wolf'],
    saves: [
      { actorId: ember!.id, targetActorId: ember!.id, request: saveRequest('save-ember') },
      { actorId: warden!.id, targetActorId: warden!.id, request: saveRequest('save-warden') }
    ]
  })

  async function openArea(
    area: PendingEncounterRuleOccurrenceSummaryDto,
    options: {
      canVoid: boolean
      onResolve: Parameters<typeof CampaignTabletopDecisionDrawer>[0]['onResolve']
    }
  ) {
    const user = userEvent.setup()
    renderWithAppProviders(
      <CampaignTabletopDecisionDrawer
        skipped={null}
        canVoid={options.canVoid}
        connected
        encounter={tabletopGmEncounter}
        latestRoll={null}
        pending={pendingEncounterRuleOccurrenceSummaryDtoSchema.parse(area)}
        submitting={false}
        onResolve={options.onResolve}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    return user
  }

  it('shows the GM the caught list, a save row per creature and removes one with the seal', async () => {
    const onResolve = vi.fn(async () => resolved())
    const user = await openArea(gmArea, { canVoid: true, onResolve })

    expect(screen.getByText('Area saves')).toBeVisible()
    expect(screen.getByText('Caught in the area: Ember, Vault Warden, Phantom Wolf')).toBeVisible()
    const wardenRow = screen.getByRole('group', { name: 'Vault Warden' })
    expect(screen.getByRole('group', { name: "Ember's Wake" })).toBeVisible()

    await user.click(within(wardenRow).getByRole('button', { name: 'Remove from area' }))
    expect(onResolve).toHaveBeenCalledWith({
      type: 'REMOVE_AREA_TARGET',
      encounterId: tabletopGmEncounter.id,
      commandId: expect.any(String),
      expectedVersion: gmArea.encounterVersion,
      occurrenceId,
      expectedOccurrenceVersion: gmArea.occurrenceVersion,
      expectedCaughtChecksum: gmArea.caughtChecksum,
      actorId: warden!.id
    })
  })

  it('shows a refused removal as an inline message', async () => {
    const onResolve = vi.fn(async () => {
      throw new Error('The area changed. Read it again.')
    })
    const user = await openArea(gmArea, { canVoid: true, onResolve })

    await user.click(
      within(screen.getByRole('group', { name: "Ember's Wake" })).getByRole('button', {
        name: 'Remove from area'
      })
    )
    expect(await screen.findByText('The area changed. Read it again.')).toBeVisible()
  })

  it('gives a roller their own save without a removal and answers it as a single-target save', async () => {
    const onResolve = vi.fn(async () => resolved())
    const user = await openArea(
      {
        ...areaBase,
        saves: [
          { actorId: warden!.id, targetActorId: warden!.id, request: saveRequest('save-warden') }
        ]
      },
      { canVoid: false, onResolve }
    )

    expect(screen.queryByText(/Caught in the area/)).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: "Ember's Wake" })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove from area' })).not.toBeInTheDocument()

    const row = screen.getByRole('group', { name: 'Vault Warden' })
    await user.type(within(row).getByLabelText('Die 1'), '14')
    await user.click(within(row).getByRole('button', { name: 'Submit roll' }))
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RESOLVE_RULE_OCCURRENCE',
        occurrenceId,
        expectedOccurrenceVersion: areaBase.occurrenceVersion,
        correlationId: null,
        resolution: {
          kind: 'ENTER_DICE',
          requestId: 'save-warden',
          rawFaces: [14],
          rollMode: 'NORMAL'
        }
      })
    )
  })

  it('offers Legendary Resistance per creature and sends its decision', async () => {
    const onResolve = vi.fn(async () => resolved())
    const optionId = 'f'.repeat(64)
    const user = await openArea(
      { ...areaBase, legendaryResistance: [{ actorId: warden!.id, optionId }] },
      { canVoid: false, onResolve }
    )

    expect(screen.getByText('Vault Warden failed its save')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Use Legendary Resistance' }))
    expect(onResolve).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'RESOLVE_RULE_OCCURRENCE',
        resolution: {
          kind: 'AREA_LEGENDARY_RESISTANCE',
          actorId: warden!.id,
          decision: { kind: 'USE', optionId }
        }
      })
    )
    await user.click(screen.getByRole('button', { name: 'Decline' }))
    expect(onResolve).toHaveBeenLastCalledWith(
      expect.objectContaining({
        resolution: {
          kind: 'AREA_LEGENDARY_RESISTANCE',
          actorId: warden!.id,
          decision: { kind: 'DECLINE' }
        }
      })
    )
  })

  it('tells the caster’s controller the caught creatures and that saves are pending', async () => {
    await openArea(
      { ...areaBase, caught: ['Ember', 'Vault Warden'] },
      { canVoid: false, onResolve: vi.fn() }
    )

    expect(screen.getByText('Caught in the area: Ember, Vault Warden')).toBeVisible()
    expect(screen.getByText('Waiting for saves.')).toBeVisible()
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit roll' })).not.toBeInTheDocument()
  })
})
