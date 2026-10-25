import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResolvedNodeClearableForm } from '../node-map/nodeFormUtils'

const mocks = vi.hoisted(() => ({
  nativeQuery: vi.fn(),
  notification: vi.fn(),
  useConvex: vi.fn()
}))

vi.mock('convex/react', () => ({ useConvex: mocks.useConvex }))
vi.mock('@mantine/notifications', () => ({
  notifications: { show: mocks.notification }
}))
import { useStructuralChangeGuard } from './useStructuralChangeGuard'

function createForm(): ResolvedNodeClearableForm<Record<string, unknown>> {
  return {
    setFieldValue: vi.fn(),
    state: { values: { selectionMode: 'DIRECT' } }
  }
}

describe('useStructuralChangeGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useConvex.mockReturnValue({ query: mocks.nativeQuery })
  })

  it.each([
    'background',
    'class',
    'feat',
    'equipment',
    'race',
    'creature',
    'spell',
    'vehicle',
    'feature',
    'proficiencyGrant',
    'facetCondition'
  ] as const)('uses native normalization for %s', async (rootMapId) => {
    mocks.nativeQuery.mockResolvedValue({ clearedPaths: [], refusedPaths: [], values: {} })
    const commit = vi.fn()
    const form = createForm()
    const { result } = renderHook(() =>
      useStructuralChangeGuard({
        form,
        rootMapId,
        rootSystemId: 'system-5e',
        rootValues: form.state.values
      })
    )

    act(() => {
      result.current.request({
        commit,
        fieldName: 'selectionMode',
        label: 'Selection mode',
        nextValue: 'REQUIRES_SUBRACE'
      })
    })

    await waitFor(() => expect(commit).toHaveBeenCalledOnce())
    expect(mocks.nativeQuery).toHaveBeenCalledOnce()
    expect(mocks.nativeQuery.mock.calls[0]?.[1]).toEqual({
      mapId: rootMapId,
      systemId: 'system-5e',
      values: { selectionMode: 'REQUIRES_SUBRACE' }
    })
  })

  it('does not apply a Background edit when native normalization fails', async () => {
    mocks.nativeQuery.mockRejectedValue(new Error('offline'))
    const commit = vi.fn()
    const form = createForm()
    const { result } = renderHook(() =>
      useStructuralChangeGuard({
        form,
        rootMapId: 'background',
        rootSystemId: 'system-5e',
        rootValues: form.state.values
      })
    )

    act(() => {
      result.current.request({
        commit,
        fieldName: 'selectionMode',
        label: 'Selection mode',
        nextValue: 'REQUIRES_SUBRACE'
      })
    })

    await waitFor(() => expect(mocks.notification).toHaveBeenCalledOnce())
    expect(commit).not.toHaveBeenCalled()
    expect(form.setFieldValue).not.toHaveBeenCalled()
  })

  it('reports an unavailable native client without applying the change', async () => {
    mocks.useConvex.mockReturnValue(undefined)
    const commit = vi.fn()
    const form = createForm()
    const { result } = renderHook(() =>
      useStructuralChangeGuard({
        form,
        rootMapId: 'background',
        rootSystemId: 'system-5e',
        rootValues: form.state.values
      })
    )

    act(() => {
      result.current.request({
        commit,
        fieldName: 'selectionMode',
        label: 'Selection mode',
        nextValue: 'REQUIRES_SUBRACE'
      })
    })

    await waitFor(() => expect(mocks.notification).toHaveBeenCalledOnce())
    expect(commit).not.toHaveBeenCalled()
  })

  it('does not apply a malformed native normalization result', async () => {
    mocks.nativeQuery.mockResolvedValue({
      clearedPaths: 'not-a-path-list',
      values: {}
    })
    const commit = vi.fn()
    const form = createForm()
    const { result } = renderHook(() =>
      useStructuralChangeGuard({
        form,
        rootMapId: 'background',
        rootSystemId: 'system-5e',
        rootValues: form.state.values
      })
    )

    act(() => {
      result.current.request({
        commit,
        fieldName: 'selectionMode',
        label: 'Selection mode',
        nextValue: 'REQUIRES_SUBRACE'
      })
    })

    await waitFor(() => expect(mocks.notification).toHaveBeenCalledOnce())
    expect(commit).not.toHaveBeenCalled()
    expect(form.setFieldValue).not.toHaveBeenCalled()
  })

  it('does not apply a stale native result after the form changes', async () => {
    let resolveNormalization:
      | ((value: { clearedPaths: string[][]; refusedPaths: string[][]; values: object }) => void)
      | undefined
    mocks.nativeQuery.mockReturnValue(
      new Promise((resolve) => {
        resolveNormalization = resolve
      })
    )
    const commit = vi.fn()
    const form = createForm()
    const { result } = renderHook(() =>
      useStructuralChangeGuard({
        form,
        rootMapId: 'background',
        rootSystemId: 'system-5e',
        rootValues: form.state.values
      })
    )

    act(() => {
      result.current.request({
        commit,
        fieldName: 'selectionMode',
        label: 'Selection mode',
        nextValue: 'REQUIRES_SUBRACE'
      })
      form.state.values = { selectionMode: 'CHANGED_ELSEWHERE' }
      resolveNormalization?.({ clearedPaths: [['selectionMode']], refusedPaths: [], values: {} })
    })

    await waitFor(() => expect(mocks.notification).toHaveBeenCalledOnce())
    expect(commit).not.toHaveBeenCalled()
    expect(form.setFieldValue).not.toHaveBeenCalled()
  })

  it('does not apply child-map changes without a native client', async () => {
    mocks.useConvex.mockReturnValue(undefined)
    const commit = vi.fn()
    const form = createForm()
    const { result } = renderHook(() =>
      useStructuralChangeGuard({
        form,
        rootMapId: 'feature',
        rootSystemId: 'system-5e',
        rootValues: form.state.values
      })
    )

    act(() => {
      result.current.request({
        commit,
        fieldName: 'selectionMode',
        label: 'Selection mode',
        nextValue: 'REQUIRES_SUBRACE'
      })
    })

    await waitFor(() => expect(mocks.notification).toHaveBeenCalledOnce())
    expect(commit).not.toHaveBeenCalled()
    expect(mocks.nativeQuery).not.toHaveBeenCalled()
  })
})
