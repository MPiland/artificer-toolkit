import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, userEvent, within } from 'storybook/test'
import { Route } from '#routes/_authed/equipment/$equipmentPublicId/$equipmentSlug/edit'
import { Shell, platformNavigation } from '#app/shell'
import {
  authoredRouteStoryParams,
  authoredRouteStoryRecords,
  seedAstralTearAwakenedEquipment,
  authoredRouteStoryUser
} from '#domains/authoredRouteStory.fixtures'
import {
  expandAuthoringBranch,
  expectAuthoringTargetLabels,
  expectMasterLockedAuthoringRoute,
  expectOwnedActiveAuthoringRoute,
  expectOwnedDraftAuthoringRoute,
  getStoryDocument,
  selectAuthoringTarget
} from '#domains/authoredRouteStory.play'
import {
  authoredRouteNodeRuntimeHandlers,
  createAuthoredEditRouteOverrides
} from '#domains/authoredRouteStory.utils'

const meta = {
  title: 'Domains/Equipment/Routes/Edit',
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: authoredRouteNodeRuntimeHandlers },
    tanstack: {
      router: {
        route: Route,
        path: '/equipment/$equipmentPublicId/$equipmentSlug/edit',
        params: authoredRouteStoryParams.equipment,
        context: { user: authoredRouteStoryUser },
        routeOverrides: createAuthoredEditRouteOverrides(
          'equipment',
          '/_authed/equipment/$equipmentPublicId/$equipmentSlug/edit',
          '/equipment/$equipmentPublicId/$equipmentSlug/edit'
        )
      }
    }
  }
} satisfies Meta<typeof Route>

export default meta

type Story = StoryObj<typeof meta>

export const OwnedActive: Story = {
  play: async ({ canvasElement }) =>
    expectOwnedActiveAuthoringRoute(canvasElement, authoredRouteStoryRecords.equipment.label)
}
export const OwnedDraft: Story = {
  parameters: {
    tanstack: {
      router: {
        routeOverrides: createAuthoredEditRouteOverrides(
          'equipment',
          '/_authed/equipment/$equipmentPublicId/$equipmentSlug/edit',
          '/equipment/$equipmentPublicId/$equipmentSlug/edit',
          'ownedDraft'
        )
      }
    }
  },
  play: async ({ canvasElement }) =>
    expectOwnedDraftAuthoringRoute(canvasElement, authoredRouteStoryRecords.equipment.label)
}

/**
 * Deterministic dense equipment state used by authoring workspace acceptance coverage.
 * It includes a weapon damage effect plus attack and damage modifiers whose grants
 * are restricted to the equipped source.
 */
export const ShortswordPlusOne: Story = {
  decorators: [
    (Story) => (
      <Shell
        currentPath='/equipment/shortsword-plus-one/shortsword-plus-one/edit'
        isAuthenticated
        navigation={platformNavigation}
        userEmail={authoredRouteStoryUser.email}
      >
        <Story />
      </Shell>
    )
  ],
  parameters: OwnedDraft.parameters,
  play: OwnedDraft.play
}

export const ShortswordPlusOneStructure: Story = {
  decorators: ShortswordPlusOne.decorators,
  parameters: OwnedDraft.parameters,
  play: async ({ canvasElement }) => {
    await expectOwnedDraftAuthoringRoute(canvasElement, authoredRouteStoryRecords.equipment.label)
    await expandAuthoringBranch(canvasElement, /^effects\b/i)
    await expandAuthoringBranch(canvasElement, /^grants\b/i)
    await expectAuthoringTargetLabels(canvasElement, [
      /melee weapon attack/i,
      /\+1 attack rolls/i,
      /\+1 damage rolls/i
    ])
    const story = getStoryDocument(canvasElement)
    await expect((await story.findAllByText('+1 Attack Rolls')).length).toBeGreaterThan(1)
    await expect((await story.findAllByText('+1 Damage Rolls')).length).toBeGreaterThan(1)
    await expect(story.queryByText('MODIFIER_GRANT')).not.toBeInTheDocument()
  }
}

