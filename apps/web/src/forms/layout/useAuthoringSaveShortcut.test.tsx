import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthoringSaveShortcut } from './useAuthoringSaveShortcut'

const mocks = vi.hoisted(() => ({
  groupEditor: undefined as object | undefined,
  saveDraft: vi.fn()
}))

vi.mock('./AuthoringFormContext', () => ({
  useAuthoringActions: () => ({ saveDraft: mocks.saveDraft }),
  useAuthoringSession: () => ({ canSaveDraft: true, readOnly: false }),
  useAuthoringStagedEditor: () => ({ groupEditor: mocks.groupEditor })
}))
vi.mock('./useAuthoringFormStatus', () => ({
  useAuthoringFormStatus: () => ({ hasChanges: true, isSubmitting: false })
}))

function ShortcutProbe() {
  useAuthoringSaveShortcut()
  return null
}

describe('authoring save shortcut', () => {
  beforeEach(() => {
    mocks.saveDraft.mockReset()
    mocks.groupEditor = undefined
  })

  it('saves the current draft with Ctrl+S', () => {
    render(<ShortcutProbe />)

    fireEvent.keyDown(window, { ctrlKey: true, key: 's' })

    expect(mocks.saveDraft).toHaveBeenCalledOnce()
  })

  it('does not save while the staged editor owns uncommitted changes', () => {
    mocks.groupEditor = {}
    render(<ShortcutProbe />)

    fireEvent.keyDown(window, { ctrlKey: true, key: 's' })

    expect(mocks.saveDraft).not.toHaveBeenCalled()
  })
})
