# PLATFORM-19: generated-file drift on a CI branch fixes itself

Ledger: PLATFORM-19 (AC PLATFORM-19.1, task PLATFORM-19.T1) in [08-phase-ledger.json](../roadmap/08-phase-ledger.json).

## Problem

The live-backend job regenerates the SRD manifest and the Convex `_generated` files and fails when they differ from the commit. A session then downloads the `generated-files` artifact, commits it and pushes again, a full CI cycle per drift. A local pre-push regeneration was rejected: the manifest generator reads built package `dist`, and slice worktrees have no `node_modules`.

## Resume here

- **Next task:** PLATFORM-19.T1.
