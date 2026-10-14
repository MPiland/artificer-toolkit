import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useQueryClient } from '@tanstack/react-query'
import { Route } from '#routes/_authed/feats/new'
import { authoredRouteStoryUser } from '#domains/authoredRouteStory.fixtures'
import { expectCreateEmptyAuthoringRoute } from '#domains/authoredRouteStory.play'
import {
  configureAuthoredRouteStoryQueries,
  createAuthoredCreateRouteOverrides
} from '#test/authoredRouteStory.utils'

const meta = {
  title: 'Domains/Feats/Routes/Create',
  decorators: [
    (Story) => {
      configureAuthoredRouteStoryQueries(useQueryClient())
      return <Story />
    }
  ],
  parameters: {
    layout: 'fullscreen',
    tanstack: {
      router: {
        route: Route,
        path: '/feats/new',
        context: { user: authoredRouteStoryUser },
        routeOverrides: createAuthoredCreateRouteOverrides('/_authed/feats/new', '/feats/new')
      }
    }
  }
} satisfies Meta<typeof Route>

export default meta

type Story = StoryObj<typeof meta>

export const CreateEmpty: Story = {
  play: async ({ canvasElement }) => expectCreateEmptyAuthoringRoute(canvasElement)
}
