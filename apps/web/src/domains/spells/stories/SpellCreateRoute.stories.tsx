import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useQueryClient } from '@tanstack/react-query'
import { usePaginatedQuery } from 'convex-helpers/react'
import { mocked } from 'storybook/test'
import { Route } from '#routes/_authed/spells/new'
import { authoredRouteStoryUser } from '#domains/authoredRouteStory.fixtures'
import { expectCreateGuidedSpellRoute } from '#domains/authoredRouteStory.play'
import {
  configureAuthoredRouteStoryQueries,
  createAuthoredCreateRouteOverrides
} from '#domains/authoredRouteStory.utils'

const meta = {
  title: 'Domains/Spells/Routes/Create',
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
        path: '/spells/new',
        context: { user: authoredRouteStoryUser },
        routeOverrides: createAuthoredCreateRouteOverrides('/_authed/spells/new', '/spells/new')
      }
    }
  }
} satisfies Meta<typeof Route>

export default meta

type Story = StoryObj<typeof meta>

export const StartingPoint: Story = {}

export const CreateEmpty: Story = {
  play: async ({ canvasElement }) => expectCreateGuidedSpellRoute(canvasElement)
}
