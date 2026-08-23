import type { AuthoredSubjectKind } from '../domains/subjects/repositories/authoredContent.js'
import { createAuthoredContentRepository } from '../domains/subjects/repositories/authoredContent.js'
import {
  createAuthoredVersionRepository,
  type AuthoredVersionRecord
} from '../domains/subjects/repositories/authoredVersion.js'
import { sql } from 'kysely'
import type { DBLike } from '#types'

type Timestamp = Date | string

const rootTableByKind: Record<AuthoredSubjectKind, string> = {
  BACKGROUND: 'public.backgrounds',
  CLASS: 'public.classes',
  CREATURE: 'public.creatures',
  EQUIPMENT: 'public.equipment',
  FEAT: 'public.feats',
  RACE: 'public.races',
  SPELL: 'public.spells',
  VEHICLE: 'public.vehicles'
}

const versionTableByKind: Record<AuthoredSubjectKind, string> = {
  BACKGROUND: 'public.background_versions',
  CLASS: 'public.class_versions',
  CREATURE: 'public.creature_versions',
  EQUIPMENT: 'public.equipment_versions',
  FEAT: 'public.feat_versions',
  RACE: 'public.race_versions',
  SPELL: 'public.spell_versions',
  VEHICLE: 'public.vehicle_versions'
}

const versionRootIdColumnByKind: Record<AuthoredSubjectKind, string> = {
  BACKGROUND: 'background_id',
  CLASS: 'class_id',
  CREATURE: 'creature_id',
  EQUIPMENT: 'equipment_id',
  FEAT: 'feat_id',
  RACE: 'race_id',
  SPELL: 'spell_id',
  VEHICLE: 'vehicle_id'
}

export interface CampaignContentShare {
  campaignId: string
  subjectKind: AuthoredSubjectKind
  subjectId: string
  sharedBy: string
  createdAt: string
  updatedAt: string
}

export interface CampaignContentShareCurrentSource {
  share: CampaignContentShare
  source: AuthoredVersionRecord
}

export interface CampaignContentShareUseExpectation {
  subjectKind: AuthoredSubjectKind
  subjectId: string
  sharedBy: string
  versionId: string
  version: number
  checksum: string
}

export interface CampaignContentShareUseLockResult {
  locked: CampaignContentShare[]
  missing: CampaignContentShareUseExpectation[]
}

export interface CampaignContentShareRemovalExpectation {
  subjectKind: AuthoredSubjectKind
  subjectId: string
  sharedBy: string
}

export interface CampaignContentShareRemovalLockResult {
  locked: CampaignContentShare[]
  missing: CampaignContentShareRemovalExpectation[]
}

export interface CampaignContentShareActivationLockResult {
  locked: CampaignContentShare[]
  missing: CampaignContentShare[]
}

export interface CampaignContentCurrentRoot {
  isMaster: boolean
  ownerUserId: string | null
  identity: Omit<CampaignContentShareUseExpectation, 'sharedBy'>
}

interface ShareRow {
  campaign_id: string
  subject_kind: string
  subject_id: string
  shared_by: string
  created_at: Timestamp
  updated_at: Timestamp
}

interface CurrentRootRow {
  active_version_id: string
  authored_checksum: string
  is_master: boolean
  user_id: string | null
  version: number
}

interface ExactRootVersionRow {
  authored_checksum: string
  is_master: boolean
  user_id: string | null
  version: number
}

