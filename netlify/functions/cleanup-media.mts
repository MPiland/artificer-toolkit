import { sql } from 'kysely'
import { createDb } from '@artificer-toolkit/db'
import { cleanupScheduledMediaObjects, purgeOwnedMedia } from '@artificer-toolkit/functions'

export const config = { schedule: '@daily' }

export default async function cleanupMedia(): Promise<Response> {
  const db = createDb()
  try {
    const deletedObjects = await cleanupScheduledMediaObjects(db)
    const result = await sql<{ owner_user_id: string }>`
      select distinct owner_user_id from media_assets
      where status = 'DELETED'
        or (status = 'PENDING_UPLOAD' and created_at < now() - interval '24 hours')
        or (status = 'PROCESSING' and coalesce(processing_started_at, created_at) < now() - interval '24 hours')
        or (status = 'READY' and unreferenced_at < now() - interval '24 hours')
        or (status = 'REJECTED' and updated_at < now() - interval '7 days')
    `.execute(db)
    const deleted = await Promise.all(
      result.rows.map((row) => purgeOwnedMedia(db, row.owner_user_id))
    )
    return Response.json({
      deletedAssets: deleted.reduce((total, count) => total + count, 0),
      deletedObjects
    })
  } finally {
    await db.destroy()
  }
}
