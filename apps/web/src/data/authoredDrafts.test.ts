import { z } from 'zod'
import type { AuthoredDraftDto } from '@artificer-toolkit/schema/api/content'
import { parseAuthoredDraftPayload } from './authoredDrafts'

const draftBase = {
  subjectKind: 'SPELL',
  subjectId: 'spell-1',
  publicId: '1',
  userId: 'user-1',
  systemId: 'system-1',
  label: 'Fire Lace',
  status: 'DRAFT',
  draftState: 'ACTIVE_WITH_DRAFT',
  baseActiveUpdatedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
} satisfies Omit<AuthoredDraftDto, 'payload'>

describe('parseAuthoredDraftPayload', () => {
  it('returns parsed draft data when the payload matches the schema', () => {
    const parsed = parseAuthoredDraftPayload(
      {
        ...draftBase,
        payload: {
          id: 'spell-1',
          label: 'Fire Lace'
        }
      },
      z.object({
        id: z.string(),
        label: z.string()
      })
    )

    expect(parsed).toMatchObject({
      isInvalid: false,
      item: {
        id: 'spell-1',
        label: 'Fire Lace'
      }
    })
  })

  it('marks malformed draft payloads invalid instead of throwing', () => {
    const parsed = parseAuthoredDraftPayload(
      {
        ...draftBase,
        payload: {
          id: 'spell-1'
        }
      },
      z.object({
        id: z.string(),
        label: z.string()
      })
    )

    expect(parsed).toMatchObject({
      isInvalid: true,
      item: undefined
    })
  })

  it('treats a missing draft as absent, not invalid', () => {
    expect(parseAuthoredDraftPayload(null, z.object({ id: z.string() }))).toEqual({
      draft: null,
      item: undefined,
      isInvalid: false
    })
  })
})
