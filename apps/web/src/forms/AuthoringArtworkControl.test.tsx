import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  mediaControl: vi.fn(),
  saveDraft: vi.fn(),
  useAuthoringForm: vi.fn()
}))

vi.mock('#app/components/MediaImage', () => ({
  MediaImageControl: (props: unknown) => {
    mocks.mediaControl(props)
    return null
  }
}))
vi.mock('#forms/layout/AuthoringFormContext', () => ({
  useAuthoringForm: mocks.useAuthoringForm
}))

import { AuthoringArtworkControl } from './AuthoringArtworkControl'

describe('AuthoringArtworkControl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useAuthoringForm.mockReturnValue({
      authoredSession: { domain: 'spell', subjectId: 'spell-id' },
      readOnly: false,
      saveDraft: mocks.saveDraft
    })
  })

  it('targets the current authored draft from the Basics image action', () => {
    render(<AuthoringArtworkControl />)

    expect(mocks.mediaControl).toHaveBeenCalledWith(
      expect.objectContaining({
        beforeChange: mocks.saveDraft,
        label: 'Add an image',
        mode: 'decorative',
        target: {
          attach: { type: 'AUTHORED_IMAGE', subjectKind: 'SPELL', subjectId: 'spell-id' },
          lookup: {
            type: 'AUTHORED_IMAGE',
            subjectKind: 'SPELL',
            subjectId: 'spell-id',
            scope: 'DRAFT'
          }
        }
      })
    )
  })
})
