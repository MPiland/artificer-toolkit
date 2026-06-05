import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { vi } from 'vitest'
import { resolver, theme } from '#css/theme'
import { AuthoredDetailItemList, AuthoredDetailLayout, AuthoredDetailProse } from './AuthoredDetail'

function renderAuthoredDetail(ui: ReactElement) {
  return render(
    <MantineProvider theme={theme} cssVariablesResolver={resolver} defaultColorScheme='dark'>
      {ui}
    </MantineProvider>
  )
}

describe('AuthoredDetail', () => {
  it('renders a readable header, fact grid, navigation, and sections', () => {
    renderAuthoredDetail(
      <AuthoredDetailLayout
        eyebrow='Spell'
        title='Sea Step'
        description='A short detail summary.'
        status={['Draft Preview', 'Homebrew']}
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

  it('can omit section navigation for compact detail pages', () => {
    renderAuthoredDetail(
      <AuthoredDetailLayout
        title='Sea Step'
        status={['SRD']}
        facts={[{ label: 'Level', value: '2' }]}
        showSectionNav={false}
        sections={[
          {
            id: 'description',
            title: 'Description',
            content: <AuthoredDetailProse html='<p>Move like water.</p>' />
          }
        ]}
      />
    )

    expect(screen.queryByRole('navigation', { name: /detail sections/i })).not.toBeInTheDocument()
    expect(screen.getByText('Move like water.')).toBeInTheDocument()
  })

  it('renders compact header actions', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()

    renderAuthoredDetail(
      <AuthoredDetailLayout
        eyebrow='Feat'
        title='Tide Reader'
        status={['SRD']}
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

  it('shows loading feedback for pending header actions', () => {
    renderAuthoredDetail(
      <AuthoredDetailLayout
        title='Dragonborn'
        status={['SRD']}
        facts={[]}
        actions={[{ label: 'Duplicate', loading: true, onClick: vi.fn() }]}
        sections={[]}
      />
    )

    expect(screen.getByRole('button', { name: /duplicate/i })).toBeDisabled()
  })

  it('blocks detail actions while a detail operation is pending', () => {
    const onDuplicate = vi.fn()
    const onCreate = vi.fn()
    const onNoticeAction = vi.fn()

    renderAuthoredDetail(
      <AuthoredDetailLayout
        actionsDisabled
        pendingOperation={{
          title: 'Creating draft...',
          body: 'Creating an editable copy of this race.'
        }}
        title='Dragonborn'
        status={['SRD']}
        facts={[]}
        actions={[
          { label: 'Duplicate', loading: true, onClick: onDuplicate },
          { label: 'Create New', onClick: onCreate }
        ]}
        notice={{
          tone: 'draft',
          title: 'Draft available',
          body: 'A draft is available.',
          action: { label: 'View Draft', onClick: onNoticeAction }
        }}
        sections={[]}
      />
    )

    expect(screen.getByRole('dialog', { name: /creating draft/i })).toBeInTheDocument()
    expect(screen.getByText('Creating an editable copy of this race.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /duplicate/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /create new/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /view draft/i })).toBeDisabled()
  })

  it('uses empty blocks instead of blank repeated sections', () => {
    renderAuthoredDetail(
      <AuthoredDetailItemList
        empty='No features have been added.'
        items={[]}
      />
    )

    expect(screen.getByText('No features have been added.')).toBeInTheDocument()
  })
})
