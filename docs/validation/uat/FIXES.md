# UAT fixes

Fixes found during UAT. They ship between rounds (D212); the frozen staging build does not change
mid-round except for admin-only tooling. UAT is not tracked as PBIs; each entry links the commit
that closes it.

| # | Round | Area | Finding | Fix | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | 1 | ACCOUNTS | Inviting UAT accounts one email at a time is slow. | `authInvitationsCli:invite` takes `{ "emails": [...] }` (1–25) and reports `{ invited, failed }`. | In CI (`ci/invite-batch`) |
| 2 | 1 | ACCOUNTS | The password hint reads "Use 12 to 128 characters"; the 128 upper bound looks odd to a user. | Hint states only the minimum ("At least 12 characters"). The 128 cap stays enforced with its own error message, so passphrases and password-manager passwords still fit. Minimum stays 12 (owner, 2026-11-24). | In CI (`ci/uat-password-hint`) |
