# UAT-ACCOUNTS-7: Choose, change and protect a username

Choose, change and protect a username.

Level 1 (Single-user basics) · Feature ACCOUNTS · Mode: Solo (OWN) · Path position 16 of 190

## Prerequisites

- Done in [UAT-ACCOUNTS-6](UAT-ACCOUNTS-6.md): you have your own account, created with your own email address.
- The review data provides the account **GM**, whose username the owner gives you for step 2.

## Accounts and windows

- **Roles used:** OWN
- **Windows:** One browser window, signed in to the account you created in [ACCOUNTS-6](UAT-ACCOUNTS-6.md). Your normal browser is fine.

## Steps

1. **OWN:** Open `<STAGING_URL>/settings/profile`.
2. **OWN:** In **Username** type the GM's username (the owner gives it to you). Note the availability message and try to save with **Save profile**.
3. **OWN:** Type the GM's username in different capitalisation and try again.
4. **OWN:** Type `ass_muncher`, then `AssMuncher`, then `Ass1Muncher`, then `assmuncher`; try to save each.
5. **OWN:** Type `Cassandra`, then `Classic`, then `Glasshouse`; check the availability message for each without saving.
6. **OWN:** Type your username with `_Two` added and choose **Save profile**.
7. **OWN:** Reload the page. Sign out and sign in using your username with `_Two` added.
8. **OWN:** Change the username to your original username in different capitalisation and save; then change it back to your original capitalisation and save.
9. **OWN:** Reload and check the exact capitalisation shown.

## Expected

- Step 2: the name is shown as taken or the save is refused; nothing changes.
- Step 3: also refused as taken (names are not case-sensitive).
- Step 4: all four are refused as not allowed.
- Step 5: all three are acceptable (no "not allowed" message).
- Step 6-7: the new name is saved, survives reload, and works for sign-in.
- Step 8-9: case-only changes are allowed and the display keeps the capitalisation you saved, ending as your original username.

## Other users see

- Not applicable: single user.

## ACs covered

ACCOUNTS-7.1, ACCOUNTS-7.2, ACCOUNTS-7.4

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Set:**
- **Role:**
- **Failed step:**
- **Notes:**
