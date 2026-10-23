import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CampaignTabletopMovementReadout } from './CampaignTabletopMovementReadout'
import type { TurnMovementEntry } from './CampaignTabletopMovementReadout.model'

const walk = { speedId: 'walk', code: 'WALK', isDefault: true, label: 'Walking Speed' }
const fly = { speedId: 'fly', code: 'FLY', isDefault: false, label: 'Flying Speed' }

const movement = (
  used: number,
  allowances: TurnMovementEntry['allowances'],
  speedId: string | null = null
): TurnMovementEntry => ({
  actorId: 'actor',
  used,
  speedId,
  allowances,
  teleport: [],
  fleeSourceActorIds: []
})

const walking = (budget: number) => ({ ...walk, budget })
const flying = (budget: number) => ({ ...fly, budget })

function renderReadout(
  props: Partial<Parameters<typeof CampaignTabletopMovementReadout>[0]> & {
    movement: TurnMovementEntry
  }
) {
  return renderWithAppProviders(
    <CampaignTabletopMovementReadout
      automationMode='ASSISTED'
      chosenSpeedId={null}
      teleportOn={null}
      onChooseSpeed={() => undefined}
      onTeleportChange={() => undefined}
      {...props}
    />
  )
}

describe('CampaignTabletopMovementReadout', () => {
  it('prompts the controller to Dash away from the source of a condition it flees (SPELLS-29.T2)', () => {
    renderReadout({
      movement: { ...movement(0, [walking(30)]), fleeSourceActorIds: ['source'] }
    })
    expect(screen.getByText('Dash away from the source')).toBeInTheDocument()
  })

  it('shows no prompt for an actor that flees nothing', () => {
    renderReadout({ movement: movement(0, [walking(30)]) })
    expect(screen.queryByText('Dash away from the source')).not.toBeInTheDocument()
  })

  it('shows the movement spent against the only speed type’s allowance', () => {
    renderReadout({ movement: movement(15, [walking(30)]) })
    expect(screen.getByText('Movement 15 / 30 ft')).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
  })

  it('warns softly past the allowance in Assisted mode', () => {
    renderReadout({ movement: movement(35, [walking(30)]) })
    expect(
      screen.getByText('Movement 35 / 30 ft · 5 ft over').closest('[data-variant]')
    ).toHaveAttribute('data-variant', 'light')
  })

  it('shows the number only past the allowance in Manual mode', () => {
    renderReadout({ automationMode: 'MANUAL', movement: movement(35, [walking(30)]) })
    expect(screen.getByText('Movement 35 / 30 ft').closest('[data-variant]')).toHaveAttribute(
      'data-variant',
      'default'
    )
    expect(screen.queryByText(/over/)).not.toBeInTheDocument()
  })

  it('shows only the number for an actor with no speed type', () => {
    renderReadout({ movement: movement(10, []) })
    expect(screen.getByText('Movement 10 ft')).toBeInTheDocument()
  })

  it('measures against walking by default and names the speed type when there are several', () => {
    renderReadout({ movement: movement(15, [flying(60), walking(30)]) })
    expect(screen.getByText('Movement 15 / 30 ft · Walking Speed')).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Movement speed type' })).toBeInTheDocument()
  })

  it('measures against the speed type of the latest move before walking', () => {
    renderReadout({ movement: movement(15, [walking(30), flying(60)], fly.speedId) })
    expect(screen.getByText('Movement 15 / 60 ft · Flying Speed')).toBeInTheDocument()
  })

  it('warns against the chosen speed type and reports a new choice', () => {
    const onChooseSpeed = vi.fn()
    renderReadout({
      chosenSpeedId: walk.speedId,
      movement: movement(40, [walking(30), flying(60)], fly.speedId),
      onChooseSpeed
    })
    expect(screen.getByText('Movement 40 / 30 ft · Walking Speed · 10 ft over')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Flying Speed' }))
    expect(onChooseSpeed).toHaveBeenCalledWith(fly.speedId)
  })
})
