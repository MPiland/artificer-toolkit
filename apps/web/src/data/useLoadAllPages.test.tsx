import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useLoadAllPages } from './useLoadAllPages'

type Status = Parameters<typeof useLoadAllPages>[0]['status']

function render(status: Status, loadMore = vi.fn()) {
  const view = renderHook(
    (props: { status: Status }) => useLoadAllPages({ status: props.status, loadMore }, 48),
    { initialProps: { status } }
  )
  return { ...view, loadMore }
}

describe('useLoadAllPages', () => {
  it('asks for the next page while more can load', () => {
    const { loadMore } = render('CanLoadMore')
    expect(loadMore).toHaveBeenCalledExactlyOnceWith(48)
  })

  it('keeps asking until the last page, then stops', () => {
    const { rerender, loadMore } = render('CanLoadMore')
    rerender({ status: 'LoadingMore' })
    rerender({ status: 'CanLoadMore' })
    expect(loadMore).toHaveBeenCalledTimes(2)
    rerender({ status: 'Exhausted' })
    expect(loadMore).toHaveBeenCalledTimes(2)
  })

  it('does not ask while disabled, even if a page could load', () => {
    const loadMore = vi.fn()
    renderHook(() => useLoadAllPages({ status: 'CanLoadMore', loadMore }, 48, false))
    expect(loadMore).not.toHaveBeenCalled()
  })

  it.each(['LoadingFirstPage', 'LoadingMore', 'Exhausted'] as const)(
    'does not ask while %s',
    (status) => {
      expect(render(status).loadMore).not.toHaveBeenCalled()
    }
  )
})
