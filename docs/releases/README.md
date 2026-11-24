# Releases

A release doc is the one durable record of a version: what shipped, the decisions behind it, the validation evidence (workflow run ids, budgets, known gaps) and what was deferred. Per-slice workbooks, handoffs and validation packets are not kept: their durable facts are folded into the release doc, and disposable evidence stays in ignored `local-validation/`. UAT scenarios and results live in `docs/validation/uat/`.

| Version                       | Status                            | Doc                                                      |
| ----------------------------- | --------------------------------- | -------------------------------------------------------- |
| v0.1.0 (pre-alpha, Phase 8.2) | frozen on staging for UAT round 1 | [v0.1.0.md](v0.1.0.md), [decisions](v0.1.0-decisions.md) |

[Open questions](open-questions.md) holds the questions waiting for the owner across releases.
