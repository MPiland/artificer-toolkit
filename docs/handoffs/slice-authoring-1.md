# Slice AUTHORING-1: System-aware shell and second-System portability

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

- **AUTHORING-1.T1** closes AC AUTHORING-1.4: the shell and navigation are System-aware and capability-driven. First verify what exists today (shell, navigation, System selection, capability reads). Prove each part that already exists with a real-code test, and build only what is missing. Navigation entries come from the System's published capabilities, never from a D&D-specific list.
- AUTHORING-1.T2 runs in the RULES-2.T12 lane ([slice-rules-2-t12.md](slice-rules-2-t12.md)), so that one tracer fixture serves both tasks. Its scope, for reference: AC AUTHORING-1.5, a neutral second-System portability tracer. This is a minimal non-D&D test System that travels the real publication, capability, catalogue and shell reads end to end, so that nothing assumes the 5e System. The docs and ERDs must describe the System-neutral model. The tracer is a test fixture and is not seeded content.

## Log

- 2026-10-24 T1 verified: the shell had a hardcoded D&D Content list and no capability read for content kinds. Ruling (orchestrator): add `contentKinds` to the System capability contract; Content = union across visible Systems, fixed order, exhaustive presentation map, explicit empty state, no default System. Proof tests: `apps/apis/convex/content/systemCapability.test.ts`, `packages/schema/src/__tests__/rules-runtime-contracts.test.ts`, `apps/web/src/shell/navigation.test.ts`, `apps/web/src/shell/useShellNavigation.test.tsx`, `apps/web/src/shell/Shell.test.tsx`. Mobile footer shows no empty-state note (desktop Library menu only).
