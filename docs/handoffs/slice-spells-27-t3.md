# Slice SPELLS-27.T3: effects that end on a spell cast

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

Closes SPELLS-27.1 with T2b. An ON_CAST_SPELL fact emitted from the one shared cast-commit path feeds the end-trigger consumer; Invisibility ends when its holder casts a spell; an author-built equivalent made through the real authoring form publishes to the same structure and ends the same way (ADR 0038). SPELLS-27.T2b (platform-13-t5 session) works in the same feature; merge it once it lands.

Iterate in CI (`ci/spells-27-t3`).

## Log
