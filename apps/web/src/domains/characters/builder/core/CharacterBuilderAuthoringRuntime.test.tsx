import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CharacterBuilderDraftDto,
  CharacterBuilderPayloadDto
} from '@artificer-toolkit/schema/api/characters'
import { CharacterBuilderAuthoringRuntime } from './CharacterBuilderAuthoringRuntime'
import { ConvexReactClient } from 'convex/react'
import { ConvexError } from 'convex/values'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import {
  characterBuilderDraftPayloadFixture,
  characterBuilderPayloadFixture,
  characterPreviewFixture
} from '../fixtures/characterBuilder.fixtures'
import type { ContentSnapshotManifestDto } from '@artificer-toolkit/schema/api/contentSnapshots'
import { normalizeCharacterForDraft } from '../shared/formNormalization'
import type { BuilderEvaluationRequest } from '../evaluation/builderEvaluation.types'
import {
  CHARACTER_BUILDER_TIMING_MARK,
  CHARACTER_BUILDER_TIMING_MEASURE
} from './characterBuilder.performance'

const mocks = vi.hoisted(() => ({
  commit: vi.fn(),
  create: vi.fn(),
  discard: vi.fn(),
  evaluate: vi.fn(),
  manifest: vi.fn(),
  preview: vi.fn(),
  featureSourceHints: vi.fn(),
  resolve: vi.fn(),
  saveDraft: vi.fn(),
  activeCharacter: vi.fn()
}))

vi.mock('#app/data/characters/mutations', () => ({
  useCreateCharacterDraftMutation: () => ({ mutateAsync: mocks.create }),
  useCommitCharacterBuilderMutation: () => ({
    isPending: false,
    mutateAsync: mocks.commit
  }),
  useDiscardCharacterDraftMutation: () => ({
    isPending: false,
    mutateAsync: mocks.discard
  }),
  useSaveCharacterDraftMutation: () => ({ mutateAsync: mocks.saveDraft })
}))

// The Builder evaluates in the browser worker (ADR 0036 S6); the worker client is the seam.
vi.mock('#app/data/characters/queries', () => ({
  getCharacterBuilderActiveCharacter: () => ({
    queryKey: ['builder-active-character'],
    queryFn: async () => mocks.activeCharacter()
  })
}))
vi.mock('#app/data/contentSnapshots/queries', () => ({
  getContentSnapshotManifest: () => ({
    queryKey: ['content-snapshot-manifest'],
    queryFn: async () => mocks.manifest()
  }),
  useContentSnapshotToken: () => async () => 'content-token'
}))
vi.mock('#app/data/systems/queries', () => ({
  getSystem: () => ({ queryKey: ['system'], queryFn: async () => ({ id: 'system' }) })
}))
vi.mock('../evaluation/builderEvaluationClient', () => ({
  createBuilderEvaluationClient: () => ({ evaluate: mocks.evaluate, terminate: () => undefined })
}))

const builtManifest: ContentSnapshotManifestDto = {
  systemId: characterBuilderPayloadFixture.character.systemId,
  sources: [],
  campaign: null
}

beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined
  HTMLElement.prototype.scrollTo = () => undefined
})

