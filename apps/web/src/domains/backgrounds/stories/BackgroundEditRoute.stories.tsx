import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Route } from '#routes/_authed/backgrounds/$backgroundPublicId/$backgroundSlug/edit'
import {
  authoredRouteStoryParams,
  authoredRouteStoryRecords,
  authoredRouteStoryUser
} from '#domains/authoredRouteStory.fixtures'
import {
  expectMasterLockedAuthoringRoute,
  expectOwnedActiveAuthoringRoute,
  expectOwnedDraftAuthoringRoute
} from '#domains/authoredRouteStory.play'
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

export const OwnedActive: Story = {
  play: async ({ canvasElement }) =>
    expectOwnedActiveAuthoringRoute(canvasElement, authoredRouteStoryRecords.background.label)
}

export const OwnedDraft: Story = {
  parameters: {
    tanstack: {
      router: {
        routeOverrides: createAuthoredEditRouteOverrides(
          'background',
          '/_authed/backgrounds/$backgroundPublicId/$backgroundSlug/edit',
          '/backgrounds/$backgroundPublicId/$backgroundSlug/edit',
          'ownedDraft'
        )
      }
    }
  },
  play: async ({ canvasElement }) =>
    expectOwnedDraftAuthoringRoute(canvasElement, authoredRouteStoryRecords.background.label)
}

export const MasterLocked: Story = {
  parameters: {
    tanstack: {
      router: {
        routeOverrides: createAuthoredEditRouteOverrides(
          'background',
          '/_authed/backgrounds/$backgroundPublicId/$backgroundSlug/edit',
          '/backgrounds/$backgroundPublicId/$backgroundSlug/edit',
          'masterLocked'
        )
      }
    }
  },
  play: async ({ canvasElement }) =>
    expectMasterLockedAuthoringRoute(canvasElement, authoredRouteStoryRecords.background.label)
}
