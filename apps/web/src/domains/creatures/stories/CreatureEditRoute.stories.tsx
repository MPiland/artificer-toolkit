import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, waitFor } from 'storybook/test'
import { Route } from '#routes/_authed/creatures/$creaturePublicId/$creatureSlug/edit'
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
  title: 'Domains/Creatures/Routes/Edit',
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: authoredRouteNodeRuntimeHandlers },
    tanstack: {
      router: {
        route: Route,
        path: '/creatures/$creaturePublicId/$creatureSlug/edit',
        params: authoredRouteStoryParams.creature,
        context: { user: authoredRouteStoryUser },
        routeOverrides: createAuthoredEditRouteOverrides(
          'creature',
          '/_authed/creatures/$creaturePublicId/$creatureSlug/edit',
          '/creatures/$creaturePublicId/$creatureSlug/edit'
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
      expect(canvas.getByDisplayValue(authoredRouteStoryRecords.creature.label)).toBeInTheDocument()
    })
    expect(canvas.getByTestId('authoring-form-canvas')).toBeInTheDocument()
    expect(canvas.getByTestId('authoring-action-bar')).toBeInTheDocument()
  }
}
