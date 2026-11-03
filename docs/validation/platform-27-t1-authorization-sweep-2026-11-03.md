# PLATFORM-27.T1: Convex authorization sweep (2026-11-03)

Closes PLATFORM-27.1 and PLATFORM-27.2. Branch `platform-27-authz`, based on `codex/phase-08-2-convex-cutover`.

## Result

- There are 295 client-callable public Convex functions (136 queries, 140 mutations, 19 actions, after excluding the Better Auth component's 8) and 14 HTTP routes. Each one has a declared access rule.
- The audit found no function that takes its caller's identity from its arguments.
- It found no confirmed cross-user read or write, no unauthenticated write, and no write path to master or seeded content.
- No code fix was needed. Seven findings are product questions, listed under [Rulings needed](#rulings-needed). Two low-impact items are deferred as edge cases.
- Coverage test: `apps/apis/convex/publicFunctionAccess.test.ts`. It has three parts:
  1. It enumerates every exported public `query`/`mutation`/`action` at runtime (Convex's `isPublic` flag) and fails if any function has no rule or any rule has no function. A `public` or `development` rule must also give a reason.
  2. It scans every argument validator, at any depth, for fields named `*userId(s)` and fails unless each one is declared in `USER_ID_ARGS` with why it is not the caller's identity.
  3. It compares `http.getRoutes()` with the declared route rules and sends each of the 11 live-session routes a request without the Worker secret. Every one must answer 401.
- Red proof: removing the `social/reports:create` rule fails part 1 with `['social/reports:create']`.

## Rules

Every rule except `public` and `development` gets the caller from `ctx.auth` through `requireIdentity` or `getAuthenticatedProfile` (`apps/apis/convex/lib/identity.ts:48-78`). That read also refuses banned accounts (`identity.ts:51`). Campaign rules use `requireCampaignAuthority` (`campaigns/authority.ts:97-106`), which refuses with `CAMPAIGN_NOT_FOUND` unless the caller holds an ACTIVE membership.

| Rule        | Count | Meaning                                                                                                                                                      |
| ----------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| self        |    61 | Reads or writes only the caller's own records, keyed by that identity.                                                                                       |
| owner       |    62 | The caller must own the record that a client-supplied id names.                                                                                              |
| member      |    78 | The caller must be an active Campaign member. Assignment, visibility and authorship checks narrow this further.                                              |
| gm          |    67 | The caller must hold the Campaign owner role.                                                                                                                |
| superadmin  |     5 | `requireSuperadmin`: superadmin role and a verified email (`identity.ts:80-87`).                                                                             |
| signedIn    |     8 | Any signed-in caller, filtered by the target's visibility (public profiles, open public listings, report evidence).                                          |
| public      |     9 | Signed-out callers are allowed for a reviewed reason (below).                                                                                                |
| development |     5 | `requireFixtureAccount` (`lib/developmentFixtures.ts:5-17`): localhost `SITE_URL` and a `draft_<hex>@example.invalid` account. Fails closed everywhere else. |

Public functions and their reasons:

- `account:session` is the session bootstrap. Signed-out and banned callers get `user: null` (`account.ts:115-155`).
- `application:featureFlags` returns deployment flags only. The sign-up page needs them before sign-in (`application.ts:12-19`).
- `content/details:get` and `content/catalogue:counts` serve platform (SRD) reference content. Owned roots and drafts still require their owner (`content/details.ts:55-74`, `content/documents.ts:213-227`).
- `content/systems:get/summary/list` read a `systems` table that only the internal import writes (`content/import.ts:192`), so it holds only platform Systems (`content/systems.ts:95-96`).
- `media/authoredAssets:binding` and `media/authoredActions:getImage` serve platform content art. `canReadAuthoredRoot(null)` is true only for PLATFORM roots, and draft art requires the draft owner (`media/authoredAssets.ts:62-88`).

## Arguments that name a user

None of these is used as the caller's identity. `USER_ID_ARGS` in the test records each one with its meaning:

- `characters/commit:commit` and `characters/drafts:save` carry `userId` in the Character payload. The server replaces it with the caller (`characters/documents.ts:314`, `characters/drafts.ts:47`).
- `campaigns/chat:list/send` and `campaigns/conversations:open` take `directUserId`, the direct-message peer. The peer must be an active member (`packages/encounter-persistence/src/conversationPersistence.ts:36-39`).
- `campaigns/characterControllers:setControllers` takes `controllerUserIds`. This is GM only, and each controller must be an active PLAYER (`characterControllers.ts:24-41`).
- `campaigns/membershipDeparture:removeMember` takes `userId`, the member being removed. This is GM only (`membershipDeparture.ts:67-74`).
- `campaigns/ownership:request` takes `recipientUserId`. This is GM only, and the recipient must be an active PLAYER (`ownership.ts:23-33`).
- `scenes/definitions:append` takes `controlledByUserIds`, the controllers the GM authors. GM only.
- `scenes/fogReads:chunks` takes `ownerUserId`, which selects a fog layer. A player may read only their own layer or the shared one (`scenes/fogReadDocuments.ts:65-76`).
- In the two development rollback actions, `ownerUserId` must equal the caller (`campaigns/developmentLifecycle.ts:1398`, `encounters/developmentLifecycle.ts:52`).

## HTTP routes

| Route                                                                                                                                     | Rule                                                                                                                                   | Evidence                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `GET /.well-known/openid-configuration`, `GET\|POST /api/auth/*`                                                                          | Better Auth provider routes, limited to `SITE_URL` origins                                                                             | `http.ts:21-23`                                                                                                  |
| `POST /live-sessions/bootstrap`, `/capture`                                                                                               | Worker secret plus the member's own JWT. The internal reads require the JWT identity to equal `expectedUserId` and the role to match.  | `liveSessions/stateHttp.ts:139-152`, `transientHttp.ts:26-40`, `bootstrap.ts:17-24`, `transientCapture.ts:76-79` |
| `POST /live-sessions/{activate,begin-drain,checkpoint,present,recover-storage,release,room-authorization,room-inputs,room-scene-capture}` | Worker secret, compared in constant time, then the room's epoch fence. A missing or short secret answers 503; a wrong one answers 401. | `liveSessions/stateHttp.ts:139-152`; epoch fences in `liveSessions/authority.ts`                                 |

## Inventory

Each line lists the function, its rule and the evidence `file:line` (relative to `apps/apis/convex/`) for the identity read and the check. `ID` means `requireIdentity` (`lib/identity.ts:74`). `AUTH` means `requireCampaignAuthority` (`campaigns/authority.ts:97`). `CHAR` means `requireCampaignCharacterAuthority` (`campaigns/characterState.ts:12`), which allows the GM or the player the Character is assigned to.

### Account, notifications, rolls

- `account`
  - `profile`, `identity`, `setProfileVisibility`, `setAuthoringExperience`, `rollPreferences`, `setAutoRollDice`, `setGmRollVisibility`: self (`account.ts:44-206`).
  - `updateProfile`: self, through the internal `accountProfileCommands:update` (`accountProfileCommands.ts:18-37`).
  - `publicProfile`: signedIn (`lib/identity.ts:26-38`).
  - `session`: public.
- `accountEntitlements:get`: self (`accountEntitlements.ts:22-30`).
- `application:featureFlags`: public.
- `notifications`
  - `feed`, `markAllSeen`, `preferences`, `updatePreferences`: self (`notifications.ts:24-88`).
  - `markRead`: owner, through the `by_userId_id` index (`notifications.ts:52-57`).
- `rolls`
  - `execute`: owner (`rollDocuments.ts:49-54`).
  - `executeConfiguration`, `addAfterRollDie`, `declineAfterRollDice`, `history`, `discard`, `clearHistory`: self, all keyed on `by_userId_*` (`rolls.ts:39-134`, `rollDocuments.ts:113-170`).

### Campaigns

- `announcements`: `list` and `get` are member, and PARTY-scoped announcements are limited to party members (`announcements.ts:64-120`). `create` is gm (`:129-132`).
- `archive:archive`: gm (`archive.ts:18-21`).
- `assignments`
  - `assign`: member. A player may assign only their own Character; the GM may assign an active member's Character (`assignments.ts:27-47`).
  - `unassign`: member, with a player limited to their own assignment (`:111-123`).
- `characterControllers:setControllers`: gm (`characterControllers.ts:22-41`).
- `characterSheet`
  - `get` and `basics`: member, through `readCampaignCharacterReader` (`characterState.ts:54-67`), with party visibility applied (`characterSheet.ts:85`).
  - `executeRoll`, `panel`, `preparationOptions`, `restPreview`, `execute`: CHAR. Sheet commands limit the GM through `assertCampaignGmSheetCommandAllowed`.
- `chat`
  - `list` and `send`: member (`chat.ts:41-141`).
  - `edit` and `unsend`: member, and only the author may change an entry (`chat.ts:186-238`).
- `clock`
  - `get`: member (`clock.ts:223-224`).
  - `recoveryPrompts`: gm (`clock.ts:239-241`).
  - `dismissRecoveryPrompt` and the commands `initialize`, `configure`, `start`, `pause`, `advance`, `rewind`, `reset`, `reconcile`: gm, through `requireClockOwner` (`clock.ts:102-107, 175`).
- `contentShares`
  - `list`: member.
  - `share`: member with the `shareOwnedContent` capability, and the caller must own the content (`contentShareCommands.ts:24-51`).
  - `unshare`: the GM or the member who shared it (`contentShareRemoval.ts:173-188`).
- `conversations`: `open`, `list`, `markRead` are member (`conversations.ts:26-98`).
- `copy:copy` and `copyJobs:begin`: gm (`copy.ts:77-78`, `copyJobs.ts:181-186`).
- `copyJobs:progress`, `copyJobs:cancel`: owner of the job. `copyJobs:list`: self (`copyJobs.ts:390-441`).
- `create:create`: self. Only platform catalogues are accepted and the entitlement limit applies (`create.ts:31-109`).
- `currencySystems`: `list` is member. `save` and `remove` are gm (`currencySystemCommands.ts:80-217`).
- `deletion`
  - `status`: owner of the deletion job (`deletion.ts:21-26`).
  - `remove`: gm (`deletionCommands.ts:20-48`).
- `developmentLifecycle:verifyDeletionRollback`: development.
- `events:list`: CHAR (`events.ts:23-36`).
- `gmReads:adjustments` and `gmReads:conditions`: CHAR. A player sees only VISIBLE entries (`gmReads.ts:18-58`).
- `gmWrites`: all four are gm (`gmWrites.ts:33-41`).
- `inventoryAudit:list`: gm.
- `inventoryCleanup`: `pending` is member with vehicle cargo access. `retry` is gm.
- `inventoryOwners`: `version` and `transferVersions` are member. The source side requires the GM or the assigned player (`inventoryCharacter.ts:25`).
- `inventoryTransfers:transfer`: member. The source must be the caller's own Character or the party inventory; a Vehicle source requires the GM (`inventoryTransferCommands.ts:28-114`).
- `membershipDeparture`: `leave` is member. `removeMember` is gm (`membershipDeparture.ts:67-138`).
- `notebooks`, `sessionNotes`
  - `list`: member. A player sees SHARED entries and their own.
  - `create`: member. Only the GM creates non-NOTE kinds.
  - `update`: member, author only.
  - `remove`: member, author or GM (`notebooks.ts:50-176`, `sessionNotes.ts:75-194`).
- `ownership`
  - `request`: gm (`ownership.ts:23-33`).
  - `accept`: only the pending transfer's recipient (`:55-74`).
- `partyInventory`: `items`, `currencies`, `equipmentOptions` are member. `partyInventoryCommands:mutate` is gm.
- `playSettings`: `get` is member, with GM-only text filtered out. `options` is member. `save` is gm.
- `queries`
  - `get`, `liveAuthority`: member.
  - `settings`, `contentUsage`: gm.
  - `list`: self, re-checking authority for each row (`queries.ts:88-112`).
- `rolls`
  - `execute`: member. A Character roll uses CHAR; a roll without a Character requires the GM (`campaigns/rolls.ts:140-156`).
  - `executePrivate`, `reveal`: gm.
- `sessionAttendance`: `list` is member. `set` is gm.
- `sessionFinish:finish`: gm.
- `sessionReferences`: all three are gm.
- `sessionRsvps`: `list` is member (empty for non-GM). `set` is member and writes only the caller's own row.
- `sessions`: `list`, `get`, `latestOpen` are member. `create` and `update` are gm.
- `update:update`: gm.
- `vehicleInventory`: member. Vehicles that are UNAVAILABLE are hidden from players.
- `vehicles`
  - `list`, `definitionOptions`: member.
  - `create`, `update`, `remove`, `lifecycle`: gm, enforced in the internal `vehicleCommands` and `vehicleLifecycle`.

### Characters

- `drafts:create`: self. `drafts:list`: self.
- `drafts:get`, `drafts:save`, `drafts:discard`: owner. Each compares `draft.userId` with the caller (`characters/drafts.ts:137-278`).
- `commit:commit`: owner (`characters/documents.ts:297`).
- `builder:activeCharacter`: owner (`characters/builder.ts:36-42`).
- `list:list`: self (`characters/list.ts:17-21`).
- `sheet:get`, `panels:get`, `preparationOptions:get`, `rest:preview`, `equipmentOptions:list`, `extraOptions:list`, `sheetCommands:execute`: owner (`characters/sheetInputs.ts:56-73`). With a `campaignId`, CHAR applies instead.
- `sheetSlices:get`, `sheetSlices:concentrationRoomRoute`, `sheetSlices:liveAuthority`: the owner, or the GM and party readers (`characterState.ts:12-69`).

### Content, authoring, imports

- `definitions`
  - `get`: owner of a USER source, or PLATFORM content (`content/definitionStore.ts:149-154`).
  - `list`: self.
  - `create`: self.
  - `saveDraft`, `publish`: owner, and PLATFORM content is refused (`reusableDefinitionService.ts:100-110, 705`).
- `drafts`
  - `list`: self.
  - `get`: owner.
  - `save`, `discard`: owner, and master content is refused (`content/draftCommands.ts:45-61`).
  - `duplicate`: copies readable content into the caller's own draft.
- `publication:publishDraft` and `classPublicationActions:publishDraft`: owner (`content/publicationPersistence.ts:115-137`, `content/classPublication.ts:88`).
- `deletion:deleteActive`: owner, and master content is refused (`content/deletion.ts:44-69`).
- `exports:get`: owner.
- `equipmentOptions:list`: self.
- `systems:capability`: self.
- `systems:get/summary/list`, `details:get`, `catalogue:counts`: public.
- `authoring/nodeRuntime:resolve` and `normalizeValues`: self.
- `contentSnapshots/access:issueAccess`, `manifest:manifest`, `manifest:catalogue`: self. The manifest covers the caller's own sources and the Campaigns where they are an active member.
- `imports/jobs`: `begin` and `list` are self. `progress` and `cancel` are owner.
- `imports/uploads`: `create` is self. `finalize` is owner.
- `imports/preview:create`: self.

### Scenes, encounters, loot, live sessions

- `scenes/definitionReads`, `scenes/definitions`, `scenes/liveReads`: gm. Each checks the OWNER role and that the record belongs to the Campaign. A draft scene save must belong to the caller (`scenes/definitions.ts:63-135`).
- `scenes/presentations`: `get` is member. `set` and `setLive` are gm (`setLive` through the `preflight` query).
- `scenes/showings`: `current` is member. `show` and `stop` are gm.
- `scenes/fogReads`, `scenes/recipientReads:header`, `scenes/recipientActions`: member, with the reveal gate and per-entity visibility applied (`scenes/liveDocuments.ts:57-80`, `scenes/recipientContext.ts:16-23`).
- `encounters/projectionReads`
  - `get`, `list`, `pendingPrepared`: member. Players get the player projection (`packages/encounter-persistence/src/sessionReads.ts`).
  - `actorSides`: gm.
- `encounters/activeReads:active`, `encounters/pendingReads:pendingRuleOccurrence`, `encounters/sceneBindings:get`: member (`encounters/readAccess.ts:12-30`).
- `encounters/activeReads:decisionSettlement`: member. See [Rulings needed](#rulings-needed) item 7.
- `encounters/actionChoices`, `encounters/actionTargetModifiers`: member, and the caller must control the actor (`NOT_ACTOR_CONTROLLER`).
- `encounters/actorTokenBindings:execute`: gm, enforced in `packages/encounter-persistence/src/actorTokenBindingPersistence.ts:57-64`.
- `encounters/healthDisplay:share`, `encounters/runs:create`, `encounters/runs:deletePrepared`: gm.
- `encounters/blueprints`: `list` and `create` are self. `update` is owner.
- `encounters/developmentLifecycle:verifyRollback`: development.
- `loot/tables`: all three are gm (`requireLootOwner`, `loot/tables.ts:39-78`).
- `liveSessions/tickets:issue`: member. The ticket's role comes from the membership row (`liveSessions/admission.ts:25-30`).
- `liveSessions/developmentMeasurement`: all three are development.

### Media

- `assets:avatar`, `createAvatarUpload`, `removeAvatar`; `avatarActions:saveAvatar`, `getAvatarImage`; `library:list`: self.
- `avatarActions:getProfileAvatarImage`: signedIn, through `readViewableProfileByUsername`.
- `authoredAssets:createUpload`, `authoredAssets:remove`, `authoredActions:save`: owner of the draft.
- `characterPortraitAssets`, `characterPortraitActions`: owner, or a member reading an assigned Character (`media/characterPortraitAssets.ts:55-79`).
- `library:attachImage`, `libraryActions:getImage`: owner of the asset.
- `vttMapAssets:createUpload`: gm.
- `vttMapActions:finalize`: owner.
- `vttMapActions:getDelivery`: the uploader, or a member while the map is the presented or shown Scene's map (`media/vttMapAssets.ts:42-85`).

### Social

- `profiles`, `blocks`, `blockLists`, `admissionLists:listOwnApplications`, `admissionLists:listReceivedInvitations`, `invitationReads:getReceived`, `listings:listOwned`, `listingDrafts:list`: self (`social/visibility.ts:8-14`).
- Listing-owner functions are owner: `listings:getOwned`, `open`, `close`, `update`; `listingDrafts:create`, `get`, `update`, `remove`; `admissionLists:listListingApplications`, `listListingInvitations`; `invitationReads:getForListing`; `invitations:create`, `revoke`; `applications:decide`. Each goes through `requireOwnedListing` / `requireOwnedCampaign` (`social/listingDocuments.ts:37-53`).
- `applications:getOwn`, `applications:withdraw`: owner (the applicant).
- `invitations:accept`, `invitations:decline`: self (the recipient).
- `discovery`, `discoveryLists`, `applications:submit`, `reports:create`: signedIn, with visibility, block and evidence checks (`social/discovery.ts:24-62`, `social/reportEvidence.ts:22-94`).
- `moderation`, `listingModeration:action`, `profileModeration:action`: superadmin (`social/moderationDocuments.ts:16-19`).

### Not client-callable

`betterAuth/adapter:*` and `betterAuth/sessionUser:get` belong to the Better Auth component (`betterAuth/convex.config.ts`). Only this app's own functions can call them, and every call site passes identity derived from `ctx.auth` (`lib/authUserReads.ts:51-60`).

## Rulings needed

Each item below is current behavior that may be intended. None reads or changes another user's data beyond what is described.

1. **GM-initiated assignment** (`campaigns/assignments:assign`, `assignments.ts:32-47`). The GM can bind any active member's ACTIVE Character into the Campaign without that player's consent, which makes it visible to the party. Is this intended?
2. **GM rolls for a player's Character** (`campaigns/characterSheet:executeRoll`, CHAR allows OWNER at `characterState.ts:33`). The roll is stored under the GM. Other sheet commands limit the GM through `assertCampaignGmSheetCommandAllowed`. Should rolls be limited the same way, given that players drive their own Characters' actions?
3. **Gifting into another player's Character inventory** (`campaigns/inventoryTransfers:transfer`, `inventoryCharacter.ts:25`). A player may push items from their own Character or the party into another member's Character without that player's consent. `inventoryOwners:transferVersions` shows the destination's version number. The source side is gated. Is this intended?
4. **Account PRIVATE vs social discovery** (`social/discovery:getProfile`, `discovery.ts:24-34`). Any signed-in viewer with an active social profile can resolve another ACTIVE social profile's username from its random public id. The account-level `profileVisibility` is not consulted. Does social participation override PRIVATE?
5. **Banned hosts stay discoverable.** A Better Auth ban refuses the banned user's own sessions (`identity.ts:51`). It does not suspend their social profile, so their OPEN PUBLIC listings stay in `discoveryLists:browse/search` until a moderator suspends the profile. Should a ban also suspend the social profile?
6. **Signed-out reference reads** (`content/details:get`, `content/catalogue:counts`, `content/systems:*`, platform art). These are currently public for platform (SRD) content. Should signed-out readers keep that access?
7. **Decision settlement for other addressees** (`encounters/activeReads:decisionSettlement`, `packages/encounter-persistence/src/sessionReads.ts:242-263`). Any member who can read the Run can learn, by occurrence id, whether a decision was answered or GM-skipped. The occurrence does not have to have been addressed to them. The leak is a single flag. Closing it would require recording each occurrence's addressees, so this is a ruling: either members may see the settlement, or it is restricted to addressees and the GM.

## Deferred edge cases (low likelihood, nothing exposed)

- `campaigns/copy:copy` and `campaigns/copyJobs:begin` check a command-id replay before `AUTH` (`copy.ts:50-75`, `copyJobs.ts:145-173`). A non-member who guesses an existing random UUID `commandId` gets "already used" instead of `CAMPAIGN_NOT_FOUND`. No data is returned, and replays are checked against the original actor.
- `characters/drafts:discard` returns `ok: true` for a draft the caller does not own, and deletes nothing (`characters/drafts.ts:268-278`).

## Notes for future work

- One shared `LIVE_SESSION_WORKER_SECRET` guards nine routes. `/present` trusts the body's `actorUserId` (the owner check still applies), and `/recover-storage` can create live authority for a Campaign that has no row yet. This trust model is the one ADR 0035 chose; a leaked secret would compromise all nine routes.
- Several public wrappers delegate the check to an internal mutation or a package (`vehicles:*`, `currencySystems:*`, `encounters/actorTokenBindings:execute`). The coverage test records the rule but cannot see whether the delegated check still runs; the existing domain refusal tests cover that.
