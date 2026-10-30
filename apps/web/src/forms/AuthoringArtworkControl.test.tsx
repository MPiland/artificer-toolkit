import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  mediaControl: vi.fn(),
  saveDraft: vi.fn(),
  useAuthoringSession: vi.fn()
}))

vi.mock('#app/components/MediaImage', () => ({
  MediaImageControl: (props: unknown) => {
    mocks.mediaControl(props)
    return null
  }
}))
vi.mock('#forms/layout/AuthoringFormContext', () => ({
  useAuthoringActions: () => ({ saveDraft: mocks.saveDraft }),
  useAuthoringSession: mocks.useAuthoringSession
}))

import { AuthoringArtworkControl } from './AuthoringArtworkControl'

describe('AuthoringArtworkControl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useAuthoringSession.mockReturnValue({
      authoredSession: { domain: 'spell', subjectId: 'spell-id' },
      readOnly: false
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
