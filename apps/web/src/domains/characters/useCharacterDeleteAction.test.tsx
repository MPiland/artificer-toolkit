import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { getFunctionName } from 'convex/server'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { useCharacterDeleteAction } from './useCharacterDeleteAction'

const characterId = '00000000-0000-4000-8000-000000000301'

function DeleteHarness({ onDeleted }: { onDeleted: () => void }) {
  const deleteAction = useCharacterDeleteAction(onDeleted)
  return (
    <>
      <button
        type='button'
        onClick={() => deleteAction.requestDelete({ id: characterId, label: 'Aria Stormwind' })}
      >
        Delete
      </button>
      {deleteAction.confirmation}
    </>
  )
}

function renderHarness(client: ConvexReactClient, onDeleted = vi.fn()) {
  renderWithAppProviders(
    <ConvexProvider client={client}>
      <DeleteHarness onDeleted={onDeleted} />
    </ConvexProvider>
  )
  return onDeleted
}

describe('useCharacterDeleteAction', () => {
  it('names the Character, deletes nothing on cancel, and deletes permanently on confirm', async () => {
    const user = userEvent.setup()
    const client = new ConvexReactClient('https://character-delete-test.convex.cloud')
    const mutation = vi.spyOn(client, 'mutation').mockResolvedValue({ ok: true as const })
    const onDeleted = renderHarness(client)

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText(/Delete Aria Stormwind\?/)).toBeInTheDocument()
    expect(screen.getByText(/cannot be restored/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mutation).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(onDeleted).toHaveBeenCalled())
    expect(mutation).toHaveBeenCalledTimes(1)
    expect(mutation.mock.calls[0]?.[1]).toEqual({ id: characterId })
    expect(getFunctionName(mutation.mock.calls[0]![0])).toBe(
      getFunctionName(convexApi.characters.deletion.remove)
    )
  })
})
