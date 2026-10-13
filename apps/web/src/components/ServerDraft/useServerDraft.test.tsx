import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useServerDraft } from './useServerDraft'

function setup(initial: { hp: number; notes: string }) {
  return renderHook(({ server }) => useServerDraft(server), { initialProps: { server: initial } })
}

describe('useServerDraft', () => {
  it('shows the server values until a field is edited', () => {
    const { result, rerender } = setup({ hp: 10, notes: '' })

    rerender({ server: { hp: 12, notes: 'Flanked' } })

    expect(result.current.values).toEqual({ hp: 12, notes: 'Flanked' })
    expect(result.current.conflicts).toEqual([])
  })

  it('keeps an edited field across an unrelated server change', () => {
    const { result, rerender } = setup({ hp: 10, notes: '' })

    act(() => result.current.setValue('hp', 4))
    rerender({ server: { hp: 10, notes: 'Flanked' } })

    expect(result.current.values).toEqual({ hp: 4, notes: 'Flanked' })
    expect(result.current.conflicts).toEqual([])
  })

  it('reports a conflict when the server changes the edited field, and keeps the edit', () => {
    const { result, rerender } = setup({ hp: 10, notes: '' })

    act(() => result.current.setValue('hp', 4))
    rerender({ server: { hp: 7, notes: '' } })

    expect(result.current.values.hp).toBe(4)
    expect(result.current.conflicts).toEqual(['hp'])
    expect(result.current.server.hp).toBe(7)
  })

  it('acceptLatest drops the edit; keepMine acknowledges the change and keeps it', () => {
    const { result, rerender } = setup({ hp: 10, notes: '' })
    act(() => result.current.setValue('hp', 4))
    rerender({ server: { hp: 7, notes: '' } })

    act(() => result.current.keepMine('hp'))
    expect(result.current.values.hp).toBe(4)
    expect(result.current.conflicts).toEqual([])

    rerender({ server: { hp: 9, notes: '' } })
    expect(result.current.conflicts).toEqual(['hp'])

    act(() => result.current.acceptLatest('hp'))
    expect(result.current.values.hp).toBe(9)
    expect(result.current.conflicts).toEqual([])
  })

  it('drops an edit once the server catches up, so later server changes show through', () => {
    const { result, rerender } = setup({ hp: 10, notes: '' })

    act(() => result.current.setValue('hp', 4))
    rerender({ server: { hp: 4, notes: '' } })
    rerender({ server: { hp: 2, notes: '' } })

    expect(result.current.values.hp).toBe(2)
    expect(result.current.conflicts).toEqual([])
  })

  it('replaces a committed edit with the value the server stored, without a conflict', () => {
    const { result, rerender } = setup({ hp: 10, notes: 'a' })

    act(() => result.current.setValue('notes', 'b '))
    act(() => result.current.markCommitted('notes'))
    expect(result.current.values.notes).toBe('b ')
    expect(result.current.conflicts).toEqual([])

    rerender({ server: { hp: 10, notes: 'b' } })

    expect(result.current.values.notes).toBe('b')
    expect(result.current.conflicts).toEqual([])

    rerender({ server: { hp: 10, notes: 'c' } })
    expect(result.current.values.notes).toBe('c')
  })

  it('treats a stored value that arrives before the commit is marked as no conflict', () => {
    const { result, rerender } = setup({ hp: 10, notes: 'a' })

    act(() => result.current.setValue('notes', 'b '))
    act(() => result.current.markCommitted('notes'))
    rerender({ server: { hp: 10, notes: 'b' } })
    act(() => result.current.markCommitted('notes'))

    expect(result.current.values.notes).toBe('b')
    expect(result.current.conflicts).toEqual([])
  })

  it('drops an edit typed back to the server value', () => {
    const { result, rerender } = setup({ hp: 10, notes: '' })

    act(() => result.current.setValue('hp', 4))
    act(() => result.current.setValue('hp', 10))
    rerender({ server: { hp: 3, notes: '' } })

    expect(result.current.values.hp).toBe(3)
  })
})
