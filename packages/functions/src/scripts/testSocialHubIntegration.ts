import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

import { createDb, type DBLike } from '@artificer-toolkit/db'
import type { CreateSocialListingInput } from '@artificer-toolkit/schema/api/socialHub'
import { sql } from 'kysely'

import {
  acceptCampaignInvite,
  createCampaign,
  createCampaignInvite,
  listReceivedCampaignInvites
} from '../services/campaign/campaignService.js'
import {
  closeSocialListing,
  createSocialListing,
  decideSocialApplication,
  initializeSocialProfile,
  openSocialListing,
  submitSocialApplication,
  updateSocialListing
} from '../services/social/index.js'

const LOCAL_DATABASE_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])
const HOST_EMAIL = 'social-host@local.test'
const FIRST_PLAYER_EMAIL = 'social-player-one@local.test'
const SECOND_PLAYER_EMAIL = 'social-player-two@local.test'

interface FixtureUser {
  id: string
  username: string
}

interface FixtureUsers {
  host: FixtureUser
  firstPlayer: FixtureUser
  secondPlayer: FixtureUser
}

function requireLocalDatabaseUrl(): string {
  const connectionString = process.env.DATABASE_CONNECTION_STRING
  if (!connectionString) {
    throw new Error('DATABASE_CONNECTION_STRING is required for the Social Hub proof.')
  }

  let host: string
  try {
    host = new URL(connectionString).hostname.toLowerCase()
  } catch {
    throw new Error('The Social Hub proof requires a URL-shaped Postgres connection string.')
  }
  if (!LOCAL_DATABASE_HOSTS.has(host)) {
    throw new Error(`Refusing to run the Social Hub proof against non-local host "${host}".`)
  }
  return connectionString
}

async function loadFixtureUsers(db: DBLike): Promise<FixtureUsers> {
  const result = await sql<{ email: string; id: string }>`
    select email, id::text as id
    from auth.users
    where email in (${HOST_EMAIL}, ${FIRST_PLAYER_EMAIL}, ${SECOND_PLAYER_EMAIL})
  `.execute(db)
  const byEmail = new Map(result.rows.map((row) => [row.email.toLowerCase(), row.id]))

  const fixture = (email: string, username: string): FixtureUser => {
    const id = byEmail.get(email)
    if (!id) {
      throw new Error(
        `Missing local user ${email}. Run packages/db/src/scripts/seedLocalAuthUser.ts.`
      )
    }
    return { id, username }
  }

  return {
    host: fixture(HOST_EMAIL, 'social_host'),
    firstPlayer: fixture(FIRST_PLAYER_EMAIL, 'social_player_one'),
    secondPlayer: fixture(SECOND_PLAYER_EMAIL, 'social_player_two')
  }
}

async function prepareUsers(db: DBLike, users: FixtureUsers): Promise<void> {
  for (const user of [users.host, users.firstPlayer, users.secondPlayer]) {
    await sql`
      update profiles
      set username = ${user.username}, updated_at = now()
      where id = ${user.id}::uuid
    `.execute(db)
    await initializeSocialProfile(db, user.id)
  }
}

async function findSystemId(db: DBLike): Promise<string> {
  const result = await sql<{ id: string }>`
    select id::text as id from systems order by created_at, id limit 1
  `.execute(db)
  const systemId = result.rows[0]?.id
  if (!systemId) throw new Error('The local database needs one seeded rules system.')
  return systemId
}

function listingFields(
  systemId: string,
  title: string,
  audience: 'PRIVATE' | 'PUBLIC' = 'PUBLIC'
): Omit<CreateSocialListingInput, 'campaignId'> {
  return {
    summary: `${title} summary for the local concurrency proof.`,
    audience,
    systemId,
    playMode: 'ONLINE',
    capacity: 1,
    schedule: {
      kind: 'FLEXIBLE',
      timeZone: 'America/Chicago',
      summary: 'Schedule coordinated with the accepted player.'
    },
    location: null,
    expectations: {
      contentGuidance: 'Adults-only fantasy adventure with agreed boundaries.',
      attendancePolicy: 'Give the table advance notice when possible.',
      allowedContentRules: 'Published rules plus host-approved options.',
      tableConduct: 'Respect boundaries and share spotlight time.',
      contentBoundaries: 'Boundaries are confirmed before play.',
      safetyPractices: ['SESSION_ZERO', 'X_CARD'],
      safetyDetails: 'Session zero sets boundaries; the X-card pauses play immediately.'
    }
  }
}

