import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { ConvexReactClient, useConvex, useMutation } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { expect, fn, mocked, userEvent, waitFor, within } from 'storybook/test'
import { characterDraftSaveInputSchema } from '@artificer-toolkit/schema/api/characterDrafts'
import { characterBuilderResolveInputSchema } from '@artificer-toolkit/schema/api/characterBuilderQueries'
import { AuthoringLayout } from '#forms/layout/AuthoringLayout'
import { authoredRouteStoryUser } from '#domains/authoredRouteStory.fixtures'
import { selectAuthoringTarget } from '#domains/authoredRouteStory.play'
import {
  characterBuilderPayloadFixture,
  characterPreviewFixture
} from '../fixtures/characterBuilder.fixtures'
import { normalizeCharacterForDraft, toCharacterFormValues } from '../shared/formNormalization'

const character = normalizeCharacterForDraft(toCharacterFormValues(characterBuilderPayloadFixture))
const draft = {
  id: '00000000-0000-4000-8000-000000000201',
  characterId: character.id,
  publicId: 'builder-story',
  systemId: character.systemId,
  userId: character.userId,
  label: character.label,
  status: 'DRAFT',
  draftState: 'ACTIVE_WITH_DRAFT',
  mode: 'edit',
  payload: { character }
}
const save = fn()
const preview = fn()
const commit = fn()

const meta = {
  title: 'Domains/Characters/Builder Native Draft',
  component: AuthoringLayout,
  args: {
    kind: 'character-builder',
    mode: 'edit',
    data: {
      characterId: character.id,
      breadcrumbLabel: character.label,
      draft,
      activeCharacter: character
    }
  },
  parameters: {
    layout: 'fullscreen',
    tanstack: { router: { context: { user: authoredRouteStoryUser } } }
  },
  beforeEach: () => {
    save.mockClear()
    preview.mockClear()
    commit.mockClear()
    const client = new ConvexReactClient('https://story-fixture.convex.cloud', { logger: false })
    Object.defineProperty(client, 'query', {
      value: fn<ConvexReactClient['query']>().mockImplementation(async (...[reference, input]) => {
        const candidate = characterBuilderResolveInputSchema.parse(input)
        expect(candidate.expectedDraftId).toBe(draft.id)
        switch (getFunctionName(reference)) {
          case 'characters/builder:resolve':
            return { ...characterBuilderPayloadFixture, character: candidate.character }
          case 'characters/builder:preview':
            preview(candidate)
            return { ...characterPreviewFixture, character: candidate.character }
          default:
            throw new Error(`Unexpected Builder query: ${getFunctionName(reference)}`)
        }
      })
    })
    mocked(useConvex).mockReturnValue(client)
    mocked(useMutation).mockImplementation((reference) => {
      const mutate: ReturnType<typeof useMutation> = Object.assign(
        async (input?: unknown) => {
          switch (getFunctionName(reference)) {
            case 'characters/drafts:save': {
              const values = characterDraftSaveInputSchema.parse(input)
              expect(values.expectedDraftId).toBe(draft.id)
              save(values)
              return {
                ...draft,
                label: values.character.label,
                payload: { character: values.character }
              }
            }
            case 'characters/commit:commit': {
              const values = characterBuilderResolveInputSchema.parse(input)
              commit(values)
              // Keep the editor visible to exercise the retryable conflict state.
              throw new Error('Story fixture: active Character changed before finalization.')
            }
            default:
              throw new Error(`Unexpected Builder mutation: ${getFunctionName(reference)}`)
          }
        },
        { withOptimisticUpdate: () => mutate }
      )
      return mutate
    })
    return () => client.close()
  }
} satisfies Meta<typeof AuthoringLayout>

export default meta
type Story = StoryObj<typeof meta>

export const SaveAndReview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    await selectAuthoringTarget(canvasElement, /^basics$/i)
    const name = await canvas.findByRole('textbox', { name: /character name/i })
    await userEvent.clear(name)
    await userEvent.type(name, 'Native draft hero')
    await expect(name).toHaveValue('Native draft hero')
    await userEvent.click(canvas.getByRole('button', { name: 'Save Draft' }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    await expect(save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        character: expect.objectContaining({ label: 'Native draft hero' })
      })
    )
    await waitFor(() => expect(canvas.getByLabelText('Saved')).toBeVisible())
    await expect(name).toHaveValue('Native draft hero')
    await userEvent.click(canvas.getByRole('button', { name: 'Activate' }))
    const dialog = await page.findByRole('dialog', { name: 'Finalize Character' })
    await waitFor(() => expect(dialog).toBeVisible())
    await userEvent.click(within(dialog).getByRole('button', { name: 'Finalize' }))
    await waitFor(() => expect(commit).toHaveBeenCalledTimes(1))
    await expect(commit.mock.calls[0]?.[0]).toEqual(preview.mock.calls[0]?.[0])
    await expect(save).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(dialog).toBeVisible())
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close finalize preview' }))
  }
}
