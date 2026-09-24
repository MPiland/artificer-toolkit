# Phase 08 pre-rebaseline salvage map

> **Historical:** This phase record predates the Phase 8.2 Convex cutover ([ADR 0029](../adr/0029-convex-backend-cutover.md)). Its Supabase/Postgres, Kysely/SQL, tRPC, `packages/functions`, `packages/db`, `apps/session-host`, GoRules/Zen, Rule Studio, and Netlify-function references, commands, and paths describe retired implementation. Current behavior is in the [architecture guides](../architecture/overview.md).

> **Status:** transitional implementation evidence
>
> **Snapshot:** `codex/vtt-pre-rebaseline-snapshot` at `0cdc7d5b26a01d2d0baa99b745098a9bc3655444`
>
> **Baseline:** `b018dcb67ddf3f64da8419db949590f988c6c62f`

The snapshot preserves the complete former dirty Gate 1/Gate 2 packet. Nothing from it transfers into
the rebaseline merely because it was implemented or previously tested. Port a surface only after its
contracts match ADRs 0023-0025 and the owning acceptance scenario.

## Strong reuse candidates

- Live-session optimistic versioning, conservative conflict classification, executor error transport,
  coordinator snapshots, and reconnect recovery.
- Idempotent committed-result receipt storage after replacing its rule-dependent payload contract.
- Canonical transaction and lock-boundary patterns after confirming aggregate ownership.
- Projection version/checksum integrity and viewer-specific projection/fallback behavior.
- Renderer-neutral barrier, line-of-effect, line-of-sight, and full-token-footprint geometry.
- Focused tests for session conflicts, executor errors, room recovery, scene receipts, and geometry.

## Replace under the rebaseline

- Global rule-pack identity, immutable revision pins, upgrade flows, and authored-version vectors.
- Global D&D semantic model keys and canonical Zen model dispatch.
- The validation-only lifecycle DAG and its D&D-named module vocabulary.
- Code/name-based senses and mechanics behavior.
- Rule Studio production administration.
- Generated SQL/types from the superseded schema packet.

## Mixed surfaces requiring symbol-level extraction

- `encounterService.ts`, `encounterRuntime.ts`, and the Encounter repository combine reusable
  application envelopes with superseded mechanics contracts.
- `vttSceneService.ts` combines reusable Scene ownership with rule-dependent continuation/result
  shapes.
- Character rule binding and Sheet application services combine reusable command/projection boundaries
  with version-vector semantics.
- The two unrun VTT migrations contain useful relational constraints mixed with superseded provenance,
  reaction, initiative, and rule-pin assumptions.

The integration owner must extract neutral locking, receipt, geometry, and projection seams rather than
cherry-picking the snapshot wholesale. Generated artifacts are always regenerated from accepted source.
