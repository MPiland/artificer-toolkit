import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { VttZoomControl } from './VttZoomControl'

function renderControl(scale = 1) {
  const onChange = vi.fn()
  renderWithAppProviders(<VttZoomControl scale={scale} onChange={onChange} />)
  return { onChange, user: userEvent.setup() }
}

describe('VttZoomControl', () => {
  it('shows the zoom as a percentage', () => {
    renderControl(1.5)
    expect(screen.getByRole('textbox', { name: 'Zoom percentage' })).toHaveValue('150%')
  })

  it('applies a typed percentage on Enter', async () => {
    const { onChange, user } = renderControl()
    const field = screen.getByRole('textbox', { name: 'Zoom percentage' })
    await user.clear(field)
    await user.type(field, '200{Enter}')
    expect(onChange).toHaveBeenCalledExactlyOnceWith(2)
  })

  it('applies a typed percentage when the field loses focus', async () => {
    const { onChange, user } = renderControl()
    const field = screen.getByRole('textbox', { name: 'Zoom percentage' })
    await user.clear(field)
    await user.type(field, '75%')
    await user.tab()
    expect(onChange).toHaveBeenCalledExactlyOnceWith(0.75)
  })

  it('reverts text that is not a percentage without changing the zoom', async () => {
    const { onChange, user } = renderControl(1.25)
    const field = screen.getByRole('textbox', { name: 'Zoom percentage' })
    await user.clear(field)
    await user.type(field, 'big{Enter}')
    expect(onChange).not.toHaveBeenCalled()
    expect(field).toHaveValue('125%')
  })

  it('drops an unfinished edit on Escape', async () => {
    const { onChange, user } = renderControl()
    const field = screen.getByRole('textbox', { name: 'Zoom percentage' })
    await user.clear(field)
    await user.type(field, '300{Escape}')
    await user.tab()
    expect(onChange).not.toHaveBeenCalled()
    expect(field).toHaveValue('100%')
  })

  it('steps the zoom in and out', async () => {
    const { onChange, user } = renderControl()
    await user.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(onChange).toHaveBeenLastCalledWith(expect.closeTo(1.1, 12))
    await user.click(screen.getByRole('button', { name: 'Zoom out' }))
    expect(onChange).toHaveBeenLastCalledWith(expect.closeTo(0.9, 12))
  })
})
