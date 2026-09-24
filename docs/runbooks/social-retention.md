# Social Hub retention

## Native Convex retention — local implementation

`social/retention:preview` is an internal, read-only query. It counts eligibility for `INVITATIONS`,
`REPORTS`, `APPLICATIONS` or `RATE_WINDOWS`, with at most eight source records per page. Supply the
same canonical millisecond UTC `asOf` and phase while following `paginationOpts.cursor` through
`isDone`; an empty page is not completion. The result contains `scanned`, `eligible` and pagination
metadata only. Pages are separate read snapshots, so live changes can affect aggregate counts.

The preview preserves the SQL cutoffs below, including strict boundaries, calendar-year leap-day
clamping, the accepted-application membership exception and report-reference protection. Applications
protected only by expired terminal reports count as eligible after those reports are purged, matching
the legacy dry run. Missing listing/applicant references never make an application eligible.
Blocks and durable invalidation events are untouched.

Internal `social/retention:apply` uses the same phase, cutoff and pagination input plus
`confirm: 'purge-expired-social-data'`. It returns counts/cursors and `deleted`, with at most eight
source deletions per transaction. Process invitations, reports, applications and rate windows in that
order; finish each phase before advancing. Continue through empty pages until `isDone`. Preserve the
cutoff across interruption/retry; replaying a page rechecks current eligibility. Application apply
requires all referenced reports to be gone. Each report deletion schedules bounded audit cleanup in
the same transaction; cleanup may complete after the operator receives the page result.

The native operator command is `yarn social:retention:convex`. Set `CONVEX_URL` to the exact intended
cloud deployment URL, then supply both `--deployment-name <name>` and `--as-of <UTC timestamp>`.
For example, the approved personal development target is `flexible-goshawk-837`, with URL
`https://flexible-goshawk-837.convex.cloud`. Use a canonical timestamp such as
`2026-09-10T00:00:00.000Z`; the cutoff must be current or past. The operator uses the existing Convex CLI
account authentication and rejects a deployment key override. It does not activate or deploy functions.

Run without `--apply` to preview. Review the target/counts before setting
`CONFIRM_SOCIAL_RETENTION_PURGE=purge-expired-social-data` and adding `--apply`. Reuse the same cutoff.
The command prints mode, deployment, cutoff and completed-phase counts only. If it fails or is
interrupted, rerun from the beginning with that cutoff; already-deleted records remain deleted and
each page rechecks eligibility. A failed run may have committed earlier pages. Audit cleanup may
still be running after source phases finish. Rerun preview to check remaining source eligibility.
Environment-specific promotion/purge authorization still applies.

The native preview/apply implementation and development fixture proofs cover bounded, retry-safe
purge batches. Eligibility is rechecked in each batch; retention periods and protected records remain
unchanged. Managed preview or purge still requires the target environment's promotion authorization.

## Historical SQL command

> This command belongs to the retired PostgreSQL implementation. Keep it only as an invariant record;
> do not use it for a current deployment.

Run this monthly during the beta. It does not require a queue or scheduler.

1. Set `DATABASE_CONNECTION_STRING` for the intended environment.
2. Run `yarn social:retention`. This is always a dry run and prints counts only.
3. Review the four counts and confirm the target environment independently.
4. Set `CONFIRM_SOCIAL_RETENTION_PURGE=purge-expired-social-data` and run
   `yarn social:retention --apply`.
5. Run the dry run again; every reported count should be zero.

The command removes terminal invitations after 180 days. It removes terminal applications after
180 days, except an accepted application whose Campaign membership is still active; after that
membership ends, its expectations snapshot remains for a further 180 days. Resolved report evidence
and its audit actions remain for two years. Obsolete rate-limit windows are cleared. Blocks are never
removed by this command.

The command is idempotent and transactional. It prints counts, not row contents, account identifiers,
application messages, evidence, connection strings, or credentials.
