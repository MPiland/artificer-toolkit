import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { AuthoredDetailItemList, AuthoredDetailLayout, AuthoredDetailProse } from './AuthoredDetail'

describe('AuthoredDetail', () => {
  it('renders a reader-first hero, fact grid, navigation, and sections', () => {
    renderWithAppProviders(
      <AuthoredDetailLayout
        eyebrow='Spell'
        title='Sea Step'
        description='A short detail summary.'
        status={['Draft Preview', 'Owned']}
        facts={[
          { label: 'Level', value: '2' },
          { label: 'Casting', value: '1 Action' }
        ]}
        sections={[
          {
            id: 'description',
            title: 'Description',
            content: <AuthoredDetailProse html='<p>Move like water.</p>' />
          }
        ]}
      />
    )

    expect(screen.getByRole('heading', { name: /sea step/i })).toBeInTheDocument()
    expect(screen.getByText('Draft Preview')).toBeInTheDocument()
    expect(screen.getByText('1 Action')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /detail sections/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /description/i })).toHaveAttribute('href', '#description')
    expect(screen.getByText('Move like water.')).toBeInTheDocument()
  })

  it('renders compact header actions', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()

    renderWithAppProviders(
      <AuthoredDetailLayout
        eyebrow='Feat'
        title='Tide Reader'
        status={['Master']}
        facts={[]}
        actions={[{ label: 'Duplicate', onClick: onEdit }]}
        sections={[
          {
            id: 'description',
            title: 'Description',
            content: <AuthoredDetailProse html='<p>Read the current.</p>' />
          }
        ]}
      />
    )

    await user.click(screen.getByRole('button', { name: /duplicate/i }))

    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('uses empty blocks instead of blank repeated sections', () => {
    renderWithAppProviders(
      <AuthoredDetailItemList
        empty='No features have been added.'
        items={[]}
      />
    )

    expect(screen.getByText('No features have been added.')).toBeInTheDocument()
  })
})
