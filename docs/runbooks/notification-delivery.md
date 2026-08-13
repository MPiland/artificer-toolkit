# Notification delivery

> **Historical:** This Novu runbook is superseded by the [Supabase notification delivery runbook](supabase-notification-delivery.md). Do not use the commands below for current deployments.

Use this runbook for the Phase 05 Novu dispatcher and Framework Bridge. Artificer remains authoritative for applications, invitations, memberships, and destinations; Novu Cloud owns feed state and channel preferences.

## Deployment prerequisites

Before enabling production delivery:

1. Configure Novu Cloud Development and Production and create a Resend email integration in each environment with its current integration key and from address. Use Novu Development for the deployed app's staging smoke unless a separate provider environment is intentionally provisioned.
2. Set `DATABASE_CONNECTION_STRING`, `NOVU_SECRET_KEY`, `NOVU_APPLICATION_IDENTIFIER`, and the existing `SITE_URL` in Netlify. Do not prefix them with `VITE_`. `SITE_URL` is the canonical app origin used by the Bridge to create authenticated deep links.
3. Deploy the application, the scheduled `dispatch-notifications` function, and the public Bridge at `https://<deployment>/.netlify/functions/novu`.
4. Sync the four Social Hub workflows from that Bridge to Novu Development. Each workflow has one in-app and one Resend email step, with the single Social Hub preference row controlling both channels. Remove `social-invitation-ended` if it was synced from an earlier development build.
5. Apply the Phase 05 migration, then use Netlify's scheduled-function **Run now** action once in Staging.

These are deployment prerequisites, not checks completed by repository validation. Resend may also deliver Supabase Auth email through `send-auth-email.mts`; do not revoke that key unless Supabase Auth has first moved to a replacement key.

## Develop and sync workflows

From the repository root, build the app and start both the Netlify Framework Bridge and Novu Local Studio:

```sh
yarn novu:dev
```

Keep that terminal open while editing or syncing workflows. The command runs both development processes together; press Ctrl+C to stop them.

After deploying the Bridge, sync its code-first workflows to Novu Cloud Development:

```sh
npx novu@latest sync \
  --bridge-url https://<deployment>/.netlify/functions/novu \
  --secret-key "$NOVU_SECRET_KEY" \
  --api-url https://api.novu.co
```

Run staging smoke against Novu Development, then sync with the Production environment credentials when promoting the application. Do not edit synced workflows directly in the dashboard: React Email templates in `packages/emails` are runtime code rendered by the Bridge. Runtime trigger payloads and logs must remain semantic and safe; never add rendered email HTML, text, subjects, email addresses, provider URLs, or private source content.

## Runtime ceiling

The scheduled function runs once per minute, claims at most 10 intents, and reclaims a claim after five minutes. Network failures, rate limits, and provider server failures retry from one minute with exponential delay capped at one hour; the tenth failed attempt is terminal. Other provider client errors are terminal immediately. Increase this ceiling or add delivery infrastructure only after measured backlog age or delivery latency requires it.

## Repository validation

Run `yarn test:notifications:integration` against the intended local database baseline. It verifies source-change commit and rollback coupling, duplicate uniqueness, failed-mutation silence, non-overlapping concurrent claims capped at 10, stale-lease recovery, and exhausted-intent exclusion without contacting Novu.

## Inspect delivery state

Normal runs log only aggregate claimed, delivered, retried, failed, and expired-invitation counts. Inspect terminal failures without selecting payloads or recipient identifiers:

```sql
select
  id,
  workflow_key,
  operation,
  attempt_count,
  occurred_at,
  failed_at,
  last_error_code
from public.notification_delivery_intents
where failed_at is not null
order by failed_at desc
limit 50;
```

Use backlog count and oldest age to decide whether the fixed 10-intents-per-minute ceiling is still adequate:

```sql
select
  count(*) as pending_count,
  min(occurred_at) as oldest_pending_at
from public.notification_delivery_intents
where delivered_at is null
  and failed_at is null;
```

Do not print `payload`, recipient IDs, provider response bodies, connection strings, or credentials.

## Replay one terminal intent

First confirm the source still exists and the destination still authorizes the intended recipient. Check Novu before replaying an ambiguous timeout: the intent UUID is the provider idempotency key.

Using the privileged operator connection for the confirmed target environment, run this transaction with the exact failed intent UUID:

```sql
begin;

update public.notification_delivery_intents
set
  attempt_count = 0,
  next_attempt_at = now(),
  claimed_at = null,
  failed_at = null,
  last_error_code = null
where id = '<intent-uuid>'
  and delivered_at is null
  and failed_at is not null;

commit;
```

The update count must be exactly one. Use Netlify **Run now**, then confirm that the intent has either `delivered_at` set or bounded retry metadata. Never delete or clone an intent to force delivery; that bypasses its idempotency identity.

## Staging smoke prerequisites

Before production delivery, exercise application submission and decision plus invitation creation, decision, revocation, and expiry. Confirm in-app and email delivery, no new notification for revocation or expiry, the inactive state when opening a retained invitation notification, preference suppression of future channel delivery, one logical notification after duplicate function invocation, generic handling of unavailable destinations, subscriber removal for a disposable deleted account, and no sensitive content in Novu or logs. Live-provider smoke results must be recorded at deployment time; repository tests do not satisfy this gate.
