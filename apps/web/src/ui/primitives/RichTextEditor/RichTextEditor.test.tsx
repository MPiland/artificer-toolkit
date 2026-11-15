import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import RichTextEditor from './RichTextEditor'

describe('RichTextEditor', () => {
  it('shows a newer value without writing the old text back when it turns editable', async () => {
    const onChange = vi.fn()
    const { rerender } = renderWithAppProviders(
      <RichTextEditor
        label='Description'
        name='description'
        onChange={onChange}
        readOnly
        value='Saved text'
      />
    )
    expect(await screen.findByText('Saved text')).toBeInTheDocument()

    rerender(
      <RichTextEditor
        label='Description'
        name='description'
        onChange={onChange}
        value='Loaded text'
      />
    )

    expect(await screen.findByText('Loaded text')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})
