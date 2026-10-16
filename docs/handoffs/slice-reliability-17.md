# Slice RELIABILITY-17: unseen-target Worker test is deterministic

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

- Closes AC RELIABILITY-17.1. nativeRoomUnseenTarget.test.ts "takes a creature the map draws, with nothing revealed" (ATTACK-17.3) intermittently gets an empty target list (ci/reaction-4-t3b Tests 38877353496 attempt 1). Find the cause and fix it there: no retry, no weakened assertion.
- Prove with a forced red on `ci/reliability-17-red` and green on `ci/reliability-17`, both cut from the newest `origin/ci/merge-batch-*`.

## Log

