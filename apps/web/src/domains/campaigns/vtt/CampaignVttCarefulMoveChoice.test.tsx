import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CampaignVttCarefulMoveChoice } from './CampaignVttCarefulMoveChoice'
import type { HalfSpeedField } from './CampaignVttCarefulMove.model'

const caltrops: HalfSpeedField = {
  id: '00000000-0000-4000-8000-000000000001',
  label: 'Caltrop field',
  shape: {
    kind: 'POLYGON',
    points: [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
      { x: 100, y: 200 }
    ]
  }
}

function renderChoice(fields: HalfSpeedField[] = [caltrops]) {
  const onChoose = vi.fn()
  const onCancel = vi.fn()
  renderWithAppProviders(
    <CampaignVttCarefulMoveChoice fields={fields} onCancel={onCancel} onChoose={onChoose} />
  )
  return { onCancel, onChoose }
}

describe('CampaignVttCarefulMoveChoice', () => {
  it('names the field the path enters and what each choice costs', () => {
    renderChoice()
    expect(screen.getByText('This path enters the Caltrop field.')).toBeInTheDocument()
    expect(screen.getByText(/double movement in the field and skips its save/)).toBeInTheDocument()
  })

  it('reports moving carefully', () => {
    const { onCancel, onChoose } = renderChoice()
    fireEvent.click(screen.getByRole('button', { name: 'Move carefully' }))
    expect(onChoose).toHaveBeenCalledExactlyOnceWith(true)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('reports moving normally', () => {
    const { onCancel, onChoose } = renderChoice()
    fireEvent.click(screen.getByRole('button', { name: 'Move normally' }))
    expect(onChoose).toHaveBeenCalledExactlyOnceWith(false)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('cancels from the button or Escape without choosing', () => {
    const { onCancel, onChoose } = renderChoice()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.keyDown(screen.getByRole('button', { name: 'Move carefully' }), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(2)
    expect(onChoose).not.toHaveBeenCalled()
  })

  it('names an unlabeled field and every field the path enters', () => {
    renderChoice([
      caltrops,
      { ...caltrops, id: '00000000-0000-4000-8000-000000000002', label: null }
    ])
    expect(screen.getByText('This path enters the Caltrop field and a field.')).toBeInTheDocument()
  })
})
