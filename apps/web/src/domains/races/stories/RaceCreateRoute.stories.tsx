import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useQueryClient } from '@tanstack/react-query'
import { usePaginatedQuery } from 'convex-helpers/react'
import { mocked } from 'storybook/test'
import { Route } from '#routes/_authed/races/new'
import { authoredRouteStoryUser } from '#domains/authoredRouteStory.fixtures'
import { expectCreateEmptyAuthoringRoute } from '#domains/authoredRouteStory.play'
import {
  configureAuthoredRouteStoryQueries,
  createAuthoredCreateRouteOverrides
} from '#domains/authoredRouteStory.utils'

const meta = {
  title: 'Domains/Races/Routes/Create',
  decorators: [
    (Story) => {
      configureAuthoredRouteStoryQueries(useQueryClient())
      return <Story />
    }
  ],
  beforeEach: () => {
    mocked(usePaginatedQuery).mockReturnValue({
      isLoading: false,
      loadMore: () => undefined,
      results: [],
      status: 'Exhausted'
    })
  },
  parameters: {
    layout: 'fullscreen',
    tanstack: {
      router: {
        route: Route,
        path: '/races/new',
        context: {
          user: authoredRouteStoryUser
        },
        routeOverrides: createAuthoredCreateRouteOverrides('/_authed/races/new', '/races/new')
      }
    }
  }
} satisfies Meta<typeof Route>

export default meta

type Story = StoryObj<typeof meta>

export const CreateEmpty: Story = {
  play: async ({ canvasElement }) => expectCreateEmptyAuthoringRoute(canvasElement)
}