async function createDraftListing(
  db: DBLike,
  hostUserId: string,
  systemId: string,
  title: string,
  createdCampaignIds: Set<string>,
  audience: 'PRIVATE' | 'PUBLIC' = 'PUBLIC'
) {
  const campaign = await createCampaign(db, hostUserId, {
    name: title,
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD'
  })
  createdCampaignIds.add(campaign.id)
  const listing = await createSocialListing(db, hostUserId, {
    campaignId: campaign.id,
    ...listingFields(systemId, title, audience)
  })
  return { campaign, listing }
}

async function createOpenListing(
  db: DBLike,
  hostUserId: string,
  systemId: string,
  title: string,
  createdCampaignIds: Set<string>,
  audience: 'PRIVATE' | 'PUBLIC' = 'PUBLIC'
) {
  const draft = await createDraftListing(
    db,
    hostUserId,
    systemId,
    title,
    createdCampaignIds,
    audience
  )
  return {
    campaign: draft.campaign,
    listing: await openSocialListing(
      db,
      hostUserId,
      draft.listing.listingPublicId,
      draft.listing.version
    )
  }
}

async function assertApplicationAgreement(db: DBLike, listingId: string): Promise<string> {
  const result = await sql<{
    active_membership: boolean
    id: string
    status: string
  }>`
    select application.id::text as id, application.status,
      exists (
        select 1
        from campaign_memberships membership
        join social_profiles applicant on applicant.user_id = membership.user_id
        join social_listings listing on listing.campaign_id = membership.campaign_id
        where listing.id = application.listing_id
          and applicant.id = application.applicant_profile_id
          and membership.role = 'PLAYER' and membership.status = 'ACTIVE'
      ) as active_membership
    from social_applications application
    where application.listing_id = ${listingId}::uuid
    order by application.id
  `.execute(db)
  const accepted = result.rows.filter((row) => row.status === 'ACCEPTED')
  assert.equal(accepted.length, 1)
  assert.equal(accepted[0]?.active_membership, true)
  assert.equal(result.rows.filter((row) => row.active_membership).length, 1)
  return accepted[0]!.id
}

async function proveTwoApplicationsForOneSeat(
  db: DBLike,
  users: FixtureUsers,
  systemId: string,
  createdCampaignIds: Set<string>
): Promise<void> {
  const { listing } = await createOpenListing(
    db,
    users.host.id,
    systemId,
    'Two application race',
    createdCampaignIds
  )
  const applications = await Promise.all([
    submitSocialApplication(db, users.firstPlayer.id, {
      listingPublicId: listing.listingPublicId,
      expectedListingVersion: listing.version,
      message: 'First player application.'
    }),
    submitSocialApplication(db, users.secondPlayer.id, {
      listingPublicId: listing.listingPublicId,
      expectedListingVersion: listing.version,
      message: 'Second player application.'
    })
  ])
  const results = await Promise.allSettled(
    applications.map((application) =>
      decideSocialApplication(db, users.host.id, {
        applicationPublicId: application.applicationPublicId,
        expectedVersion: application.version,
        decision: 'ACCEPT'
      })
    )
  )
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1)

  const acceptedId = await assertApplicationAgreement(db, listing.listingPublicId)
  const acceptedInput = applications.find(
    (application) => application.applicationPublicId === acceptedId
  )
  assert.ok(acceptedInput)
  const retry = await decideSocialApplication(db, users.host.id, {
    applicationPublicId: acceptedInput.applicationPublicId,
    expectedVersion: acceptedInput.version,
    decision: 'ACCEPT'
  })
  assert.equal(retry.status, 'ACCEPTED')

  await closeSocialListing(db, users.host.id, listing.listingPublicId, listing.version)
  assert.equal(await assertApplicationAgreement(db, listing.listingPublicId), acceptedId)
}

