import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  encounterGmActorDtoSchema,
  type EncounterGmActorDto
} from '@artificer-toolkit/schema/api/encounters'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import {
  createTabletopCampaign,
  seedTabletopSystem,
  tabletopGmEncounter
} from '../vtt/CampaignTabletop.stories.fixtures'
import { EncounterActorCard } from './EncounterActorCard'

const campaign = createTabletopCampaign('OWNER')
const enemy = encounterGmActorDtoSchema.parse({
  ...tabletopGmEncounter.actors.find((actor) => actor.kind === 'CREATURE')!,
  currentHitPoints: 47,
  maxHitPoints: 64
})

function card(actor: EncounterGmActorDto, onCommand = vi.fn()) {
  // CampaignEncounterWorkspace renders each card inside an Accordion.Item keyed by actor.id.
  return (
    <EncounterActorCard
      key={actor.id}
      actor={actor}
      campaign={campaign}
      currentUserId='user-1'
      disabled={false}
      encounterId={tabletopGmEncounter.id}
      healthDisplayDefault='DESCRIPTIVE'
      onCommand={onCommand}
    />
  )
}

describe('EncounterActorCard in-progress edits', () => {
  it('keeps an edit when the server pushes an unrelated change, and commits it', async () => {
    const user = userEvent.setup()
    const onCommand = vi.fn()
    const { rerender } = renderWithAppProviders(card(enemy, onCommand))

    const hitPoints = screen.getByLabelText('Current HP')
    await user.clear(hitPoints)
    await user.type(hitPoints, '20')
    rerender(card({ ...enemy, gmNotes: 'Flanking left' }, onCommand))

    expect(screen.getByLabelText('Current HP')).toHaveValue('20')
    expect(screen.getByLabelText('GM notes')).toHaveValue('Flanking left')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await user.tab()
    expect(onCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_ACTOR',
        actorId: enemy.id,
        currentHitPoints: 20,
        gmNotes: 'Flanking left'
      })
    )
  })

  it('surfaces a server change to the edited field and keeps the edit until the user chooses', async () => {
    const user = userEvent.setup()
    const { rerender } = renderWithAppProviders(card(enemy))

    const hitPoints = screen.getByLabelText('Current HP')
    await user.clear(hitPoints)
    await user.type(hitPoints, '20')
    rerender(card({ ...enemy, currentHitPoints: 30 }))

    expect(screen.getByLabelText('Current HP')).toHaveValue('20')
    expect(screen.getByRole('alert')).toHaveTextContent(/Current HP.*30/)

    await user.click(screen.getByRole('button', { name: 'Use latest' }))
    expect(screen.getByLabelText('Current HP')).toHaveValue('30')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps the edit and dismisses the notice when the user chooses to keep theirs', async () => {
    const user = userEvent.setup()
    const { rerender } = renderWithAppProviders(card(enemy))

    const hitPoints = screen.getByLabelText('Current HP')
    await user.clear(hitPoints)
    await user.type(hitPoints, '20')
    rerender(card({ ...enemy, currentHitPoints: 30 }))
    await user.click(screen.getByRole('button', { name: 'Keep mine' }))

    expect(screen.getByLabelText('Current HP')).toHaveValue('20')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the server value again once the server catches up with a committed edit', async () => {
    const user = userEvent.setup()
    const { rerender } = renderWithAppProviders(card(enemy))

    const hitPoints = screen.getByLabelText('Current HP')
    await user.clear(hitPoints)
    await user.type(hitPoints, '20')
    rerender(card({ ...enemy, currentHitPoints: 20 }))
    rerender(card({ ...enemy, currentHitPoints: 12 }))

    expect(screen.getByLabelText('Current HP')).toHaveValue('12')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('remounts with the other actor’s values when a different actor is shown', async () => {
    const user = userEvent.setup()
    const other = {
      ...enemy,
      id: '99999999-9999-4999-8999-999999999904',
      label: 'Third enemy',
      currentHitPoints: 11
    }
    const { rerender } = renderWithAppProviders(card(enemy))

    const hitPoints = screen.getByLabelText('Current HP')
    await user.clear(hitPoints)
    await user.type(hitPoints, '20')
    rerender(card(other))

    expect(screen.getByLabelText('Current HP')).toHaveValue('11')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

const exhaustion = srdSystemRecord.conditionTypes.find(({ code }) => code === 'EXHAUSTION')!

function SeededSystem({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  useState(() => seedTabletopSystem(queryClient, campaign))
  return children
}

describe('EncounterActorCard condition levels', () => {
  it('sets a Creature’s Exhaustion level from the System’s leveled condition', async () => {
    const user = userEvent.setup()
    const onCommand = vi.fn()
    const exhausted = { ...enemy, conditions: [{ conditionTypeId: exhaustion.id, level: 2 }] }
    renderWithAppProviders(<SeededSystem>{card(exhausted, onCommand)}</SeededSystem>)

    const control = await screen.findByRole('group', { name: 'Exhaustion level' })
    expect(control).toHaveTextContent('Level 2')
    await user.click(screen.getByRole('button', { name: 'Increase Exhaustion level' }))

    expect(onCommand).toHaveBeenCalledWith({
      type: 'UPDATE_ACTOR',
      actorId: enemy.id,
      conditions: [{ conditionTypeId: exhaustion.id, level: 3 }]
    })
  })

  it('stops at the System’s maximum level', async () => {
    const exhausted = {
      ...enemy,
      conditions: [{ conditionTypeId: exhaustion.id, level: exhaustion.maximumLevel! }]
    }
    renderWithAppProviders(<SeededSystem>{card(exhausted)}</SeededSystem>)

    expect(await screen.findByRole('button', { name: 'Increase Exhaustion level' })).toBeDisabled()
  })
})
