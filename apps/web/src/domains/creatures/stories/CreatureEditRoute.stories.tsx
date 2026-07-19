import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Route } from '#routes/_authed/creatures/$creaturePublicId/$creatureSlug/edit'
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

export const OwnedActive: Story = {
  play: async ({ canvasElement }) =>
    expectOwnedActiveAuthoringRoute(canvasElement, authoredRouteStoryRecords.creature.label)
}
export const OwnedDraft: Story = {
  parameters: {
    tanstack: {
      router: {
        routeOverrides: createAuthoredEditRouteOverrides(
          'creature',
          '/_authed/creatures/$creaturePublicId/$creatureSlug/edit',
          '/creatures/$creaturePublicId/$creatureSlug/edit',
          'ownedDraft'
        )
      }
    }
  },
  play: async ({ canvasElement }) =>
    expectOwnedDraftAuthoringRoute(canvasElement, authoredRouteStoryRecords.creature.label)
}
export const MasterLocked: Story = {
  parameters: {
    tanstack: {
      router: {
        routeOverrides: createAuthoredEditRouteOverrides(
          'creature',
          '/_authed/creatures/$creaturePublicId/$creatureSlug/edit',
          '/creatures/$creaturePublicId/$creatureSlug/edit',
          'masterLocked'
        )
      }
    }
  },
  play: async ({ canvasElement }) =>
    expectMasterLockedAuthoringRoute(canvasElement, authoredRouteStoryRecords.creature.label)
}
