import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, waitFor } from 'storybook/test'
import { Route } from '#routes/_authed/feats/$featPublicId/$featSlug/edit'
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
  title: 'Domains/Feats/Routes/Edit',
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: authoredRouteNodeRuntimeHandlers },
    tanstack: {
      router: {
        route: Route,
        path: '/feats/$featPublicId/$featSlug/edit',
        params: authoredRouteStoryParams.feat,
        context: { user: authoredRouteStoryUser },
        routeOverrides: createAuthoredEditRouteOverrides(
          'feat',
          '/_authed/feats/$featPublicId/$featSlug/edit',
          '/feats/$featPublicId/$featSlug/edit'
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
      expect(canvas.getByDisplayValue(authoredRouteStoryRecords.feat.label)).toBeInTheDocument()
    })
    expect(canvas.getByTestId('authoring-form-canvas')).toBeInTheDocument()
    expect(canvas.getByTestId('authoring-action-bar')).toBeInTheDocument()
  }
}
