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

## Proposed ledger edits (filled by the slice session)
