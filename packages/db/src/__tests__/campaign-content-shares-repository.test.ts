import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const repositorySource = readFileSync(
  resolve(import.meta.dirname, '../repositories/campaignContentShares.ts'),
  'utf8'
)
const tableSource = readFileSync(
  resolve(import.meta.dirname, '../domains/campaigns/tables/campaigns.sql'),
  'utf8'
)

describe('Campaign content share repository', () => {
  it('stores one live root share without replacing its author', () => {
    expect(repositorySource).toContain('insert into public.campaign_content_shares')
    expect(repositorySource).toContain(
      'on conflict (campaign_id, subject_kind, subject_id) do nothing'
    )
    expect(repositorySource).toContain('existing.sharedBy !== input.sharedBy')
    expect(repositorySource).not.toContain('campaign_content_versions')
    expect(repositorySource).not.toContain('campaign_character_content_bindings')
  })

  it('loads only shares whose author remains an active member and owns the current root', () => {
    const start = repositorySource.indexOf('async listCurrentSources(')
    const end = repositorySource.indexOf('async findShare(', start)
    const method = repositorySource.slice(start, end)

    expect(method).toContain('join public.campaign_memberships membership')
    expect(method).toContain("membership.status = 'ACTIVE'")
    expect(method).toContain('authoredContent.findActiveBySubjects')
    expect(method).toContain('authoredVersions.findActiveByIds')
    expect(method).toContain('root.isMaster')
    expect(method).toContain('root.ownerUserId !== share.sharedBy')
  })

  it('locks a content reader in Campaign then active membership order', () => {
    const start = repositorySource.indexOf('async lockCampaignMemberForContentRead(')
    const end = repositorySource.indexOf('async listShares(', start)
    const method = repositorySource.slice(start, end)
    const campaignLock = method.indexOf('from public.campaigns')
    const membershipLock = method.indexOf('from public.campaign_memberships')

    expect(campaignLock).toBeGreaterThan(-1)
    expect(membershipLock).toBeGreaterThan(campaignLock)
    expect(method.slice(campaignLock, membershipLock)).toContain('for share')
    expect(method.slice(membershipLock)).toContain("status = 'ACTIVE'")
    expect(method.slice(membershipLock)).toContain('for share')
  })

  it('locks share use in Campaign, share, membership, and exact-version order', () => {
    const start = repositorySource.indexOf('async lockSharesForUse(')
    const end = repositorySource.indexOf('async lockShareAuthorizationsForUse(', start)
    const method = repositorySource.slice(start, end)
    const campaignLock = method.indexOf('from public.campaigns')
    const shareLock = method.indexOf('from public.campaign_content_shares')
    const membershipLock = method.indexOf('from public.campaign_memberships')
    const rootLock = method.indexOf('lockExactAuthoredRootVersion')

    expect(campaignLock).toBeGreaterThan(-1)
    expect(shareLock).toBeGreaterThan(campaignLock)
    expect(membershipLock).toBeGreaterThan(shareLock)
    expect(rootLock).toBeGreaterThan(membershipLock)
    expect(method.slice(campaignLock, shareLock)).toContain('for share')
    expect(method.slice(shareLock, membershipLock)).toContain('for key share')
    expect(method.slice(membershipLock, rootLock)).toContain('for share')
    expect(method.slice(membershipLock, rootLock)).not.toContain('for key share')
  })

  it('validates exact pinned identity without requiring the active pointer and sorts roots', () => {
    const start = repositorySource.indexOf('async lockSharesForUse(')
    const end = repositorySource.indexOf('async lockShareAuthorizationsForUse(', start)
    const method = repositorySource.slice(start, end)

    expect(method.indexOf('sortUseExpectations(input.shares)')).toBeLessThan(
      method.indexOf('for (const share of shares)')
    )
    expect(method).not.toContain('root.active_version_id !== share.versionId')
    expect(method).toContain('root.version !== share.version')
    expect(method).toContain('root.authored_checksum !== share.checksum')
    const helperStart = repositorySource.indexOf('async function lockExactAuthoredRootVersion(')
    const helperEnd = repositorySource.indexOf(
      'export function createCampaignContentShareRepository',
      helperStart
    )
    const helper = repositorySource.slice(helperStart, helperEnd)
    expect(helper).toContain('version.id = ${input.versionId}::uuid')
    expect(helper).toContain("root.status = 'ACTIVE'")
    expect(helper).toContain('order by root.id, version.id')
    expect(helper).toContain('for key share of root')
    expect(helper).toContain('for share of version')
    expect(helper).not.toContain('root.active_version_id')
  })

  it('locks new-source Campaign authorization before the Character without locking authored roots', () => {
    const start = repositorySource.indexOf('async lockShareAuthorizationsForUse(')
    const end = repositorySource.indexOf('async lockSharesForRemoval(', start)
    const method = repositorySource.slice(start, end)
    const campaignLock = method.indexOf('from public.campaigns')
    const shareLock = method.indexOf('from public.campaign_content_shares')
    const membershipLock = method.indexOf('from public.campaign_memberships')

    expect(campaignLock).toBeGreaterThan(-1)
    expect(shareLock).toBeGreaterThan(campaignLock)
    expect(membershipLock).toBeGreaterThan(shareLock)
    expect(method.slice(campaignLock, shareLock)).toContain('for share')
    expect(method.slice(shareLock, membershipLock)).toContain('for key share')
    expect(method.slice(membershipLock)).toContain('for share')
    expect(method).not.toContain('lockExactAuthoredRootVersion')
    expect(method).not.toContain('lockCurrentAuthoredRoot')
  })

  it('locks only exact removal rows deterministically and deletes by expected author', () => {
    const start = repositorySource.indexOf('async lockSharesForRemoval(')
    const end = repositorySource.indexOf('async unshareRootExpectingAuthor(', start)
    const lockMethod = repositorySource.slice(start, end)
    const deleteStart = end
    const deleteEnd = repositorySource.indexOf('async shareRoot(', deleteStart)
    const deleteMethod = repositorySource.slice(deleteStart, deleteEnd)

    expect(lockMethod).toContain('sortRemovalExpectations(input.shares)')
    expect(lockMethod).toContain('campaign_id = ${input.campaignId}::uuid')
    expect(lockMethod).toContain('(subject_kind, subject_id) in')
    expect(lockMethod).toContain('order by subject_kind, subject_id')
    expect(lockMethod).toContain('for update')
    expect(deleteMethod).toContain(".where('campaign_id', '=', input.campaignId)")
    expect(deleteMethod).toContain(".where('subject_kind', '=', input.subjectKind)")
    expect(deleteMethod).toContain(".where('subject_id', '=', input.subjectId)")
    expect(deleteMethod).toContain(".where('shared_by', '=', input.sharedBy)")
  })

  it('discovers one root across Campaigns and locks activation shares without touching the root', () => {
    const listStart = repositorySource.indexOf('async listByRoot(')
    const listEnd = repositorySource.indexOf('async listCurrentSources(', listStart)
    const listMethod = repositorySource.slice(listStart, listEnd)
    const lockStart = repositorySource.indexOf('async lockSharesForActivation(')
    const lockEnd = repositorySource.indexOf('async shareRoot(', lockStart)
    const lockMethod = repositorySource.slice(lockStart, lockEnd)

    expect(listMethod).toContain('where subject_kind = ${input.subjectKind}')
    expect(listMethod).toContain('and subject_id = ${input.subjectId}::uuid')
    expect(listMethod).toContain('order by campaign_id, subject_kind, subject_id')
    expect(lockMethod).toContain(
      '`${left.campaignId}:${left.subjectKind}:${left.subjectId}`.localeCompare('
    )
    expect(lockMethod).toContain('(campaign_id, subject_kind, subject_id) in')
    expect(lockMethod).toContain('order by campaign_id, subject_kind, subject_id')
    expect(lockMethod).toContain('for key share')
    expect(lockMethod).not.toContain('lockCurrentAuthoredRoot')
  })

  it('keeps the share table server-owned under forced RLS', () => {
    expect(tableSource).toContain(
      'ALTER TABLE public.campaign_content_shares ENABLE ROW LEVEL SECURITY'
    )
    expect(tableSource).toContain(
      'ALTER TABLE public.campaign_content_shares FORCE ROW LEVEL SECURITY'
    )
    expect(tableSource).toContain(
      'REVOKE ALL ON TABLE public.campaign_content_shares FROM anon, authenticated'
    )
  })
})
