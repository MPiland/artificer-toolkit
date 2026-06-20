import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, waitFor } from 'storybook/test'
import { Route } from '#routes/_authed/backgrounds/$backgroundPublicId/$backgroundSlug/edit'
import {
  authoredRouteStoryParams,
  authoredRouteStoryRecords,
  authoredRouteStoryUser
} from '#domains/authoredRouteStory.fixtures'
import {
  authoredRouteNodeRuntimeHandlers,
  createAuthoredEditRouteOverrides
} from '#domains/authoredRouteStory.utils'

const meta = {
  title: 'Domains/Backgrounds/Routes/Edit',
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: authoredRouteNodeRuntimeHandlers },
    tanstack: {
      router: {
        route: Route,
        path: '/backgrounds/$backgroundPublicId/$backgroundSlug/edit',
        params: authoredRouteStoryParams.background,
        context: { user: authoredRouteStoryUser },
        routeOverrides: createAuthoredEditRouteOverrides(
          'background',
          '/_authed/backgrounds/$backgroundPublicId/$backgroundSlug/edit',
          '/backgrounds/$backgroundPublicId/$backgroundSlug/edit'
        )
      }
    }
  }
} satisfies Meta<typeof Route>

export default meta

type Story = StoryObj<typeof meta>

export const Draft: Story = {
  play: async ({ canvas }) => {
    await waitFor(() => {
      expect(canvas.getByDisplayValue(authoredRouteStoryRecords.background.label)).toBeInTheDocument()
    })
    expect(canvas.getByTestId('authoring-form-canvas')).toBeInTheDocument()
    expect(canvas.getByTestId('authoring-action-bar')).toBeInTheDocument()
  }
}
