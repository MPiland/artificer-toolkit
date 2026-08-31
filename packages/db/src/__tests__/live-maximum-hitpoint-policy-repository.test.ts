import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
  join(process.cwd(), 'packages/db/src/repositories/liveMaximumHitPointPolicy.ts'),
  'utf8'
)

describe('live maximum-hit-point policy repository', () => {
  it('uses one dependent context query with Campaign, assignment, Character, then HP locks', () => {
    const lockContext = source.slice(source.indexOf('async lockContext('))
    const campaign = lockContext.indexOf('active_campaign as materialized')
    const assignment = lockContext.indexOf('assignment as materialized')
    const character = lockContext.indexOf('character_lock as materialized')
    const hitPoints = lockContext.indexOf('hit_points as materialized')
    expect(campaign).toBeGreaterThan(-1)
    expect(assignment).toBeGreaterThan(campaign)
    expect(character).toBeGreaterThan(assignment)
    expect(hitPoints).toBeGreaterThan(character)
    const mainContextQuery = lockContext.slice(
      lockContext.indexOf('const result = await sql<LockContextRow>'),
      lockContext.indexOf('const row = result.rows[0]')
    )
    expect(mainContextQuery.match(/\.execute\(db\)/g) ?? []).toHaveLength(1)
    expect(lockContext).toContain('for share')
    expect(lockContext).toContain('for update')
    expect(lockContext).toContain("and session.status = 'OPEN'")
    expect(lockContext).toContain('and attendance.present = true')
    expect(lockContext).toContain('and lease.expires_at > now()')
    expect(lockContext).toContain('for share of membership, session, attendance, lease')
    expect(lockContext).toContain('overlay.projection_checksum as overlay_projection_checksum')
    expect(lockContext).toContain(
      'overlay.projection_schema_version as overlay_projection_schema_version'
    )
    expect(lockContext).toContain('projection.initiative_actor_facts')
    expect(lockContext).toContain('projection.pinned_sense_definitions')
    expect(lockContext).toContain('const overlay = parseOverlay({')
    expect(lockContext).not.toContain('base.*, overlay.*')
    expect(lockContext).toContain('expectedStreamVersion: number')
    expect(lockContext).toContain(
      'priorEvent === null && row.character_stream_version !== input.expectedStreamVersion'
    )
    expect(lockContext).toContain('const receipt = await sql<{ event_data: Json }>')
    expect(lockContext).toContain(
      'where character_id = ${input.characterId} and command_id = ${input.commandId}'
    )
  })

  it('prepares and commits dependent CAS projections without a forgeable projection input', () => {
    const commit = source.slice(
      source.indexOf('async prepareAndCommit('),
      source.indexOf('async lockContext(')
    )
    expect(commit).toContain('with adjustment as')
    expect(commit).toContain('hit_points as')
    expect(commit).toContain('campaign_overlay as')
    expect(commit).toContain('update public.character_mechanics_projections set')
    expect(commit).toContain('update public.campaign_character_mechanics_projections set')
    expect(commit).not.toContain('insert into public.character_mechanics_projections')
    expect(commit).not.toContain('insert into public.campaign_character_mechanics_projections')
    expect(commit).toContain('authored_version_vector =')
    expect(commit).toContain('bounded_registry =')
    expect(commit).toContain('nextCharacterCommandState')
    expect(commit).toContain('nextBasePolicy')
    expect(commit).toContain('nextCampaignPolicy')
    expect(commit).toContain('nextManualMaximumModifierOwner')
    expect(commit).toContain(
      'checksumCharacterMechanicsCommandState(\n        input.nextCharacterCommandState'
    )
    expect(commit).toContain('checksumCharacterMechanicsCommandLane(mechanicsCandidate)')
    expect(commit).toContain('checksumCharacterMechanicsProjection(parsedMechanics)')
    expect(commit).toContain('checksumCampaignCharacterMechanicsProjection(parsedOverlay)')
    expect(commit).not.toContain('nextMechanics')
    expect(commit).not.toContain('nextOverlay')
    expect(commit).toContain('on conflict (character_id, command_id) do nothing')
  })
})
