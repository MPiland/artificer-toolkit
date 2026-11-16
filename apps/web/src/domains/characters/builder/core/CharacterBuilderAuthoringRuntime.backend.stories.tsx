import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { api } from '@artificer-toolkit/apis/convex/api'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { characterBuilderCommitInputSchema } from '@artificer-toolkit/schema/api/characterBuilderQueries'
import { characterDraftSaveInputSchema } from '@artificer-toolkit/schema/api/characterDrafts'
import { writesTo } from '#app/test/storybook/storyWrites'
import { buildCharacterRouteParams } from '#app/routing/authoredRouteParams'
import { Route } from '#routes/_authed/characters/$characterPublicId/$characterSlug/edit'
import { selectAuthoringTarget } from '#domains/authoredRouteStory.play'
import { STORY_CHARACTERS } from '../../../../../../apis/tests/developmentReviewDataScenarios'

const { draftPending } = STORY_CHARACTERS

// The Builder over the seeded Character whose draft waits on its active Sheet (D218, D221): the
// real contract manifest and System are read from the deployment and the browser Worker evaluates
// them. Draft save and activation are spied writes.
const meta = {
  title: 'Domains/Characters/Builder Native Draft',
  parameters: {
    layout: 'fullscreen',
    tanstack: {
      router: {
        route: Route,
        path: '/characters/$characterPublicId/$characterSlug/edit' as const,
        params: buildCharacterRouteParams(draftPending.characterId, draftPending.label)
      }
    }
  }
} satisfies Meta<typeof Route>

export default meta

type Story = StoryObj<typeof Route>

export const SaveAndReview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    await selectAuthoringTarget(canvasElement, /^basics$/i)
    const name = await canvas.findByRole(
      'textbox',
      { name: /character name/i },
      { timeout: 15_000 }
    )
    await expect(name).toHaveValue(draftPending.label)
    await userEvent.clear(name)
    await userEvent.type(name, 'Native draft hero')
    await expect(name).toHaveValue('Native draft hero')
    await userEvent.click(canvas.getByRole('button', { name: 'Save Draft' }))
    await waitFor(() => expect(writesTo(api.characters.drafts.save)).toHaveLength(1))
    const save = characterDraftSaveInputSchema.parse(writesTo(api.characters.drafts.save)[0])
    await expect(save.character.label).toBe('Native draft hero')
    await waitFor(() => expect(canvas.getByLabelText('Saved')).toBeVisible())
    await expect(name).toHaveValue('Native draft hero')
    await userEvent.click(canvas.getByRole('button', { name: 'Activate' }))
    const dialog = await page.findByRole('dialog', { name: 'Finalize Character' })
    await waitFor(() => expect(dialog).toBeVisible())
    const finalize = await within(dialog).findByRole('button', { name: 'Finalize' })
    await waitFor(() => expect(finalize).toBeEnabled(), { timeout: 15_000 })
    await userEvent.click(finalize)
    await waitFor(() => expect(writesTo(api.characters.commit.commit)).toHaveLength(1))
    // Activation sends the edited Character against the draft the save targeted.
    const commit = characterBuilderCommitInputSchema.parse(
      writesTo(api.characters.commit.commit)[0]
    )
    await expect(commit).toMatchObject({
      expectedDraftId: save.expectedDraftId,
      mode: 'edit',
      character: { id: draftPending.characterId, label: 'Native draft hero' }
    })
    await expect(writesTo(api.characters.drafts.save)).toHaveLength(1)
  }
}
