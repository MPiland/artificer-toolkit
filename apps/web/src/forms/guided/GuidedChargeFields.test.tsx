import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ChargeUseDto } from '@artificer-toolkit/schema/shared'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { GuidedChargeFields } from './GuidedChargeFields'
import { createCharge } from './guidedCharge'

function renderFields(charges: ChargeUseDto | undefined) {
  const onChange = vi.fn()
  renderWithAppProviders(
    <GuidedChargeFields charges={charges} subject='feat' onChange={onChange} />
  )
  return onChange
}

const advancedCharge = (): ChargeUseDto => ({
  ...createCharge(),
  scalingKind: 'PER_LEVEL',
  levels: []
})

describe('GuidedChargeFields', () => {
  it('creates a simple charge when limited uses are turned on', async () => {
    const user = userEvent.setup()
    const onChange = renderFields(undefined)

    await user.click(screen.getByRole('textbox', { name: 'Does it have limited uses?' }))
    await user.click(await screen.findByRole('option', { name: /^Yes/ }))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1, resetKind: 'LONG_REST', limitKind: 'FIXED_AMOUNT' })
    )
  })

  it('removes the charge when limited uses are turned off', async () => {
    const user = userEvent.setup()
    const onChange = renderFields(createCharge())

    await user.click(screen.getByRole('textbox', { name: 'Does it have limited uses?' }))
    await user.click(await screen.findByRole('option', { name: /^No/ }))

    expect(onChange).toHaveBeenCalledWith(undefined)
  })

  it('offers the reset options and applies the chosen one', async () => {
    const user = userEvent.setup()
    const charge = createCharge()
    const onChange = renderFields(charge)

    await user.click(screen.getByRole('textbox', { name: 'Reset timing' }))
    expect(await screen.findAllByRole('option')).toHaveLength(3)
    await user.click(screen.getByRole('option', { name: 'Dawn' }))

    expect(onChange).toHaveBeenCalledWith({ ...charge, resetKind: 'DAWN' })
  })

  it('keeps the reset timing when the chosen option is picked again', async () => {
    const user = userEvent.setup()
    renderFields(createCharge())

    await user.click(screen.getByRole('textbox', { name: 'Reset timing' }))
    await user.click(await screen.findByRole('option', { name: 'Long rest' }))

    expect(screen.getByRole('textbox', { name: 'Reset timing' })).toHaveValue('Long rest')
  })

  it('keeps an advanced charge intact and refuses to remove it', async () => {
    const user = userEvent.setup()
    const onChange = renderFields(advancedCharge())

    expect(screen.getByText('Advanced charge model preserved')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Reset timing' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('textbox', { name: 'Does it have limited uses?' }))
    await user.click(await screen.findByRole('option', { name: /^No/ }))

    expect(onChange).not.toHaveBeenCalled()
  })
})
