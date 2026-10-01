import type { MutationCtx } from '../_generated/server'

type ClockWriter = MutationCtx['db']

export async function openClockSegment(
  db: ClockWriter,
  campaignId: string,
  startAbsoluteMinute: number,
  at: string
) {
  await db.insert('campaignClockSegments', {
    id: crypto.randomUUID(),
    campaignId,
    startedAt: at,
    stoppedAt: null,
    startAbsoluteMinute,
    endAbsoluteMinute: null
  })
}

export async function closeOpenClockSegment(
  db: ClockWriter,
  campaignId: string,
  endAbsoluteMinute: number,
  at: string
) {
  const open = await db
    .query('campaignClockSegments')
    .withIndex('by_campaignId_stoppedAt', (q) =>
      q.eq('campaignId', campaignId).eq('stoppedAt', null)
    )
    .unique()
  if (!open) throw new Error('Running Campaign clock has no open segment.')
  await db.patch(open._id, { stoppedAt: at, endAbsoluteMinute })
}
