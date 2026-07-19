import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect } from 'storybook/test'
import { Route } from '#routes/_authed/races/$racePublicId/$raceSlug/edit'
import {
  authoredRouteStoryParams,
  authoredRouteStoryRecords,
  authoredRouteStoryUser
} from '#domains/authoredRouteStory.fixtures'
import {
  expandAuthoringBranch,
  expandAuthoringChildBranch,
  expectAuthoringTargetLabels,
  expectMasterLockedAuthoringRoute,
  expectOwnedActiveAuthoringRoute,
  expectOwnedDraftAuthoringRoute,
  getStoryDocument,
  selectAuthoringChildTarget
} from '#domains/authoredRouteStory.play'
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

export const OwnedActive: Story = {
  play: async ({ canvasElement }) =>
    expectOwnedActiveAuthoringRoute(canvasElement, authoredRouteStoryRecords.race.label)
}
export const OwnedDraft: Story = {
  parameters: {
    tanstack: {
      router: {
        routeOverrides: createAuthoredEditRouteOverrides(
          'race',
          '/_authed/races/$racePublicId/$raceSlug/edit',
          '/races/$racePublicId/$raceSlug/edit',
          'ownedDraft'
        )
      }
    }
  },
  play: async ({ canvasElement }) =>
    expectOwnedDraftAuthoringRoute(canvasElement, authoredRouteStoryRecords.race.label)
}

export const DragonbornAncestryFeatureBranch: Story = {
  parameters: OwnedDraft.parameters,
  play: async ({ canvasElement }) => {
    await expectOwnedDraftAuthoringRoute(canvasElement, authoredRouteStoryRecords.race.label)
    await expandAuthoringBranch(canvasElement, /^ancestry\b/i)
    await expandAuthoringBranch(canvasElement, /^options\b/i)
    await expandAuthoringBranch(canvasElement, /^red dragon\b/i)
    await expandAuthoringChildBranch(canvasElement, /^red dragon\b/i, /^features\b/i)
    await expectAuthoringTargetLabels(canvasElement, [
      /^ancestry\b/i,
      /^red dragon\b/i,
      /^breath weapon\b/i
    ])
    await selectAuthoringChildTarget(canvasElement, /^breath weapon\b/i, /^feature basics\b/i)

    const story = getStoryDocument(canvasElement)
    await expect(await story.findByDisplayValue('Breath Weapon')).toBeInTheDocument()
    await expect(await story.findByText('Exhale destructive fire in a 15-foot cone.')).toBeInTheDocument()
  }
}
export const MasterLocked: Story = {
  parameters: {
    tanstack: {
      router: {
        routeOverrides: createAuthoredEditRouteOverrides(
          'race',
          '/_authed/races/$racePublicId/$raceSlug/edit',
          '/races/$racePublicId/$raceSlug/edit',
          'masterLocked'
        )
      }
    }
  },
  play: async ({ canvasElement }) =>
    expectMasterLockedAuthoringRoute(canvasElement, authoredRouteStoryRecords.race.label)
}
