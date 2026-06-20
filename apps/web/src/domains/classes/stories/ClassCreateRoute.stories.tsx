import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, waitFor } from 'storybook/test'
import { Route } from '#routes/_authed/classes/new'
import { authoredRouteStoryUser } from '#domains/authoredRouteStory.fixtures'
import {
  authoredRouteNodeRuntimeHandlers,
  createAuthoredCreateRouteOverrides
} from '#domains/authoredRouteStory.utils'

const meta = {
  title: 'Domains/Classes/Routes/Create',
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: authoredRouteNodeRuntimeHandlers },
    tanstack: {
      router: {
        route: Route,
        path: '/classes/new',
        context: { user: authoredRouteStoryUser },
        routeOverrides: createAuthoredCreateRouteOverrides('/_authed/classes/new', '/classes/new')
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
