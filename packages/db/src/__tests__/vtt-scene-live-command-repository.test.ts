import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(import.meta.dirname, '../repositories/vttScenes.ts'), 'utf8')

describe('VTT Scene live-command repository', () => {
  it('locks the complete live authorization context before returning a Scene projection', () => {
    expect(source).toContain('async lockLiveCommandContext')
    expect(source).toContain('INNER JOIN public.campaign_memberships AS membership')
    expect(source).toContain("membership.status = 'ACTIVE'")
    expect(source).toContain('INNER JOIN public.campaign_sessions AS session')
    expect(source).toContain("session.status = 'OPEN'")
    expect(source).toContain('INNER JOIN public.live_session_command_leases AS lease')
    expect(source).toContain('lease.expires_at > now()')
    expect(source).toContain("campaign.status = 'ACTIVE'")
    expect(source).toContain('FOR UPDATE OF scene, session, lease')
    expect(source).toContain('FOR SHARE OF campaign, membership')
  })

  it('publishes the event and projection through one dependent CTE', () => {
    expect(source).toContain('async publishLiveCommand')
    expect(source).toContain('WITH updated_scene AS')
    expect(source).toContain('), appended_event AS')
    expect(source).toContain('FROM updated_scene')
    expect(source).toContain('INNER JOIN updated_scene ON true')
  })
})
