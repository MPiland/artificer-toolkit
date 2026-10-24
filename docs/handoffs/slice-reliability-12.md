# Slice RELIABILITY-12: Convex infers real authoring DTO and speed types

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

- **RELIABILITY-12.T1** closes ACs RELIABILITY-12.1 and 12.2.
  - The intersection-built schemas in `packages/shared` `facet.ts` and `effects/path.ts`, recursion included, become flat unions. Convex `_generated/api.d.ts` then has no `any` for facet restrictions or effect paths (`BASIC_ACTION`). The authoring contract and publication tests stay unchanged.
  - An encounter stat block's `speeds` is typed from the stored authored creature speed shape instead of `z.array(z.unknown())`. Derive that shape; do not invent one.
  - The `generatedApiTypes` type test proves both. RELIABILITY-11 found the same Convex intersection-to-`any` defect earlier; follow its fix pattern ([slice-reliability-11.md](slice-reliability-11.md)).

## Log
