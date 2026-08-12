import { createDb } from '@artificer-toolkit/db'
import { dispatchPendingNotifications } from '@artificer-toolkit/functions'

export const config = { schedule: '* * * * *' }

export default async function dispatchNotifications(): Promise<Response> {
  const secretKey = process.env.NOVU_SECRET_KEY
  if (!secretKey) throw new Error('NOVU_SECRET_KEY is required.')

  const db = createDb()
  try {
    const result = await dispatchPendingNotifications(db, secretKey)
    console.info('Notification dispatch summary.', result)
    return Response.json(result)
  } finally {
    await db.destroy()
  }
}
