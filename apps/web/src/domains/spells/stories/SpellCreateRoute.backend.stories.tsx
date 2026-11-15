import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { Route } from '#routes/_authed/spells/new'
import {
  authoringDesktopViewport,
  expectCreateGuidedSpellRoute,
  getStoryDocument
} from '#domains/authoredRouteStory.play'

// Creates against the seeded deployment as the story account (D218, D221); writes are spies.
const meta = {
  title: 'Domains/Spells/Routes/Create',
  globals: authoringDesktopViewport.globals,
  parameters: {
    layout: 'fullscreen',
    viewport: { options: authoringDesktopViewport.options },
    tanstack: { router: { route: Route, path: '/spells/new' } }
  }
} satisfies Meta<typeof Route>

export default meta

type Story = StoryObj<typeof meta>

export const CreateEmpty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The first read crosses the network to the seeded deployment.
    await canvas.findByRole('heading', { name: 'How do you want to begin?' }, { timeout: 15_000 })
    await expectCreateGuidedSpellRoute(canvasElement)

    // Guided creation asks for each required value before it moves on.
    await expect(canvas.getByText(/spell.*draft.*homebrew/i)).toBeVisible()
    await userEvent.type(canvas.getByRole('textbox', { name: 'Spell name' }), 'Ember Thread')
    await expect(canvas.getByRole('button', { name: 'Next' })).toBeDisabled()
    await userEvent.click(canvas.getByRole('combobox', { name: 'School of magic' }))
    await userEvent.click(
      await getStoryDocument(canvasElement).findByRole('option', { name: 'Evocation' })
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await waitFor(() =>
      expect(canvas.getByRole('heading', { name: 'What does the spell do?' })).toBeVisible()
    )
    await expect(canvas.queryByLabelText('Authoring preview')).not.toBeInTheDocument()

    const damageOutcome = canvas.getByRole('button', { name: /^Damage\b/ })
    await expect(canvas.getByRole('button', { name: 'Next' })).toBeDisabled()
    await userEvent.click(damageOutcome)
    await expect(damageOutcome).toHaveAttribute('aria-pressed', 'true')
    await expect(canvas.getByRole('button', { name: 'Next' })).toBeEnabled()
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    // Retried like Playwright's web-first assertions, because the next step transitions in.
    await waitFor(() => expect(canvas.getByRole('textbox', { name: 'Damage dice' })).toBeVisible())
    await waitFor(() => expect(canvas.getByLabelText('Authoring preview')).toBeVisible())
    await expect(canvas.queryByTestId('authoring-action-bar')).not.toBeInTheDocument()
  }
}
