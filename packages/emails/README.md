# @artificer-toolkit/emails

Branded React Email templates and pure renderers for Artificer Toolkit authentication and Social Hub
messages.

Current Convex actions import `renderAuthEmail` and `renderSocialNotificationEmail`, then deliver the
validated output through the native email transport and `@convex-dev/resend` component. This package
owns presentation only; it does not own recipients, retries, provider state or notification
persistence. Browser code never imports it.

```text
yarn workspace @artificer-toolkit/emails dev
yarn workspace @artificer-toolkit/emails build
yarn workspace @artificer-toolkit/emails test
```

Templates use portable design-system primitives, inline email-safe styles, text-first branding and
plain-text fallbacks. Do not add web CSS, Mantine components, private assets or unvalidated
user-controlled content.

See the [Convex notification delivery runbook](../../docs/runbooks/convex-notification-delivery.md).
