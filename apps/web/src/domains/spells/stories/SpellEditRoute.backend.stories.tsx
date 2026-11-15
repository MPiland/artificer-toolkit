import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { fireball } from '@artificer-toolkit/source-data/srd/spells/fireball.js'
import { expect, within } from 'storybook/test'
import { Route } from '#routes/_authed/spells/$spellPublicId/$spellSlug/edit'
import { buildSpellRouteParams } from '#app/routing/authoredRouteParams'
import { expectMasterLockedAuthoringRoute } from '#domains/authoredRouteStory.play'

// Reads the seeded SRD Fireball as the story account (D218, D221); the loader redirects the subject
// id to the record's canonical handle.
const meta = {
  title: 'Domains/Spells/Routes/Edit Seeded',
  parameters: {
    layout: 'fullscreen',
    tanstack: {
      router: {
        route: Route,
        path: '/spells/$spellPublicId/$spellSlug/edit',
        params: buildSpellRouteParams(fireball.id, fireball.label)
      }
    }
  }
} satisfies Meta<typeof Route>

export default meta

type Story = StoryObj<typeof meta>

export const MasterLocked: Story = {
  play: async ({ canvasElement }) => {
    // The first read crosses the network to the seeded deployment.
    await expect(
      await within(canvasElement).findByDisplayValue(fireball.label, {}, { timeout: 15_000 })
    ).toBeInTheDocument()
    await expectMasterLockedAuthoringRoute(canvasElement, fireball.label)
  }
}
