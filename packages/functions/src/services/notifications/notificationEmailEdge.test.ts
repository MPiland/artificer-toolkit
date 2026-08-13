import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const source = await readFile(
  new URL('../../../../../supabase/functions/_shared/notification-email.ts', import.meta.url),
  'utf8'
)

describe('notification Edge email', () => {
  it('links Campaign announcements to the implemented Campaign route', () => {
    expect(source).toContain(
      '`/campaigns/${encodeURIComponent(payload.campaignPublicId)}?tab=announcements&announcementPublicId=${encodeURIComponent(payload.announcementPublicId)}`'
    )
    expect(source).not.toContain('/announcements/${payload.announcementPublicId}')
  })
})
