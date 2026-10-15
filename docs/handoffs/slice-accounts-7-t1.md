# Slice workbook: ACCOUNTS-7.T1 (tiered username moderation, Q22)

**Status:** in progress
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

`validateUsername` (`packages/shared/src/domains/account/usernamePolicy.ts`) refuses any name with a profanity substring, before and after a digit swap. It uses `@2toad/profanity` with `wholeWord: false`, so it refuses Cassandra, Classic, Dickens, Essex, Glasshouse and Assassin.

Replace it with the tiered policy the product owner approved in Q22 (see "Resolved" in `docs/handoffs/phase-08-2-decisions.md`):

1. **Normalize:** lowercase, digit and look-alike swaps, collapse repeated letters.
2. **Parts:** split at `_`, at lower-to-upper case changes and at letter-digit changes. Refuse a name with a blocked part.
3. **Unambiguous terms** (slurs and stems that never occur inside ordinary words) are refused anywhere, even inside one part. Short ambiguous terms (ass, dick, cum, tit) are refused only as a whole part. A maintained allowlist covers known false positives.
4. **Compounds:** an unbroken part such as `assmuncher` is refused when it splits into a blocked word plus dictionary words. This runs on the server only (Convex signup and rename), so the web bundle carries no dictionary. The client check stays advisory; the server is the authority (AC ACCOUNTS-7.1).
5. Keep the reserved names, the length limits, the pattern and the one message (`USERNAME_NOT_ALLOWED_MESSAGE`).

Evaluate the maintained `obscenity` npm library first, for its blocklist, allowlist and look-alike handling. Adding it, and removing `@2toad/profanity`, is approved if it fits. Record what you compared in the status log. If neither library gives a usable dictionary for step 4, use the smallest maintained English word list that does, and keep it out of `packages/shared` code the web imports.

Escalate (`SendMessage` to the main session) only if:

- the server-only compound check needs a new Convex action, or adds work to the signup transaction beyond Convex limits; or
- the dictionary costs more than about 1 MB in the Convex bundle.

## Closes

- AC ACCOUNTS-7.4.

## File scope

- `packages/shared/src/domains/account/**` and its tests.
- `apps/apis/convex/betterAuth/options.ts` and `apps/apis/convex/accountProfileCommands.ts`, for wiring the server-only check.
- `package.json` files for the dependency change, plus `yarn.lock`.

## Red-first checklist

1. **Unit, against the real `validateUsername`:**
   - accepted: Cassandra, Classic, Dickens, Essex, Glasshouse, Assassin, Scunthorpe;
   - refused: `ass_muncher`, `AssMuncher`, `Ass1Muncher`, `a55_muncher`, plus a reserved name and a too-short name.
   - Red on base for the accepted list.
2. **Server compound:** `assmuncher` is refused through the real Convex signup path (`accountJourneys.test.ts` style), and `cassandra` is accepted.
3. **Rename:** `accountProfileCommands` applies the same server check.
4. CI on `ci/accounts-7-t1`. The web username field tests stay green.

## Status log

- 2026-10-15: workbook written.
- 2026-10-15: **Library comparison.**
  - `obscenity@0.4.6` (MIT, no dependencies, 153 KB unpacked, updated 2026-01). Adopted for its matcher, transformers (look-alike characters, leetspeak, repeat collapsing) and per-phrase allowlist. Its English dataset is prefix-anchored (`|ass` with a whitelist of ass-words), so used as shipped it still refuses Assyrian or Dickson. The slice builds its own dataset from it: `ass`, `dick`, `cum`, `tit` become whole-part patterns, `asshole`/`dickhead`-style dictionary profanities are added as unambiguous phrases, and a small global allowlist (Penistone, Fukushima, Fukuoka, Fukui) is added.
  - `@2toad/profanity`: substring or whole-word only, no allowlist, no repeat or look-alike handling. **Not removed**: `packages/shared/src/domains/campaign/campaignTextPolicy.ts` still uses it (out of this slice's scope). Follow-up: move that policy to obscenity and drop the dependency.
  - Dictionary for the server compound check: `an-array-of-english-words` (3.3 MB) and `word-list` (about 2.7 MB) exceed the 1 MB budget; the `subtlex-word-frequencies@2.0.0` package is 3.6 MB of JSON and cannot be tree-shaken. Vendored instead: 72,321 lowercase words of four or more letters generated from subtlex by `yarn workspace @artificer-toolkit/shared generate:username-words` into `usernameWordList.ts` (656 KB, imported only by `usernameServerPolicy.ts`, subpath `@artificer-toolkit/shared/account/usernameServer`). No new Convex action; the check is a pure function inside the existing validators. No escalation trigger hit.
- 2026-10-15: **Design.** `validateUsername` checks the lowercased, digit-resolved name joined without `_` for unambiguous terms, and every part of two segmentations: split at `_`, case changes (also digit-to-uppercase) and as a second segmentation also at letter-digit changes (`Ass1Muncher` → `ass`); the unsplit digit form catches `a55_muncher`. `validateUsernameOnServer` adds the compound check: a part that is not itself a dictionary word is refused when it segments into a blocked word (`ass`, `dick`, `cum`, `tit`) plus dictionary words.
- 2026-10-15: **Premise changes (flagged).** `usernamePolicy.test.ts` listed `assassin` as refused; Q22 requires it accepted, so it moved to the accepted list. `Tit4n`-style names are refused by design (the letter-digit split yields the part `tit`).
- 2026-10-15: **Red.** Local: `local-validation/accounts-7-t1/red-shared.log` (28 failures against the base policy; the server-policy file already existed in the tree, so its failures there are import-shaped and not evidence). CI run 38794114559 on commit f9efc866f (tests only): `usernamePolicy.test.ts` accepted-name cases fail and `usernameModeration.test.ts` 3/3 fail (`local-validation/accounts-7-t1/ci-red-failed.log`). The first CI attempt asserted status 422 for the refusal; Better Auth returns 400, corrected before green.
- 2026-10-15: **Green (shared).** `green-shared.log`: 2 files, 55 tests pass. Pending: CI on the green commit.
- Not run here: Storybook (not applicable), web username-field tests (CI "Web tests").
- Note for PLATFORM-13.T7: random hex test names (`Journey_<12 hex>`) can contain `b00b`-style look-alikes for unambiguous terms (about 1 in 7,000); the server check adds a negligible compound risk. T7's own retry logic stays valid.
- Docs: no canonical guide describes username moderation, so none changed; Q22 in `phase-08-2-decisions.md` remains the record.

## Proposed ledger edits (filled by the slice session)

- AC ACCOUNTS-7.4: mark accepted once CI on `ci/accounts-7-t1` is green. Proof: `packages/shared/src/__tests__/usernamePolicy.test.ts`, `usernameServerPolicy.test.ts`, `apps/apis/convex/usernameModeration.test.ts` (signup and rename through the real Better Auth handler and `account.updateProfile`).
- Task ACCOUNTS-7.T1: done. Backlog: move `campaignTextPolicy.ts` from `@2toad/profanity` to obscenity and remove the dependency (not registered anywhere yet).
