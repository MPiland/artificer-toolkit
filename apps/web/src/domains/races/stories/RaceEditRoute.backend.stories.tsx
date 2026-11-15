import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { dragonborn } from '@artificer-toolkit/source-data/srd/races/dragonborn.js'
import { expect } from 'storybook/test'
import { Route } from '#routes/_authed/races/$racePublicId/$raceSlug/edit'
import { buildRaceRouteParams } from '#app/routing/authoredRouteParams'
import {
  authoringDesktopViewport,
  expandAuthoringBranch,
  expandAuthoringChildBranch,
  expectAuthoringTargetLabels,
  expectMasterLockedAuthoringRoute,
  expectOwnedActiveAuthoringRoute,
  expectOwnedDraftAuthoringRoute,
  findSeededAuthoringRecord,
  getStoryDocument,
  selectAuthoringChildTarget
} from '#domains/authoredRouteStory.play'
import { STORY_RECORDS } from '../../../../../apis/tests/developmentReviewDataScenarios'

const { ownedActive, ownedDraft } = STORY_RECORDS.race

/** The edit route opened at a subject id, which the loader redirects to its canonical handle. */
function editRouter(subjectId: string, label: string) {
  return {
    route: Route,
    path: '/races/$racePublicId/$raceSlug/edit' as const,
    params: buildRaceRouteParams(subjectId, label)
  }
}

// Reads the seeded races as the story account (D218, D221): the SRD Dragonborn and the account's own
// copies of it that `seedStoryData` activates and drafts. Writes are spies.
const meta = {
  title: 'Domains/Races/Routes/Edit',
  globals: authoringDesktopViewport.globals,
  parameters: {
    layout: 'fullscreen',
    viewport: { options: authoringDesktopViewport.options },
    tanstack: { router: editRouter(dragonborn.id, dragonborn.label) }
  }
} satisfies Meta<typeof Route>

export default meta

// Typed by the route (the meta sets no `component`), so a story can retarget its params.
type Story = StoryObj<typeof Route>

export const MasterLocked: Story = {
  play: async ({ canvasElement }) => {
    await findSeededAuthoringRecord(canvasElement, dragonborn.label)
    await expectMasterLockedAuthoringRoute(canvasElement, dragonborn.label)
  }
}

export const OwnedActive: Story = {
  parameters: {
    tanstack: {
      router: editRouter(ownedActive.subjectId, ownedActive.label)
    }
  },
  play: async ({ canvasElement }) => {
    await findSeededAuthoringRecord(canvasElement, ownedActive.label)
    await expectOwnedActiveAuthoringRoute(canvasElement, ownedActive.label)
  }
}

export const OwnedDraft: Story = {
  parameters: {
    tanstack: {
      router: editRouter(ownedDraft.subjectId, ownedDraft.label)
    }
  },
  play: async ({ canvasElement }) => {
    await findSeededAuthoringRecord(canvasElement, ownedDraft.label)
    await expectOwnedDraftAuthoringRoute(canvasElement, ownedDraft.label)
  }
}

export const DragonbornAncestryFeatureBranch: Story = {
  parameters: OwnedDraft.parameters,
  play: async ({ canvasElement }) => {
    await findSeededAuthoringRecord(canvasElement, ownedDraft.label)
    await expectOwnedDraftAuthoringRoute(canvasElement, ownedDraft.label)
    await expandAuthoringBranch(canvasElement, /^ancestry\b/i)
    await expandAuthoringBranch(canvasElement, /^options\b/i)
    await expandAuthoringBranch(canvasElement, /^red \(fire\)/i)
    await expandAuthoringChildBranch(canvasElement, /^red \(fire\)/i, /^features\b/i)
    await expectAuthoringTargetLabels(canvasElement, [
      /^ancestry\b/i,
      /^red \(fire\)/i,
      /^level 1 · breath weapon\b/i
    ])
    await selectAuthoringChildTarget(
      canvasElement,
      /^level 1 · breath weapon\b/i,
      /^feature basics\b/i
    )

    const story = getStoryDocument(canvasElement)
    await expect(await story.findByDisplayValue('Breath Weapon')).toBeInTheDocument()
    await expect(
      await story.findByText(/^You can use your action to exhale destructive energy\./)
    ).toBeInTheDocument()
  }
}
