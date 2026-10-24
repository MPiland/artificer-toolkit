# Slice RELIABILITY-8.T4: shared web rules written once

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

- **RELIABILITY-8.T4** closes AC RELIABILITY-8.7. Its ledger note lists every site.
  - Enum labels go through `formatEnumLabel`, and the local copies are deleted.
  - `ReferenceOption` is one type.
  - The Campaign owner-and-active permission comes from a server capability flag on the Campaign read, which replaces the 12 inline `role === 'OWNER' && status === 'ACTIVE'` checks. The server still enforces it.
  - The social admission lists share one paginated pending/history query and merge path.
  - Username messages and form feedback are shared, `SignInForm` uses `useHydrated`, and the duplicated dice-roll dismiss effect is merged.
- Stay out of the authored-form factory, the Guided<Subject>Authoring files and `authoringNodeDefaults.ts`. Those belong to RELIABILITY-8.T1–T3 ([slice-reliability-8.md](slice-reliability-8.md)), which runs at the same time.

## Log