export const ShortswordPlusOneDamageModifierDrawer: Story = {
  decorators: ShortswordPlusOne.decorators,
  parameters: OwnedDraft.parameters,
  play: async ({ canvasElement }) => {
    await expectOwnedDraftAuthoringRoute(canvasElement, authoredRouteStoryRecords.equipment.label)
    await expandAuthoringBranch(canvasElement, /^grants\b/i)
    await selectAuthoringTarget(canvasElement, /\+1 damage rolls/i)

    const story = getStoryDocument(canvasElement)
    const drawer = await story.findByRole('dialog', { name: /edit \+1 damage rolls/i })
    const drawerCanvas = within(drawer)
    await expect(drawerCanvas.getByText('Restrictions')).toBeInTheDocument()
    await expect(
      await drawerCanvas.findByRole('button', { name: /remove option/i })
    ).toBeInTheDocument()
    await expect(
      await drawerCanvas.findByRole('button', { name: /remove condition/i })
    ).toBeInTheDocument()
    await expect(drawerCanvas.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument()
    await expect(drawerCanvas.getByRole('button', { name: /^save$/i })).toBeInTheDocument()
    await expect(drawerCanvas.queryByText('DAMAGE')).not.toBeInTheDocument()
  }
}

export const AstralTearAwakenedStructure: Story = {
  decorators: [
    (Story) => (
      <Shell
        currentPath='/equipment/the-astral-tear-awakened/the-astral-tear-awakened/edit'
        isAuthenticated
        navigation={platformNavigation}
        userEmail={authoredRouteStoryUser.email}
      >
        <Story />
      </Shell>
    )
  ],
  parameters: {
    tanstack: {
      router: {
        query: { step: 'overview:feature:features:overview' },
        routeOverrides: createAuthoredEditRouteOverrides(
          'equipment',
          '/_authed/equipment/$equipmentPublicId/$equipmentSlug/edit',
          '/equipment/$equipmentPublicId/$equipmentSlug/edit',
          'ownedDraft',
          seedAstralTearAwakenedEquipment
        )
      }
    }
  },
  play: async ({ canvasElement }) => {
    const story = getStoryDocument(canvasElement)
    await expect(
      await story.findByRole('heading', {
        level: 1,
        name: seedAstralTearAwakenedEquipment.label
      })
    ).toBeInTheDocument()
    await expect(story.getByText(/all changes saved/i)).toBeInTheDocument()
    await expect(story.getByRole('button', { name: /save draft/i })).toBeInTheDocument()
    const showSteps = story.queryByRole('button', { name: /show steps/i })
    const railRoot = showSteps ? canvasElement.ownerDocument.body : canvasElement
    if (showSteps) {
      await userEvent.click(showSteps)
      await expect(
        await story.findByRole('navigation', { name: /^authoring steps$/i })
      ).toBeInTheDocument()
    }
    await expandAuthoringBranch(railRoot, /^effects\b/i)
    await expandAuthoringBranch(railRoot, /^grants\b/i)
    await expandAuthoringBranch(railRoot, /^features\b/i)
    await expectAuthoringTargetLabels(railRoot, [
      /melee weapon attack/i,
      /\+1 attack rolls/i,
      /\+1 damage rolls/i,
      /warping strike/i,
      /spells/i
    ])
    const editor = within(story.getByTestId('authoring-form-content'))
    await expect(editor.getAllByText('Features')).toHaveLength(1)
    await expect(
      editor.getByText('Add and organize the abilities this item provides.')
    ).toBeInTheDocument()
    await expect(
      story.getByRole('heading', { level: 1, name: 'The Astral Tear Awakened' })
    ).toBeInTheDocument()
    const hideSteps = story.queryByRole('button', { name: /hide steps/i })
    if (hideSteps) await userEvent.click(hideSteps)
    const showPreview = story.queryByRole('button', { name: /show preview/i })
    if (showPreview) await userEvent.click(showPreview)
    await expect(
      await story.findByRole('heading', { level: 3, name: 'Warping Strike' })
    ).toBeInTheDocument()
    await expect(await story.findByRole('heading', { level: 3, name: 'Spells' })).toBeInTheDocument()
  }
}

export const MasterLocked: Story = {
  parameters: {
    tanstack: {
      router: {
        routeOverrides: createAuthoredEditRouteOverrides(
          'equipment',
          '/_authed/equipment/$equipmentPublicId/$equipmentSlug/edit',
          '/equipment/$equipmentPublicId/$equipmentSlug/edit',
          'masterLocked'
        )
      }
    }
  },
  play: async ({ canvasElement }) =>
    expectMasterLockedAuthoringRoute(canvasElement, authoredRouteStoryRecords.equipment.label)
}
