import { Button } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#app/lib/api'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { tabletopSceneDefinition } from './CampaignTabletop.stories.fixtures'
import { CampaignScenePreparation } from './CampaignScenePreparation'

vi.mock('./CampaignSceneEditor', () => ({
  CampaignSceneEditor: ({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) => (
    <Button onClick={() => onDirtyChange(true)}>Change scene</Button>
  )
}))

describe('CampaignScenePreparation unsaved navigation', () => {
  afterEach(() => vi.restoreAllMocks())

  it('keeps a dirty scene editor mounted when the GM stays', async () => {
    const user = await renderDirtySceneEditor()
    await user.click(await screen.findByRole('button', { name: 'Change scene' }))
    await user.click(screen.getByRole('button', { name: 'Open spells' }))

    expect(await screen.findByRole('dialog', { name: 'Leave without saving?' })).toBeInTheDocument()
    expect(screen.getByTestId('pathname')).toHaveTextContent('/backgrounds')

    await user.click(screen.getByRole('button', { name: 'Stay' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Leave without saving?' })
      ).not.toBeInTheDocument()
    )
    expect(screen.getByTestId('pathname')).toHaveTextContent('/backgrounds')
  })
})

async function renderDirtySceneEditor() {
  vi.spyOn(api.campaigns.scenes, 'list').mockResolvedValue([tabletopSceneDefinition])
  render(
    <TestRouterProvider initialPath='/backgrounds'>
      <CampaignScenePreparation
        campaignId='11111111-1111-4111-8111-111111111111'
        currentUserId='22222222-2222-4222-8222-222222222222'
        memberships={[]}
      />
      <NavigationProbe />
    </TestRouterProvider>
  )
  return userEvent.setup()
}

function NavigationProbe() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  return (
    <>
      <Button onClick={() => void navigate({ to: '/spells' })}>Open spells</Button>
      <span data-testid='pathname'>{pathname}</span>
    </>
  )
}