async function proveInvitationAgainstApplication(
  db: DBLike,
  users: FixtureUsers,
  systemId: string,
  createdCampaignIds: Set<string>
): Promise<void> {
  const { listing } = await createOpenListing(
    db,
    users.host.id,
    systemId,
    'Invite application race',
    createdCampaignIds
  )
  const [invitation, application] = await Promise.all([
    createCampaignInvite(db, users.host.id, {
      listingPublicId: listing.listingPublicId,
      expectedListingVersion: listing.version,
      username: users.firstPlayer.username
    }),
    submitSocialApplication(db, users.secondPlayer.id, {
      listingPublicId: listing.listingPublicId,
      expectedListingVersion: listing.version,
      message: 'Application racing the invitation.'
    })
  ])
  const results = await Promise.allSettled([
    acceptCampaignInvite(db, users.firstPlayer.id, invitation.invitePublicId, invitation.version),
    decideSocialApplication(db, users.host.id, {
      applicationPublicId: application.applicationPublicId,
      expectedVersion: application.version,
      decision: 'ACCEPT'
    })
  ])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1)

  const agreement = await sql<{ accepted_sources: number; active_players: number }>`
    select
      (
        (select count(*) from campaign_invites
          where listing_id = ${listing.listingPublicId}::uuid and status = 'ACCEPTED')
        +
        (select count(*) from social_applications
          where listing_id = ${listing.listingPublicId}::uuid and status = 'ACCEPTED')
      )::int as accepted_sources,
      (select count(*)::int
        from campaign_memberships membership
        join social_listings social_listing on social_listing.campaign_id = membership.campaign_id
        where social_listing.id = ${listing.listingPublicId}::uuid
          and membership.role = 'PLAYER' and membership.status = 'ACTIVE') as active_players
  `.execute(db)
  assert.equal(agreement.rows[0]?.accepted_sources, 1)
  assert.equal(agreement.rows[0]?.active_players, 1)
  await closeSocialListing(db, users.host.id, listing.listingPublicId, listing.version)
}

async function provePublicListingEntitlement(
  db: DBLike,
  hostUserId: string,
  systemId: string,
  createdCampaignIds: Set<string>
): Promise<void> {
  const [first, second] = await Promise.all([
    createDraftListing(db, hostUserId, systemId, 'Public entitlement first', createdCampaignIds),
    createDraftListing(db, hostUserId, systemId, 'Public entitlement second', createdCampaignIds)
  ])
  await sql`update account_entitlements set tier = 'FREE' where user_id = ${hostUserId}::uuid`.execute(
    db
  )
  const existing = await sql<{ count: number }>`
    select count(*)::int as count
    from social_listings listing
    join campaigns campaign on campaign.id = listing.campaign_id
    where campaign.owner_user_id = ${hostUserId}::uuid
      and listing.status = 'OPEN'
      and listing.audience = 'PUBLIC'
      and listing.id not in (${first.listing.listingPublicId}::uuid,
        ${second.listing.listingPublicId}::uuid)
  `.execute(db)
  if ((existing.rows[0]?.count ?? 0) === 0) {
    await openSocialListing(db, hostUserId, first.listing.listingPublicId, first.listing.version)
    await assert.rejects(
      openSocialListing(db, hostUserId, second.listing.listingPublicId, second.listing.version)
    )
  } else {
    await assert.rejects(
      openSocialListing(db, hostUserId, first.listing.listingPublicId, first.listing.version)
    )
  }
  await sql`update account_entitlements set tier = 'PRO_GM' where user_id = ${hostUserId}::uuid`.execute(
    db
  )
}

