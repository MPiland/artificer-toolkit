import pg from 'pg'

const { Client } = pg

const APPLY_FLAG = '--apply'
const CONFIRMATION = 'purge-expired-social-data'

function requireConnectionString(): string {
  const value = process.env.DATABASE_CONNECTION_STRING?.trim()
  if (!value) throw new Error('DATABASE_CONNECTION_STRING is required.')
  return value
}

async function count(client: pg.Client, statement: string): Promise<number> {
  const result = await client.query<{ count: string }>(statement)
  return Number(result.rows[0]?.count ?? 0)
}

async function main() {
  const apply = process.argv.includes(APPLY_FLAG)
  if (apply && process.env.CONFIRM_SOCIAL_RETENTION_PURGE !== CONFIRMATION) {
    throw new Error(`CONFIRM_SOCIAL_RETENTION_PURGE must equal "${CONFIRMATION}" with --apply.`)
  }

  const client = new Client({ connectionString: requireConnectionString() })
  await client.connect()

  try {
    await client.query('begin')
    await client.query("set local statement_timeout = '5min'")

    const terminalInvites = await count(
      client,
      `select count(*) as count
       from campaign_invites
       where status <> 'PENDING'
         and coalesce(responded_at, revoked_at, expired_at, updated_at) < now() - interval '180 days'`
    )
    const terminalApplications = await count(
      client,
      `select count(*) as count
       from social_applications application
       join social_listings listing on listing.id = application.listing_id
       join social_profiles applicant on applicant.id = application.applicant_profile_id
       where application.status <> 'SUBMITTED'
         and (
           application.status <> 'ACCEPTED'
           or not exists (
             select 1 from campaign_memberships membership
             where membership.campaign_id = listing.campaign_id
               and membership.user_id = applicant.user_id
               and membership.status = 'ACTIVE'
           )
         )
         and greatest(
           coalesce(application.withdrawn_at, application.responded_at, application.expired_at,
             application.blocked_at, application.updated_at),
           coalesce((
             select max(membership.left_at)
             from campaign_memberships membership
             where membership.campaign_id = listing.campaign_id
               and membership.user_id = applicant.user_id
           ), '-infinity'::timestamptz)
         ) < now() - interval '180 days'`
    )
    const resolvedReports = await count(
      client,
      `select count(*) as count
       from social_reports
       where status in ('RESOLVED', 'DISMISSED')
         and resolved_at < now() - interval '2 years'`
    )
    const expiredRateWindows = await count(
      client,
      `select count(*) as count
       from social_action_rate_limits
       where window_started_at < now() - interval '2 days'`
    )

    console.log(
      JSON.stringify({
        mode: apply ? 'apply' : 'dry-run',
        terminalInvites,
        terminalApplications,
        resolvedReports,
        expiredRateWindows
      })
    )

    if (apply) {
      await client.query(
        `delete from campaign_invites
         where status <> 'PENDING'
           and coalesce(responded_at, revoked_at, expired_at, updated_at) < now() - interval '180 days'`
      )
      await client.query(
        `delete from social_applications application
         using social_listings listing, social_profiles applicant
         where listing.id = application.listing_id
           and applicant.id = application.applicant_profile_id
           and application.status <> 'SUBMITTED'
           and (
             application.status <> 'ACCEPTED'
             or not exists (
               select 1 from campaign_memberships membership
               where membership.campaign_id = listing.campaign_id
                 and membership.user_id = applicant.user_id
                 and membership.status = 'ACTIVE'
             )
           )
           and greatest(
             coalesce(application.withdrawn_at, application.responded_at, application.expired_at,
               application.blocked_at, application.updated_at),
             coalesce((
               select max(membership.left_at)
               from campaign_memberships membership
               where membership.campaign_id = listing.campaign_id
                 and membership.user_id = applicant.user_id
             ), '-infinity'::timestamptz)
           ) < now() - interval '180 days'`
      )
      await client.query(
        `delete from social_moderation_actions action
         using social_reports report
         where report.id = action.report_id
           and report.status in ('RESOLVED', 'DISMISSED')
           and report.resolved_at < now() - interval '2 years'`
      )
      await client.query(
        `delete from social_reports
         where status in ('RESOLVED', 'DISMISSED')
           and resolved_at < now() - interval '2 years'`
      )
      await client.query(
        `delete from social_action_rate_limits
         where window_started_at < now() - interval '2 days'`
      )
      await client.query('commit')
    } else {
      await client.query('rollback')
    }
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Social retention purge failed.')
  process.exitCode = 1
})
