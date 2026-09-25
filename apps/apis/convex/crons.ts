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
  'purge expired Scene command receipts',
  { hourUTC: 9, minuteUTC: 0 },
  internal.scenes.commandRetention.purge,
  {}
)
export default crons
