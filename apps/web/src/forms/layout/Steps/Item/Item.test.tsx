import { fireEvent, render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { describe, expect, it, vi } from 'vitest'
import { Item } from './Item'

describe('authoring rail item interaction', () => {
  it('keeps navigation and expansion as independent actions', () => {
    const onSelect = vi.fn()

    render(
      <MantineProvider>
        <Item
          item={{
            children: [
              {
                id: 'feature-row',
                label: 'Warping Strike'
              }
            ],
            id: 'features',
            label: 'Features',
            navigationHref: '/equipment/example/edit?step=features',
            navigationTargetId: 'features-overview',
            onSelect
          }}
        />
      </MantineProvider>
    )

    const expander = screen.getByRole('button', { name: 'Collapse Features' })
    fireEvent.click(screen.getByRole('link', { name: 'Features' }))

    expect(onSelect).toHaveBeenCalledOnce()
    expect(expander).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(expander)

    expect(onSelect).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Expand Features' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )

    fireEvent.click(screen.getByRole('link', { name: 'Features' }))

    expect(onSelect).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: 'Collapse Features' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
  })
})
