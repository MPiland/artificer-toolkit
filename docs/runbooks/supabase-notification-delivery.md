# Supabase notification delivery runbook

Artificer remains authoritative for applications, invitations, memberships, announcements, and destinations. Postgres owns feed/preferences; Supabase Edge executes delivery; Resend sends email.

## Deploy

1. Apply all Supabase migrations.
2. Configure Edge Function secrets: `NOTIFICATION_DISPATCH_SECRET`, `RESEND_API_KEY`, `NOTIFICATION_EMAIL_FROM`, and `APP_URL`. Supabase provides `SUPABASE_URL` and its secret key automatically. Never expose any of these through `VITE_` variables.
3. Deploy with `yarn supabase functions deploy notification-dispatch`.
4. Schedule one authenticated POST per minute to `/functions/v1/notification-dispatch` with `x-notification-dispatch-secret`. Use Supabase Cron/Vault or another controlled scheduler; never place the secret in source SQL or a browser.
5. Confirm only aggregate dispatch counts appear in logs.

## Local validation

Start local Supabase, then run `yarn notifications:serve`. Invoke the function with a POST and the local `x-notification-dispatch-secret`. Local product email may use a controlled Resend test recipient; source/outbox/feed behavior does not require a real mailbox.

Run `yarn test:notifications:integration` against the local database. It verifies source/outbox transaction coupling, uniqueness, bounded claiming, lease recovery, cancellation, preferences, and feed idempotency. The Phase 06 local proof additionally covers GM Campaign announcement publication to an active Player.

## Runtime behavior

- Each run expires a bounded invitation batch, suppresses cancelled triggers, marks exhausted rows, and claims at most ten due intents.
- Claims older than five minutes are reclaimable.
- Network, rate-limit, and provider server failures retry exponentially from one minute to one hour; the tenth failed attempt is terminal. Other provider client errors are terminal immediately.
- The intent UUID is both feed uniqueness and the Resend idempotency key.
- Disabled channels are successful no-ops. Cancellation suppresses pending delivery and does not erase retained history.

## Production smoke

Before real users, use disposable GM and Player accounts:

1. Establish active Campaign membership through the ordinary product flow.
2. Have the GM publish a TABLE announcement.
3. Run or wait for the dispatcher and verify exactly one Player delivery, no publisher delivery, and no protected title/body in intent or logs.
4. Verify the Player feed badge, seen/read transitions, and authorized deep link to the exact announcement.
5. Disable each channel and verify only future delivery is suppressed.
6. Remove the Player and verify the retained notification no longer opens protected Campaign content.
7. Delete the disposable Campaign/accounts and confirm database cascades remove feed/preferences without provider cleanup.

Do not replay by creating another source. Inspect the intent's bounded status fields and invoke the dispatcher again only after correcting configuration or waiting for `next_attempt_at`. Never copy payloads, addresses, provider responses, or secret values into logs or tickets.
