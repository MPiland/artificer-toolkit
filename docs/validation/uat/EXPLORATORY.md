# Exploratory tasks

Open, goal-based tasks for finding usability problems and bias in how the product is explained and laid out. They are not pass/fail: nothing here moves a feature to accepted, and there is no Expected line to match. The scripted scenarios in the other files check that features work; these check whether a person who has not been told how can get things done.

**Testers must not read the scripted scenario files first.** The scripted steps name every button and field, which would hide the confusion these tasks exist to find. Read only [README](README.md#setup) for setup, [Accounts](README.md#accounts) and [Review data](README.md#review-data), and the [alpha play guide](../../guides/alpha-play-guide.md) if you want the live-table vocabulary. Do not open a scenario file until your results file is written.

## How to run a task

1. Pick the task and the account named in it. Use the review data account and Campaign listed under **Start**; sign in as described in [Accounts](README.md#accounts).
2. Start a timer. Work toward the goal in your own way. Do not look for a "right" path.
3. If you are stuck for more than a few minutes, say what you were trying to do and what you expected, then use the on-screen help, then ask the operator. Record every one of these.
4. Stop the timer when you reach the goal or give up. Giving up is a result: record it.
5. Fill in the record for the task (below), then move to the next.

Tasks change the data, so run them on a reset build or throwaway Campaigns where noted. Two or more testers may run the same task; do not compare notes until both results files are written.

## What to record for every task

- **Time:** minutes from start to goal, or to the moment you gave up.
- **Outcome:** reached the goal, reached it with help, or gave up.
- **Confusion points:** each place you hesitated, with the page, the label or control, and what you thought it meant.
- **Workarounds:** anything you did that the product did not seem designed for, such as using a different page, a copy, a screenshot, or a note kept elsewhere.
- **Rating:** 1 (very easy and clear) to 5 (very hard or unclear).
- **Bias check:** one line on what you assumed beforehand (from other tabletop software, from earlier tasks) that turned out wrong.

## Recording results

Save one file per tester per run as `docs/validation/uat/results/<YYYY-MM-DD>-EXPLORATORY-<tester>.md` (create the `results` folder on the first run). `<tester>` is the tester's name or handle, with no spaces.

```markdown
# EXPLORATORY run <YYYY-MM-DD> - <tester>

- Build: <git rev-parse HEAD for a local run, or the staging build name the owner gave>
- Environment: local | staging
- Account and Campaign: <as used in each task>

| Task          | Time (min) | Outcome                    | Rating 1-5 | Confusion points | Workarounds | Bias check |
| ------------- | ---------- | -------------------------- | ---------- | ---------------- | ----------- | ---------- |
| EXPLORATORY-1 |            | reached / helped / gave up |            |                  |             |            |
```

Add one short paragraph per task if a table cell is too small. Screenshots of confusing screens go in the ignored `local-validation/uat/<YYYY-MM-DD>/` folder and are named in the notes. Do not put passwords or tokens in a results file.

## EXPLORATORY-1: Build a level-3 caster and play one round

- **Goal:** Create a new level-3 spellcasting Character and play one round of combat with it.
- **Start:** Account **P3** (`Review_Pl_Cade`), Campaign **Review: Sandbox**, with the GM (**GM**) in a second browser profile.
- **Scope:** Choose any caster Class and Race you like. Pick spells without being told which. End when your Character has acted once in an Encounter round and the result is visible to the GM.
- **Look for:** whether you found where to start; whether level, spell slots and spells were easy to set; whether you understood what to do on your turn.

## EXPLORATORY-2: Author a homebrew spell from memory and cast it

- **Goal:** Write down a spell you know from another game or from memory, publish it, and cast it at the table.
- **Start:** Account **P1** (`Review_Pl_Aria`), Campaign **Review: Party in the Field**, GM in a second profile.
- **Scope:** Use whichever authoring mode you prefer. Share the spell with the Campaign if you think the GM needs it. The goal is met when the spell resolves at the table, even if some of it is adjudicated by the GM.
- **Look for:** which parts of your spell the form could and could not express; whether you chose Guided or Advanced and why; where you wanted to copy an SRD spell instead.

## EXPLORATORY-3: Set up a new encounter on an uploaded map as GM

- **Goal:** Take a map image of your own and set up an Encounter on it, ready for players to join.
- **Start:** Account **GM** (`Review_Gm_Rowan`), Campaign **Review: Fire and Thunder** (or a throwaway Campaign if you prefer a clean start). Use any image file on your computer.
- **Scope:** Add the map, place the players' Characters and at least two creatures, and start the Encounter. End when a player window shows the board and its own token.
- **Look for:** map scale and grid setup, token placement, how you decided between a Scene and an Encounter, and anything the players could see that you meant to keep hidden.

## EXPLORATORY-4: Run a short session as a first-time player

- **Goal:** Join a Campaign you have never seen, find your Character and take your first turn.
- **Start:** Account **SPARE1** (`Review_Pl_Dara`), outside every Campaign until the GM invites that username to **Review: Shield and Hold**; the GM sends the invitation and you accept it yourself.
- **Scope:** Accept the invitation, open the Campaign, and take a turn in the running Encounter. You may use the play guide.
- **Look for:** whether the invitation and joining steps were clear; whether you could tell whose turn it was; whether you could find the action you wanted without help.

## EXPLORATORY-5: Copy and change an existing monster

- **Goal:** Make a tougher version of an existing creature and use it in an Encounter.
- **Start:** Account **GM**, Campaign **Review: Party in the Field**.
- **Scope:** Start from an SRD creature of your choice. Change what you think is needed to make it harder, then put it into an Encounter of that Campaign and see the change at the table. Do not use a creature already in the Encounter.
- **Look for:** whether the product's locked-versus-editable rules for SRD records were clear; whether you expected to edit a number that the form computes (for example Armor Class); whether the effect of your change was visible at the table.

## EXPLORATORY-6: Find out what went wrong

- **Goal:** Work out why something at the table did not behave as you expected, and fix it or report it.
- **Start:** Account **GM**, Campaign **Review: Fire and Thunder**, with **P2** (`Review_Pl_Bryn`) in a second profile.
- **Scope:** In the live table, attempt something you think the rules allow but are unsure the product supports (for example an unusual spell target, a reaction, or moving through difficult terrain). If the result surprises you, find out why using only what the app shows. End when you can explain the result, or decide it is a defect.
- **Look for:** whether the app explained its own result; where you went to find the reason; whether the log or message wording matched your mental model of the rules.

## EXPLORATORY-7: Hand over a Character mid-campaign

- **Goal:** Level a Character up between Sessions and play the next Session with the new abilities.
- **Start:** Account **P2**, Character **Pyra** in **Review: Fire and Thunder**.
- **Scope:** Raise Pyra by one level in the Builder, review what changed, then play a round in the Encounter with a newly gained option if one is available. End when the Sheet and the live table agree about the new level.
- **Look for:** whether the Builder showed what changed; whether you knew where the Sheet and the Builder differ in purpose; any value that looked wrong after the level-up.
