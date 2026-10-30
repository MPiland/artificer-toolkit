import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { describe, expect, it, vi } from 'vitest'
import { GuidedAuthoringFrame } from '../guided/GuidedAuthoringFrame'
import { useAuthoringExperience } from './useAuthoringExperience'

const mocks = vi.hoisted(() => ({
  user: { authoringExperience: 'advanced' },
  convex: { mutation: vi.fn() },
  router: { invalidate: vi.fn().mockResolvedValue(undefined) }
}))

vi.mock('convex/react', () => ({ useConvex: () => mocks.convex }))
vi.mock('@tanstack/react-router', () => ({
  useMatch: () => mocks.user,
  useRouter: () => mocks.router
}))
vi.mock('./AuthoringFormContext', () => ({
  useAuthoringActions: () => ({ cancel: vi.fn() }),
  useAuthoringSession: () => ({})
}))

function ModeSwitch() {
  const { experience, isUpdating, setExperience } = useAuthoringExperience()
  return experience === 'advanced' ? (
    <button disabled={isUpdating} onClick={() => void setExperience('guided')}>
      Use guided authoring
    </button>
  ) : (
    <GuidedAuthoringFrame
      description='Start your spell.'
      domainLabel='Spell'
      onAdvanced={isUpdating ? undefined : () => void setExperience('advanced')}
      title='Basics'
    >
      Guided content
    </GuidedAuthoringFrame>
  )
}

describe('authoring preference switch', () => {
  it('keeps the Guided switch unavailable until the pending preference save finishes', async () => {
    const user = userEvent.setup()
    let finishSave: () => void = () => undefined
    const pendingSave = new Promise<void>((resolve) => {
      finishSave = resolve
    })
    mocks.convex.mutation.mockReturnValueOnce(pendingSave).mockResolvedValue(undefined)
    render(
      <MantineProvider env='test'>
        <ModeSwitch />
      </MantineProvider>
    )

    try {
      await user.click(screen.getByRole('button', { name: 'Use guided authoring' }))
      const advanced = screen.getByRole('button', { name: 'Switch to advanced' })
      expect(advanced).toBeDisabled()
      await user.click(advanced)
      expect(mocks.convex.mutation).toHaveBeenCalledTimes(1)
      expect(mocks.convex.mutation).toHaveBeenLastCalledWith(expect.anything(), {
        experience: 'guided'
      })
    } finally {
      await act(async () => {
        finishSave()
        await pendingSave
      })
    }

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Switch to advanced' })).toBeEnabled()
    )
    await user.click(screen.getByRole('button', { name: 'Switch to advanced' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Use guided authoring' })).toBeEnabled()
    )
    expect(mocks.convex.mutation).toHaveBeenCalledTimes(2)
    expect(mocks.convex.mutation).toHaveBeenLastCalledWith(expect.anything(), {
      experience: 'advanced'
    })
  })
})