async function proveEditAndCloseAgainstSubmission(
  db: DBLike,
  users: FixtureUsers,
  systemId: string,
  createdCampaignIds: Set<string>
): Promise<void> {
  const edited = await createOpenListing(
    db,
    users.host.id,
    systemId,
    'Material edit expiry',
    createdCampaignIds
  )
  const [application, invitation] = await Promise.all([
    submitSocialApplication(db, users.firstPlayer.id, {
      listingPublicId: edited.listing.listingPublicId,
      expectedListingVersion: edited.listing.version,
      message: 'Application that must expire on a material edit.'
    }),
    createCampaignInvite(db, users.host.id, {
      listingPublicId: edited.listing.listingPublicId,
      expectedListingVersion: edited.listing.version,
      username: users.secondPlayer.username
    })
  ])
  await updateSocialListing(db, users.host.id, {
    ...listingFields(systemId, 'Material edit expiry'),
    schedule: {
      kind: 'ONE_TIME',
      timeZone: 'America/Chicago',
      summary: 'A newly fixed session time.',
      startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    },
    listingPublicId: edited.listing.listingPublicId,
    expectedVersion: edited.listing.version
  })
  const expired = await sql<{ application_status: string; invite_status: string }>`
    select application.status as application_status, invitation.status as invite_status
    from social_applications application, campaign_invites invitation
    where application.id = ${application.applicationPublicId}::uuid
      and invitation.id = ${invitation.invitePublicId}::uuid
  `.execute(db)
  assert.equal(expired.rows[0]?.application_status, 'EXPIRED')
  assert.equal(expired.rows[0]?.invite_status, 'EXPIRED')

  const closing = await createOpenListing(
    db,
    users.host.id,
    systemId,
    'Close submission race',
    createdCampaignIds
  )
  const race = await Promise.allSettled([
    submitSocialApplication(db, users.firstPlayer.id, {
      listingPublicId: closing.listing.listingPublicId,
      expectedListingVersion: closing.listing.version,
      message: 'Application racing listing closure.'
    }),
    closeSocialListing(db, users.host.id, closing.listing.listingPublicId, closing.listing.version)
  ])
  assert.equal(race[1]?.status, 'fulfilled')
  const remaining = await sql<{ count: number }>`
    select count(*)::int as count from social_applications
    where listing_id = ${closing.listing.listingPublicId}::uuid and status = 'SUBMITTED'
  `.execute(db)
  assert.equal(remaining.rows[0]?.count, 0)
}

async function proveInboxExpiry(
  db: DBLike,
  users: FixtureUsers,
  systemId: string,
  createdCampaignIds: Set<string>
): Promise<void> {
  const { listing } = await createOpenListing(
    db,
    users.host.id,
    systemId,
    'Invitation expiry',
    createdCampaignIds,
    'PRIVATE'
  )
  const invitation = await createCampaignInvite(db, users.host.id, {
    listingPublicId: listing.listingPublicId,
    expectedListingVersion: listing.version,
    username: users.firstPlayer.username
  })
  await sql`
    update campaign_invites set expires_at = now() - interval '1 second'
    where id = ${invitation.invitePublicId}::uuid
  `.execute(db)
  const inbox = await listReceivedCampaignInvites(db, users.firstPlayer.id)
  assert.equal(
    inbox.find((item) => item.invitePublicId === invitation.invitePublicId)?.status,
    'EXPIRED'
  )
}

async function main(): Promise<void> {
  const db = createDb({ connectionString: requireLocalDatabaseUrl() })
  const createdCampaignIds = new Set<string>()
  let originalTier = 'FREE'
  let users: FixtureUsers | undefined

  try {
    users = await loadFixtureUsers(db)
    const tier = await sql<{ tier: string }>`
      select tier from account_entitlements where user_id = ${users.host.id}::uuid
    `.execute(db)
    originalTier = tier.rows[0]?.tier ?? 'FREE'
    await sql`
      update account_entitlements set tier = 'PRO_GM' where user_id = ${users.host.id}::uuid
    `.execute(db)
    await prepareUsers(db, users)
    const systemId = await findSystemId(db)

    await proveTwoApplicationsForOneSeat(db, users, systemId, createdCampaignIds)
    await proveInvitationAgainstApplication(db, users, systemId, createdCampaignIds)
    await provePublicListingEntitlement(db, users.host.id, systemId, createdCampaignIds)
    await proveEditAndCloseAgainstSubmission(db, users, systemId, createdCampaignIds)
    await proveInboxExpiry(db, users, systemId, createdCampaignIds)

    console.info('Social Hub local proof passed: application/application seat race')
    console.info('Social Hub local proof passed: invitation/application seat race and retry')
    console.info('Social Hub local proof passed: public listing entitlement limit')
    console.info('Social Hub local proof passed: material edit and close admission expiry')
    console.info('Social Hub local proof passed: membership/source agreement after commit')
    console.info('Social Hub local proof passed: expired inbox lifecycle transition')
  } finally {
    for (const campaignId of createdCampaignIds) {
      await sql`delete from campaigns where id = ${campaignId}::uuid`.execute(db)
    }
    if (users) {
      await sql`
        delete from social_action_rate_limits
        where user_id in (${users.host.id}::uuid, ${users.firstPlayer.id}::uuid,
          ${users.secondPlayer.id}::uuid)
      `.execute(db)
      await sql`
        update account_entitlements set tier = ${originalTier}
        where user_id = ${users.host.id}::uuid
      `.execute(db)
    }
    await db.destroy()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
