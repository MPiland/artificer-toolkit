import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useQueryClient } from '@tanstack/react-query'
import { usePaginatedQuery } from 'convex-helpers/react'
import { expect, mocked } from 'storybook/test'
import { Route } from '#routes/_authed/spells/$spellPublicId/$spellSlug/edit'
import {
  authoredRouteStoryParams,
  authoredRouteStoryRecords,
  authoredRouteStoryUser
} from '#domains/authoredRouteStory.fixtures'
import {
  expandAuthoringBranch,
  expectAuthoringTargetLabels,
  expectMasterLockedAuthoringRoute,
  expectOwnedActiveAuthoringRoute,
  expectOwnedDraftAuthoringRoute,
  getStoryDocument,
  selectAuthoringChildTarget
} from '#domains/authoredRouteStory.play'
import {
  configureAuthoredRouteStoryQueries,
  createAuthoredEditRouteOverrides
} from '#test/authoredRouteStory.utils'

const meta = {
  title: 'Domains/Spells/Routes/Edit',
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
        path: '/spells/$spellPublicId/$spellSlug/edit',
        params: authoredRouteStoryParams.spell,
        context: { user: authoredRouteStoryUser },
        routeOverrides: createAuthoredEditRouteOverrides(
          'spell',
          '/_authed/spells/$spellPublicId/$spellSlug/edit',
          '/spells/$spellPublicId/$spellSlug/edit'
        )
      }
    }
  }
} satisfies Meta<typeof Route>

export default meta

type Story = StoryObj<typeof meta>

export const OwnedActive: Story = {
  play: async ({ canvasElement }) =>
    expectOwnedActiveAuthoringRoute(canvasElement, authoredRouteStoryRecords.spell.label)
}
export const OwnedDraft: Story = {
  parameters: {
    tanstack: {
      router: {
        routeOverrides: createAuthoredEditRouteOverrides(
          'spell',
          '/_authed/spells/$spellPublicId/$spellSlug/edit',
          '/spells/$spellPublicId/$spellSlug/edit',
          'ownedDraft'
        )
      }
    }
  },
  play: async ({ canvasElement }) =>
    expectOwnedDraftAuthoringRoute(canvasElement, authoredRouteStoryRecords.spell.label)
}

export const FireballSavingThrowEffect: Story = {
  parameters: OwnedDraft.parameters,
  play: async ({ canvasElement }) => {
    await expectOwnedDraftAuthoringRoute(canvasElement, authoredRouteStoryRecords.spell.label)
    await expandAuthoringBranch(canvasElement, /^effects\b/i)
    await expandAuthoringBranch(canvasElement, /^saving throw\b/i)
    await expandAuthoringBranch(canvasElement, /^details\b/i)
    await expandAuthoringBranch(canvasElement, /^outcome paths\b/i)
    await expectAuthoringTargetLabels(canvasElement, [
      /^saving throw\b/i,
      /^on save failure\b/i,
      /^on save success\b/i
    ])
    await selectAuthoringChildTarget(canvasElement, /^on save failure\b/i, /^details\b/i)

    const story = getStoryDocument(canvasElement)
    await expect(await story.findByRole('combobox', { name: /outcome path/i })).toHaveDisplayValue(
      'On Save Failure'
    )
    await expect(await story.findByRole('button', { name: /^damage$/i })).toBeInTheDocument()
    await expect(story.queryByText('ON_SAVE_FAIL')).not.toBeInTheDocument()
  }
}
export const MasterLocked: Story = {
  parameters: {
    tanstack: {
      router: {
        routeOverrides: createAuthoredEditRouteOverrides(
          'spell',
          '/_authed/spells/$spellPublicId/$spellSlug/edit',
          '/spells/$spellPublicId/$spellSlug/edit',
          'masterLocked'
        )
      }
    }
  },
  play: async ({ canvasElement }) =>
    expectMasterLockedAuthoringRoute(canvasElement, authoredRouteStoryRecords.spell.label)
}
