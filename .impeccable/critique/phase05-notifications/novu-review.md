# Phase 05 Novu notification review

Date: 2026-08-11

## Evidence

- Twenty deterministic confirmation captures at 1440x900 and 390x844 in light and dark modes.
- States: authenticated shell feed, grouped unread feed, empty feed, preferences, and focused deep link.
- Focused Storybook Playwright specification: 5 passed.
- Impeccable reviewer A: visual critique against `PRODUCT.md` and `DESIGN.md`.
- Isolated Impeccable reviewer B: scoped detector and source-of-truth pass; no P0/P1/P2 findings after corrections.
- Separate final audit: cancellation ordering, full-feed seen state, preference recovery, shared count subscription, and safe maturity projection confirmed; bounded confirmation pass found no remaining P0/P1/P2 issues.

## Corrections applied

- Changed notification timestamps from muted to secondary text and unread markers to the accessible accent-text token.
- Replaced the stacked browser/custom deep-link outline with one Forge focus treatment.
- Added one empty-state action that navigates to Social Hub and closes the desktop drawer.
- Corrected the deterministic Novu session/count mocks exposed by the browser run.
- Applied the Standard Social text projection before storing listing titles in notification intents; bounded bulk expiry copy uses a neutral listing label.
- Enforced cancellation ordering so a cancellation suppresses a deferred trigger retry and waits for a current provider attempt before cancelling.
- Marked the full provider feed seen while retaining the 25-item product history cap.
- Blocked preference edits when provider state fails to load and shared one unseen-count subscription across responsive bell variants.
- Made the preference Retry path recover even when the Novu hook retains its prior error object after a successful refetch.

## Deliberate non-change

Reviewer A suggested event-kind glyphs. They were not added: titles and copy already identify applications versus invitations, and decorative per-kind chrome is not required for comprehension or action.

## Remaining external gate

Live Novu workflow synchronization, Resend delivery, provider preference enforcement, duplicate dispatcher behavior, and staging deep links require the deployment smoke in `docs/runbooks/notification-delivery.md`.
