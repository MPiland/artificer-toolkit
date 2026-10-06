import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()
crons.interval(
  'dispatch notifications',
  { minutes: 1 },
  internal.notifications.delivery.dispatch,
  {}
)
crons.daily(
  'delete superseded content snapshots',
  { hourUTC: 9, minuteUTC: 30 },
  internal.contentSnapshots.actions.deleteSupersededObjects,
  {}
)
export default crons
