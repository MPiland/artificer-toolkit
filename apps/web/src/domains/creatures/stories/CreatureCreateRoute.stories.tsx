import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, waitFor } from 'storybook/test'
import { Route } from '#routes/_authed/creatures/new'
import { authoredRouteStoryUser } from '#domains/authoredRouteStory.fixtures'
import {
  authoredRouteNodeRuntimeHandlers,
  createAuthoredCreateRouteOverrides
} from '#domains/authoredRouteStory.utils'

const meta = {
  title: 'Domains/Creatures/Routes/Create',
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: authoredRouteNodeRuntimeHandlers },
    tanstack: {
      router: {
        route: Route,
        path: '/creatures/new',
        context: { user: authoredRouteStoryUser },
        routeOverrides: createAuthoredCreateRouteOverrides(
          '/_authed/creatures/new',
          '/creatures/new'
        )
      }
    }
  }
} satisfies Meta<typeof Route>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await waitFor(() => {
      expect(canvas.getByRole('textbox', { name: /name/i })).toBeInTheDocument()
    })
    expect(canvas.getByTestId('authoring-form-canvas')).toBeInTheDocument()
    expect(canvas.getByTestId('authoring-action-bar')).toBeInTheDocument()
  }
}
