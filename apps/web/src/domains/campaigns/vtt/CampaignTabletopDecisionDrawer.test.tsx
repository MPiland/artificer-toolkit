import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
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

function committed(commandId: string, occurrenceVersion = 3) {
  return {
    type: 'COMMAND_COMMITTED' as const,
    acceptedSequence: 1,
    aggregateKind: 'ENCOUNTER' as const,
    aggregateId: tabletopGmEncounter.id,
    deliverySequence: 1,
    originCommandId: commandId,
    replayed: false,
    changedAggregates: [],
    encounterActorTokenBindings: [],
    encounterSceneBindings: [],
    version: tabletopGmEncounter.version,
    response: {
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
}

describe('CampaignTabletopDecisionDrawer initiative declaration', () => {
  it('submits only the selected frozen primary and bonus identities', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn(async (command) => committed(command.commandId))
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
    await user.click(screen.getByRole('combobox', { name: 'Primary action' }))
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
    const onResolve = vi.fn(async (command) => committed(command.commandId))
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
    await user.click(screen.getByRole('combobox', { name: 'Primary action' }))
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
