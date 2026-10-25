import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useDismissRollOnClick } from './useDismissRollOnClick'

describe('useDismissRollOnClick', () => {
  it('dismisses on the next document click while presenting', () => {
    const dismiss = vi.fn()
    renderHook(() => useDismissRollOnClick(true, dismiss))

    document.body.click()

    expect(dismiss).toHaveBeenCalledTimes(1)
  })

  it('ignores clicks when no roll is presented', () => {
    const dismiss = vi.fn()
    renderHook(() => useDismissRollOnClick(false, dismiss))

    document.body.click()

    expect(dismiss).not.toHaveBeenCalled()
  })

  it('stops listening once presentation ends', () => {
    const dismiss = vi.fn()
    const { rerender } = renderHook(
      ({ presenting }) => useDismissRollOnClick(presenting, dismiss),
      {
        initialProps: { presenting: true }
      }
    )

    rerender({ presenting: false })
    document.body.click()

    expect(dismiss).not.toHaveBeenCalled()
  })
})
