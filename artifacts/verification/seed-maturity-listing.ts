import { createDb } from '@artificer-toolkit/db'
import { createCampaign, createSocialListing, openSocialListing } from '@artificer-toolkit/functions'
import { sql } from 'kysely'

const connectionString = process.env.DATABASE_CONNECTION_STRING
if (!connectionString || !['127.0.0.1', 'localhost', '::1'].includes(new URL(connectionString).hostname)) {
  throw new Error('Refusing to seed outside the local database.')
}

const db = createDb(connectionString)
const account = await sql<{ id: string }>`
  select id::text as id from auth.users where email = 'social-player-one@local.test'
`.execute(db)
const system = await sql<{ id: string }>`
  select id::text as id from systems order by created_at, id limit 1
`.execute(db)
const userId = account.rows[0]?.id
const systemId = system.rows[0]?.id
if (!userId || !systemId) throw new Error('Local Social validation fixtures are missing.')

await sql`update account_entitlements set tier = 'PRO_GM' where user_id = ${userId}::uuid`.execute(db)
const campaign = await createCampaign(db, userId, {
  name: 'Shit-Forged Mature Table',
  description: 'A shitstorm-fueled heroic one-shot for veteran players.',
  format: 'ONE_SHOT',
  toneTags: ['DARK', 'GRITTY'],
  toneDetails: 'A dark, shitstorm-charged adventure.',
  contentMaturity: 'MATURE'
})
const draft = await createSocialListing(db, userId, {
  campaignId: campaign.id,
  summary: 'A shitstorm-fueled heroic one-shot for veteran players.',
  audience: 'PUBLIC',
  systemId,
  playMode: 'ONLINE',
  capacity: 5,
  schedule: {
    kind: 'FLEXIBLE',
    timeZone: 'America/Chicago',
    summary: 'One evening coordinated in Central time.'
  },
  location: null,
  expectations: {
    contentGuidance: 'Strong shit and fantasy violence.',
    attendancePolicy: 'Confirm attendance before the session.',
    allowedContentRules: 'Published rules plus host-approved options.',
    tableConduct: 'Respect boundaries and share the spotlight.',
    contentBoundaries: 'No harassment or sexual violence.',
    safetyPractices: ['SESSION_ZERO', 'X_CARD'],
    safetyDetails: 'Review boundaries before play and pause immediately when asked.'
  }
})
await openSocialListing(db, userId, draft.listingPublicId, draft.version)
await db.destroy()
