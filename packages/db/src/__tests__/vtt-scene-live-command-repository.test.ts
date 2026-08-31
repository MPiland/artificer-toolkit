import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(import.meta.dirname, '../repositories/vttScenes.ts'), 'utf8')

describe('VTT Scene live-command repository', () => {
  it('locks the complete live authorization context in session, lease, then Scene order', () => {
    expect(source).toContain('async lockLiveCommandContext')
    expect(source).toContain('INNER JOIN public.campaign_memberships AS membership')
    expect(source).toContain("membership.status = 'ACTIVE'")
    expect(source).toContain('INNER JOIN public.campaign_sessions AS session')
    expect(source).toContain("session.status = 'OPEN'")
    expect(source).toContain(
      'INNER JOIN public.campaign_session_scene_presentations AS presentation'
    )
    expect(source).toContain('presentation.scene_id = scene.id')
    expect(source).toContain('FROM public.campaign_sessions')
    expect(source).toContain('WHERE id = ${input.sessionId}')
    expect(source).toContain('FROM public.live_session_command_leases')
    expect(source).toContain('authority_id = ${input.authorityId}')
    expect(source).toContain('expires_at > now()')
    expect(source).toContain("campaign.status = 'ACTIVE'")
    expect(source).toContain('FOR UPDATE OF scene, presentation')

    const sessionLock = source.indexOf('WHERE id = ${input.sessionId}')
    const leaseLock = source.indexOf('authority_id = ${input.authorityId}')
    const sceneLock = source.indexOf('FOR UPDATE OF scene, presentation')
    expect(sessionLock).toBeGreaterThan(-1)
    expect(leaseLock).toBeGreaterThan(sessionLock)
    expect(sceneLock).toBeGreaterThan(leaseLock)
  })

  it('publishes the event and projection through one dependent CTE', () => {
    expect(source).toContain('async publishLiveCommand')
    expect(source).toContain('WITH updated_scene AS')
    expect(source).toContain('), appended_event AS')
    expect(source).toContain('FROM updated_scene')
    expect(source).toContain('INNER JOIN updated_scene ON true')
  })
})
