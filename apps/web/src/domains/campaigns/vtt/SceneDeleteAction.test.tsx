import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getFunctionName } from 'convex/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@artificer-toolkit/apis/convex/api'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { SceneDeleteAction } from './SceneDeleteAction'

const mocks = vi.hoisted(() => ({ remove: vi.fn(), unexpected: vi.fn() }))

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference) === getFunctionName(api.scenes.definitions.remove)
      ? mocks.remove
      : mocks.unexpected
}))

const scene = { id: '33333333-3333-4333-8333-333333333333', name: 'Ashen Keep', version: 4 }
const campaignId = '22222222-2222-4222-8222-222222222222'

describe('SceneDeleteAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes the scene at its version only after confirmation', async () => {
    mocks.remove.mockResolvedValue(null)
    const onDeleted = vi.fn()
    const user = userEvent.setup()
    renderWithAppProviders(
      <SceneDeleteAction campaignId={campaignId} scene={scene} onDeleted={onDeleted} />
    )

    await user.click(screen.getByRole('button', { name: 'Delete scene' }))
    expect(mocks.remove).not.toHaveBeenCalled()
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Delete scene?' })).getByRole('button', {
        name: 'Delete scene'
      })
    )

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1))
    expect(mocks.remove).toHaveBeenCalledWith({
      campaignId,
      sceneId: scene.id,
      expectedVersion: 4
    })
  })

  it('keeps the scene when the GM backs out or the delete is refused', async () => {
    mocks.remove.mockRejectedValue(new Error('Scene definition changed before deletion.'))
    const onDeleted = vi.fn()
    const user = userEvent.setup()
    renderWithAppProviders(
      <SceneDeleteAction campaignId={campaignId} scene={scene} onDeleted={onDeleted} />
    )

    await user.click(screen.getByRole('button', { name: 'Delete scene' }))
    await user.click(await screen.findByRole('button', { name: 'Keep it' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(mocks.remove).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Delete scene' }))
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Delete scene?' })).getByRole('button', {
        name: 'Delete scene'
      })
    )
    expect(await screen.findByText(/couldn’t be deleted/)).toBeInTheDocument()
    expect(onDeleted).not.toHaveBeenCalled()
  })
})
