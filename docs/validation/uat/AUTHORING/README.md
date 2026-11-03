# Content authoring — UAT scenarios

Feature `AUTHORING` in the [phase ledger](../../../roadmap/08-phase-ledger.json). Set up first: [README](../OPERATOR.md#setup).

Proves a GM or player can browse the SRD, copy any locked SRD record into their own draft, edit, save, publish, duplicate and delete homebrew, keep drafts private from other accounts, share published homebrew with a Campaign, and that the authoring forms behave. Source loss reaching existing Characters is in [BUILDER](../BUILDER/README.md). On publishing, the control is labelled **Activate** on most pages (some pages say Publish); use whichever the page shows.

## Scenarios

One file per scenario, listed in the order the [tracker](../TRACKER.md) runs them. Each file ends with a Result block to fill in.

| Path position | Level | Scenario                                | Title                                                                 |
| ------------- | ----- | --------------------------------------- | --------------------------------------------------------------------- |
| 24            | 1     | [UAT-AUTHORING-1](UAT-AUTHORING-1.md)   | Browse Game Systems and Rules Catalogues                              |
| 25            | 1     | [UAT-AUTHORING-2](UAT-AUTHORING-2.md)   | SRD records are locked but can be copied into an owned draft          |
| 26            | 1     | [UAT-AUTHORING-3](UAT-AUTHORING-3.md)   | Background lifecycle — create, save, publish, replace, export, delete |
| 27            | 1     | [UAT-AUTHORING-10](UAT-AUTHORING-10.md) | Another account cannot see or edit your drafts                        |
| 28            | 1     | [UAT-AUTHORING-4](UAT-AUTHORING-4.md)   | Author, publish and filter a homebrew Spell with artwork              |
| 29            | 1     | [UAT-AUTHORING-5](UAT-AUTHORING-5.md)   | Author a Class and see the Spell guard                                |
| 30            | 1     | [UAT-AUTHORING-7](UAT-AUTHORING-7.md)   | Equipment variants, inheritance and item names                        |
| 31            | 1     | [UAT-AUTHORING-8](UAT-AUTHORING-8.md)   | Author a Feat, a Race and a Vehicle                                   |
| 32            | 1     | [UAT-AUTHORING-9](UAT-AUTHORING-9.md)   | Reusable effects, grants and modifiers on a System                    |
| 33            | 1     | [UAT-AUTHORING-12](UAT-AUTHORING-12.md) | Option descriptions and adding a Check and a DC                       |
| 34            | 1     | [UAT-AUTHORING-13](UAT-AUTHORING-13.md) | Author a Fire Bolt-like cantrip from scratch                          |
| 35            | 1     | [UAT-AUTHORING-14](UAT-AUTHORING-14.md) | Author a Fireball-like spell from scratch                             |
| 36            | 1     | [UAT-AUTHORING-15](UAT-AUTHORING-15.md) | Author an Empowered Spell-like feature that spends a resource pool    |
| 57            | 2     | [UAT-AUTHORING-11](UAT-AUTHORING-11.md) | Share homebrew with a Campaign, then withdraw it                      |
| 90            | 3     | [UAT-AUTHORING-6](UAT-AUTHORING-6.md)   | Creature copy, computed AC and the item loadout                       |

## Authoring feedback

Each tester fills this in once, after the authoring scenarios they ran ([UAT-AUTHORING-13](UAT-AUTHORING-13.md) to 15, plus any other authoring scenario). Write it in the Notes of one of your Result blocks under a `### Authoring feedback - <tester> - <YYYY-MM-DD>` heading, with the commit or staging build, the table below and an answer to each question. Answer in your own words; short answers are fine, and "none" is a valid answer.

| Scenario                                | Time taken (minutes) | Difficulty (1 = trivial, 5 = could not finish unaided) |
| --------------------------------------- | -------------------- | ------------------------------------------------------ |
| [UAT-AUTHORING-13](UAT-AUTHORING-13.md) |                      |                                                        |
| [UAT-AUTHORING-14](UAT-AUTHORING-14.md) |                      |                                                        |
| [UAT-AUTHORING-15](UAT-AUTHORING-15.md) |                      |                                                        |

1. **Guided and Advanced.** Which mode felt easier for the things you built? Did you switch between them, and if so at which step and why (the Guided header offers **Switch to advanced**; Settings, Preferences changes the default)?
2. **Where you got stuck.** List each place you stopped or asked for help, the page or section it was on, and how you got unstuck.
3. **Fields you did not understand.** List the field labels whose meaning or effect you could not tell, even if you filled them in by guessing.
4. **Starting point.** For the next effect you build, would you rather copy an existing effect, start from a template, or build from scratch? Say why, and say if it depends on the kind of effect.
5. **Visual node-graph editor.** Imagine building the same effect on a canvas of connected boxes (a node graph) instead of the form. Would that have helped, made it harder, or made no difference? Say why, and for which of the three scenarios.
6. **Anything else** that cost you time or that you expected to find and did not.

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC             | Why not a UAT step                                                                                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTHORING-1.2  | Fail-closed handling of malformed, corrupt or unavailable Systems; needs deliberately corrupted stored data that a tester cannot create.                                                 |
| AUTHORING-1.5  | Neutral second-System tracers and documentation; no second System exists to browse.                                                                                                      |
| AUTHORING-4.2  | Canonical replay, index repair and managed backfill of all 1,057 roots; a seed and repair audit.                                                                                         |
| AUTHORING-5.2  | Canonical Creature import audit across the corpus (compilation, identity, rollback); a seed audit. SRD Creatures are browsed in [UAT-PLATFORM-1](../PLATFORM/UAT-PLATFORM-1.md).         |
| AUTHORING-6.3  | Canonical Equipment import including the 500-item inheritance ceiling and unordered parents; a seed audit.                                                                               |
| AUTHORING-10.2 | Canonical Vehicle import audit (compilation, checksums, rollback of conflicts) across the corpus; a seed audit. Vehicles are browsed in [UAT-PLATFORM-1](../PLATFORM/UAT-PLATFORM-1.md). |
| AUTHORING-14.1 | Clone conformance over all 1,057 canonical records; a corpus-scale test. One copy per domain is exercised by hand in [UAT-AUTHORING-2](UAT-AUTHORING-2.md) and 3.                        |