describe('CharacterBuilderAuthoringRuntime', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.manifest.mockReturnValue(builtManifest)
    mocks.activeCharacter.mockReturnValue(characterBuilderPayloadFixture.character)
    mocks.resolve.mockResolvedValue(characterBuilderPayloadFixture)
    mocks.featureSourceHints.mockReturnValue([])
    mocks.evaluate.mockImplementation(async (request: BuilderEvaluationRequest) =>
      request.operation === 'resolve'
        ? { ok: true, output: { operation: 'resolve', payload: await mocks.resolve(request) } }
        : {
            ok: true,
            output: {
              operation: 'preview',
              preview: await mocks.preview(request),
              featureSourceHints: mocks.featureSourceHints()
            }
          }
    )
  })

  it('preserves unsaved intent and rejects stale resolution across same-generation loader updates', async () => {
    const user = userEvent.setup()
    const olderResolution = deferred<CharacterBuilderPayloadDto>()
    const newerResolution = deferred<CharacterBuilderPayloadDto>()
    const initialPayload = structuredClone(characterBuilderDraftPayloadFixture)
    mocks.resolve
      .mockResolvedValueOnce(initialPayload)
      .mockReturnValueOnce(olderResolution.promise)
      .mockReturnValueOnce(newerResolution.promise)
    const seaElfReference = initialPayload.references.races.find(
      (race) => race.id === 'subrace-sea-elf'
    )
    if (!seaElfReference) throw new Error('Expected the canonical Sea Elf reference fixture.')
    initialPayload.references.races.push({
      ...seaElfReference,
      id: 'subrace-high-elf',
      label: 'High Elf'
    })
    initialPayload.view.race.subraceOptions.push({ id: 'subrace-high-elf', label: 'High Elf' })
    const authenticatedPayload = createResolvedPayload({
      characterId: initialPayload.character.id,
      label: 'Hydrated Hero',
      race: { raceId: 'race-elf', subraceId: 'subrace-high-elf' },
      raceLabel: 'High Elf',
      template: initialPayload,
      userId: 'authenticated-user'
    })
    const stalePayload = createResolvedPayload({
      characterId: initialPayload.character.id,
      label: '',
      race: { raceId: 'race-elf', subraceId: 'subrace-sea-elf' },
      raceLabel: 'Sea Elf',
      template: initialPayload,
      userId: initialPayload.character.userId
    })

    // The hydrated owner is a new evaluation input, so the Builder re-resolves the current values.
    mocks.resolve.mockResolvedValue(authenticatedPayload)

    const { rerender } = renderWithAppProviders(
      <CharacterBuilderAuthoringRuntime data={editData(initialPayload)} mode='edit' />
    )

    // The Builder evaluates the opened values once its content is ready, then once per edit.
    await waitFor(() => expect(mocks.resolve).toHaveBeenCalledTimes(1))
    await user.click(await screen.findByRole('link', { name: 'Race' }))
    await chooseRace(user, 'Sea Elf', 'Choose Race')
    await waitFor(() => expect(mocks.resolve).toHaveBeenCalledTimes(2))

    await user.click(screen.getByRole('link', { name: 'Basics' }))
    const nameInput = screen.getByRole('textbox', { name: /character name/i })
    await user.type(nameInput, 'Hydrated Hero')

    await user.click(screen.getByRole('link', { name: 'Race' }))
    await chooseRace(user, 'High Elf', 'Change Race')
    await waitFor(() => expect(mocks.resolve).toHaveBeenCalledTimes(3))
    await user.click(screen.getByRole('link', { name: 'Basics' }))
    const originalNameInput = screen.getByRole('textbox', { name: /character name/i })

    rerender(<CharacterBuilderAuthoringRuntime data={editData(authenticatedPayload)} mode='edit' />)

    const hydratedNameInput = screen.getByRole('textbox', { name: /character name/i })
    expect(hydratedNameInput).toBe(originalNameInput)
    expect(hydratedNameInput).toHaveValue('Hydrated Hero')

    expect(mocks.resolve.mock.calls[1]?.[0]).toMatchObject({
      operation: 'resolve',
      draft: { expectedDraftId: 'draft-generation', mode: 'create' }
    })
    expect(mocks.create).not.toHaveBeenCalled()

    await act(async () => {
      newerResolution.resolve(authenticatedPayload)
      await newerResolution.promise
    })
    await act(async () => {
      olderResolution.resolve(stalePayload)
      await olderResolution.promise
    })

    await user.click(screen.getByRole('link', { name: 'Race' }))
    expect(screen.getByRole('heading', { level: 3, name: 'High Elf' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3, name: 'Sea Elf' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Basics' }))
    expect(screen.getByRole('textbox', { name: /character name/i })).toHaveValue('Hydrated Hero')
  }, 15_000)

  it('resets the form when a different persisted draft generation is loaded', async () => {
    const user = userEvent.setup()
    const payload = structuredClone(characterBuilderDraftPayloadFixture)
    const { rerender } = renderWithAppProviders(
      <CharacterBuilderAuthoringRuntime data={editData(payload)} mode='edit' />
    )
    await user.click(screen.getByRole('link', { name: 'Basics' }))
    await user.type(await screen.findByRole('textbox', { name: /character name/i }), 'Unsaved name')
    payload.character.label = 'Reopened draft'
    rerender(
      <CharacterBuilderAuthoringRuntime
        data={editData(payload, 'new-generation')}

        mode='edit'
      />
    )
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /character name/i })).toHaveValue('Reopened draft')
    )
  })

  it('retries native draft opening with the same Character identity', async () => {
    const user = userEvent.setup()
    mocks.create.mockRejectedValue(new Error('Temporary failure'))
    renderWithAppProviders(
      <CharacterBuilderAuthoringRuntime
        data={{ systemId: characterBuilderPayloadFixture.character.systemId, systems: [] }}

        mode='create'
      />
    )
    await user.click(await screen.findByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2))
    expect(mocks.create.mock.calls[0]?.[0]).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      systemId: characterBuilderPayloadFixture.character.systemId
    })
    expect(mocks.create.mock.calls[1]?.[0]).toEqual(mocks.create.mock.calls[0]?.[0])
    expect(screen.queryByRole('textbox', { name: /character name/i })).not.toBeInTheDocument()
  })

  it('replaces the failure notice with the opening status while a retry is in flight', async () => {
    const user = userEvent.setup()
    const retry = deferred<CharacterBuilderDraftDto>()
    mocks.create
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockReturnValueOnce(retry.promise)
    renderWithAppProviders(
      <CharacterBuilderAuthoringRuntime
        data={{ systemId: characterBuilderPayloadFixture.character.systemId, systems: [] }}

        mode='create'
      />
    )
    expect(await screen.findByText('Could not open that character draft.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Opening character draft…')
    expect(screen.queryByText('Could not open that character draft.')).not.toBeInTheDocument()
  })

  it.each(['', ' plus newer edit'])(
    'retains saved values and pending edits: %s',
    async (pendingEdit) => {
      const user = userEvent.setup()
      const pending = deferred<CharacterBuilderDraftDto>()
      mocks.saveDraft.mockReturnValueOnce(pending.promise)
      const data = editData(characterBuilderPayloadFixture)
      renderWithAppProviders(<CharacterBuilderAuthoringRuntime data={data} mode='edit' />)
      await user.click(screen.getByRole('link', { name: 'Basics' }))
      const name = await screen.findByRole('textbox', { name: /character name/i })
      await user.clear(name)
      await user.type(name, 'Saved name')
      await user.click(screen.getByRole('button', { name: 'Save Draft' }))
      await waitFor(() => expect(mocks.saveDraft).toHaveBeenCalledTimes(1))
      expect(mocks.saveDraft.mock.calls[0]?.[0]).toMatchObject({
        expectedDraftId: 'draft-generation',
        character: { label: 'Saved name', status: 'DRAFT' }
      })
      expect(mocks.saveDraft.mock.calls[0]?.[0]).not.toHaveProperty('baseActiveUpdatedAt')
      if (pendingEdit) await user.type(name, pendingEdit)
      await act(async () => {
        pending.resolve(data.draft)
        await pending.promise
      })
      await waitFor(() => expect(name).toHaveValue(`Saved name${pendingEdit}`))
    }
  )

  it('autosaves through effect replay, saves on a step change, and shows the save state quietly', async () => {
    const user = userEvent.setup()
    const saving = deferred<CharacterBuilderDraftDto>()
    mocks.saveDraft.mockReturnValueOnce(saving.promise)
    const data = editData(characterBuilderPayloadFixture)
    renderWithAppProviders(<CharacterBuilderAuthoringRuntime data={data} mode='edit' />, {
      reactStrictMode: true
    })
    await user.click(screen.getByRole('link', { name: 'Basics' }))
    const name = await screen.findByRole('textbox', { name: /character name/i })
    await user.clear(name)
    await user.type(name, 'Autosaved name')
    expect(mocks.saveDraft).not.toHaveBeenCalled()
    // A step change saves without waiting for the idle debounce.
    await user.click(screen.getByRole('link', { name: 'Race' }))
    await waitFor(() => expect(mocks.saveDraft).toHaveBeenCalledTimes(1))
    expect(mocks.saveDraft.mock.calls[0]?.[0]).toMatchObject({
      expectedDraftId: 'draft-generation',
      character: { label: 'Autosaved name', status: 'DRAFT' }
    })
    expect(await screen.findByText('Saving…')).toBeInTheDocument()
    await act(async () => {
      saving.resolve(data.draft)
      await saving.promise
    })
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('keeps an immediate Race rail selection after renderer progress publication', async () => {
    const user = userEvent.setup()
    performance.clearMarks(CHARACTER_BUILDER_TIMING_MARK.BUILDER_RAIL_COMMITTED)
    renderWithAppProviders(
      <CharacterBuilderAuthoringRuntime
        data={editData(characterBuilderPayloadFixture)}

        mode='edit'
      />
    )

    const navigation = await screen.findByRole('navigation', { name: 'Authoring steps' })
    expect(within(navigation).getByText('Basics', { exact: true }).closest('a')).toBeVisible()
    expect(within(navigation).getByText('Review', { exact: true }).closest('a')).toBeVisible()
    const raceLink = within(navigation).getByText('Race', { exact: true }).closest('a')
    expect(raceLink).not.toBeNull()
    await user.click(raceLink!)

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Race' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Change Race' })).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(
        performance.getEntriesByName(CHARACTER_BUILDER_TIMING_MARK.BUILDER_RAIL_COMMITTED, 'mark')
      ).toHaveLength(1)
    })
  })

  it('measures step navigation from the rail to the committed panel', async () => {
    const user = userEvent.setup()
    performance.clearMarks(CHARACTER_BUILDER_TIMING_MARK.STEP_NAVIGATION_INTENT)
    performance.clearMeasures(CHARACTER_BUILDER_TIMING_MEASURE.STEP_NAVIGATION)
    renderWithAppProviders(
      <CharacterBuilderAuthoringRuntime
        data={editData(characterBuilderPayloadFixture)}
        mode='edit'
      />
    )

    const navigation = await screen.findByRole('navigation', { name: 'Authoring steps' })
    await user.click(within(navigation).getByText('Race', { exact: true }).closest('a')!)

    await waitFor(() => {
      expect(
        performance.getEntriesByName(CHARACTER_BUILDER_TIMING_MEASURE.STEP_NAVIGATION, 'measure')
      ).toHaveLength(1)
    })
  })

  it('opens on the recommended step once the first evaluation returns, unless the URL named a step', async () => {
    const payload = structuredClone(characterBuilderDraftPayloadFixture)
    expect(payload.resolution.recommendedSectionId).toBe('RACE')
    mocks.resolve.mockResolvedValue(payload)
    const first = renderWithAppProviders(
      <CharacterBuilderAuthoringRuntime data={editData(payload)} mode='edit' />
    )
    expect(await screen.findByRole('heading', { level: 2, name: 'Race' })).toBeInTheDocument()
    first.unmount()

    renderWithAppProviders(
      <CharacterBuilderAuthoringRuntime data={editData(payload)} mode='edit' />,
      { initialPath: '/?step=basics' }
    )
    await waitFor(() => expect(mocks.resolve).toHaveBeenCalled())
    expect(await screen.findByRole('heading', { level: 2, name: 'Basics' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'Race' })).not.toBeInTheDocument()
  })

  it('stops autosaving and says so when the draft was replaced elsewhere', async () => {
    const user = userEvent.setup()
    mocks.saveDraft.mockRejectedValue(
      new ConvexError({ code: 'DRAFT_REPLACED', message: 'Character draft generation changed.' })
    )
    renderWithAppProviders(
      <CharacterBuilderAuthoringRuntime
        data={editData(characterBuilderPayloadFixture)}

        mode='edit'
      />
    )
    await user.click(await screen.findByRole('link', { name: 'Basics' }))
    await user.type(await screen.findByRole('textbox', { name: /character name/i }), 'x')
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect(await screen.findByText('Opened elsewhere')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: /character name/i }), 'y')
    await user.click(screen.getByRole('link', { name: 'Race' }))
    expect(mocks.saveDraft).toHaveBeenCalledTimes(1)
  })

  it('discards active draft from overflow actions with generation-bound draft id', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <CharacterBuilderAuthoringRuntime
        data={editData(characterBuilderDraftPayloadFixture)}

        mode='edit'
      />
    )
    const moreActionsButton = await screen.findByRole('button', { name: 'More authoring actions' })
    fireEvent.click(moreActionsButton)
    await user.click(await screen.findByRole('menuitem', { name: /discard draft/i }))
    await waitFor(() =>
      expect(mocks.discard).toHaveBeenCalledWith({
        id: characterBuilderDraftPayloadFixture.character.id,
        expectedDraftId: 'draft-generation'
      })
    )
  })

  it('commits the reviewed candidate, generation and feature hints without a draft save', async () => {
    const user = userEvent.setup()
    // The worker names the roots of the reviewed Character's standalone features (ADR 0036 S7).
    const featureSourceHints = [
      {
        featureId: '00000000-0000-4000-8000-000000000a01',
        rootId: '00000000-0000-4000-8000-000000000a02'
      }
    ]
    mocks.featureSourceHints.mockReturnValue(featureSourceHints)
    const candidate = normalizeCharacterForDraft(characterBuilderPayloadFixture.character)
    const preview = {
      ...characterPreviewFixture,
      character: { ...candidate, label: 'Reviewed name' }
    }
    mocks.preview.mockResolvedValueOnce(preview)
    mocks.commit.mockRejectedValueOnce(new Error('Conflict keeps editor open'))
    renderWithAppProviders(
      <CharacterBuilderAuthoringRuntime
        data={editData(characterBuilderPayloadFixture)}

        mode='edit'
      />
    )
    const activate = screen.getByRole('button', { name: 'Activate' })
    // Finalizing waits for the first evaluation in the browser.
    await waitFor(() => expect(activate).toBeEnabled())
    await user.click(activate)
    const dialog = await screen.findByRole('dialog', { name: 'Finalize Character' })
    expect(mocks.preview.mock.calls[0]?.[0]).toMatchObject({
      operation: 'preview',
      draft: { expectedDraftId: 'draft-generation' },
      character: { status: 'DRAFT' }
    })
    await user.click(within(dialog).getByRole('button', { name: 'Finalize' }))
    await waitFor(() =>
      expect(mocks.commit).toHaveBeenCalledWith({
        character: preview.character,
        expectedDraftId: 'draft-generation',
        mode: 'create',
        featureSourceHints
      })
    )
    expect(mocks.saveDraft).not.toHaveBeenCalled()
    expect(dialog).toBeInTheDocument()
  })

  it('keeps a pending finalize preview shown as saving while the builder re-renders (RELIABILITY-10 journey)', async () => {
    const user = userEvent.setup()
    const previewing = deferred<typeof characterPreviewFixture>()
    mocks.preview.mockReturnValueOnce(previewing.promise)
    renderWithAppProviders(
      <CharacterBuilderAuthoringRuntime
        data={editData(characterBuilderPayloadFixture)}

        mode='edit'
      />
    )
    await user.click(await screen.findByRole('link', { name: 'Basics' }))
    const activate = screen.getByRole('button', { name: 'Activate' })
    await waitFor(() => expect(activate).toBeEnabled())
    await user.click(activate)
    await waitFor(() => expect(mocks.preview).toHaveBeenCalledTimes(1))
    expect(activate).toHaveAttribute('data-loading', 'true')

    // An edit re-renders the builder's progress; the pending preview is still a save in flight.
    const name = screen.getByRole('textbox', { name: /character name/i })
    await user.type(name, 'x')
    expect(name).toHaveValue(`${characterBuilderPayloadFixture.character.label}x`)
    expect(activate).toHaveAttribute('data-loading', 'true')

    await act(async () => {
      previewing.resolve(characterPreviewFixture)
      await previewing.promise
    })
    expect(await screen.findByRole('dialog', { name: 'Finalize Character' })).toBeInTheDocument()
    expect(activate).not.toHaveAttribute('data-loading')
  })

  it('shows that published content is still updating', async () => {
    mocks.manifest.mockReturnValue({
      ...builtManifest,
      sources: [
        {
          contentSourceId: '00000000-0000-4000-8000-000000000001',
          kind: 'USER',
          head: {
            scope: 'SOURCE',
            scopeId: '00000000-0000-4000-8000-000000000001',
            revision: 3,
            builtRevision: 2,
            kinds: {}
          }
        }
      ]
    } satisfies ContentSnapshotManifestDto)
    renderWithAppProviders(
      <CharacterBuilderAuthoringRuntime
        data={editData(characterBuilderDraftPayloadFixture)}

        mode='edit'
      />
    )

    expect(await screen.findByText(/still updating/i)).toBeInTheDocument()
  })

  it('names content that failed to load and retries the evaluation', async () => {
    const user = userEvent.setup()
    // The resolved payload matches the opened draft, so no debounced re-evaluation follows the retry.
    mocks.resolve.mockResolvedValue(characterBuilderDraftPayloadFixture)
    mocks.evaluate.mockResolvedValueOnce({ ok: false, failedKind: 'SPELL' })
    renderWithAppProviders(
      <CharacterBuilderAuthoringRuntime
        data={editData(characterBuilderDraftPayloadFixture)}

        mode='edit'
      />
    )

    expect(await screen.findByText(/could not load spells/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() =>
      expect(screen.queryByText(/could not load spells/i)).not.toBeInTheDocument()
    )
    expect(mocks.evaluate).toHaveBeenCalledTimes(2)
  })

  it('evaluates edits of an active Character locally against it, without Convex resolve or preview', async () => {
    const user = userEvent.setup()
    const active = { ...characterBuilderDraftPayloadFixture.character, label: 'Active record' }
    mocks.activeCharacter.mockReturnValue(active)
    mocks.resolve.mockResolvedValueOnce(characterBuilderDraftPayloadFixture)
    mocks.preview.mockResolvedValue(characterPreviewFixture)
    const convexClient = new ConvexReactClient('https://tests.convex.cloud')
    const convexQuery = vi.spyOn(convexClient, 'query')
    renderWithAppProviders(
      <CharacterBuilderAuthoringRuntime
        data={editData(characterBuilderDraftPayloadFixture, 'draft-generation', 'edit')}

        mode='edit'
      />,
      { convexClient }
    )

    await waitFor(() => expect(mocks.resolve).toHaveBeenCalledTimes(1))
    await user.click(await screen.findByRole('link', { name: 'Race' }))
    await chooseRace(user, 'Sea Elf', 'Choose Race')
    await waitFor(() => expect(mocks.resolve).toHaveBeenCalledTimes(2))
    expect(mocks.resolve.mock.calls[1]?.[0]).toMatchObject({
      operation: 'resolve',
      draft: { expectedDraftId: 'draft-generation', mode: 'edit' },
      previousCharacter: { label: 'Active record' }
    })
    await user.click(screen.getByRole('button', { name: 'Activate' }))
    await waitFor(() => expect(mocks.preview).toHaveBeenCalledTimes(1))
    expect(mocks.preview.mock.calls[0]?.[0]).toMatchObject({
      operation: 'preview',
      previousCharacter: { label: 'Active record' }
    })
    expect(convexQuery).not.toHaveBeenCalled()
  })
})

