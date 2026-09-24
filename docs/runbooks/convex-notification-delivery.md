# Convex notification delivery

Convex stores notification intents, feed rows, preferences and delivery status. A one-minute Convex
cron expires due invitations and processes at most ten pending intents. The `@convex-dev/resend`
component owns provider enqueue, status and retries; source eligibility is rechecked before delivery.

## Configuration

Configure these server-only Convex variables:

```text
MAIL_DELIVERY_MODE=resend
RESEND_API_KEY=<Resend API key>
NOTIFICATION_EMAIL_FROM=<verified sender>
```

For an authorized managed smoke, `RESEND_TEST_RECIPIENT` may be one of Resend's documented
`delivered`, `bounced` or `complained` test addresses. Remove it before real delivery. Never expose
these values through `VITE_` variables.

Local correctness uses `MAIL_DELIVERY_MODE=local`, loopback `CONVEX_SITE_URL`, and a loopback
`LOCAL_EMAIL_SINK_URL`. It does not contact Resend.

## Operation

The cron is defined in `apps/apis/convex/crons.ts`. Each run records an in-app feed item when enabled,
then queues email when enabled. Feed history is bounded to 25 rows per user. Provider acknowledgement
means accepted by Resend; it does not prove inbox delivery. Pending provider work is checked on later
cron runs. Delivery stops after ten failed attempts.

The current implementation has no manual mutation for replaying a terminal intent. Correct the
configuration or source defect locally, prove it, then use an explicitly approved fixture or product
flow in the target environment. Do not clone an intent or edit its status in the dashboard.

## Inspection and smoke

Use the Convex dashboard to inspect only bounded status fields on `notificationDeliveryIntents`:
`status`, `attemptCount`, `nextAttemptAt`, `lastErrorCode`, `feedRecorded` and provider status. Do not
copy email addresses, notification data, provider responses, tokens or secrets into logs.

For a managed smoke, use disposable owner and player accounts:

1. Create one Campaign announcement or Social invitation through the product.
2. Wait for the cron and verify one eligible recipient receives one feed item and one email according
   to preferences.
3. Disable each channel and verify only future delivery is suppressed.
4. Remove access and verify the retained notification cannot expose protected Campaign content.
5. Delete the disposable accounts and verify their private notification state is removed while shared
   Campaign history remains anonymized.

Live-provider smoke requires the promotion authorization for that environment. Repository tests and
the local email sink prove application behavior before promotion.
