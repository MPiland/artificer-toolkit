import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useQueryClient } from '@tanstack/react-query'
import { useMutation } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { api } from '@artificer-toolkit/apis/convex/api'
import { expect, fn, mocked, userEvent, waitFor, within } from 'storybook/test'
import { characterBuilderCommitInputSchema } from '@artificer-toolkit/schema/api/characterBuilderQueries'
import { characterDraftSaveInputSchema } from '@artificer-toolkit/schema/api/characterDrafts'
import { contentSnapshotManifestDtoSchema } from '@artificer-toolkit/schema/api/contentSnapshots'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { systemAuthoredDtoSchema } from '@artificer-toolkit/schema/vocabulary/system'
import { AUTHORED_RECORD_STATUS } from '@artificer-toolkit/shared/core'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { getCharacterBuilderActiveCharacter } from '#app/data/characters/queries'
import { getContentSnapshotManifest } from '#app/data/contentSnapshots/queries'
import { getSystem } from '#app/data/systems/queries'
import { CharacterBuilderAuthoringRuntime } from './CharacterBuilderAuthoringRuntime'
import { authoredRouteStoryUser } from '#domains/authoredRouteStory.fixtures'
import { selectAuthoringTarget } from '#domains/authoredRouteStory.play'
import type {
  BuilderEvaluationWorkerMessage,
  BuilderEvaluationWorkerRequest
} from '../evaluation/builderEvaluation.types'
import { createBuilderEvaluator } from '../evaluation/builderEvaluator'
import {
  createSnapshotStore,
  readySrdCharacterIntent,
  readySrdSnapshot
} from '../evaluation/builderSnapshot.fixtures'
import {
  createFallbackCharacterFormValues,
  normalizeCharacterForDraft
} from '../shared/formNormalization'

const fallbackValues = createFallbackCharacterFormValues(srdSystemRecord.id)
const character = normalizeCharacterForDraft({
  ...fallbackValues,
  id: '00000000-0000-4000-8000-000000000101',
  label: 'Astra Vale',
  userId: authoredRouteStoryUser.id,
  intent: { ...fallbackValues.intent, ...readySrdCharacterIntent }
})
const activeCharacter = characterAuthoredDtoSchema.parse({
  ...character,
  status: AUTHORED_RECORD_STATUS.ACTIVE
})
const manifest = contentSnapshotManifestDtoSchema.parse(readySrdSnapshot.manifest)
const system = systemAuthoredDtoSchema.parse(srdSystemRecord)
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
const commit = fn()
// The real Builder evaluator over the SRD snapshot objects, spied so the story can read what
// the Finalize preview evaluated.
const evaluate = fn(
  createBuilderEvaluator({
    store: createSnapshotStore(readySrdSnapshot.objects),
    onLoading: () => undefined
  })
)

/** The browser Worker's platform seam: runs the real evaluator in the page, answering the real client. */
class BuilderEvaluationWorker extends EventTarget {
  postMessage(message: BuilderEvaluationWorkerRequest) {
    if (message.type !== 'evaluate') return
    void evaluate(message.request).then((result) =>
      this.dispatchEvent(
        new MessageEvent<BuilderEvaluationWorkerMessage>('message', {
          data: { type: 'result', id: message.id, result }
        })
      )
    )
  }

  terminate() {}
}

const meta = {
  title: 'Domains/Characters/Builder Native Draft',
  component: CharacterBuilderAuthoringRuntime,
  args: {
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
    commit.mockClear()
    evaluate.mockClear()
    const originalWorker = globalThis.Worker
    Object.defineProperty(globalThis, 'Worker', {
      configurable: true,
      value: BuilderEvaluationWorker,
      writable: true
    })
    mocked(useMutation).mockImplementation((reference) => {
      const mutate: ReturnType<typeof useMutation> = Object.assign(
        async (input?: unknown) => {
          switch (getFunctionName(reference)) {
            case getFunctionName(api.characters.drafts.save): {
              const values = characterDraftSaveInputSchema.parse(input)
              expect(values.expectedDraftId).toBe(draft.id)
              save(values)
              return {
                ...draft,
                label: values.character.label,
                payload: { character: values.character }
              }
            }
            case getFunctionName(api.characters.commit.commit): {
              const values = characterBuilderCommitInputSchema.parse(input)
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
    return () => {
      Object.defineProperty(globalThis, 'Worker', {
        configurable: true,
        value: originalWorker,
        writable: true
      })
    }
  }
} satisfies Meta<typeof CharacterBuilderAuthoringRuntime>

export default meta
type Story = StoryObj<typeof meta>

export const SaveAndReview: Story = {
  // The Builder's three evaluation inputs: the live manifest, the System and the active Character.
  decorators: [
    (Story) => {
      const queryClient = useQueryClient()
      const manifestQuery = getContentSnapshotManifest(character.systemId, character.id)
      queryClient.setQueryDefaults(manifestQuery.queryKey, { queryFn: async () => manifest })
      queryClient.setQueryData(manifestQuery.queryKey, manifest)
      const systemQuery = getSystem(character.systemId)
      queryClient.setQueryDefaults(systemQuery.queryKey, { queryFn: async () => system })
      queryClient.setQueryData(systemQuery.queryKey, system)
      const activeQuery = getCharacterBuilderActiveCharacter(character.id)
      queryClient.setQueryDefaults(activeQuery.queryKey, { queryFn: async () => activeCharacter })
      queryClient.setQueryData(activeQuery.queryKey, activeCharacter)
      return <Story />
    }
  ],
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
    // Commit sends what the Finalize preview evaluated: its Character, draft generation and hints.
    const previewIndex = evaluate.mock.calls
      .map(([request]) => request.operation)
      .lastIndexOf('preview')
    const previewRequest = evaluate.mock.calls[previewIndex]?.[0]
    const previewed = await evaluate.mock.results[previewIndex]?.value
    if (!previewRequest || !previewed?.ok || previewed.output.operation !== 'preview')
      throw new Error('Expected a successful Finalize preview.')
    await expect(previewRequest.draft.expectedDraftId).toBe(draft.id)
    // The typed name reached the evaluator, which judged the edited Character ready to activate.
    await expect(previewed.output.preview.character.label).toBe('Native draft hero')
    await expect(previewed.output.preview.preview).toMatchObject({
      predictedStatus: AUTHORED_RECORD_STATUS.ACTIVE,
      downgradesStatus: false,
      destructive: false
    })
    await expect(commit.mock.calls[0]?.[0]).toEqual({
      character: previewed.output.preview.character,
      expectedDraftId: previewRequest.draft.expectedDraftId,
      mode: previewRequest.draft.mode,
      featureSourceHints: previewed.output.featureSourceHints
    })
    await expect(save).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(dialog).toBeVisible())
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close finalize preview' }))
  }
}
