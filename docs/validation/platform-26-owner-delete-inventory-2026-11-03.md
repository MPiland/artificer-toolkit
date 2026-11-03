# PLATFORM-26.T1: owner permanent-delete inventory (2026-11-03)

Ruling (2026-11-03): a user can permanently delete any content they create. This inventory compares every owner-created Convex table with its delete path (API mutation and UI entry point) and with the account-deletion cascade (`apps/apis/convex/accountDeletion*.ts`, ADR 0040).

## Covered kinds

| Kind | Tables | API mutation | UI entry point |
| --- | --- | --- | --- |
| Authored content | `authoredRoots` | `content/deletion.deleteActive` | `data/authoredOperations.ts` |
| Authored drafts | `authoredDrafts` | `content/drafts.discard` | `data/authoredOperations.ts` |
| Campaigns | `campaigns` | `campaigns/deletion.remove` | `CampaignSettings.tsx` |
| Scenes | `sceneDefinitions`, `sceneDefinitionSaves` | `scenes/definitions.remove` | **new** `vtt/SceneDeleteAction.tsx` (was API-only) |
| Vehicles | `campaignVehicles` | `campaigns/vehicles.remove` | `CampaignVehicles.tsx` |
| Notebooks | `campaignNotebookSections` | `campaigns/notebooks.remove` | `CampaignNotebook.tsx` |
| Session notes | `campaignSessionNotes` | `campaigns/sessionNotes.remove` | `CampaignSessionNotes.tsx` |
| Session references | `campaignSessionReferences` | `campaigns/sessionReferences.remove` | `CampaignSessionReferences.tsx` |
| Chat messages | `campaignConversationEntries` | `campaigns/chat.unsend` | `CampaignChat.tsx` |
| Currency systems | `campaignCurrencySystems` | `campaigns/currencySystems.remove` | `CurrencySystemEditor.tsx` |
| Social listing drafts | `socialListings` | `social/listingDrafts.remove` | `SocialListingFormPage.tsx` |
| Uploaded media | `mediaAssets` | `media/authoredAssets.remove` | `data/media.ts` |
| Roll history | `userRollHistory` | `rolls.discard` | `data/rolls.ts` |
| Encounter blueprints | `encounterBlueprints`, `encounterBlueprintUpdates` | **new** `encounters/blueprints.remove` | **new** "Delete saved encounter" in `CampaignEncounters.tsx` |

## Gaps fixed

- **Encounter blueprints** had no delete. `blueprints.remove` is owner-only (missing row and non-owner both answer "unavailable"). The row delete and usage-counter sync live in `encounters/blueprintDeletion.ts` (`deleteBlueprintRow`) and are shared with the account-deletion FINISH step (one home per cascade). Update receipts are purged in bounded batches by the self-rescheduling `purgeUpdates`. Runs created from a blueprint hold their own snapshot (no `blueprintId`), so existing encounters are unaffected.
- **Scene delete** had an API mutation and no UI. `SceneDeleteAction` adds a confirmed "Delete scene" action to the Scene editor; deleting clears the selection.
- A shared `ConfirmDeleteModal` (`apps/web/src/components/ConfirmDelete`) backs both confirmations.

## Pending (reported for a ruling, not guessed)

| Kind | Tables | Question |
| --- | --- | --- |
| Characters | `characters`, `characterPlayStates`, `characterDrafts` | BUILDER-5 owns it. |
| Campaign announcements | `campaignAnnouncements` | Delivered to members as notifications: does deleting retract them? |
| Campaign sessions | `campaignSessions` | Other members own notes, RSVPs and attendance on the session. |
| Custom sources, reusable definitions | `contentSources`, `reusableDefinitions`, `reusableDefinitionDrafts` | Other accounts and Campaigns may depend on a published source. |
| Import jobs | `importJobs`, `importPreviewSessions` | Job history with created content attached. |
| Published Social listings | `socialListings` (OPEN/CLOSED) | Carry other accounts' applications. |
| VTT map uploads | `mediaAssets` | Share the table with Scene references. |

## Coverage test and limits

`apps/apis/convex/ownerDeletionCoverage.test.ts` detects owner-keyed tables from the schema (fields `ownerUserId`, `authorUserId`, `creatorUserId`, `createdByUserId`, `userId`, `recipientUserId`) and fails unless each is a covered kind, a pending kind, or an exempt table with a reason. For covered kinds it also checks the API mutation exists and the UI file calls it. Limit: Campaign-scoped tables with no owner field (vehicles, Scenes, sessions) are caught only when listed in the registry.

## Proof files

- `apps/apis/convex/ownerDeletionCoverage.test.ts` (31 tests; red before the fix on Scenes UI and blueprint API/UI)
- `apps/apis/convex/encounters/blueprints.test.ts` (signed-out and non-owner refusals, owner delete with 65 receipts drained, usage 1→0, repeat refused)
- `apps/web/src/domains/campaigns/vtt/SceneDeleteAction.test.tsx` (confirm gate, call shape, cancel, refused delete)
