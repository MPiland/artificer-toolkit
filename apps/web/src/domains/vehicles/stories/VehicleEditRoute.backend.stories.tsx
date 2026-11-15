import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { sailingShip } from '@artificer-toolkit/source-data/srd/vehicles/sailing-ship.js'
import { Route } from '#routes/_authed/vehicles/$vehiclePublicId/$vehicleSlug/edit'
import { buildVehicleRouteParams } from '#app/routing/authoredRouteParams'
import {
  authoringDesktopViewport,
  expectMasterLockedAuthoringRoute,
  expectOwnedActiveAuthoringRoute,
  expectOwnedDraftAuthoringRoute,
  findSeededAuthoringRecord
} from '#domains/authoredRouteStory.play'
import { STORY_RECORDS } from '../../../../../apis/tests/developmentReviewDataScenarios'

const { ownedActive, ownedDraft } = STORY_RECORDS.vehicle

/** The edit route opened at a subject id, which the loader redirects to its canonical handle. */
function editRouter(subjectId: string, label: string) {
  return {
    route: Route,
    path: '/vehicles/$vehiclePublicId/$vehicleSlug/edit' as const,
    params: buildVehicleRouteParams(subjectId, label)
  }
}

// Reads the seeded vehicles as the story account (D218, D221): the SRD Sailing Ship and the account's own
// copies of it that `seedStoryData` activates and drafts. Writes are spies.
const meta = {
  title: 'Domains/Vehicles/Routes/Edit',
  globals: authoringDesktopViewport.globals,
  parameters: {
    layout: 'fullscreen',
    viewport: { options: authoringDesktopViewport.options },
    tanstack: { router: editRouter(sailingShip.id, sailingShip.label) }
  }
} satisfies Meta<typeof Route>

export default meta

// Typed by the route (the meta sets no `component`), so a story can retarget its params.
type Story = StoryObj<typeof Route>

export const MasterLocked: Story = {
  play: async ({ canvasElement }) => {
    await findSeededAuthoringRecord(canvasElement, sailingShip.label)
    await expectMasterLockedAuthoringRoute(canvasElement, sailingShip.label)
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
