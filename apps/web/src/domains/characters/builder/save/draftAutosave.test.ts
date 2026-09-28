import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthoringDraftSaveStatus } from '#forms/layout/AuthoringFormContext'
import { createDraftAutosave } from './draftAutosave'

function setup(save = vi.fn(async (_value: string) => {})) {
  const statuses: AuthoringDraftSaveStatus[] = []
  const autosave = createDraftAutosave({ save, onStatus: (status) => statuses.push(status) })
  return { autosave, save, statuses }
}

describe('draft autosave', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('saves the latest value after 2 s without changes', async () => {
    const { autosave, save, statuses } = setup()
    autosave.change('a')
    await vi.advanceTimersByTimeAsync(1_500)
    autosave.change('ab')
    await vi.advanceTimersByTimeAsync(1_999)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenLastCalledWith('ab')
    expect(statuses).toEqual(['pending', 'saving', 'saved'])
  })

  it('saves at most every 10 s', async () => {
    const { autosave, save } = setup()
    autosave.change('a')
    await vi.advanceTimersByTimeAsync(2_000)
    expect(save).toHaveBeenCalledTimes(1)
    autosave.change('b')
    await vi.advanceTimersByTimeAsync(2_000)
    // Idle, but only 4 s after the last save began.
    expect(save).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(7_999)
    expect(save).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith('b')
  })

  it('flushes immediately, ignoring the idle and rate limits, and only when something is unsaved', async () => {
    const { autosave, save } = setup()
    await autosave.flush()
    expect(save).not.toHaveBeenCalled()
    autosave.change('a')
    await autosave.flush()
    expect(save).toHaveBeenCalledTimes(1)
    autosave.change('b')
    await autosave.flush()
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith('b')
    // Nothing is left for the timer.
    await vi.advanceTimersByTimeAsync(30_000)
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('never runs two saves at once, and saves changes made during a save afterwards', async () => {
    let finish: () => void = () => {}
    const save = vi.fn(
      (_value: string) =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    const { autosave } = setup(save)
    autosave.change('a')
    const first = autosave.flush()
    autosave.change('b')
    const second = autosave.flush()
    expect(save).toHaveBeenCalledTimes(1)
    finish()
    await first
    await vi.advanceTimersByTimeAsync(0)
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith('b')
    finish()
    await second
  })

  it('retries a failed save with backoff and reports it', async () => {
    const save = vi
      .fn(async (_value: string) => {})
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
    const { autosave, statuses } = setup(save)
    autosave.change('a')
    await autosave.flush()
    expect(statuses.at(-1)).toBe('retrying')
    await vi.advanceTimersByTimeAsync(1_999)
    expect(save).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(2)
    expect(statuses.at(-1)).toBe('retrying')
    // The delay doubles.
    await vi.advanceTimersByTimeAsync(3_999)
    expect(save).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(3)
    expect(save).toHaveBeenLastCalledWith('a')
    expect(statuses.at(-1)).toBe('saved')
  })

  it('stops after cancel, and a disposed autosave saves nothing further', async () => {
    const { autosave, save } = setup()
    autosave.change('a')
    autosave.cancel()
    await vi.advanceTimersByTimeAsync(30_000)
    await autosave.flush()
    expect(save).not.toHaveBeenCalled()
  })
})
