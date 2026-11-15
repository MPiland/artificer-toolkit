import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { Route } from '#routes/_authed/backgrounds/$backgroundPublicId/$backgroundSlug/edit'
import { buildBackgroundRouteParams } from '#app/routing/authoredRouteParams'
import {
  authoringDesktopViewport,
  expectMasterLockedAuthoringRoute,
  expectOwnedActiveAuthoringRoute,
  expectOwnedDraftAuthoringRoute,
  findSeededAuthoringRecord
} from '#domains/authoredRouteStory.play'
import { STORY_RECORDS } from '../../../../../apis/tests/developmentReviewDataScenarios'

const { ownedActive, ownedDraft } = STORY_RECORDS.background

// Reads the seeded backgrounds as the story account (D218, D221): the SRD Acolyte and the account's
// own copies of it that `seedStoryData` activates and drafts. The loader redirects each subject id to
// the record's canonical handle; writes are spies.
const meta = {
  title: 'Domains/Backgrounds/Routes/Edit',
  globals: authoringDesktopViewport.globals,
  parameters: {
    layout: 'fullscreen',
    viewport: { options: authoringDesktopViewport.options },
    tanstack: {
      router: {
        route: Route,
        path: '/backgrounds/$backgroundPublicId/$backgroundSlug/edit',
        params: buildBackgroundRouteParams(acolyte.id, acolyte.label)
      }
    }
  }
} satisfies Meta<typeof Route>

export default meta

type Story = StoryObj<typeof meta>

export const MasterLocked: Story = {
  play: async ({ canvasElement }) => {
    await findSeededAuthoringRecord(canvasElement, acolyte.label)
    await expectMasterLockedAuthoringRoute(canvasElement, acolyte.label)
  }
}

export const OwnedActive: Story = {
  parameters: {
    tanstack: {
      router: { params: buildBackgroundRouteParams(ownedActive.subjectId, ownedActive.label) }
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
      router: { params: buildBackgroundRouteParams(ownedDraft.subjectId, ownedDraft.label) }
    }
  },
  play: async ({ canvasElement }) => {
    await findSeededAuthoringRecord(canvasElement, ownedDraft.label)
    await expectOwnedDraftAuthoringRoute(canvasElement, ownedDraft.label)
  }
}
