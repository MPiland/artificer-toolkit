# Slice workbook: ACCOUNTS-7.T1 (tiered username moderation, Q22)

**Status:** done (review round: CI run 38814079911 green on d56530a07; first pass run 38798429920)
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
  - `@2toad/profanity`: substring or whole-word only, no allowlist, no repeat or look-alike handling. **Not removed**: `packages/shared/src/domains/campaign/campaignTextPolicy.ts` still uses it (out of this slice's scope). Follow-up: ACCOUNTS-7.T2.
  - Dictionary for the server compound check: `an-array-of-english-words` (3.3 MB) and `word-list` (about 2.7 MB) exceed the 1 MB budget; the `subtlex-word-frequencies@2.0.0` package is 3.6 MB of JSON and cannot be tree-shaken. Vendored instead: 72,321 lowercase words of four or more letters generated from subtlex by `yarn workspace @artificer-toolkit/shared generate:username-words` into `usernameWordList.ts` (656 KB, imported only by `usernameServerPolicy.ts`, subpath `@artificer-toolkit/shared/account/usernameServer`). Convex bundle cost: the generated `usernameWordList.ts` file is 655,751 bytes (the word list itself is slightly smaller than the file, which includes a header; about 656 KB, under the 1 MB trigger); a separate esbuild bundle measurement was not taken, and CI's Convex typecheck and shards load the module. No new Convex action; the check is a pure function inside the existing validators. No escalation trigger hit.
- 2026-10-15: **Design.** `validateUsername` checks the lowercased, digit-resolved name joined without `_` for unambiguous terms, and every part of two segmentations: split at `_`, case changes (also digit-to-uppercase) and as a second segmentation also at letter-digit changes (`Ass1Muncher` → `ass`); the unsplit digit form catches `a55_muncher`. `validateUsernameOnServer` adds the compound check: a part that is not itself a dictionary word is refused when it segments into a blocked word (`ass`, `dick`, `cum`, `tit`) plus dictionary words.
- 2026-10-15: **Premise changes (flagged).** `usernamePolicy.test.ts` listed `assassin` as refused; Q22 requires it accepted, so it moved to the accepted list. `Tit4n`-style names are refused by design (the letter-digit split yields the part `tit`).
- 2026-10-15: **Red.** Local: `local-validation/accounts-7-t1/red-shared.log` (28 failures against the base policy; the server-policy file already existed in the tree, so its failures there are import-shaped and not evidence). CI run 38794114559 on commit f9efc866f (tests only): `usernamePolicy.test.ts` accepted-name cases fail and `usernameModeration.test.ts` 3/3 fail (`local-validation/accounts-7-t1/ci-red-failed.log`). The first CI attempt asserted status 422 for the refusal; Better Auth returns 400, corrected before green.
- 2026-10-15: **Green (shared).** `green-shared.log`: 2 files, 55 tests pass.
- 2026-10-15: **Green (CI).** The first green attempt (run 38796582621, commit 25caf43b3) failed in "Build packages" on TS2488 (`whitelistedTerms` is optional in obscenity's `build()` type); fixed in 4f687ed7f. Run 38798429920 on 4f687ed7f: all 8 jobs green (build, web and Convex typechecks, package and Worker tests, web tests, Convex shards 1-4), including `usernameModeration.test.ts` with `{ status: 400, code: 'INVALID_USERNAME' }`. Log: `local-validation/accounts-7-t1/ci-green2-watch.log`.
- 2026-10-15: **Merge review round (frozen list B1, S1-S4, S6, N1-N8).** Red first: `red2-shared.log` (22 failures against the reviewed code, commit b28c7e9b3, tests only). Then:
  - **B1:** `usernameModerationCandidates` (renamed from `usernameModerationParts`) now also holds the name joined without `_` and its case-insensitive `_`-only parts, deduplicated (N3). The client matcher checks every candidate (N5: `hasBlockedTerm` inlined); the server compound check runs on every candidate, so the joined form is covered. `My_aSS`, `Big_DiCk`, `aSS_Muncher` are refused on the client; `a_ss_muncher`, `aSSmuncher` on the server.
  - **S1:** the dictionary Set is built on the first compound check, not at module load.
  - **S2:** two- and three-letter words are in the dictionary behind a frequency floor of 1,000 in the subtlex corpus (generator updated, list regenerated: 72,595 words, `usernameWordList.ts` 656,850 bytes, under 1 MB). `Dickson` needed the allowlist (`allowedUsernameTerms`, which the server now also treats as dictionary words) and so did `cockpit`, which the matcher's `|cockp` pattern refused on the client already.
  - **S3:** repeated-letter padding is matched by run length instead of three collapsed variants: a name's run of a letter may be longer than the word's run but never shorter, so `assmuncherrr`, `diickmuncher`, `cuummuncher` and `aassmuncher` are refused while `asmuncher` is not. The 3+→1 variant alone would not refuse `diickmuncher` or `cuummuncher` (two letters, and a seam letter that `muncher` shares), so this replaces it. No padding gap is known; a gap would be a letter that the name pads while a _different_ word is read through it, which the segmentation search would have to cover.
  - **S4:** the compound check's blocked words are `wholePartUsernameTerms`, derived from the english dataset (every phrase with a pattern bounded on both sides) plus ass, dick, cum and tit that replace the dataset's prefix patterns. `cocklover`, `sexmachine`, `prickface` are refused; `Essex`, `Cockpit`, `Sextant` stay accepted.
  - **S6:** `.oxlintrc.jsonc` forbids `@artificer-toolkit/shared/account/usernameServer` in `apps/web/**` (probe file confirmed the rule fires, then deleted).
  - **N1/N2, N4, N6, N8:** the phrases are an array of `{ term, patterns }`; the no-op `.replace(/[^a-z]/g, '')` is gone; `|cums|` is a cum pattern; `assman` is in `profaneCompounds`; the byte size wording is corrected.
  - **Probe of false positives (throwaway test, deleted):** `Dickinson`, `Hitchcock` and `Middlesex` were refused by the short-word dictionary (dick + in + son, hit + cock, middle + sex) and are now on the allowlist with accepted-name tests. `Assassin_Creed`, `Titan_Fall` and `Compass_Rose` were refused by the joined-form check (B1(b)) with S2 short words; fixed in the follow-up below. Accepted in the probe: Bassett, Cummins, Glass_House, Hannah_Montana, Peacock, Sussex. The long tail of surnames that read as blocked term + short words still needs the allowlist.
  - **Joined-form exemption (main session ruling):** the server skips the joined candidate when every other candidate (`_`, case and letter-digit part) is a dictionary or allowlisted word, so `Assassin_Creed`, `Titan_Fall`, `Compass_Rose` and `TitanFall` are accepted. Any non-word part keeps the joined check: `a_ss_muncher` (`a`, `ss`) and `aSSmuncher` stay refused, `My_aSS`, `Big_DiCk` and `aSS_Muncher` stay refused through their `ass` / `dick` part. An unbroken `Titanfall` is still read as one part and refused. Red: `red3-shared.log` (4 failures); green: `green4-shared.log` (88 pass).
  - **CI (review round):** run 38814079911 on d56530a07, all 9 jobs green (build, web and Convex typechecks, package and Worker tests, web tests, Convex shards 1-4). Local logs: `red2-shared.log`, `green3-shared.log` (84 tests pass).
  - **Independent review (opus, read-only, HEAD 74b268a92):** every AC clause maps to a real-code test; test integrity clean. Fixed after it: B-1 one-sided dataset terms (`cunt`, `twat`, `shit`, `wank`, `turd`) now feed the compound check (`anchoredUsernameTerms`, renamed from `wholePartUsernameTerms`), so `bigcuntface` is refused; S-1 plurals of blocked terms (`bigdicks`, `mytits`); S-2 dead `|titt`/`|tiddies` patterns replaced by post-collapse `|tity`/`|titie` (`titty`, `TittyLover` refused; `Tiddies` is indistinguishable from `tidies` after collapsing and is not covered); `shuttlecock` allowlisted; R1 signup test for `TitanFall` (passes in CI run 38822620315, so the Better Auth validator sees the typed casing; no change needed). CI: run 38822620315 on 0dbce74b6, all 9 jobs green. Logs: `red4-shared.log`, `green6-shared.log` (103 pass). **Recorded, not fixed:** (a) S-3 the subtitle dictionary exempts profane dictionary words (`Whoremonger`, `Whorehouse`); (b) the joined-skip passes two-word names whose join hides a term across the boundary (`AlasSlicker`; reviewer suggests refusing only segmentations where a blocked piece crosses a part boundary); (c) a junk-letter affix (`xshitx`, `xassx`) is not segmentable and passes the compound check; (d) untested: max length 30, Fukushima/Fukuoka/Fukui; (e) the `removePhrasesIf` predicate collects terms as a side effect.
  - **Merge review round 2 (frozen list B1-B3, D1; phase branch merged as 78e60a804f).** Red: `red5-shared.log` (25 failures, commit 25516c08e; the two sign-in tests are red in CI run 38825781248). Then:
    - **B1:** the compound check now counts pieces. A candidate is refused when it reads as a blocked term plus dictionary words and no reading as non-blocked dictionary words uses fewer pieces; a tie keeps the blocked reading (`asslicker` = ass + licker = as + slicker; `bigdicks`, `assmuncher` stay refused). `titanslayer`, `titanqueen`, `basstitan`, `Titanfall_Fan`, `compassrose`, `Cuminseed` are accepted. Blocked words (terms and their plurals) are excluded from the clean word index. `shithead` moved into `profaneCompounds` (client pattern) because `big` + `shithead` would otherwise read as clean.
    - **B2:** `assman` is the whole-part pattern `|assman|` (Glassman, Bassman, Grassman, Hassman, Brassman, Glass_Man accepted; `assman` still refused). Allowlist: titus, dickerson, pettit, cockburn, bluetit (so TitusLee, matthewtitus, Pettitt follow).
    - **B3:** `usernameValidator` is `isUsernameFormatValid` (length and character set; exported from `account/username`). Moderation moved to the `before` hook in `authFactory.helper.ts` for `/sign-up/email` and `/update-user` (username and displayUsername), same 400 `INVALID_USERNAME`; rename through `account.updateProfile` still validates first. The `displayUsernameValidator` is gone. Convex tests: a `TitanSlayer` account signs in as `titanslayer`, and an account renamed to `AssMuncher` after sign-up still signs in.
    - **D1:** allowlist Annalise, Analise, Shital, Shittu, Shiitake.
    - **Deferred (recorded, not done):** D2 (coupling of candidate order and mixed splittings), D3 (isolate parse cost of the word list), N1 and N2 (round-1 review nits), and the dataset refusals of Hitler, Scrotum and Testicles. Also still open from the independent review: S-3 (profane dictionary words such as `Whoremonger` pass), `AlasSlicker`-style joins, junk-letter affixes (`xassx`); `/invitation/redeem` signs up through `betterAuth({...options})`, so it runs the same hook (no change needed). Logs: `green7-shared.log` (129 pass).
- Not run here: Storybook (not applicable), web username-field tests (CI "Web tests").
- Note for PLATFORM-13.T7: random hex test names (`Journey_<12 hex>`) can contain `b00b`-style look-alikes for unambiguous terms (about 1 in 7,000); the server check adds a negligible compound risk. T7's own retry logic stays valid.
- Docs: no canonical guide describes username moderation, so none changed; Q22 in `phase-08-2-decisions.md` remains the record.

## Proposed ledger edits (filled by the slice session)

- AC ACCOUNTS-7.4: mark accepted once CI on `ci/accounts-7-t1` is green. Proof: `packages/shared/src/__tests__/usernamePolicy.test.ts`, `usernameServerPolicy.test.ts`, `apps/apis/convex/usernameModeration.test.ts` (signup and rename through the real Better Auth handler and `account.updateProfile`).
- Task ACCOUNTS-7.T1: done. Moving `campaignTextPolicy.ts` from `@2toad/profanity` to obscenity and removing the dependency is registered as ACCOUNTS-7.T2 (AC ACCOUNTS-7.5).
