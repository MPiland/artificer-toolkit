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

- 2026-10-24: Implemented RELIABILITY-8.7 on `ci/reliability-8-t4`.
  - `capabilities.manageActiveCampaign` (shared `getCampaignCapabilities`, `campaignCapabilitiesDtoSchema`) replaces the 12 inline owner-and-active checks and `isCampaignTableSettingsEditable`. Server enforcement is unchanged.
  - Enum labels use `formatEnumLabel`; `ReferenceOption` is one type (`data/contentReferences.ts`).
  - The four Social admission lists share `hooks/admissionLists.ts` (`admissionPageSize`, `mergeAdmissionRows`) and `AdmissionListFooter`; `formatSocialDate` and `formatSocialTimestamp` replace inline `Intl.DateTimeFormat`.
  - Auth: `AuthFormFeedback` and `AuthFeedback` are shared by SignIn, SignUp, ResetPassword and UpdatePassword; `auth/usernameMessages.ts` is shared by SignUp, UpdatePassword and ProfileSettings. SignInForm already used `useHydrated`.
  - Dice: `useDismissRollOnClick` replaces the duplicated dismiss effect.
  - Not done, left in place on purpose: `socialSearch.ts` enum restatement (schemas are `lazySchema`, not safe without a compile) and the `forms/*` label copies (owned by T1–T3).
  - Proof tests: `packages/shared/src/__tests__/campaign-capabilities.test.ts`, `apps/web/src/domains/social/hooks/admissionLists.test.ts`, `apps/web/src/components/dice/useDismissRollOnClick.test.ts`.
