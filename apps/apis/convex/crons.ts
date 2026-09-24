import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()
crons.interval(
  'dispatch notifications',
  { minutes: 1 },
  internal.notifications.delivery.dispatch,
  {}
)
export default crons
