import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useQueryClient } from '@tanstack/react-query'
import { Route } from '#routes/_authed/classes/new'
import { authoredRouteStoryUser } from '#domains/authoredRouteStory.fixtures'
import { expectCreateEmptyAuthoringRoute } from '#domains/authoredRouteStory.play'
import {
  configureAuthoredRouteStoryQueries,
  createAuthoredCreateRouteOverrides
} from '#domains/authoredRouteStory.utils'

const meta = {
  title: 'Domains/Classes/Routes/Create',
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
        path: '/classes/new',
        context: { user: authoredRouteStoryUser },
        routeOverrides: createAuthoredCreateRouteOverrides('/_authed/classes/new', '/classes/new')
      }
    }
  }
} satisfies Meta<typeof Route>

export default meta

type Story = StoryObj<typeof meta>

export const CreateEmpty: Story = {
  play: async ({ canvasElement }) => expectCreateEmptyAuthoringRoute(canvasElement)
}
