# Platform foundation — UAT scenarios

Feature `PLATFORM` in the [phase ledger](../../roadmap/08-phase-ledger.json). Set up first: [README](README.md#setup).

PLATFORM is mostly infrastructure. What a tester can see is: the SRD content is present and browsable, images can be uploaded, viewed and removed with the right privacy, and account emails are requested from the app. Everything else is proved by its ledger tests and is listed under Covered elsewhere.

## UAT-PLATFORM-1: SRD content is present and browsable

- **Covers:** PLATFORM-2.3, PLATFORM-5.2
- **Accounts:** GM
- **Preconditions:** Review data built ([README](README.md#review-data)).

**Steps**

1. **GM:** Sign in and open http://localhost:3000/systems.
2. **GM:** Note how many Game Systems are listed, then open the SRD System.
3. **GM:** On the System page, look through the catalogues it shows (for example Rules Catalogues and reusable definitions) and open one entry.
4. **GM:** Open http://localhost:3000/spells. In **Search spells**, type "Fireball" and open the result.
5. **GM:** Open http://localhost:3000/creatures, search "Wolf", open it, go back, search "Goblin", open it.
6. **GM:** Open http://localhost:3000/classes and find Fighter. Open http://localhost:3000/races and find the Dragonborn. Open http://localhost:3000/backgrounds, http://localhost:3000/feats, http://localhost:3000/vehicles and confirm each list has entries.
7. **GM:** Open http://localhost:3000/equipment, search "Healer" and open "Healer's Kit".
8. **GM:** Reload the Fireball page and the Wolf page.

**Expected**

- The Systems list shows the SRD System, and its page opens without an error.
- Every catalogue above lists SRD entries and each entry opens a read-only detail page with its full text (no empty or "not found" page).
- Searching narrows the list to matching names; clearing the search restores the list.
- Reloading a detail page shows the same content.
- The SRD entries are marked as SRD content (not Homebrew) and show no edit controls other than the copy action ("Duplicate to edit"); see [AUTHORING](AUTHORING.md) for the lock and copy checks.

**Other users see**

- Not applicable: single user.

## UAT-PLATFORM-2: Upload, replace and remove an avatar

- **Covers:** PLATFORM-4.1, PLATFORM-4.2, PLATFORM-4.4
- **Accounts:** P3
- **Preconditions:** Review data built. Have a small valid PNG or JPEG on your computer, a second different image, and a plain text file (.txt).

**Steps**

1. **P3:** Open http://localhost:3000/settings/profile.
2. **P3:** Choose **Change avatar** and pick the first image.
3. **P3:** Wait for the upload to finish, then choose **Save profile** if the page asks for it.
4. **P3:** Reload the page.
5. **P3:** Choose **Change avatar** again and pick the second image. Confirm it replaces the first.
6. **P3:** Choose **Change avatar** and pick the .txt file.
7. **P3:** Choose **Change avatar** and pick an image larger than the limit shown on the page, if you have one (skip this step if you do not).
8. **P3:** Remove the avatar using the remove control next to it, then reload.

**Expected**

- After step 3 and 4 the first image shows as your avatar and survives the reload.
- After step 5 only the second image shows; the first is gone from the page.
- The .txt file is refused with a visible error; the avatar does not change.
- The oversized image (if tried) is refused with a visible error; the avatar does not change.
- After step 8 the avatar returns to the default placeholder and stays that way after reload.

**Other users see**

- **P1:** After step 5, anywhere P3's avatar appears (for example the Campaign member list of Review: Party in the Field), the second image appears; after step 8 the placeholder appears. The refused files never appear.

## UAT-PLATFORM-3: Artwork is private to its owner until shared

- **Covers:** PLATFORM-4.1, PLATFORM-4.3, PLATFORM-4.4
- **Accounts:** P1, P2
- **Preconditions:** Review data built; a small valid image on P1's computer. Two browser profiles ([README](README.md#running-several-users-side-by-side)).

**Steps**

1. **P1:** Open http://localhost:3000/spells/new.
2. **P1:** Type the name "UAT Image Spark" and upload the image as the Spell's artwork.
3. **P1:** Choose **Save Draft**, then reload and confirm the artwork is still shown.
4. **P1:** Right-click the artwork and choose Copy image address (or Open image in new tab and copy the address bar).
5. **P2:** Paste that address into a new tab in P2's own window and press Enter.
6. **P2:** Open http://localhost:3000/spells and search "UAT Image".
7. **P1:** Back on the draft, choose **Discard draft** and confirm.
8. **P1:** Open the copied image address again in a new tab.

**Expected**

- P1 sees the artwork on the draft after reload.
- P2 cannot load P1's image from the copied address (a refusal, blank or error, not the picture).
- P2's search finds no "UAT Image Spark".
- After the discard the draft is gone from P1's lists and the copied address no longer shows the picture.

**Other users see**

- **P2:** Nothing of P1's draft or its artwork at any point.

## UAT-PLATFORM-4: Password reset email is requested from the app

- **Covers:** PLATFORM-3.1, PLATFORM-3.2
- **Accounts:** P3
- **Preconditions:** Signed out. Local email is accept-and-discard, so the email itself cannot be read (gap G1); this scenario proves the app asks for it and shows the right next screen.

**Steps**

1. **P3:** Open http://localhost:3000/sign-in and follow the forgot-password link to the **Reset your password** page.
2. **P3:** Enter `review_pl_cade@example.invalid` in **Email address** and submit.
3. **P3:** On the next page (**Verify your reset code**) read the message shown.
4. **P3:** Go back and repeat with an address that has no account, `nobody-here@example.invalid`.
5. **P3:** Compare the messages from both attempts.
6. **P3:** Sign in normally with the old password to confirm nothing changed.

**Expected**

- Both attempts show the same neutral message (the app does not reveal whether an account exists) and the page asking for the six-digit code.
- No error about email delivery appears.
- The old password still signs in.
- Reading the email and entering the real code is not possible here (gap G1); the reset itself is run in [ACCOUNTS](ACCOUNTS.md) and is blocked there for the same reason.

**Other users see**

- Not applicable: single user.

## UAT-PLATFORM-5: A Concentration save shows its result on the roll card

- **Covers:** PLATFORM-15.1
- **Accounts:** GM, P1
- **Preconditions:** Run [UAT-SPELLS-7](SPELLS.md) steps 1-7 first (Sage holds Concentration on Hold Person and the Wolf bites Sage). This scenario only checks what the roll card shows.

**Steps**

1. **GM:** After the Wolf's bite in UAT-SPELLS-7 step 7, open the chat and find the Concentration save roll card for Sage.
2. **P1:** Open the chat in P1's window and find the same card.
3. **GM:** Read the card: the DC, the d20 and total, and the result wording.
4. **P1:** Compare with the Encounter history entry for the bite and the save.
5. **GM:** Reload the tabletop and find the card again.

**Expected**

- The card shows the DC (10 or half the damage, whichever is higher), the roll and total, and a single clear result (passed or failed), consistent with whether Hold Person ended.
- The Encounter history entry for the save shows the same result; no second, conflicting result label appears.
- After the reload the card and history show the same result.

**Other users see**

- **P1:** The same card and result as the GM; no private GM rolls.

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC             | Why not a UAT step                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PLATFORM-2.1   | Schema, validator and index contract review.                                                                                                            |
| PLATFORM-2.2   | Static API type generation; a build property.                                                                                                           |
| PLATFORM-5.1   | Preservation of the 1,083 source files and 1,057 root UUIDs is a corpus check run by the seed audit.                                                    |
| PLATFORM-5.3   | Import rollback and rejection of corrupt input; needs a deliberately broken corpus.                                                                     |
| PLATFORM-5.4   | Internal HTTP endpoints denied; a network-level check run by tests.                                                                                     |
| PLATFORM-5.5   | Cloud-dev CPU limit; measured by the harness.                                                                                                           |
| PLATFORM-5.6   | Manifest freshness check in the import audit.                                                                                                           |
| PLATFORM-5.7   | Per-mutation durations recorded by a loaded seed run.                                                                                                   |
| PLATFORM-6.1   | Removal of the legacy local runtime (INTERNAL).                                                                                                         |
| PLATFORM-7.1   | Removal of Supabase (INTERNAL).                                                                                                                         |
| PLATFORM-8.1   | Removal of SQL, Kysely and migrations (INTERNAL).                                                                                                       |
| PLATFORM-9.1   | Removal of GoRules (INTERNAL).                                                                                                                          |
| PLATFORM-10.1  | Removal of tRPC and Netlify functions (INTERNAL).                                                                                                       |
| PLATFORM-11.1  | Backend test-suite realism (test doubles replaced by the real Worker); a property of the tests themselves.                                              |
| PLATFORM-12.1  | Web test-suite realism (fixtures parse through the real schemas); a property of the tests themselves.                                                   |
| PLATFORM-13.2  | Native boundary audit script in CI.                                                                                                                     |
| PLATFORM-13.4  | Test-suite reorganisation.                                                                                                                              |
| PLATFORM-13.5  | Dependency refresh.                                                                                                                                     |
| PLATFORM-13.6  | Test timeout reliability under load.                                                                                                                    |
| PLATFORM-13.7  | Test speed record.                                                                                                                                      |
| PLATFORM-13.8  | Test determinism under load.                                                                                                                            |
| PLATFORM-13.9  | Generated test usernames; a test-harness property.                                                                                                      |
| PLATFORM-13.10 | Test log noise.                                                                                                                                         |
| PLATFORM-13.11 | Live-backend validation on GitHub Actions.                                                                                                              |
| PLATFORM-13.12 | Local Convex runner environment handling.                                                                                                               |
| PLATFORM-13.13 | Developer workflow for running tests.                                                                                                                   |
| PLATFORM-13.14 | Validation lock reclaim.                                                                                                                                |
| PLATFORM-13.15 | CI journey log upload.                                                                                                                                  |
| PLATFORM-14.1  | Web test reliability.                                                                                                                                   |
| PLATFORM-14.2  | Test folder rename.                                                                                                                                     |
| PLATFORM-14.3  | TanStack Start and Storybook upgrade; the app working at all is shown by every other file.                                                              |
| PLATFORM-16.1  | Removal of a Convex table.                                                                                                                              |
| PLATFORM-16.2  | Documentation of the removal.                                                                                                                           |
| PLATFORM-17.1  | Test fixture typing.                                                                                                                                    |
| PLATFORM-17.2  | Shared test-fixture builder.                                                                                                                            |
| PLATFORM-17.3  | Test-double audit.                                                                                                                                      |
| PLATFORM-18.1  | Seeding a changed corpus N+1 over N needs two different corpus builds on a live backend; a live-backend CI run, not reproducible from the review data.  |
| PLATFORM-18.2  | Same, for definitions, Systems and catalogues.                                                                                                          |
| PLATFORM-19.1  | CI auto-fix of generated-file drift.                                                                                                                    |
| PLATFORM-20.1  | Dead compiler code deleted.                                                                                                                             |
| PLATFORM-20.2  | Copy-only compilers deleted.                                                                                                                            |
| PLATFORM-20.3  | Flat modifier grant compile shape; a type and contract change.                                                                                          |
| PLATFORM-20.4  | Documentation.                                                                                                                                          |
| PLATFORM-21.2  | Stale compiled projection migration; development data is migrated in the change, so nothing stale exists in the review data to observe.                 |
| PLATFORM-22.1  | CI timing for type errors.                                                                                                                              |
| PLATFORM-22.2  | Worker test-harness error reporting.                                                                                                                    |
| PLATFORM-22.3  | Merge fast path, proved by tree identity.                                                                                                               |
| PLATFORM-22.4  | CI red/green proof job.                                                                                                                                 |
| PLATFORM-23.1  | CI test selection.                                                                                                                                      |
| PLATFORM-23.2  | Parity tests fixed; CI result.                                                                                                                          |
| PLATFORM-23.3  | Local typecheck lane (since retired in AGENTS.md).                                                                                                      |
| PLATFORM-23.4  | Local scoped-test build lane.                                                                                                                           |
| PLATFORM-24.1  | Rejection of a tampered frozen graph on resume needs forged stored data; a tester sees only the honest pause-and-resume path, exercised in UAT-RULES-3. |
| PLATFORM-24.2  | Removal of the continuation signing key from code, env and docs.                                                                                        |
| PLATFORM-25.1  | CI formatting and lint auto-fix.                                                                                                                        |
| PLATFORM-25.2  | CI merge-slice workflow.                                                                                                                                |
| PLATFORM-25.3  | CI batch merge.                                                                                                                                         |
| PLATFORM-25.4  | CI run-id handling.                                                                                                                                     |
