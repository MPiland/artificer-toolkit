import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CharacterBuilderDraftDto,
  CharacterBuilderPayloadDto
} from '@artificer-toolkit/schema/api/characters'
import { AuthoringLayout } from '#forms/layout/AuthoringLayout'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import {
  characterBuilderDraftPayloadFixture,
  characterBuilderPayloadFixture,
  characterPreviewFixture
} from '../fixtures/characterBuilder.fixtures'
import { normalizeCharacterForDraft } from '../shared/formNormalization'

const mocks = vi.hoisted(() => ({
  commit: vi.fn(),
  create: vi.fn(),
  discard: vi.fn(),
  preview: vi.fn(),
  resolve: vi.fn(),
  saveDraft: vi.fn()
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
  usePreviewCharacterSaveMutation: () => ({ mutateAsync: mocks.preview }),
  useResolveCharacterBuilderMutation: () => ({ mutateAsync: mocks.resolve }),
  useSaveCharacterDraftMutation: () => ({ mutateAsync: mocks.saveDraft })
}))

beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined
  HTMLElement.prototype.scrollTo = () => undefined
})

describe('CharacterBuilderAuthoringRuntime', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
  })

  it('preserves unsaved intent and rejects stale resolution across same-generation loader updates', async () => {
    const user = userEvent.setup()
    const olderResolution = deferred<CharacterBuilderPayloadDto>()
    const newerResolution = deferred<CharacterBuilderPayloadDto>()
    mocks.resolve
      .mockReturnValueOnce(olderResolution.promise)
      .mockReturnValueOnce(newerResolution.promise)
    const initialPayload = structuredClone(characterBuilderDraftPayloadFixture)
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

    const { rerender } = renderWithAppProviders(
      <AuthoringLayout data={editData(initialPayload)} kind='character-builder' mode='edit' />
    )

    await chooseRace(user, 'Sea Elf', 'Choose Race')
    await waitFor(() => expect(mocks.resolve).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('link', { name: 'Basics' }))
    const nameInput = screen.getByRole('textbox', { name: /character name/i })
    await user.type(nameInput, 'Hydrated Hero')

    await user.click(screen.getByRole('link', { name: 'Race' }))
    await chooseRace(user, 'High Elf', 'Change Race')
    await waitFor(() => expect(mocks.resolve).toHaveBeenCalledTimes(2))
    await user.click(screen.getByRole('link', { name: 'Basics' }))
    const originalNameInput = screen.getByRole('textbox', { name: /character name/i })

    rerender(
      <AuthoringLayout data={editData(authenticatedPayload)} kind='character-builder' mode='edit' />
    )

    const hydratedNameInput = screen.getByRole('textbox', { name: /character name/i })
    expect(hydratedNameInput).toBe(originalNameInput)
    expect(hydratedNameInput).toHaveValue('Hydrated Hero')

    expect(mocks.resolve.mock.calls[0]?.[0]).toMatchObject({
      expectedDraftId: 'draft-generation',
      mode: 'create'
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
  })

  it('resets the form when a different persisted draft generation is loaded', async () => {
    const user = userEvent.setup()
    const payload = structuredClone(characterBuilderDraftPayloadFixture)
    const { rerender } = renderWithAppProviders(
      <AuthoringLayout data={editData(payload)} kind='character-builder' mode='edit' />
    )
    await user.click(screen.getByRole('link', { name: 'Basics' }))
    await user.type(screen.getByRole('textbox', { name: /character name/i }), 'Unsaved name')
    payload.character.label = 'Reopened draft'
    rerender(
      <AuthoringLayout
        data={editData(payload, 'new-generation')}
        kind='character-builder'
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
      <AuthoringLayout
        data={{ systems: [{ id: characterBuilderPayloadFixture.character.systemId }] }}
        kind='character-builder'
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

  it.each(['', ' plus newer edit'])(
    'retains saved values and pending edits: %s',
    async (pendingEdit) => {
      const user = userEvent.setup()
      const pending = deferred<CharacterBuilderDraftDto>()
      mocks.saveDraft.mockReturnValueOnce(pending.promise)
      const data = editData(characterBuilderPayloadFixture)
      renderWithAppProviders(<AuthoringLayout data={data} kind='character-builder' mode='edit' />)
      await user.click(screen.getByRole('link', { name: 'Basics' }))
      const name = screen.getByRole('textbox', { name: /character name/i })
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

  it('discards active draft from overflow actions with generation-bound draft id', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <AuthoringLayout
        data={editData(characterBuilderDraftPayloadFixture)}
        kind='character-builder'
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

  it('commits the reviewed candidate and generation without an intervening draft save', async () => {
    const user = userEvent.setup()
    const candidate = normalizeCharacterForDraft(characterBuilderPayloadFixture.character)
    const preview = {
      ...characterPreviewFixture,
      character: { ...candidate, label: 'Reviewed name' }
    }
    mocks.preview.mockResolvedValueOnce(preview)
    mocks.commit.mockRejectedValueOnce(new Error('Conflict keeps editor open'))
    renderWithAppProviders(
      <AuthoringLayout
        data={editData(characterBuilderPayloadFixture)}
        kind='character-builder'
        mode='edit'
      />
    )
    await user.click(screen.getByRole('button', { name: 'Activate' }))
    const dialog = await screen.findByRole('dialog', { name: 'Finalize Character' })
    expect(mocks.preview.mock.calls[0]?.[0]).toMatchObject({
      expectedDraftId: 'draft-generation',
      character: { status: 'DRAFT' }
    })
    await user.click(within(dialog).getByRole('button', { name: 'Finalize' }))
    await waitFor(() =>
      expect(mocks.commit).toHaveBeenCalledWith({
        character: preview.character,
        expectedDraftId: 'draft-generation',
        mode: 'create'
      })
    )
    expect(mocks.saveDraft).not.toHaveBeenCalled()
    expect(dialog).toBeInTheDocument()
  })
})

function editData(payload: CharacterBuilderPayloadDto, generation = 'draft-generation') {
  const draft: CharacterBuilderDraftDto = {
    id: generation,
    characterId: payload.character.id,
    publicId: 'test-character',
    userId: payload.character.userId,
    systemId: payload.character.systemId,
    label: payload.character.label,
    status: 'DRAFT',
    draftState: 'DRAFT_ONLY',
    mode: 'create',
    payload: { character: payload.character }
  }
  return {
    characterId: payload.character.id,
    breadcrumbLabel: payload.character.label,
    draft,
    payload
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
