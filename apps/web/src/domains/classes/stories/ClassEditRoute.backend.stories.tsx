import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { Route } from '#routes/_authed/classes/$classPublicId/$classSlug/edit'
import { buildClassRouteParams } from '#app/routing/authoredRouteParams'
import {
  authoringDesktopViewport,
  expectMasterLockedAuthoringRoute,
  expectOwnedActiveAuthoringRoute,
  expectOwnedDraftAuthoringRoute,
  findSeededAuthoringRecord
} from '#domains/authoredRouteStory.play'
import { STORY_RECORDS } from '../../../../../apis/tests/developmentReviewDataScenarios'

const { ownedActive, ownedDraft } = STORY_RECORDS.class

/** The edit route opened at a subject id, which the loader redirects to its canonical handle. */
function editRouter(subjectId: string, label: string) {
  return {
    route: Route,
    path: '/classes/$classPublicId/$classSlug/edit' as const,
    params: buildClassRouteParams(subjectId, label)
  }
}

// Reads the seeded classes as the story account (D218, D221): the SRD Wizard and the account's own
// copies of it that `seedStoryData` activates and drafts. Writes are spies.
const meta = {
  title: 'Domains/Classes/Routes/Edit',
  globals: authoringDesktopViewport.globals,
  parameters: {
    layout: 'fullscreen',
    viewport: { options: authoringDesktopViewport.options },
    tanstack: { router: editRouter(wizard.id, wizard.label) }
  }
} satisfies Meta<typeof Route>

export default meta

// Typed by the route (the meta sets no `component`), so a story can retarget its params.
type Story = StoryObj<typeof Route>

export const MasterLocked: Story = {
  play: async ({ canvasElement }) => {
    await findSeededAuthoringRecord(canvasElement, wizard.label)
    await expectMasterLockedAuthoringRoute(canvasElement, wizard.label)
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
