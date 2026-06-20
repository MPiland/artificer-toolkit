import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, waitFor } from 'storybook/test'
import { Route } from '#routes/_authed/races/$racePublicId/$raceSlug/edit'
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
  title: 'Domains/Races/Routes/Edit',
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: authoredRouteNodeRuntimeHandlers },
    tanstack: {
      router: {
        route: Route,
        path: '/races/$racePublicId/$raceSlug/edit',
        params: authoredRouteStoryParams.race,
        context: {
          user: authoredRouteStoryUser
        },
        routeOverrides: createAuthoredEditRouteOverrides(
          'race',
          '/_authed/races/$racePublicId/$raceSlug/edit',
          '/races/$racePublicId/$raceSlug/edit'
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
      expect(canvas.getByDisplayValue(authoredRouteStoryRecords.race.label)).toBeInTheDocument()
    })
    expect(canvas.getByTestId('authoring-form-canvas')).toBeInTheDocument()
    expect(canvas.getByTestId('authoring-action-bar')).toBeInTheDocument()
  }
}
