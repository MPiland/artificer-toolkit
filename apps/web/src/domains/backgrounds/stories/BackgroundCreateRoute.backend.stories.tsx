import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, within } from 'storybook/test'
import { Route } from '#routes/_authed/backgrounds/new'
import {
  authoringDesktopViewport,
  expectCreateEmptyAuthoringRoute,
  findGuidedNameField
} from '#domains/authoredRouteStory.play'

// Creates against the seeded deployment as the story account (D218, D221); writes are spies.
const meta = {
  title: 'Domains/Backgrounds/Routes/Create',
  globals: authoringDesktopViewport.globals,
  parameters: {
    layout: 'fullscreen',
    viewport: { options: authoringDesktopViewport.options },
    tanstack: { router: { route: Route, path: '/backgrounds/new' } }
  }
} satisfies Meta<typeof Route>

export default meta

type Story = StoryObj<typeof meta>

export const CreateEmpty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The first read crosses the network to the seeded deployment.
    await canvas.findByRole('heading', { name: 'How do you want to begin?' }, { timeout: 15_000 })
    await expectCreateEmptyAuthoringRoute(canvasElement)

    // A required Guided value blocks forward navigation at the point of repair.
    const name = await findGuidedNameField(canvasElement)
    await expect(name).toHaveValue('')
    await expect(canvas.getByRole('button', { name: 'Next' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Next' })).toBeDisabled()
    await expect(canvas.queryByLabelText('Authoring preview')).not.toBeInTheDocument()
    await expect(canvas.queryByTestId('authoring-action-bar')).not.toBeInTheDocument()
  }
}