function toIsoString(value: Timestamp): string {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid database timestamp "${value}".`)
  return date.toISOString()
}

function toShare(row: ShareRow): CampaignContentShare {
  return {
    campaignId: row.campaign_id,
    subjectKind: row.subject_kind as AuthoredSubjectKind,
    subjectId: row.subject_id,
    sharedBy: row.shared_by,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  }
}

function sortUseExpectations(
  shares: ReadonlyArray<CampaignContentShareUseExpectation>
): CampaignContentShareUseExpectation[] {
  const unique = new Map<string, CampaignContentShareUseExpectation>()
  for (const share of shares) {
    const key = `${share.subjectKind}:${share.subjectId}`
    const existing = unique.get(key)
    if (existing && JSON.stringify(existing) !== JSON.stringify(share)) {
      throw new Error(`Campaign content share "${key}" has conflicting use expectations.`)
    }
    unique.set(key, share)
  }
  return [...unique.values()].sort((left, right) =>
    `${left.subjectKind}:${left.subjectId}`.localeCompare(`${right.subjectKind}:${right.subjectId}`)
  )
}

function sortRemovalExpectations(
  shares: ReadonlyArray<CampaignContentShareRemovalExpectation>
): CampaignContentShareRemovalExpectation[] {
  const unique = new Map<string, CampaignContentShareRemovalExpectation>()
  for (const share of shares) {
    const key = `${share.subjectKind}:${share.subjectId}`
    const existing = unique.get(key)
    if (existing && existing.sharedBy !== share.sharedBy) {
      throw new Error(`Campaign content share "${key}" has conflicting removal expectations.`)
    }
    unique.set(key, share)
  }
  return [...unique.values()].sort((left, right) =>
    `${left.subjectKind}:${left.subjectId}`.localeCompare(`${right.subjectKind}:${right.subjectId}`)
  )
}

async function lockCurrentAuthoredRoot(
  db: DBLike,
  input: { subjectKind: AuthoredSubjectKind; subjectId: string }
): Promise<CurrentRootRow | null> {
  const result = await sql<CurrentRootRow>`
    select
      root.active_version_id,
      version.authored_checksum,
      coalesce(root.is_master, false) as is_master,
      root.user_id,
      version.version
    from ${sql.table(rootTableByKind[input.subjectKind])} root
    join ${sql.table(versionTableByKind[input.subjectKind])} version
      on version.id = root.active_version_id
    where root.id = ${input.subjectId}::uuid
      and root.status = 'ACTIVE'
    order by root.id, version.id
    for share of root, version
  `.execute(db)
  return result.rows[0] ?? null
}

async function lockExactAuthoredRootVersion(
  db: DBLike,
  input: Pick<CampaignContentShareUseExpectation, 'subjectId' | 'subjectKind' | 'versionId'>
): Promise<ExactRootVersionRow | null> {
  const rootIdColumn = versionRootIdColumnByKind[input.subjectKind]
  const result = await sql<ExactRootVersionRow>`
    select
      version.authored_checksum,
      coalesce(root.is_master, false) as is_master,
      root.user_id,
      version.version
    from ${sql.table(rootTableByKind[input.subjectKind])} root
    join ${sql.table(versionTableByKind[input.subjectKind])} version
      on ${sql.ref(rootIdColumn)} = root.id
      and version.id = ${input.versionId}::uuid
    where root.id = ${input.subjectId}::uuid
      and root.status = 'ACTIVE'
    order by root.id, version.id
    for key share of root
    for share of version
  `.execute(db)
  return result.rows[0] ?? null
}

export function createCampaignContentShareRepository(db: DBLike) {
  const authoredContent = createAuthoredContentRepository(db)
  const authoredVersions = createAuthoredVersionRepository(db)

  return {
    async lockCampaignMemberForContentRead(input: {
      campaignId: string
      userId: string
    }): Promise<{ campaignExists: boolean; memberActive: boolean }> {
      const campaign = await sql<{ id: string }>`
        select id
        from public.campaigns
        where id = ${input.campaignId}::uuid
        for share
      `.execute(db)
      if (!campaign.rows[0]) return { campaignExists: false, memberActive: false }

      const membership = await sql<{ user_id: string }>`
        select user_id
        from public.campaign_memberships
        where campaign_id = ${input.campaignId}::uuid
          and user_id = ${input.userId}::uuid
          and status = 'ACTIVE'
        for share
      `.execute(db)
      return { campaignExists: true, memberActive: membership.rows[0] !== undefined }
    },

    async listShares(campaignId: string): Promise<CampaignContentShare[]> {
      const result = await sql<ShareRow>`
        select share.campaign_id, share.subject_kind, share.subject_id, share.shared_by,
          share.created_at, share.updated_at
        from public.campaign_content_shares share
        where share.campaign_id = ${campaignId}::uuid
        order by share.created_at, share.subject_kind, share.subject_id
      `.execute(db)
      return result.rows.map(toShare)
    },

    async listByAuthor(input: {
      campaignId: string
      sharedBy: string
    }): Promise<CampaignContentShare[]> {
      const result = await sql<ShareRow>`
        select share.campaign_id, share.subject_kind, share.subject_id, share.shared_by,
          share.created_at, share.updated_at
        from public.campaign_content_shares share
        where share.campaign_id = ${input.campaignId}::uuid
          and share.shared_by = ${input.sharedBy}::uuid
        order by share.subject_kind, share.subject_id
      `.execute(db)
      return result.rows.map(toShare)
    },

    async listByRoot(input: {
      subjectKind: AuthoredSubjectKind
      subjectId: string
    }): Promise<CampaignContentShare[]> {
      const result = await sql<ShareRow>`
        select campaign_id, subject_kind, subject_id, shared_by, created_at, updated_at
        from public.campaign_content_shares
        where subject_kind = ${input.subjectKind}
          and subject_id = ${input.subjectId}::uuid
        order by campaign_id, subject_kind, subject_id
      `.execute(db)
      return result.rows.map(toShare)
    },

    async listCurrentSources(campaignId: string): Promise<CampaignContentShareCurrentSource[]> {
      const activeResult = await sql<ShareRow>`
        select share.campaign_id, share.subject_kind, share.subject_id, share.shared_by,
          share.created_at, share.updated_at
        from public.campaign_content_shares share
        join public.campaign_memberships membership
          on membership.campaign_id = share.campaign_id
          and membership.user_id = share.shared_by
          and membership.status = 'ACTIVE'
        where share.campaign_id = ${campaignId}::uuid
        order by share.subject_kind, share.subject_id, share.shared_by
      `.execute(db)
      const shares = activeResult.rows.map(toShare)
      const current: CampaignContentShareCurrentSource[] = []
      for (const subjectKind of [...new Set(shares.map((share) => share.subjectKind))].sort()) {
        const kindShares = shares.filter((share) => share.subjectKind === subjectKind)
        const subjectIds = kindShares.map((share) => share.subjectId)
        const [roots, versions] = await Promise.all([
          authoredContent.findActiveBySubjects({ subjectKind, subjectIds }),
          authoredVersions.findActiveByIds({ subjectKind, subjectIds })
        ])
        const rootsById = new Map(roots.map((root) => [root.subjectId, root]))
        for (const share of kindShares) {
          const root = rootsById.get(share.subjectId)
          const source = versions.get(share.subjectId)
          if (!root || !source || root.isMaster || root.ownerUserId !== share.sharedBy) continue
          current.push({ share, source })
        }
      }
      return current
    },

    async findShare(input: {
      campaignId: string
      subjectKind: AuthoredSubjectKind
      subjectId: string
    }): Promise<CampaignContentShare | null> {
      const result = await sql<ShareRow>`
        select campaign_id, subject_kind, subject_id, shared_by, created_at, updated_at
        from public.campaign_content_shares
        where campaign_id = ${input.campaignId}::uuid
          and subject_kind = ${input.subjectKind}
          and subject_id = ${input.subjectId}::uuid
      `.execute(db)
      return result.rows[0] ? toShare(result.rows[0]) : null
    },

    async hasShareForRoot(input: {
      subjectKind: AuthoredSubjectKind
      subjectId: string
    }): Promise<boolean> {
      const result = await sql<{ subject_id: string }>`
        select subject_id
        from public.campaign_content_shares
        where subject_kind = ${input.subjectKind}
          and subject_id = ${input.subjectId}::uuid
        limit 1
      `.execute(db)
      return result.rows[0] !== undefined
    },

    async lockOwnedCurrentRoot(input: {
      subjectKind: AuthoredSubjectKind
      subjectId: string
      ownerUserId: string
    }): Promise<CampaignContentShareUseExpectation | null> {
      const root = await lockCurrentAuthoredRoot(db, input)
      if (!root || root.is_master || root.user_id !== input.ownerUserId) return null
      return {
        subjectKind: input.subjectKind,
        subjectId: input.subjectId,
        sharedBy: input.ownerUserId,
        versionId: root.active_version_id,
        version: root.version,
        checksum: root.authored_checksum
      }
    },

    async lockCurrentRoot(input: {
      subjectKind: AuthoredSubjectKind
      subjectId: string
    }): Promise<CampaignContentCurrentRoot | null> {
      const root = await lockCurrentAuthoredRoot(db, input)
      if (!root) return null
      return {
        isMaster: root.is_master,
        ownerUserId: root.user_id,
        identity: {
          subjectKind: input.subjectKind,
          subjectId: input.subjectId,
          versionId: root.active_version_id,
          version: root.version,
          checksum: root.authored_checksum
        }
      }
    },

    async lockSharesForUse(input: {
      campaignId: string
      shares: ReadonlyArray<CampaignContentShareUseExpectation>
    }): Promise<CampaignContentShareUseLockResult> {
      const locked: CampaignContentShare[] = []
      const shares = sortUseExpectations(input.shares)
      const missing: CampaignContentShareUseExpectation[] = []
      const campaign = await sql<{ id: string }>`
        select id
        from public.campaigns
        where id = ${input.campaignId}::uuid
          and status = 'ACTIVE'
        for share
      `.execute(db)
      if (!campaign.rows[0]) return { locked, missing: shares }

      for (const share of shares) {
        const shareResult = await sql<ShareRow>`
          select campaign_id, subject_kind, subject_id, shared_by, created_at, updated_at
          from public.campaign_content_shares
          where campaign_id = ${input.campaignId}::uuid
            and subject_kind = ${share.subjectKind}
            and subject_id = ${share.subjectId}::uuid
          for key share
        `.execute(db)
        const row = shareResult.rows[0]
        if (!row || row.shared_by !== share.sharedBy) {
          missing.push(share)
          continue
        }
        const membership = await sql<{ user_id: string }>`
          select user_id
          from public.campaign_memberships
          where campaign_id = ${input.campaignId}::uuid
            and user_id = ${share.sharedBy}::uuid
            and status = 'ACTIVE'
          for share
        `.execute(db)
        const root = await lockExactAuthoredRootVersion(db, share)
        if (
          !membership.rows[0] ||
          !root ||
          root.is_master ||
          root.user_id !== share.sharedBy ||
          root.version !== share.version ||
          root.authored_checksum !== share.checksum
        ) {
          missing.push(share)
          continue
        }
        locked.push(toShare(row))
      }
      return { locked, missing }
    },

    async lockShareAuthorizationsForUse(input: {
      campaignId: string
      shares: ReadonlyArray<CampaignContentShareUseExpectation>
    }): Promise<CampaignContentShareUseLockResult> {
      const locked: CampaignContentShare[] = []
      const shares = sortUseExpectations(input.shares)
      const missing: CampaignContentShareUseExpectation[] = []
      const campaign = await sql<{ id: string }>`
        select id
        from public.campaigns
        where id = ${input.campaignId}::uuid
          and status = 'ACTIVE'
        for share
      `.execute(db)
      if (!campaign.rows[0]) return { locked, missing: shares }

      for (const share of shares) {
        const shareResult = await sql<ShareRow>`
          select campaign_id, subject_kind, subject_id, shared_by, created_at, updated_at
          from public.campaign_content_shares
          where campaign_id = ${input.campaignId}::uuid
            and subject_kind = ${share.subjectKind}
            and subject_id = ${share.subjectId}::uuid
          for key share
        `.execute(db)
        const row = shareResult.rows[0]
        if (!row || row.shared_by !== share.sharedBy) {
          missing.push(share)
          continue
        }
        const membership = await sql<{ user_id: string }>`
          select user_id
          from public.campaign_memberships
          where campaign_id = ${input.campaignId}::uuid
            and user_id = ${share.sharedBy}::uuid
            and status = 'ACTIVE'
          for share
        `.execute(db)
        if (!membership.rows[0]) {
          missing.push(share)
          continue
        }
        locked.push(toShare(row))
      }
      return { locked, missing }
    },

    async lockSharesForRemoval(input: {
      campaignId: string
      shares: ReadonlyArray<CampaignContentShareRemovalExpectation>
    }): Promise<CampaignContentShareRemovalLockResult> {
      const selected = sortRemovalExpectations(input.shares)
      if (selected.length === 0) return { locked: [], missing: [] }
      const result = await sql<ShareRow>`
        select campaign_id, subject_kind, subject_id, shared_by, created_at, updated_at
        from public.campaign_content_shares
        where campaign_id = ${input.campaignId}::uuid
          and (subject_kind, subject_id) in (
            ${sql.join(
              selected.map((share) => sql`(${share.subjectKind}, ${share.subjectId}::uuid)`)
            )}
          )
        order by subject_kind, subject_id
        for update
      `.execute(db)
      const rowsByKey = new Map(
        result.rows.map((row) => [`${row.subject_kind}:${row.subject_id}`, row])
      )
      const locked: CampaignContentShare[] = []
      const missing: CampaignContentShareRemovalExpectation[] = []
      for (const share of selected) {
        const row = rowsByKey.get(`${share.subjectKind}:${share.subjectId}`)
        if (!row || row.shared_by !== share.sharedBy) missing.push(share)
        else locked.push(toShare(row))
      }
      return { locked, missing }
    },

    async lockSharesForActivation(
      shares: ReadonlyArray<CampaignContentShare>
    ): Promise<CampaignContentShareActivationLockResult> {
      const selected = [...shares].sort((left, right) =>
        `${left.campaignId}:${left.subjectKind}:${left.subjectId}`.localeCompare(
          `${right.campaignId}:${right.subjectKind}:${right.subjectId}`
        )
      )
      if (selected.length === 0) return { locked: [], missing: [] }
      const result = await sql<ShareRow>`
        select campaign_id, subject_kind, subject_id, shared_by, created_at, updated_at
        from public.campaign_content_shares
        where (campaign_id, subject_kind, subject_id) in (
          ${sql.join(
            selected.map(
              (share) =>
                sql`(${share.campaignId}::uuid, ${share.subjectKind}, ${share.subjectId}::uuid)`
            )
          )}
        )
        order by campaign_id, subject_kind, subject_id
        for key share
      `.execute(db)
      const rowsByKey = new Map(
        result.rows.map((row) => [`${row.campaign_id}:${row.subject_kind}:${row.subject_id}`, row])
      )
      const locked: CampaignContentShare[] = []
      const missing: CampaignContentShare[] = []
      for (const share of selected) {
        const row = rowsByKey.get(`${share.campaignId}:${share.subjectKind}:${share.subjectId}`)
        if (!row || row.shared_by !== share.sharedBy) missing.push(share)
        else locked.push(toShare(row))
      }
      return { locked, missing }
    },

    async unshareRootExpectingAuthor(input: {
      campaignId: string
      subjectKind: AuthoredSubjectKind
      subjectId: string
      sharedBy: string
    }): Promise<CampaignContentShare | null> {
      const row = await db
        .deleteFrom('campaign_content_shares')
        .where('campaign_id', '=', input.campaignId)
        .where('subject_kind', '=', input.subjectKind)
        .where('subject_id', '=', input.subjectId)
        .where('shared_by', '=', input.sharedBy)
        .returningAll()
        .executeTakeFirst()
      return row ? toShare(row) : null
    },

    async shareRoot(input: {
      campaignId: string
      subjectKind: AuthoredSubjectKind
      subjectId: string
      sharedBy: string
    }): Promise<CampaignContentShare> {
      const result = await sql<ShareRow>`
        insert into public.campaign_content_shares (campaign_id, subject_kind, subject_id, shared_by)
        values (${input.campaignId}::uuid, ${input.subjectKind}, ${input.subjectId}::uuid, ${input.sharedBy}::uuid)
        on conflict (campaign_id, subject_kind, subject_id) do nothing
        returning campaign_id, subject_kind, subject_id, shared_by, created_at, updated_at
      `.execute(db)
      if (result.rows[0]) return toShare(result.rows[0])
      const existing = await this.findShare(input)
      if (!existing) throw new Error('Campaign content share was not created.')
      if (existing.sharedBy !== input.sharedBy) {
        throw new Error('Campaign content root is already shared by a different author.')
      }
      return existing
    }
  }
}
