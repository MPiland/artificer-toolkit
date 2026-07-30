import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthoringSaveShortcut } from './useAuthoringSaveShortcut'

const mocks = vi.hoisted(() => ({
  saveDraft: vi.fn(),
  useAuthoringForm: vi.fn()
}))

vi.mock('./AuthoringFormContext', () => ({
  useAuthoringForm: mocks.useAuthoringForm
}))

function ShortcutProbe() {
  useAuthoringSaveShortcut()
  return null
}

describe('authoring save shortcut', () => {
  beforeEach(() => {
    mocks.saveDraft.mockReset()
    mocks.useAuthoringForm.mockReturnValue({
      canSaveDraft: true,
      hasChanges: true,
      isSubmitting: false,
      readOnly: false,
      saveDraft: mocks.saveDraft,
      stagedEditorOpen: false
    })
  })

  it('saves the current draft with Ctrl+S', () => {
    render(<ShortcutProbe />)

    fireEvent.keyDown(window, { ctrlKey: true, key: 's' })

    expect(mocks.saveDraft).toHaveBeenCalledOnce()
  })

  it('does not save while the staged editor owns uncommitted changes', () => {
    mocks.useAuthoringForm.mockReturnValue({
      canSaveDraft: true,
      hasChanges: true,
      isSubmitting: false,
      readOnly: false,
      saveDraft: mocks.saveDraft,
      stagedEditorOpen: true
    })
    render(<ShortcutProbe />)

    fireEvent.keyDown(window, { ctrlKey: true, key: 's' })

    expect(mocks.saveDraft).not.toHaveBeenCalled()
  })
})
