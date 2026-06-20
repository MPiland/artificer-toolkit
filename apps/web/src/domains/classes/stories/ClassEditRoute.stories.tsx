import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, waitFor } from 'storybook/test'
import { Route } from '#routes/_authed/classes/$classPublicId/$classSlug/edit'
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
  title: 'Domains/Classes/Routes/Edit',
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: authoredRouteNodeRuntimeHandlers },
    tanstack: {
      router: {
        route: Route,
        path: '/classes/$classPublicId/$classSlug/edit',
        params: authoredRouteStoryParams.class,
        context: { user: authoredRouteStoryUser },
        routeOverrides: createAuthoredEditRouteOverrides(
          'class',
          '/_authed/classes/$classPublicId/$classSlug/edit',
          '/classes/$classPublicId/$classSlug/edit'
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
      expect(canvas.getByDisplayValue(authoredRouteStoryRecords.class.label)).toBeInTheDocument()
    })
    expect(canvas.getByTestId('authoring-form-canvas')).toBeInTheDocument()
    expect(canvas.getByTestId('authoring-action-bar')).toBeInTheDocument()
  }
}
