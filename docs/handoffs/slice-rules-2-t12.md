# Slice RULES-2.T9f, T12 and AUTHORING-1.T2: the neutral tracer System

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md). ADR 0039 governs this slice. The ledger text of each task is its scope. Run the tasks in this order:

1. **RULES-2.T9f1, T9f2 and T9f3** (D192 split, user-approved): T9f1 makes sizes System core codes. T9f2 keys ability-score records by definition id and reseeds. T9f3 changes authored ability references to `abilityDefinitionId` and reseeds, and the D192 codemod exception covers it. List every golden flip.
2. **RULES-2.T12:** a second neutral tracer System, a Fate-like test fixture, drives the Encounter pipeline through the adapters.
3. **AUTHORING-1.T2** (AC AUTHORING-1.5): the same tracer System also travels the real publication, capability, catalogue and shell reads. The docs and ERDs describe the System-neutral model. Use one tracer fixture for both tasks, never a second one.

The tracer is a test fixture and is not seeded content.

## Log
