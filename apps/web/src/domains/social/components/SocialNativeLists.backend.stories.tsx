import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import {
  STORY_CAMPAIGN,
  type StoryAccountKey
} from '../../../../../apis/tests/developmentReviewDataScenarios'
import type { SocialHubSearch } from '../socialSearch'
import { SocialDiscoveryView } from './SocialDiscoveryView'
import { SocialHostingView } from './SocialHostingView'

function Fixture({ view }: { view: 'discovery' | 'hosting' }) {
  const [search, setSearch] = useState<SocialHubSearch>({ view: 'discover' })
  if (view === 'hosting') return <SocialHostingView />
  return <SocialDiscoveryView search={search} onSearchChange={setSearch} />
}

// Reads the seeded listings (D218, D221): the peer browses the reader's open table, and the reader
// hosts it. Paging past a first page is covered with the real views in SocialDiscoveryHostingViews.test.tsx.
const meta = {
  title: 'Social/Native discovery and hosting',
  component: Fixture,
  args: { view: 'discovery' },
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof Fixture>
export default meta
type Story = StoryObj<typeof meta>

const peer = { storyAccount: 'peer' satisfies StoryAccountKey }

export const BrowseThenSearch: Story = {
  parameters: peer,
  play: async ({ canvas, canvasElement }) => {
    await expect(await canvas.findByRole('link', { name: STORY_CAMPAIGN.name })).toBeVisible()
    await userEvent.type(
      canvas.getByRole('textbox', { name: 'Search table titles and summaries' }),
      STORY_CAMPAIGN.name
    )
    await expect(await canvas.findByRole('link', { name: STORY_CAMPAIGN.name })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Filters' }))
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() =>
      expect(body.getByRole('dialog', { name: 'Discovery filters' })).toBeVisible()
    )
    await userEvent.click(body.getByRole('button', { name: 'Close discovery filters' }))
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument())
  }
}

export const ExhaustedSearch: Story = {
  parameters: peer,
  play: async ({ canvas }) => {
    await canvas.findByRole('link', { name: STORY_CAMPAIGN.name })
    await userEvent.type(
      canvas.getByRole('textbox', { name: 'Search table titles and summaries' }),
      'zzzzqx'
    )
    await expect(await canvas.findByText('No tables match', {}, { timeout: 5000 })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Load more tables' })).not.toBeInTheDocument()
  }
}

export const HostedPage: Story = {
  args: { view: 'hosting' },
  play: async ({ canvas, canvasElement }) => {
    await expect(await canvas.findByRole('link', { name: STORY_CAMPAIGN.name })).toBeVisible()
    await expect(canvas.queryByText('No hosted listings')).not.toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Edit listing' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Review applications' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Invite player' }))
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() => expect(body.getByRole('dialog')).toBeVisible())
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument())
  }
}
