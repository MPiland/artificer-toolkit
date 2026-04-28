import type { DBLike, TableName } from '@artificer-toolkit/db'

type AuthoredContentTable =
  | 'backgrounds'
  | 'classes'
  | 'creatures'
  | 'equipment'
  | 'feats'
  | 'races'
  | 'spells'
  | 'vehicles'

interface AuthoredOwnership {
  isMaster: boolean
  ownerUserId: string | null
}

interface AuthoredListRow {
  userId: string
  isMaster?: boolean | null
  ownerUserId?: string | null
}

interface AuthoredRecord {
  id: string
  userId: string
}

interface AuthoringPipelineResult<TRecord extends AuthoredRecord> {
  authored: TRecord
}

function getPermissions(ownership: AuthoredOwnership, userId: string) {
  const ownsRecord = !ownership.isMaster && ownership.ownerUserId === userId

  return {
    canView: true,
    canEdit: ownsRecord,
    canCopy: true,
    canDelete: ownsRecord
  }
}

function getProvenance(ownership: AuthoredOwnership) {
  return {
    kind: ownership.isMaster ? 'MASTER' as const : 'OWNED' as const,
    ownerUserId: ownership.isMaster ? null : ownership.ownerUserId
  }
}

function getListOwnership(row: AuthoredListRow): AuthoredOwnership {
  const isMaster = row.isMaster ?? row.userId === 'master'

  return {
    isMaster,
    ownerUserId: isMaster ? null : row.ownerUserId ?? row.userId
  }
}

export function normalizeAuthoredListResponse<
  TItem extends AuthoredListRow,
  TResponse extends { items: TItem[], meta: unknown }
>(
  response: TResponse,
  userId: string
) {
  return {
    ...response,
    items: response.items.map((item) => {
      const ownership = getListOwnership(item)

      return {
        ...item,
        provenance: getProvenance(ownership),
        permissions: getPermissions(ownership, userId)
      }
    })
  }
}

export async function getAuthoredOwnership(
  db: DBLike,
  table: AuthoredContentTable,
  id: string
): Promise<AuthoredOwnership | null> {
  const row = await db
    .selectFrom(table as TableName)
    .select([
      'is_master as isMaster',
      'user_id as ownerUserId'
    ])
    .where('id', '=', id)
    .executeTakeFirst() as { isMaster: boolean, ownerUserId: string | null } | undefined

  if (!row) return null

  return {
    isMaster: row.isMaster,
    ownerUserId: row.isMaster ? null : row.ownerUserId
  }
}

export async function normalizeAuthoredDetailResponse<TRecord extends AuthoredRecord>(
  db: DBLike,
  table: AuthoredContentTable,
  item: TRecord | null,
  userId: string
) {
  if (!item) return null

  const ownership = await getAuthoredOwnership(db, table, item.id)
    ?? { isMaster: item.userId === 'master', ownerUserId: item.userId === 'master' ? null : item.userId }

  return {
    item,
    provenance: getProvenance(ownership),
    permissions: getPermissions(ownership, userId)
  }
}

export function normalizeAuthoringInput<TRecord extends AuthoredRecord>(
  input: TRecord,
  userId: string
): TRecord {
  return {
    ...input,
    userId
  }
}

export async function normalizeAuthoringResult<TRecord extends AuthoredRecord>(
  db: DBLike,
  table: AuthoredContentTable,
  result: AuthoringPipelineResult<TRecord>,
  userId: string
) {
  return normalizeAuthoredDetailResponse(db, table, result.authored, userId)
}
