# Exploratory tasks

Open, goal-based tasks for finding usability problems and bias in how the product is explained and laid out. They are not pass/fail: nothing here moves a feature to accepted, and there is no Expected line to match. The scripted scenarios check that features work; these check whether a person who has not been told how can get things done.

**Testers must not read the scripted scenario files first.** Read only the [Start here page](../README.md), the [accounts](../README.md#accounts) and the task file itself. Do not open a scenario file until your Result is written. Run these right after [Orientation](../ORIENTATION/UAT-ORIENTATION-1.md), before Level 1.

## How to run a task

1. Pick the task and the account named in it. Use the accounts and Campaign listed under **What is ready for you**; sign in as described in [Accounts](../README.md#accounts).
2. Start a timer. Work toward the goal in your own way. Do not look for a "right" path.
3. If you are stuck for more than a few minutes, say what you were trying to do and what you expected, then use the on-screen help, then ask the operator. Record every one of these.
4. Stop the timer when you reach the goal or give up. Giving up is a result: record it.
5. Fill in the Result block at the end of the task file, then move to the next.

Each task names what to tidy up afterwards, so the scripted scenarios later in the path find the review data as they expect. Two or more testers may run the same task; do not compare notes until both have written their run notes.

## What to record for every task

- **Time:** minutes from start to goal, or to the moment you gave up.
- **Outcome:** reached the goal, reached it with help, or gave up.
- **Confusion points:** each place you hesitated, with the page, the label or control, and what you thought it meant.
- **Workarounds:** anything you did that the product did not seem designed for, such as using a different page, a copy, a screenshot, or a note kept elsewhere.
- **Rating:** 1 (very easy and clear) to 5 (very hard or unclear).
- **Bias check:** one line on what you assumed beforehand (from other tabletop software, from earlier tasks) that turned out wrong.

Screenshots of confusing screens go in the ignored `local-validation/uat/<YYYY-MM-DD>/` folder and are named in the Result. Do not put passwords or tokens in a Result.

## Tasks

| Run order | Level | Scenario                          | Title                                           |
| --------- | ----- | --------------------------------- | ----------------------------------------------- |
| 2         | 0     | [EXPLORATORY-1](EXPLORATORY-1.md) | Build a level-3 caster and play one round       |
| 3         | 0     | [EXPLORATORY-2](EXPLORATORY-2.md) | Author a homebrew spell from memory and cast it |
| 4         | 0     | [EXPLORATORY-3](EXPLORATORY-3.md) | Set up a new encounter on an uploaded map as GM |
| 5         | 0     | [EXPLORATORY-4](EXPLORATORY-4.md) | Run a short session as a first-time player      |
| 6         | 0     | [EXPLORATORY-5](EXPLORATORY-5.md) | Copy and change an existing monster             |
| 7         | 0     | [EXPLORATORY-6](EXPLORATORY-6.md) | Find out what went wrong                        |
| 8         | 0     | [EXPLORATORY-7](EXPLORATORY-7.md) | Hand over a Character mid-campaign              |
