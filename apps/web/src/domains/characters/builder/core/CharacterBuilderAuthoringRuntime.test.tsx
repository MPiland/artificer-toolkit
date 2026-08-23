import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characters'
import { AuthoringLayout } from '#forms/layout/AuthoringLayout'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { characterBuilderDraftPayloadFixture } from '../fixtures/characterBuilder.fixtures'

const mocks = vi.hoisted(() => ({
  commit: vi.fn(),
  discard: vi.fn(),
  preview: vi.fn(),
  resolve: vi.fn(),
  saveDraft: vi.fn()
}))

vi.mock('#app/data/characters/mutations', () => ({
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

  it('preserves create intent and rejects stale resolution across authenticated hydration', async () => {
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
      characterId: 'authenticated-transient-character',
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
      <AuthoringLayout
        data={{ payload: initialPayload, systems: [] }}
        kind='character-builder'
        mode='create'
      />
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
      <AuthoringLayout
        data={{ payload: authenticatedPayload, systems: [] }}
        kind='character-builder'
        mode='create'
      />
    )

    const hydratedNameInput = screen.getByRole('textbox', { name: /character name/i })
    expect(hydratedNameInput).toBe(originalNameInput)
    expect(hydratedNameInput).toHaveValue('Hydrated Hero')

    const firstRequest = mocks.resolve.mock.calls[0]?.[0] as { signal?: AbortSignal }
    expect(firstRequest.signal?.aborted).toBe(true)

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
})

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