function editData(
  payload: CharacterBuilderPayloadDto,
  generation = 'draft-generation',
  mode: CharacterBuilderDraftDto['mode'] = 'create'
) {
  const draft: CharacterBuilderDraftDto = {
    id: generation,
    characterId: payload.character.id,
    publicId: 'test-character',
    userId: payload.character.userId,
    systemId: payload.character.systemId,
    label: payload.character.label,
    status: 'DRAFT',
    draftState: mode === 'create' ? 'DRAFT_ONLY' : 'ACTIVE_WITH_DRAFT',
    mode,
    payload: { character: payload.character }
  }
  return {
    characterId: payload.character.id,
    breadcrumbLabel: payload.character.label,
    draft,
    activeCharacter: mode === 'edit' ? payload.character : null
  }
}

async function chooseRace(
  user: ReturnType<typeof userEvent.setup>,
  raceLabel: string,
  actionLabel: 'Change Race' | 'Choose Race'
) {
  await user.click(screen.getByRole('button', { name: actionLabel }))
  const chooser = await screen.findByRole('dialog', { name: 'Choose a race' })
  await user.click(within(chooser).getByRole('radio', { name: raceLabel }))
  await user.click(within(chooser).getByRole('button', { name: actionLabel }))
  await waitFor(() => expect(chooser).not.toBeInTheDocument())
}

function createResolvedPayload({
  characterId,
  label,
  race,
  raceLabel,
  template,
  userId
}: {
  characterId: string
  label: string
  race: { raceId: string; subraceId?: string }
  raceLabel: string
  template: CharacterBuilderPayloadDto
  userId: string
}): CharacterBuilderPayloadDto {
  return {
    ...structuredClone(template),
    character: {
      ...structuredClone(template.character),
      id: characterId,
      label,
      userId,
      intent: {
        ...structuredClone(template.character.intent),
        race
      }
    },
    resolution: {
      ...structuredClone(template.resolution),
      summary: {
        ...structuredClone(template.resolution.summary),
        selectedRace: {
          raceId: race.raceId,
          raceLabel,
          subraceId: race.subraceId,
          subraceLabel: race.subraceId ? raceLabel : undefined
        }
      }
    }
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}
