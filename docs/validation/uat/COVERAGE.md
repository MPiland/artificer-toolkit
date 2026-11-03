# UAT coverage

Generated from the scenario files' "ACs covered" sections and the ledger: every AC of every feature is either covered by at least one scenario, listed in its feature's README as **Covered elsewhere** (no tester-visible behaviour; the ledger proof is the evidence), or listed as **Not coverable** with its gap.

| Feature     | Folder                               | Scenarios | ACs     | Covered by a scenario | of which blocked | Covered elsewhere | Not coverable |
| ----------- | ------------------------------------ | --------- | ------- | --------------------- | ---------------- | ----------------- | ------------- |
| PLATFORM    | [PLATFORM](PLATFORM/README.md)       | 5         | 68      | 10                    | 0                | 58                | 0             |
| ACCOUNTS    | [ACCOUNTS](ACCOUNTS/README.md)       | 13        | 37      | 29                    | 0                | 8                 | 0             |
| AUTHORING   | [AUTHORING](AUTHORING/README.md)     | 15        | 59      | 52                    | 0                | 7                 | 0             |
| RULES       | [RULES](RULES/README.md)             | 5         | 14      | 5                     | 0                | 9                 | 0             |
| BUILDER     | [BUILDER](BUILDER/README.md)         | 7         | 14      | 12                    | 0                | 2                 | 0             |
| SHEET       | [SHEET](SHEET/README.md)             | 11        | 25      | 22                    | 0                | 3                 | 0             |
| CAMPAIGN    | [CAMPAIGN](CAMPAIGN/README.md)       | 9         | 24      | 19                    | 0                | 5                 | 0             |
| SOCIAL      | [SOCIAL](SOCIAL/README.md)           | 6         | 11      | 8                     | 0                | 3                 | 0             |
| ROOM        | [ROOM](ROOM/README.md)               | 10        | 38      | 20                    | 0                | 18                | 0             |
| SCENE       | [SCENE](SCENE/README.md)             | 9         | 16      | 15                    | 0                | 1                 | 0             |
| MOVE        | [MOVE](MOVE/README.md)               | 9         | 22      | 18                    | 0                | 4                 | 0             |
| ENCOUNTER   | [ENCOUNTER](ENCOUNTER/README.md)     | 7         | 30      | 29                    | 0                | 1                 | 0             |
| ATTACK      | [ATTACK](ATTACK/README.md)           | 11        | 88      | 84                    | 0                | 4                 | 0             |
| SPELLS      | [SPELLS](SPELLS/README.md)           | 27        | 102     | 98                    | 0                | 4                 | 0             |
| REACTION    | [REACTION](REACTION/README.md)       | 7         | 14      | 14                    | 0                | 0                 | 0             |
| PRIVACY     | [PRIVACY](PRIVACY/README.md)         | 9         | 11      | 10                    | 0                | 1                 | 0             |
| RELIABILITY | [RELIABILITY](RELIABILITY/README.md) | 13        | 92      | 36                    | 0                | 56                | 0             |
| VTT_UI      | [VTT_UI](VTT_UI/README.md)           | 4         | 13      | 12                    | 0                | 1                 | 0             |
| PERF        | [PERF](PERF/README.md)               | 2         | 21      | 5                     | 1                | 16                | 0             |
| QUALITY     | [QUALITY](QUALITY/README.md)         | 0         | 2       | 0                     | 0                | 2                 | 0             |
| RELEASE     | [RELEASE](RELEASE/README.md)         | 1         | 19      | 5                     | 0                | 9                 | 5             |
| **Total**   |                                      | **180**   | **720** | **503**               | **1**            | **212**           | **5**         |

Scenarios counted are the scripted ones (180); the orientation scenario and 7 exploratory tasks cover no AC.

## AC map

"(blocked)" means every scenario that covers the AC waits on a [known UAT gap](OPERATOR.md#known-uat-gaps).

<details>
<summary>PLATFORM: 10 of 68 ACs in scenarios</summary>

| AC             | Scenarios                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------ |
| PLATFORM-2.1   | Covered elsewhere                                                                          |
| PLATFORM-2.2   | Covered elsewhere                                                                          |
| PLATFORM-2.3   | [UAT-PLATFORM-1](PLATFORM/UAT-PLATFORM-1.md)                                               |
| PLATFORM-3.1   | [UAT-PLATFORM-4](PLATFORM/UAT-PLATFORM-4.md)                                               |
| PLATFORM-3.2   | [UAT-PLATFORM-4](PLATFORM/UAT-PLATFORM-4.md)                                               |
| PLATFORM-4.1   | [UAT-PLATFORM-2](PLATFORM/UAT-PLATFORM-2.md), [UAT-PLATFORM-3](PLATFORM/UAT-PLATFORM-3.md) |
| PLATFORM-4.2   | [UAT-PLATFORM-2](PLATFORM/UAT-PLATFORM-2.md)                                               |
| PLATFORM-4.3   | [UAT-PLATFORM-3](PLATFORM/UAT-PLATFORM-3.md)                                               |
| PLATFORM-4.4   | [UAT-PLATFORM-2](PLATFORM/UAT-PLATFORM-2.md), [UAT-PLATFORM-3](PLATFORM/UAT-PLATFORM-3.md) |
| PLATFORM-5.1   | Covered elsewhere                                                                          |
| PLATFORM-5.2   | [UAT-PLATFORM-1](PLATFORM/UAT-PLATFORM-1.md)                                               |
| PLATFORM-5.3   | Covered elsewhere                                                                          |
| PLATFORM-5.4   | Covered elsewhere                                                                          |
| PLATFORM-5.5   | Covered elsewhere                                                                          |
| PLATFORM-5.6   | Covered elsewhere                                                                          |
| PLATFORM-5.7   | Covered elsewhere                                                                          |
| PLATFORM-6.1   | Covered elsewhere                                                                          |
| PLATFORM-7.1   | Covered elsewhere                                                                          |
| PLATFORM-8.1   | Covered elsewhere                                                                          |
| PLATFORM-9.1   | Covered elsewhere                                                                          |
| PLATFORM-10.1  | Covered elsewhere                                                                          |
| PLATFORM-11.1  | Covered elsewhere                                                                          |
| PLATFORM-12.1  | Covered elsewhere                                                                          |
| PLATFORM-13.2  | Covered elsewhere                                                                          |
| PLATFORM-13.4  | Covered elsewhere                                                                          |
| PLATFORM-13.5  | Covered elsewhere                                                                          |
| PLATFORM-13.6  | Covered elsewhere                                                                          |
| PLATFORM-13.7  | Covered elsewhere                                                                          |
| PLATFORM-13.8  | Covered elsewhere                                                                          |
| PLATFORM-13.9  | Covered elsewhere                                                                          |
| PLATFORM-13.10 | Covered elsewhere                                                                          |
| PLATFORM-13.11 | Covered elsewhere                                                                          |
| PLATFORM-13.12 | Covered elsewhere                                                                          |
| PLATFORM-13.13 | Covered elsewhere                                                                          |
| PLATFORM-13.14 | Covered elsewhere                                                                          |
| PLATFORM-13.15 | Covered elsewhere                                                                          |
| PLATFORM-14.1  | Covered elsewhere                                                                          |
| PLATFORM-14.2  | Covered elsewhere                                                                          |
| PLATFORM-14.3  | Covered elsewhere                                                                          |
| PLATFORM-15.1  | [UAT-PLATFORM-5](PLATFORM/UAT-PLATFORM-5.md)                                               |
| PLATFORM-16.1  | Covered elsewhere                                                                          |
| PLATFORM-16.2  | Covered elsewhere                                                                          |
| PLATFORM-17.1  | Covered elsewhere                                                                          |
| PLATFORM-17.2  | Covered elsewhere                                                                          |
| PLATFORM-17.3  | Covered elsewhere                                                                          |
| PLATFORM-18.1  | Covered elsewhere                                                                          |
| PLATFORM-18.2  | Covered elsewhere                                                                          |
| PLATFORM-19.1  | Covered elsewhere                                                                          |
| PLATFORM-20.1  | Covered elsewhere                                                                          |
| PLATFORM-20.2  | Covered elsewhere                                                                          |
| PLATFORM-20.3  | Covered elsewhere                                                                          |
| PLATFORM-20.4  | Covered elsewhere                                                                          |
| PLATFORM-21.1  | [UAT-AUTHORING-3](AUTHORING/UAT-AUTHORING-3.md)                                            |
| PLATFORM-21.2  | Covered elsewhere                                                                          |
| PLATFORM-22.1  | Covered elsewhere                                                                          |
| PLATFORM-22.2  | Covered elsewhere                                                                          |
| PLATFORM-22.3  | Covered elsewhere                                                                          |
| PLATFORM-22.4  | Covered elsewhere                                                                          |
| PLATFORM-23.1  | Covered elsewhere                                                                          |
| PLATFORM-23.2  | Covered elsewhere                                                                          |
| PLATFORM-23.3  | Covered elsewhere                                                                          |
| PLATFORM-23.4  | Covered elsewhere                                                                          |
| PLATFORM-24.1  | Covered elsewhere                                                                          |
| PLATFORM-24.2  | Covered elsewhere                                                                          |
| PLATFORM-25.1  | Covered elsewhere                                                                          |
| PLATFORM-25.2  | Covered elsewhere                                                                          |
| PLATFORM-25.4  | Covered elsewhere                                                                          |
| PLATFORM-25.3  | Covered elsewhere                                                                          |

</details>

<details>
<summary>ACCOUNTS: 29 of 37 ACs in scenarios</summary>

| AC            | Scenarios                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------- |
| ACCOUNTS-1.1  | [UAT-ACCOUNTS-1](ACCOUNTS/UAT-ACCOUNTS-1.md), [UAT-ACCOUNTS-3](ACCOUNTS/UAT-ACCOUNTS-3.md)   |
| ACCOUNTS-1.2  | [UAT-ACCOUNTS-1](ACCOUNTS/UAT-ACCOUNTS-1.md), [UAT-ACCOUNTS-3](ACCOUNTS/UAT-ACCOUNTS-3.md)   |
| ACCOUNTS-1.3  | Covered elsewhere                                                                            |
| ACCOUNTS-1.4  | Covered elsewhere                                                                            |
| ACCOUNTS-2.1  | [UAT-ACCOUNTS-4](ACCOUNTS/UAT-ACCOUNTS-4.md)                                                 |
| ACCOUNTS-2.2  | [UAT-ACCOUNTS-4](ACCOUNTS/UAT-ACCOUNTS-4.md)                                                 |
| ACCOUNTS-3.1  | [UAT-ACCOUNTS-6](ACCOUNTS/UAT-ACCOUNTS-6.md)                                                 |
| ACCOUNTS-3.2  | [UAT-ACCOUNTS-6](ACCOUNTS/UAT-ACCOUNTS-6.md)                                                 |
| ACCOUNTS-3.3  | [UAT-ACCOUNTS-6](ACCOUNTS/UAT-ACCOUNTS-6.md)                                                 |
| ACCOUNTS-4.1  | Covered elsewhere                                                                            |
| ACCOUNTS-4.2  | [UAT-ACCOUNTS-6](ACCOUNTS/UAT-ACCOUNTS-6.md)                                                 |
| ACCOUNTS-4.3  | Covered elsewhere                                                                            |
| ACCOUNTS-4.4  | Covered elsewhere                                                                            |
| ACCOUNTS-5.1  | [UAT-ACCOUNTS-1](ACCOUNTS/UAT-ACCOUNTS-1.md), [UAT-ACCOUNTS-2](ACCOUNTS/UAT-ACCOUNTS-2.md)   |
| ACCOUNTS-5.2  | [UAT-ACCOUNTS-3](ACCOUNTS/UAT-ACCOUNTS-3.md)                                                 |
| ACCOUNTS-5.3  | [UAT-ACCOUNTS-3](ACCOUNTS/UAT-ACCOUNTS-3.md)                                                 |
| ACCOUNTS-6.1  | [UAT-ACCOUNTS-5](ACCOUNTS/UAT-ACCOUNTS-5.md)                                                 |
| ACCOUNTS-6.2  | [UAT-ACCOUNTS-5](ACCOUNTS/UAT-ACCOUNTS-5.md)                                                 |
| ACCOUNTS-6.3  | [UAT-ACCOUNTS-5](ACCOUNTS/UAT-ACCOUNTS-5.md)                                                 |
| ACCOUNTS-7.1  | [UAT-ACCOUNTS-7](ACCOUNTS/UAT-ACCOUNTS-7.md)                                                 |
| ACCOUNTS-7.2  | [UAT-ACCOUNTS-7](ACCOUNTS/UAT-ACCOUNTS-7.md)                                                 |
| ACCOUNTS-7.3  | [UAT-ACCOUNTS-3](ACCOUNTS/UAT-ACCOUNTS-3.md)                                                 |
| ACCOUNTS-7.4  | [UAT-ACCOUNTS-7](ACCOUNTS/UAT-ACCOUNTS-7.md)                                                 |
| ACCOUNTS-7.5  | [UAT-ACCOUNTS-13](ACCOUNTS/UAT-ACCOUNTS-13.md)                                               |
| ACCOUNTS-8.1  | Covered elsewhere                                                                            |
| ACCOUNTS-8.2  | [UAT-ACCOUNTS-8](ACCOUNTS/UAT-ACCOUNTS-8.md)                                                 |
| ACCOUNTS-8.3  | [UAT-ACCOUNTS-8](ACCOUNTS/UAT-ACCOUNTS-8.md)                                                 |
| ACCOUNTS-8.4  | [UAT-ACCOUNTS-8](ACCOUNTS/UAT-ACCOUNTS-8.md)                                                 |
| ACCOUNTS-9.1  | Covered elsewhere                                                                            |
| ACCOUNTS-9.2  | [UAT-ACCOUNTS-9](ACCOUNTS/UAT-ACCOUNTS-9.md), [UAT-ACCOUNTS-10](ACCOUNTS/UAT-ACCOUNTS-10.md) |
| ACCOUNTS-9.3  | Covered elsewhere                                                                            |
| ACCOUNTS-9.4  | [UAT-ACCOUNTS-9](ACCOUNTS/UAT-ACCOUNTS-9.md), [UAT-ACCOUNTS-10](ACCOUNTS/UAT-ACCOUNTS-10.md) |
| ACCOUNTS-10.1 | [UAT-ACCOUNTS-11](ACCOUNTS/UAT-ACCOUNTS-11.md)                                               |
| ACCOUNTS-10.2 | [UAT-ACCOUNTS-12](ACCOUNTS/UAT-ACCOUNTS-12.md)                                               |
| ACCOUNTS-10.3 | [UAT-ACCOUNTS-12](ACCOUNTS/UAT-ACCOUNTS-12.md)                                               |
| ACCOUNTS-10.4 | [UAT-ACCOUNTS-12](ACCOUNTS/UAT-ACCOUNTS-12.md)                                               |
| ACCOUNTS-10.5 | [UAT-ACCOUNTS-12](ACCOUNTS/UAT-ACCOUNTS-12.md)                                               |

</details>

<details>
<summary>AUTHORING: 52 of 59 ACs in scenarios</summary>

| AC             | Scenarios                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------- |
| AUTHORING-1.1  | [UAT-AUTHORING-1](AUTHORING/UAT-AUTHORING-1.md)                                                    |
| AUTHORING-1.2  | Covered elsewhere                                                                                  |
| AUTHORING-1.3  | [UAT-AUTHORING-1](AUTHORING/UAT-AUTHORING-1.md)                                                    |
| AUTHORING-1.4  | [UAT-AUTHORING-1](AUTHORING/UAT-AUTHORING-1.md)                                                    |
| AUTHORING-1.5  | Covered elsewhere                                                                                  |
| AUTHORING-2.1  | [UAT-AUTHORING-1](AUTHORING/UAT-AUTHORING-1.md)                                                    |
| AUTHORING-2.2  | [UAT-AUTHORING-2](AUTHORING/UAT-AUTHORING-2.md), [UAT-AUTHORING-11](AUTHORING/UAT-AUTHORING-11.md) |
| AUTHORING-2.3  | [UAT-AUTHORING-3](AUTHORING/UAT-AUTHORING-3.md)                                                    |
| AUTHORING-3.1  | [UAT-AUTHORING-3](AUTHORING/UAT-AUTHORING-3.md)                                                    |
| AUTHORING-3.2  | [UAT-AUTHORING-3](AUTHORING/UAT-AUTHORING-3.md)                                                    |
| AUTHORING-3.3  | [UAT-BUILDER-4](BUILDER/UAT-BUILDER-4.md)                                                          |
| AUTHORING-4.1  | [UAT-AUTHORING-4](AUTHORING/UAT-AUTHORING-4.md), [UAT-AUTHORING-5](AUTHORING/UAT-AUTHORING-5.md)   |
| AUTHORING-4.2  | Covered elsewhere                                                                                  |
| AUTHORING-4.3  | [UAT-AUTHORING-5](AUTHORING/UAT-AUTHORING-5.md)                                                    |
| AUTHORING-4.4  | [UAT-AUTHORING-5](AUTHORING/UAT-AUTHORING-5.md)                                                    |
| AUTHORING-5.1  | [UAT-AUTHORING-8](AUTHORING/UAT-AUTHORING-8.md), [UAT-AUTHORING-6](AUTHORING/UAT-AUTHORING-6.md)   |
| AUTHORING-5.2  | Covered elsewhere                                                                                  |
| AUTHORING-6.1  | [UAT-AUTHORING-7](AUTHORING/UAT-AUTHORING-7.md)                                                    |
| AUTHORING-6.2  | [UAT-AUTHORING-7](AUTHORING/UAT-AUTHORING-7.md)                                                    |
| AUTHORING-6.3  | Covered elsewhere                                                                                  |
| AUTHORING-6.4  | [UAT-BUILDER-4](BUILDER/UAT-BUILDER-4.md)                                                          |
| AUTHORING-7.1  | [UAT-AUTHORING-8](AUTHORING/UAT-AUTHORING-8.md)                                                    |
| AUTHORING-7.2  | [UAT-BUILDER-4](BUILDER/UAT-BUILDER-4.md)                                                          |
| AUTHORING-8.1  | [UAT-AUTHORING-8](AUTHORING/UAT-AUTHORING-8.md)                                                    |
| AUTHORING-8.2  | [UAT-AUTHORING-1](AUTHORING/UAT-AUTHORING-1.md)                                                    |
| AUTHORING-8.3  | [UAT-AUTHORING-1](AUTHORING/UAT-AUTHORING-1.md)                                                    |
| AUTHORING-9.1  | [UAT-AUTHORING-4](AUTHORING/UAT-AUTHORING-4.md), [UAT-AUTHORING-13](AUTHORING/UAT-AUTHORING-13.md) |
| AUTHORING-9.2  | [UAT-AUTHORING-4](AUTHORING/UAT-AUTHORING-4.md)                                                    |
| AUTHORING-9.3  | [UAT-AUTHORING-4](AUTHORING/UAT-AUTHORING-4.md)                                                    |
| AUTHORING-9.4  | [UAT-AUTHORING-1](AUTHORING/UAT-AUTHORING-1.md)                                                    |
| AUTHORING-10.1 | [UAT-AUTHORING-8](AUTHORING/UAT-AUTHORING-8.md)                                                    |
| AUTHORING-10.2 | Covered elsewhere                                                                                  |
| AUTHORING-11.1 | [UAT-AUTHORING-9](AUTHORING/UAT-AUTHORING-9.md)                                                    |
| AUTHORING-11.2 | [UAT-AUTHORING-9](AUTHORING/UAT-AUTHORING-9.md)                                                    |
| AUTHORING-11.3 | [UAT-AUTHORING-9](AUTHORING/UAT-AUTHORING-9.md)                                                    |
| AUTHORING-11.4 | [UAT-AUTHORING-9](AUTHORING/UAT-AUTHORING-9.md)                                                    |
| AUTHORING-12.1 | [UAT-AUTHORING-2](AUTHORING/UAT-AUTHORING-2.md), [UAT-AUTHORING-10](AUTHORING/UAT-AUTHORING-10.md) |
| AUTHORING-12.2 | [UAT-AUTHORING-3](AUTHORING/UAT-AUTHORING-3.md)                                                    |
| AUTHORING-12.3 | [UAT-AUTHORING-4](AUTHORING/UAT-AUTHORING-4.md)                                                    |
| AUTHORING-12.4 | [UAT-AUTHORING-2](AUTHORING/UAT-AUTHORING-2.md)                                                    |
| AUTHORING-13.1 | [UAT-AUTHORING-3](AUTHORING/UAT-AUTHORING-3.md)                                                    |
| AUTHORING-13.2 | [UAT-AUTHORING-3](AUTHORING/UAT-AUTHORING-3.md)                                                    |
| AUTHORING-13.3 | [UAT-AUTHORING-7](AUTHORING/UAT-AUTHORING-7.md)                                                    |
| AUTHORING-14.1 | Covered elsewhere                                                                                  |
| AUTHORING-14.2 | [UAT-AUTHORING-2](AUTHORING/UAT-AUTHORING-2.md)                                                    |
| AUTHORING-14.3 | [UAT-AUTHORING-2](AUTHORING/UAT-AUTHORING-2.md)                                                    |
| AUTHORING-15.1 | [UAT-AUTHORING-2](AUTHORING/UAT-AUTHORING-2.md), [UAT-AUTHORING-10](AUTHORING/UAT-AUTHORING-10.md) |
| AUTHORING-15.2 | [UAT-AUTHORING-11](AUTHORING/UAT-AUTHORING-11.md)                                                  |
| AUTHORING-15.3 | [UAT-AUTHORING-11](AUTHORING/UAT-AUTHORING-11.md)                                                  |
| AUTHORING-16.1 | [UAT-AUTHORING-7](AUTHORING/UAT-AUTHORING-7.md)                                                    |
| AUTHORING-16.2 | [UAT-AUTHORING-7](AUTHORING/UAT-AUTHORING-7.md)                                                    |
| AUTHORING-17.1 | [UAT-AUTHORING-6](AUTHORING/UAT-AUTHORING-6.md)                                                    |
| AUTHORING-17.2 | [UAT-AUTHORING-6](AUTHORING/UAT-AUTHORING-6.md)                                                    |
| AUTHORING-17.3 | [UAT-AUTHORING-6](AUTHORING/UAT-AUTHORING-6.md)                                                    |
| AUTHORING-18.1 | [UAT-AUTHORING-12](AUTHORING/UAT-AUTHORING-12.md)                                                  |
| AUTHORING-19.1 | [UAT-AUTHORING-12](AUTHORING/UAT-AUTHORING-12.md)                                                  |
| AUTHORING-20.1 | [UAT-AUTHORING-12](AUTHORING/UAT-AUTHORING-12.md)                                                  |
| AUTHORING-21.1 | [UAT-AUTHORING-15](AUTHORING/UAT-AUTHORING-15.md)                                                  |
| AUTHORING-21.2 | [UAT-AUTHORING-15](AUTHORING/UAT-AUTHORING-15.md)                                                  |

</details>

<details>
<summary>RULES: 5 of 14 ACs in scenarios</summary>

| AC        | Scenarios                                                                |
| --------- | ------------------------------------------------------------------------ |
| RULES-1.1 | [UAT-RULES-1](RULES/UAT-RULES-1.md)                                      |
| RULES-1.2 | [UAT-RULES-3](RULES/UAT-RULES-3.md), [UAT-RULES-2](RULES/UAT-RULES-2.md) |
| RULES-1.3 | Covered elsewhere                                                        |
| RULES-1.4 | [UAT-RULES-3](RULES/UAT-RULES-3.md), [UAT-RULES-2](RULES/UAT-RULES-2.md) |
| RULES-1.5 | [UAT-RULES-4](RULES/UAT-RULES-4.md)                                      |
| RULES-1.6 | [UAT-RULES-5](RULES/UAT-RULES-5.md)                                      |
| RULES-2.1 | Covered elsewhere                                                        |
| RULES-2.2 | Covered elsewhere                                                        |
| RULES-2.3 | Covered elsewhere                                                        |
| RULES-2.4 | Covered elsewhere                                                        |
| RULES-2.5 | Covered elsewhere                                                        |
| RULES-2.6 | Covered elsewhere                                                        |
| RULES-2.7 | Covered elsewhere                                                        |
| RULES-2.8 | Covered elsewhere                                                        |

</details>

<details>
<summary>BUILDER: 12 of 14 ACs in scenarios</summary>

| AC          | Scenarios                                                                            |
| ----------- | ------------------------------------------------------------------------------------ |
| BUILDER-1.1 | [UAT-BUILDER-1](BUILDER/UAT-BUILDER-1.md)                                            |
| BUILDER-1.2 | [UAT-BUILDER-2](BUILDER/UAT-BUILDER-2.md)                                            |
| BUILDER-1.3 | [UAT-BUILDER-1](BUILDER/UAT-BUILDER-1.md)                                            |
| BUILDER-2.1 | [UAT-BUILDER-3](BUILDER/UAT-BUILDER-3.md)                                            |
| BUILDER-2.2 | [UAT-BUILDER-1](BUILDER/UAT-BUILDER-1.md), [UAT-BUILDER-2](BUILDER/UAT-BUILDER-2.md) |
| BUILDER-2.3 | Covered elsewhere                                                                    |
| BUILDER-2.4 | Covered elsewhere                                                                    |
| BUILDER-3.1 | [UAT-BUILDER-4](BUILDER/UAT-BUILDER-4.md)                                            |
| BUILDER-3.2 | [UAT-BUILDER-4](BUILDER/UAT-BUILDER-4.md)                                            |
| BUILDER-3.3 | [UAT-BUILDER-4](BUILDER/UAT-BUILDER-4.md)                                            |
| BUILDER-3.4 | [UAT-BUILDER-5](BUILDER/UAT-BUILDER-5.md)                                            |
| BUILDER-4.1 | [UAT-BUILDER-6](BUILDER/UAT-BUILDER-6.md)                                            |
| BUILDER-4.2 | [UAT-BUILDER-6](BUILDER/UAT-BUILDER-6.md)                                            |
| BUILDER-4.3 | [UAT-BUILDER-6](BUILDER/UAT-BUILDER-6.md)                                            |

</details>

<details>
<summary>SHEET: 22 of 25 ACs in scenarios</summary>

| AC        | Scenarios                                                                  |
| --------- | -------------------------------------------------------------------------- |
| SHEET-1.1 | [UAT-SHEET-1](SHEET/UAT-SHEET-1.md), [UAT-SHEET-10](SHEET/UAT-SHEET-10.md) |
| SHEET-1.2 | [UAT-SHEET-3](SHEET/UAT-SHEET-3.md)                                        |
| SHEET-1.3 | [UAT-SHEET-1](SHEET/UAT-SHEET-1.md)                                        |
| SHEET-1.4 | [UAT-SHEET-1](SHEET/UAT-SHEET-1.md)                                        |
| SHEET-2.1 | [UAT-SHEET-2](SHEET/UAT-SHEET-2.md)                                        |
| SHEET-2.2 | [UAT-SHEET-2](SHEET/UAT-SHEET-2.md)                                        |
| SHEET-2.3 | [UAT-SHEET-2](SHEET/UAT-SHEET-2.md)                                        |
| SHEET-3.1 | [UAT-SHEET-4](SHEET/UAT-SHEET-4.md)                                        |
| SHEET-3.2 | [UAT-SHEET-4](SHEET/UAT-SHEET-4.md)                                        |
| SHEET-3.3 | [UAT-SHEET-4](SHEET/UAT-SHEET-4.md)                                        |
| SHEET-3.4 | [UAT-SHEET-4](SHEET/UAT-SHEET-4.md)                                        |
| SHEET-3.5 | [UAT-SHEET-5](SHEET/UAT-SHEET-5.md)                                        |
| SHEET-4.1 | [UAT-SHEET-7](SHEET/UAT-SHEET-7.md)                                        |
| SHEET-4.2 | [UAT-SHEET-6](SHEET/UAT-SHEET-6.md)                                        |
| SHEET-4.3 | [UAT-SHEET-6](SHEET/UAT-SHEET-6.md)                                        |
| SHEET-4.4 | [UAT-SHEET-6](SHEET/UAT-SHEET-6.md)                                        |
| SHEET-5.1 | Covered elsewhere                                                          |
| SHEET-5.2 | [UAT-SHEET-1](SHEET/UAT-SHEET-1.md)                                        |
| SHEET-5.3 | [UAT-SHEET-11](SHEET/UAT-SHEET-11.md)                                      |
| SHEET-5.4 | Covered elsewhere                                                          |
| SHEET-6.1 | [UAT-SHEET-9](SHEET/UAT-SHEET-9.md)                                        |
| SHEET-7.1 | Covered elsewhere                                                          |
| SHEET-8.1 | [UAT-SHEET-8](SHEET/UAT-SHEET-8.md)                                        |
| SHEET-8.2 | [UAT-SHEET-8](SHEET/UAT-SHEET-8.md)                                        |
| SHEET-8.3 | [UAT-SHEET-8](SHEET/UAT-SHEET-8.md)                                        |

</details>

<details>
<summary>CAMPAIGN: 19 of 24 ACs in scenarios</summary>

| AC           | Scenarios                                    |
| ------------ | -------------------------------------------- |
| CAMPAIGN-1.1 | [UAT-CAMPAIGN-1](CAMPAIGN/UAT-CAMPAIGN-1.md) |
| CAMPAIGN-1.2 | [UAT-CAMPAIGN-1](CAMPAIGN/UAT-CAMPAIGN-1.md) |
| CAMPAIGN-1.3 | Covered elsewhere                            |
| CAMPAIGN-2.1 | [UAT-CAMPAIGN-3](CAMPAIGN/UAT-CAMPAIGN-3.md) |
| CAMPAIGN-2.2 | [UAT-CAMPAIGN-3](CAMPAIGN/UAT-CAMPAIGN-3.md) |
| CAMPAIGN-2.3 | [UAT-CAMPAIGN-2](CAMPAIGN/UAT-CAMPAIGN-2.md) |
| CAMPAIGN-2.4 | [UAT-CAMPAIGN-2](CAMPAIGN/UAT-CAMPAIGN-2.md) |
| CAMPAIGN-2.5 | [UAT-CAMPAIGN-2](CAMPAIGN/UAT-CAMPAIGN-2.md) |
| CAMPAIGN-3.1 | [UAT-CAMPAIGN-4](CAMPAIGN/UAT-CAMPAIGN-4.md) |
| CAMPAIGN-3.2 | [UAT-CAMPAIGN-4](CAMPAIGN/UAT-CAMPAIGN-4.md) |
| CAMPAIGN-3.3 | [UAT-CAMPAIGN-4](CAMPAIGN/UAT-CAMPAIGN-4.md) |
| CAMPAIGN-3.4 | [UAT-CAMPAIGN-4](CAMPAIGN/UAT-CAMPAIGN-4.md) |
| CAMPAIGN-3.5 | [UAT-CAMPAIGN-4](CAMPAIGN/UAT-CAMPAIGN-4.md) |
| CAMPAIGN-4.1 | [UAT-CAMPAIGN-5](CAMPAIGN/UAT-CAMPAIGN-5.md) |
| CAMPAIGN-4.2 | Covered elsewhere                            |
| CAMPAIGN-4.3 | Covered elsewhere                            |
| CAMPAIGN-5.1 | [UAT-CAMPAIGN-5](CAMPAIGN/UAT-CAMPAIGN-5.md) |
| CAMPAIGN-5.2 | Covered elsewhere                            |
| CAMPAIGN-6.1 | [UAT-CAMPAIGN-6](CAMPAIGN/UAT-CAMPAIGN-6.md) |
| CAMPAIGN-6.2 | [UAT-CAMPAIGN-6](CAMPAIGN/UAT-CAMPAIGN-6.md) |
| CAMPAIGN-6.3 | [UAT-CAMPAIGN-6](CAMPAIGN/UAT-CAMPAIGN-6.md) |
| CAMPAIGN-7.1 | [UAT-CAMPAIGN-7](CAMPAIGN/UAT-CAMPAIGN-7.md) |
| CAMPAIGN-8.1 | [UAT-CAMPAIGN-8](CAMPAIGN/UAT-CAMPAIGN-8.md) |
| CAMPAIGN-8.2 | Covered elsewhere                            |

</details>

<details>
<summary>SOCIAL: 8 of 11 ACs in scenarios</summary>

| AC         | Scenarios                                                                      |
| ---------- | ------------------------------------------------------------------------------ |
| SOCIAL-1.1 | [UAT-SOCIAL-1](SOCIAL/UAT-SOCIAL-1.md), [UAT-SOCIAL-2](SOCIAL/UAT-SOCIAL-2.md) |
| SOCIAL-1.2 | [UAT-SOCIAL-4](SOCIAL/UAT-SOCIAL-4.md)                                         |
| SOCIAL-1.3 | Covered elsewhere                                                              |
| SOCIAL-1.4 | Covered elsewhere                                                              |
| SOCIAL-1.5 | [UAT-SOCIAL-3](SOCIAL/UAT-SOCIAL-3.md)                                         |
| SOCIAL-2.1 | [UAT-SOCIAL-5](SOCIAL/UAT-SOCIAL-5.md)                                         |
| SOCIAL-2.2 | [UAT-SOCIAL-5](SOCIAL/UAT-SOCIAL-5.md)                                         |
| SOCIAL-2.3 | [UAT-SOCIAL-5](SOCIAL/UAT-SOCIAL-5.md)                                         |
| SOCIAL-3.1 | [UAT-SOCIAL-6](SOCIAL/UAT-SOCIAL-6.md)                                         |
| SOCIAL-3.2 | [UAT-SOCIAL-6](SOCIAL/UAT-SOCIAL-6.md)                                         |
| SOCIAL-3.3 | Covered elsewhere                                                              |

</details>

<details>
<summary>ROOM: 20 of 38 ACs in scenarios</summary>

| AC        | Scenarios                                                            |
| --------- | -------------------------------------------------------------------- |
| ROOM-1.1  | [UAT-ROOM-1](ROOM/UAT-ROOM-1.md)                                     |
| ROOM-1.2  | Covered elsewhere                                                    |
| ROOM-1.3  | Covered elsewhere                                                    |
| ROOM-1.4  | [UAT-ROOM-3](ROOM/UAT-ROOM-3.md)                                     |
| ROOM-1.5  | [UAT-ROOM-1](ROOM/UAT-ROOM-1.md), [UAT-ROOM-10](ROOM/UAT-ROOM-10.md) |
| ROOM-2.1  | [UAT-ROOM-2](ROOM/UAT-ROOM-2.md)                                     |
| ROOM-2.2  | [UAT-ROOM-3](ROOM/UAT-ROOM-3.md)                                     |
| ROOM-2.3  | [UAT-ROOM-2](ROOM/UAT-ROOM-2.md)                                     |
| ROOM-3.1  | [UAT-ROOM-4](ROOM/UAT-ROOM-4.md)                                     |
| ROOM-3.2  | [UAT-ROOM-6](ROOM/UAT-ROOM-6.md)                                     |
| ROOM-3.3  | [UAT-ROOM-5](ROOM/UAT-ROOM-5.md)                                     |
| ROOM-3.4  | [UAT-ROOM-5](ROOM/UAT-ROOM-5.md)                                     |
| ROOM-3.5  | [UAT-ROOM-6](ROOM/UAT-ROOM-6.md)                                     |
| ROOM-3.6  | [UAT-ROOM-7](ROOM/UAT-ROOM-7.md)                                     |
| ROOM-4.1  | [UAT-ROOM-8](ROOM/UAT-ROOM-8.md)                                     |
| ROOM-4.2  | [UAT-ROOM-8](ROOM/UAT-ROOM-8.md)                                     |
| ROOM-4.3  | Covered elsewhere                                                    |
| ROOM-4.4  | Covered elsewhere                                                    |
| ROOM-4.5  | [UAT-ROOM-8](ROOM/UAT-ROOM-8.md)                                     |
| ROOM-5.1  | [UAT-ROOM-9](ROOM/UAT-ROOM-9.md)                                     |
| ROOM-5.2  | Covered elsewhere                                                    |
| ROOM-5.3  | [UAT-ROOM-9](ROOM/UAT-ROOM-9.md)                                     |
| ROOM-5.4  | [UAT-ROOM-9](ROOM/UAT-ROOM-9.md)                                     |
| ROOM-6.1  | Covered elsewhere                                                    |
| ROOM-6.2  | Covered elsewhere                                                    |
| ROOM-6.3  | Covered elsewhere                                                    |
| ROOM-6.4  | Covered elsewhere                                                    |
| ROOM-6.5  | Covered elsewhere                                                    |
| ROOM-6.6  | Covered elsewhere                                                    |
| ROOM-6.7  | Covered elsewhere                                                    |
| ROOM-6.8  | Covered elsewhere                                                    |
| ROOM-6.9  | Covered elsewhere                                                    |
| ROOM-6.10 | Covered elsewhere                                                    |
| ROOM-6.11 | Covered elsewhere                                                    |
| ROOM-6.12 | Covered elsewhere                                                    |
| ROOM-6.13 | Covered elsewhere                                                    |
| ROOM-6.14 | [UAT-ROOM-9](ROOM/UAT-ROOM-9.md)                                     |
| ROOM-7.1  | [UAT-ROOM-4](ROOM/UAT-ROOM-4.md)                                     |

</details>

<details>
<summary>SCENE: 15 of 16 ACs in scenarios</summary>

| AC        | Scenarios                                                                |
| --------- | ------------------------------------------------------------------------ |
| SCENE-1.1 | [UAT-SCENE-1](SCENE/UAT-SCENE-1.md)                                      |
| SCENE-1.2 | [UAT-SCENE-3](SCENE/UAT-SCENE-3.md)                                      |
| SCENE-1.3 | [UAT-SCENE-6](SCENE/UAT-SCENE-6.md)                                      |
| SCENE-2.1 | [UAT-SCENE-3](SCENE/UAT-SCENE-3.md)                                      |
| SCENE-2.2 | [UAT-SCENE-6](SCENE/UAT-SCENE-6.md)                                      |
| SCENE-2.3 | Covered elsewhere                                                        |
| SCENE-2.4 | [UAT-SCENE-5](SCENE/UAT-SCENE-5.md)                                      |
| SCENE-2.5 | [UAT-SCENE-4](SCENE/UAT-SCENE-4.md)                                      |
| SCENE-3.1 | [UAT-SCENE-1](SCENE/UAT-SCENE-1.md), [UAT-SCENE-2](SCENE/UAT-SCENE-2.md) |
| SCENE-3.2 | [UAT-SCENE-7](SCENE/UAT-SCENE-7.md)                                      |
| SCENE-3.3 | [UAT-SCENE-7](SCENE/UAT-SCENE-7.md)                                      |
| SCENE-4.1 | [UAT-SCENE-8](SCENE/UAT-SCENE-8.md)                                      |
| SCENE-4.2 | [UAT-SCENE-8](SCENE/UAT-SCENE-8.md)                                      |
| SCENE-5.1 | [UAT-SCENE-9](SCENE/UAT-SCENE-9.md)                                      |
| SCENE-5.2 | [UAT-SCENE-9](SCENE/UAT-SCENE-9.md)                                      |
| SCENE-5.3 | [UAT-SCENE-9](SCENE/UAT-SCENE-9.md)                                      |

</details>

<details>
<summary>MOVE: 18 of 22 ACs in scenarios</summary>

| AC       | Scenarios                                                                                            |
| -------- | ---------------------------------------------------------------------------------------------------- |
| MOVE-1.1 | [UAT-MOVE-1](MOVE/UAT-MOVE-1.md), [UAT-MOVE-2](MOVE/UAT-MOVE-2.md)                                   |
| MOVE-1.2 | [UAT-MOVE-3](MOVE/UAT-MOVE-3.md), [UAT-MOVE-4](MOVE/UAT-MOVE-4.md), [UAT-MOVE-7](MOVE/UAT-MOVE-7.md) |
| MOVE-1.3 | [UAT-MOVE-6](MOVE/UAT-MOVE-6.md), [UAT-MOVE-1](MOVE/UAT-MOVE-1.md)                                   |
| MOVE-1.4 | [UAT-MOVE-5](MOVE/UAT-MOVE-5.md)                                                                     |
| MOVE-1.5 | [UAT-MOVE-1](MOVE/UAT-MOVE-1.md)                                                                     |
| MOVE-2.1 | Covered elsewhere                                                                                    |
| MOVE-2.2 | [UAT-MOVE-7](MOVE/UAT-MOVE-7.md)                                                                     |
| MOVE-2.3 | Covered elsewhere                                                                                    |
| MOVE-2.4 | [UAT-MOVE-7](MOVE/UAT-MOVE-7.md)                                                                     |
| MOVE-2.5 | Covered elsewhere                                                                                    |
| MOVE-2.6 | [UAT-MOVE-7](MOVE/UAT-MOVE-7.md)                                                                     |
| MOVE-3.1 | [UAT-MOVE-8](MOVE/UAT-MOVE-8.md)                                                                     |
| MOVE-3.2 | [UAT-MOVE-8](MOVE/UAT-MOVE-8.md)                                                                     |
| MOVE-3.3 | [UAT-MOVE-8](MOVE/UAT-MOVE-8.md)                                                                     |
| MOVE-3.4 | Covered elsewhere                                                                                    |
| MOVE-3.5 | [UAT-MOVE-8](MOVE/UAT-MOVE-8.md)                                                                     |
| MOVE-3.6 | [UAT-MOVE-8](MOVE/UAT-MOVE-8.md)                                                                     |
| MOVE-3.7 | [UAT-MOVE-8](MOVE/UAT-MOVE-8.md)                                                                     |
| MOVE-4.1 | [UAT-MOVE-9](MOVE/UAT-MOVE-9.md)                                                                     |
| MOVE-4.2 | [UAT-MOVE-9](MOVE/UAT-MOVE-9.md)                                                                     |
| MOVE-4.3 | [UAT-MOVE-9](MOVE/UAT-MOVE-9.md)                                                                     |
| MOVE-4.4 | [UAT-MOVE-9](MOVE/UAT-MOVE-9.md)                                                                     |

</details>

<details>
<summary>ENCOUNTER: 29 of 30 ACs in scenarios</summary>

| AC             | Scenarios                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------ |
| ENCOUNTER-1.1  | [UAT-ENCOUNTER-3](ENCOUNTER/UAT-ENCOUNTER-3.md)                                                  |
| ENCOUNTER-1.2  | [UAT-ENCOUNTER-7](ENCOUNTER/UAT-ENCOUNTER-7.md)                                                  |
| ENCOUNTER-1.3  | [UAT-ENCOUNTER-7](ENCOUNTER/UAT-ENCOUNTER-7.md)                                                  |
| ENCOUNTER-2.1  | [UAT-ENCOUNTER-3](ENCOUNTER/UAT-ENCOUNTER-3.md)                                                  |
| ENCOUNTER-2.2  | [UAT-ENCOUNTER-3](ENCOUNTER/UAT-ENCOUNTER-3.md), [UAT-ENCOUNTER-1](ENCOUNTER/UAT-ENCOUNTER-1.md) |
| ENCOUNTER-2.3  | [UAT-ENCOUNTER-1](ENCOUNTER/UAT-ENCOUNTER-1.md), [UAT-ENCOUNTER-2](ENCOUNTER/UAT-ENCOUNTER-2.md) |
| ENCOUNTER-2.4  | [UAT-ENCOUNTER-3](ENCOUNTER/UAT-ENCOUNTER-3.md)                                                  |
| ENCOUNTER-2.5  | [UAT-ENCOUNTER-3](ENCOUNTER/UAT-ENCOUNTER-3.md)                                                  |
| ENCOUNTER-2.6  | Covered elsewhere                                                                                |
| ENCOUNTER-2.7  | [UAT-ENCOUNTER-1](ENCOUNTER/UAT-ENCOUNTER-1.md)                                                  |
| ENCOUNTER-3.1  | [UAT-ENCOUNTER-3](ENCOUNTER/UAT-ENCOUNTER-3.md)                                                  |
| ENCOUNTER-3.2  | [UAT-ENCOUNTER-2](ENCOUNTER/UAT-ENCOUNTER-2.md)                                                  |
| ENCOUNTER-3.3  | [UAT-ENCOUNTER-4](ENCOUNTER/UAT-ENCOUNTER-4.md), [UAT-ENCOUNTER-1](ENCOUNTER/UAT-ENCOUNTER-1.md) |
| ENCOUNTER-3.4  | [UAT-ENCOUNTER-4](ENCOUNTER/UAT-ENCOUNTER-4.md), [UAT-ENCOUNTER-1](ENCOUNTER/UAT-ENCOUNTER-1.md) |
| ENCOUNTER-3.5  | [UAT-ENCOUNTER-4](ENCOUNTER/UAT-ENCOUNTER-4.md), [UAT-ENCOUNTER-1](ENCOUNTER/UAT-ENCOUNTER-1.md) |
| ENCOUNTER-3.6  | [UAT-ENCOUNTER-4](ENCOUNTER/UAT-ENCOUNTER-4.md), [UAT-ENCOUNTER-1](ENCOUNTER/UAT-ENCOUNTER-1.md) |
| ENCOUNTER-3.7  | [UAT-ENCOUNTER-4](ENCOUNTER/UAT-ENCOUNTER-4.md)                                                  |
| ENCOUNTER-4.1  | [UAT-ENCOUNTER-2](ENCOUNTER/UAT-ENCOUNTER-2.md)                                                  |
| ENCOUNTER-4.2  | [UAT-ENCOUNTER-2](ENCOUNTER/UAT-ENCOUNTER-2.md)                                                  |
| ENCOUNTER-4.3  | [UAT-ENCOUNTER-2](ENCOUNTER/UAT-ENCOUNTER-2.md)                                                  |
| ENCOUNTER-4.4  | [UAT-ENCOUNTER-2](ENCOUNTER/UAT-ENCOUNTER-2.md)                                                  |
| ENCOUNTER-5.1  | [UAT-ENCOUNTER-1](ENCOUNTER/UAT-ENCOUNTER-1.md)                                                  |
| ENCOUNTER-6.1  | [UAT-ENCOUNTER-5](ENCOUNTER/UAT-ENCOUNTER-5.md)                                                  |
| ENCOUNTER-6.2  | [UAT-ENCOUNTER-5](ENCOUNTER/UAT-ENCOUNTER-5.md)                                                  |
| ENCOUNTER-6.3  | [UAT-ENCOUNTER-5](ENCOUNTER/UAT-ENCOUNTER-5.md)                                                  |
| ENCOUNTER-7.1  | [UAT-ENCOUNTER-6](ENCOUNTER/UAT-ENCOUNTER-6.md)                                                  |
| ENCOUNTER-7.2  | [UAT-ENCOUNTER-6](ENCOUNTER/UAT-ENCOUNTER-6.md)                                                  |
| ENCOUNTER-8.1  | [UAT-ENCOUNTER-6](ENCOUNTER/UAT-ENCOUNTER-6.md)                                                  |
| ENCOUNTER-9.1  | [UAT-ENCOUNTER-6](ENCOUNTER/UAT-ENCOUNTER-6.md), [UAT-ENCOUNTER-2](ENCOUNTER/UAT-ENCOUNTER-2.md) |
| ENCOUNTER-10.1 | [UAT-ENCOUNTER-2](ENCOUNTER/UAT-ENCOUNTER-2.md)                                                  |

</details>

<details>
<summary>ATTACK: 84 of 88 ACs in scenarios</summary>

| AC          | Scenarios                                                                        |
| ----------- | -------------------------------------------------------------------------------- |
| ATTACK-1.1  | [UAT-ATTACK-1](ATTACK/UAT-ATTACK-1.md), [UAT-ATTACK-11](ATTACK/UAT-ATTACK-11.md) |
| ATTACK-1.2  | [UAT-ATTACK-10](ATTACK/UAT-ATTACK-10.md)                                         |
| ATTACK-1.3  | [UAT-ATTACK-7](ATTACK/UAT-ATTACK-7.md)                                           |
| ATTACK-2.1  | [UAT-ATTACK-1](ATTACK/UAT-ATTACK-1.md)                                           |
| ATTACK-2.2  | [UAT-ATTACK-2](ATTACK/UAT-ATTACK-2.md)                                           |
| ATTACK-2.3  | [UAT-ATTACK-2](ATTACK/UAT-ATTACK-2.md)                                           |
| ATTACK-2.4  | [UAT-ATTACK-2](ATTACK/UAT-ATTACK-2.md)                                           |
| ATTACK-2.5  | [UAT-ATTACK-1](ATTACK/UAT-ATTACK-1.md)                                           |
| ATTACK-3.1  | [UAT-ATTACK-1](ATTACK/UAT-ATTACK-1.md)                                           |
| ATTACK-3.2  | [UAT-ATTACK-3](ATTACK/UAT-ATTACK-3.md)                                           |
| ATTACK-3.3  | [UAT-ATTACK-4](ATTACK/UAT-ATTACK-4.md)                                           |
| ATTACK-4.1  | [UAT-ATTACK-7](ATTACK/UAT-ATTACK-7.md)                                           |
| ATTACK-4.2  | [UAT-ATTACK-7](ATTACK/UAT-ATTACK-7.md)                                           |
| ATTACK-5.1  | [UAT-ATTACK-10](ATTACK/UAT-ATTACK-10.md)                                         |
| ATTACK-5.2  | [UAT-ATTACK-10](ATTACK/UAT-ATTACK-10.md)                                         |
| ATTACK-5.3  | [UAT-ATTACK-10](ATTACK/UAT-ATTACK-10.md)                                         |
| ATTACK-5.4  | [UAT-ATTACK-10](ATTACK/UAT-ATTACK-10.md)                                         |
| ATTACK-5.5  | [UAT-ATTACK-10](ATTACK/UAT-ATTACK-10.md)                                         |
| ATTACK-5.6  | [UAT-ATTACK-10](ATTACK/UAT-ATTACK-10.md)                                         |
| ATTACK-5.7  | [UAT-ATTACK-10](ATTACK/UAT-ATTACK-10.md)                                         |
| ATTACK-5.8  | [UAT-ATTACK-10](ATTACK/UAT-ATTACK-10.md)                                         |
| ATTACK-5.9  | [UAT-ATTACK-10](ATTACK/UAT-ATTACK-10.md)                                         |
| ATTACK-5.10 | [UAT-ATTACK-10](ATTACK/UAT-ATTACK-10.md)                                         |
| ATTACK-5.11 | [UAT-ATTACK-10](ATTACK/UAT-ATTACK-10.md)                                         |
| ATTACK-5.12 | [UAT-ATTACK-10](ATTACK/UAT-ATTACK-10.md)                                         |
| ATTACK-5.13 | [UAT-ATTACK-10](ATTACK/UAT-ATTACK-10.md)                                         |
| ATTACK-5.14 | [UAT-ATTACK-10](ATTACK/UAT-ATTACK-10.md)                                         |
| ATTACK-5.15 | [UAT-ATTACK-10](ATTACK/UAT-ATTACK-10.md)                                         |
| ATTACK-6.1  | Covered elsewhere                                                                |
| ATTACK-6.2  | Covered elsewhere                                                                |
| ATTACK-6.3  | Covered elsewhere                                                                |
| ATTACK-6.4  | [UAT-ATTACK-11](ATTACK/UAT-ATTACK-11.md)                                         |
| ATTACK-6.5  | [UAT-ATTACK-11](ATTACK/UAT-ATTACK-11.md)                                         |
| ATTACK-6.6  | [UAT-ATTACK-11](ATTACK/UAT-ATTACK-11.md)                                         |
| ATTACK-7.1  | [UAT-ATTACK-8](ATTACK/UAT-ATTACK-8.md)                                           |
| ATTACK-7.3  | [UAT-ATTACK-8](ATTACK/UAT-ATTACK-8.md)                                           |
| ATTACK-7.4  | [UAT-ATTACK-8](ATTACK/UAT-ATTACK-8.md)                                           |
| ATTACK-7.5  | [UAT-ATTACK-8](ATTACK/UAT-ATTACK-8.md)                                           |
| ATTACK-7.6  | [UAT-ATTACK-8](ATTACK/UAT-ATTACK-8.md)                                           |
| ATTACK-7.7  | [UAT-ATTACK-8](ATTACK/UAT-ATTACK-8.md)                                           |
| ATTACK-7.8  | [UAT-ATTACK-10](ATTACK/UAT-ATTACK-10.md)                                         |
| ATTACK-7.2  | [UAT-ATTACK-10](ATTACK/UAT-ATTACK-10.md)                                         |
| ATTACK-7.9  | [UAT-ATTACK-8](ATTACK/UAT-ATTACK-8.md)                                           |
| ATTACK-8.1  | [UAT-ATTACK-1](ATTACK/UAT-ATTACK-1.md)                                           |
| ATTACK-8.2  | [UAT-ATTACK-9](ATTACK/UAT-ATTACK-9.md)                                           |
| ATTACK-8.3  | [UAT-ATTACK-3](ATTACK/UAT-ATTACK-3.md)                                           |
| ATTACK-8.4  | [UAT-ATTACK-9](ATTACK/UAT-ATTACK-9.md), [UAT-ATTACK-4](ATTACK/UAT-ATTACK-4.md)   |
| ATTACK-9.1  | [UAT-ATTACK-9](ATTACK/UAT-ATTACK-9.md)                                           |
| ATTACK-9.2  | [UAT-ATTACK-9](ATTACK/UAT-ATTACK-9.md)                                           |
| ATTACK-9.3  | [UAT-ATTACK-9](ATTACK/UAT-ATTACK-9.md)                                           |
| ATTACK-9.4  | [UAT-ATTACK-9](ATTACK/UAT-ATTACK-9.md)                                           |
| ATTACK-9.5  | [UAT-ATTACK-9](ATTACK/UAT-ATTACK-9.md)                                           |
| ATTACK-9.6  | [UAT-ATTACK-9](ATTACK/UAT-ATTACK-9.md)                                           |
| ATTACK-10.1 | [UAT-ATTACK-6](ATTACK/UAT-ATTACK-6.md)                                           |
| ATTACK-10.2 | [UAT-ATTACK-6](ATTACK/UAT-ATTACK-6.md)                                           |
| ATTACK-10.3 | [UAT-ATTACK-6](ATTACK/UAT-ATTACK-6.md)                                           |
| ATTACK-10.4 | [UAT-ATTACK-6](ATTACK/UAT-ATTACK-6.md)                                           |
| ATTACK-10.5 | [UAT-ATTACK-5](ATTACK/UAT-ATTACK-5.md)                                           |
| ATTACK-10.6 | [UAT-ATTACK-5](ATTACK/UAT-ATTACK-5.md)                                           |
| ATTACK-11.1 | [UAT-ATTACK-10](ATTACK/UAT-ATTACK-10.md)                                         |
| ATTACK-11.2 | Covered elsewhere                                                                |
| ATTACK-11.3 | [UAT-ATTACK-10](ATTACK/UAT-ATTACK-10.md)                                         |
| ATTACK-11.4 | [UAT-ATTACK-10](ATTACK/UAT-ATTACK-10.md)                                         |
| ATTACK-12.1 | [UAT-ATTACK-7](ATTACK/UAT-ATTACK-7.md)                                           |
| ATTACK-12.2 | [UAT-ATTACK-7](ATTACK/UAT-ATTACK-7.md)                                           |
| ATTACK-12.3 | [UAT-ATTACK-7](ATTACK/UAT-ATTACK-7.md)                                           |
| ATTACK-12.4 | [UAT-ATTACK-7](ATTACK/UAT-ATTACK-7.md)                                           |
| ATTACK-13.1 | [UAT-ATTACK-7](ATTACK/UAT-ATTACK-7.md)                                           |
| ATTACK-13.2 | [UAT-ATTACK-7](ATTACK/UAT-ATTACK-7.md)                                           |
| ATTACK-13.3 | [UAT-ATTACK-7](ATTACK/UAT-ATTACK-7.md)                                           |
| ATTACK-15.1 | [UAT-ATTACK-7](ATTACK/UAT-ATTACK-7.md)                                           |
| ATTACK-15.2 | [UAT-ATTACK-7](ATTACK/UAT-ATTACK-7.md)                                           |
| ATTACK-15.3 | [UAT-ATTACK-7](ATTACK/UAT-ATTACK-7.md)                                           |
| ATTACK-16.1 | [UAT-ATTACK-7](ATTACK/UAT-ATTACK-7.md)                                           |
| ATTACK-16.2 | [UAT-ATTACK-7](ATTACK/UAT-ATTACK-7.md)                                           |
| ATTACK-17.1 | [UAT-ATTACK-1](ATTACK/UAT-ATTACK-1.md)                                           |
| ATTACK-17.2 | [UAT-ATTACK-1](ATTACK/UAT-ATTACK-1.md)                                           |
| ATTACK-17.3 | [UAT-ATTACK-5](ATTACK/UAT-ATTACK-5.md)                                           |
| ATTACK-17.4 | [UAT-ATTACK-5](ATTACK/UAT-ATTACK-5.md)                                           |
| ATTACK-17.5 | [UAT-ATTACK-5](ATTACK/UAT-ATTACK-5.md)                                           |
| ATTACK-17.6 | [UAT-ATTACK-5](ATTACK/UAT-ATTACK-5.md)                                           |
| ATTACK-18.1 | [UAT-ATTACK-8](ATTACK/UAT-ATTACK-8.md)                                           |
| ATTACK-18.2 | [UAT-ATTACK-8](ATTACK/UAT-ATTACK-8.md)                                           |
| ATTACK-18.3 | [UAT-ATTACK-8](ATTACK/UAT-ATTACK-8.md)                                           |
| ATTACK-19.1 | [UAT-ATTACK-1](ATTACK/UAT-ATTACK-1.md), [UAT-ATTACK-11](ATTACK/UAT-ATTACK-11.md) |
| ATTACK-19.2 | [UAT-ATTACK-11](ATTACK/UAT-ATTACK-11.md)                                         |
| ATTACK-19.3 | [UAT-ATTACK-11](ATTACK/UAT-ATTACK-11.md)                                         |
| ATTACK-19.4 | [UAT-ATTACK-11](ATTACK/UAT-ATTACK-11.md)                                         |

</details>

<details>
<summary>SPELLS: 98 of 102 ACs in scenarios</summary>

| AC          | Scenarios                                                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SPELLS-1.1  | [UAT-SPELLS-3](SPELLS/UAT-SPELLS-3.md), [UAT-SPELLS-24](SPELLS/UAT-SPELLS-24.md)                                                                                   |
| SPELLS-1.2  | [UAT-SPELLS-3](SPELLS/UAT-SPELLS-3.md), [UAT-SPELLS-7](SPELLS/UAT-SPELLS-7.md), [UAT-SPELLS-23](SPELLS/UAT-SPELLS-23.md), [UAT-SPELLS-24](SPELLS/UAT-SPELLS-24.md) |
| SPELLS-2.1  | [UAT-SPELLS-7](SPELLS/UAT-SPELLS-7.md), [UAT-SPELLS-8](SPELLS/UAT-SPELLS-8.md)                                                                                     |
| SPELLS-2.2  | [UAT-SPELLS-7](SPELLS/UAT-SPELLS-7.md), [UAT-SPELLS-8](SPELLS/UAT-SPELLS-8.md)                                                                                     |
| SPELLS-2.3  | [UAT-SPELLS-7](SPELLS/UAT-SPELLS-7.md)                                                                                                                             |
| SPELLS-2.4  | [UAT-SPELLS-7](SPELLS/UAT-SPELLS-7.md), [UAT-SPELLS-9](SPELLS/UAT-SPELLS-9.md)                                                                                     |
| SPELLS-2.5  | [UAT-SPELLS-8](SPELLS/UAT-SPELLS-8.md)                                                                                                                             |
| SPELLS-2.6  | [UAT-SPELLS-7](SPELLS/UAT-SPELLS-7.md), [UAT-SPELLS-8](SPELLS/UAT-SPELLS-8.md)                                                                                     |
| SPELLS-2.7  | [UAT-SPELLS-8](SPELLS/UAT-SPELLS-8.md)                                                                                                                             |
| SPELLS-3.1  | [UAT-SPELLS-10](SPELLS/UAT-SPELLS-10.md)                                                                                                                           |
| SPELLS-3.2  | [UAT-SPELLS-10](SPELLS/UAT-SPELLS-10.md)                                                                                                                           |
| SPELLS-3.3  | [UAT-SPELLS-1](SPELLS/UAT-SPELLS-1.md), [UAT-SPELLS-10](SPELLS/UAT-SPELLS-10.md)                                                                                   |
| SPELLS-3.4  | [UAT-SPELLS-10](SPELLS/UAT-SPELLS-10.md)                                                                                                                           |
| SPELLS-3.5  | [UAT-SPELLS-10](SPELLS/UAT-SPELLS-10.md), [UAT-SPELLS-11](SPELLS/UAT-SPELLS-11.md)                                                                                 |
| SPELLS-3.6  | [UAT-SPELLS-1](SPELLS/UAT-SPELLS-1.md), [UAT-SPELLS-25](SPELLS/UAT-SPELLS-25.md)                                                                                   |
| SPELLS-3.7  | [UAT-SPELLS-11](SPELLS/UAT-SPELLS-11.md)                                                                                                                           |
| SPELLS-4.1  | Covered elsewhere                                                                                                                                                  |
| SPELLS-4.2  | [UAT-SPELLS-19](SPELLS/UAT-SPELLS-19.md)                                                                                                                           |
| SPELLS-5.1  | [UAT-SPELLS-12](SPELLS/UAT-SPELLS-12.md)                                                                                                                           |
| SPELLS-5.2  | [UAT-SPELLS-12](SPELLS/UAT-SPELLS-12.md)                                                                                                                           |
| SPELLS-5.3  | [UAT-SPELLS-15](SPELLS/UAT-SPELLS-15.md)                                                                                                                           |
| SPELLS-5.4  | [UAT-SPELLS-13](SPELLS/UAT-SPELLS-13.md), [UAT-SPELLS-15](SPELLS/UAT-SPELLS-15.md)                                                                                 |
| SPELLS-5.5  | [UAT-SPELLS-13](SPELLS/UAT-SPELLS-13.md)                                                                                                                           |
| SPELLS-5.6  | [UAT-SPELLS-15](SPELLS/UAT-SPELLS-15.md)                                                                                                                           |
| SPELLS-5.7  | [UAT-SPELLS-7](SPELLS/UAT-SPELLS-7.md), [UAT-SPELLS-15](SPELLS/UAT-SPELLS-15.md)                                                                                   |
| SPELLS-5.8  | [UAT-SPELLS-15](SPELLS/UAT-SPELLS-15.md)                                                                                                                           |
| SPELLS-5.9  | [UAT-SPELLS-16](SPELLS/UAT-SPELLS-16.md)                                                                                                                           |
| SPELLS-5.10 | [UAT-SPELLS-13](SPELLS/UAT-SPELLS-13.md), [UAT-SPELLS-15](SPELLS/UAT-SPELLS-15.md)                                                                                 |
| SPELLS-5.11 | [UAT-SPELLS-7](SPELLS/UAT-SPELLS-7.md), [UAT-SPELLS-16](SPELLS/UAT-SPELLS-16.md)                                                                                   |
| SPELLS-5.12 | [UAT-SPELLS-16](SPELLS/UAT-SPELLS-16.md)                                                                                                                           |
| SPELLS-5.13 | [UAT-SPELLS-16](SPELLS/UAT-SPELLS-16.md)                                                                                                                           |
| SPELLS-5.14 | [UAT-SPELLS-16](SPELLS/UAT-SPELLS-16.md)                                                                                                                           |
| SPELLS-6.1  | Covered elsewhere                                                                                                                                                  |
| SPELLS-7.1  | [UAT-SPELLS-3](SPELLS/UAT-SPELLS-3.md)                                                                                                                             |
| SPELLS-7.2  | [UAT-SPELLS-3](SPELLS/UAT-SPELLS-3.md)                                                                                                                             |
| SPELLS-7.3  | [UAT-SPELLS-4](SPELLS/UAT-SPELLS-4.md)                                                                                                                             |
| SPELLS-8.1  | [UAT-SPELLS-2](SPELLS/UAT-SPELLS-2.md), [UAT-SPELLS-7](SPELLS/UAT-SPELLS-7.md)                                                                                     |
| SPELLS-8.2  | [UAT-SPELLS-11](SPELLS/UAT-SPELLS-11.md)                                                                                                                           |
| SPELLS-8.3  | [UAT-SPELLS-13](SPELLS/UAT-SPELLS-13.md), [UAT-SPELLS-15](SPELLS/UAT-SPELLS-15.md)                                                                                 |
| SPELLS-8.4  | [UAT-SPELLS-3](SPELLS/UAT-SPELLS-3.md)                                                                                                                             |
| SPELLS-8.5  | [UAT-SPELLS-7](SPELLS/UAT-SPELLS-7.md)                                                                                                                             |
| SPELLS-8.6  | [UAT-SPELLS-26](SPELLS/UAT-SPELLS-26.md)                                                                                                                           |
| SPELLS-9.1  | [UAT-SPELLS-7](SPELLS/UAT-SPELLS-7.md), [UAT-SPELLS-9](SPELLS/UAT-SPELLS-9.md)                                                                                     |
| SPELLS-9.2  | [UAT-SPELLS-7](SPELLS/UAT-SPELLS-7.md), [UAT-SPELLS-9](SPELLS/UAT-SPELLS-9.md)                                                                                     |
| SPELLS-10.1 | [UAT-SPELLS-9](SPELLS/UAT-SPELLS-9.md)                                                                                                                             |
| SPELLS-10.2 | [UAT-SPELLS-9](SPELLS/UAT-SPELLS-9.md)                                                                                                                             |
| SPELLS-10.3 | [UAT-SPELLS-9](SPELLS/UAT-SPELLS-9.md)                                                                                                                             |
| SPELLS-10.4 | [UAT-SPELLS-9](SPELLS/UAT-SPELLS-9.md)                                                                                                                             |
| SPELLS-10.5 | [UAT-SPELLS-9](SPELLS/UAT-SPELLS-9.md)                                                                                                                             |
| SPELLS-10.6 | [UAT-SPELLS-9](SPELLS/UAT-SPELLS-9.md)                                                                                                                             |
| SPELLS-11.1 | [UAT-SPELLS-12](SPELLS/UAT-SPELLS-12.md)                                                                                                                           |
| SPELLS-11.2 | [UAT-SPELLS-12](SPELLS/UAT-SPELLS-12.md)                                                                                                                           |
| SPELLS-11.3 | [UAT-SPELLS-12](SPELLS/UAT-SPELLS-12.md)                                                                                                                           |
| SPELLS-12.1 | [UAT-SPELLS-17](SPELLS/UAT-SPELLS-17.md)                                                                                                                           |
| SPELLS-12.2 | [UAT-SPELLS-17](SPELLS/UAT-SPELLS-17.md)                                                                                                                           |
| SPELLS-12.3 | [UAT-SPELLS-17](SPELLS/UAT-SPELLS-17.md)                                                                                                                           |
| SPELLS-13.1 | [UAT-SPELLS-5](SPELLS/UAT-SPELLS-5.md)                                                                                                                             |
| SPELLS-13.2 | [UAT-SPELLS-5](SPELLS/UAT-SPELLS-5.md)                                                                                                                             |
| SPELLS-14.1 | [UAT-SPELLS-6](SPELLS/UAT-SPELLS-6.md)                                                                                                                             |
| SPELLS-14.2 | [UAT-SPELLS-6](SPELLS/UAT-SPELLS-6.md)                                                                                                                             |
| SPELLS-15.1 | [UAT-SPELLS-18](SPELLS/UAT-SPELLS-18.md)                                                                                                                           |
| SPELLS-16.1 | [UAT-SPELLS-3](SPELLS/UAT-SPELLS-3.md)                                                                                                                             |
| SPELLS-17.1 | [UAT-SPELLS-19](SPELLS/UAT-SPELLS-19.md)                                                                                                                           |
| SPELLS-17.2 | [UAT-SPELLS-19](SPELLS/UAT-SPELLS-19.md)                                                                                                                           |
| SPELLS-17.3 | [UAT-SPELLS-19](SPELLS/UAT-SPELLS-19.md)                                                                                                                           |
| SPELLS-17.4 | [UAT-SPELLS-19](SPELLS/UAT-SPELLS-19.md)                                                                                                                           |
| SPELLS-17.5 | [UAT-SPELLS-19](SPELLS/UAT-SPELLS-19.md)                                                                                                                           |
| SPELLS-17.6 | [UAT-SPELLS-27](SPELLS/UAT-SPELLS-27.md)                                                                                                                           |
| SPELLS-18.1 | [UAT-SPELLS-18](SPELLS/UAT-SPELLS-18.md)                                                                                                                           |
| SPELLS-19.1 | [UAT-SPELLS-18](SPELLS/UAT-SPELLS-18.md)                                                                                                                           |
| SPELLS-19.2 | [UAT-SPELLS-18](SPELLS/UAT-SPELLS-18.md)                                                                                                                           |
| SPELLS-20.1 | [UAT-SPELLS-19](SPELLS/UAT-SPELLS-19.md)                                                                                                                           |
| SPELLS-21.1 | [UAT-SPELLS-18](SPELLS/UAT-SPELLS-18.md)                                                                                                                           |
| SPELLS-22.1 | [UAT-SPELLS-5](SPELLS/UAT-SPELLS-5.md)                                                                                                                             |
| SPELLS-23.1 | [UAT-SPELLS-5](SPELLS/UAT-SPELLS-5.md)                                                                                                                             |
| SPELLS-23.2 | [UAT-SPELLS-5](SPELLS/UAT-SPELLS-5.md)                                                                                                                             |
| SPELLS-24.1 | [UAT-SPELLS-19](SPELLS/UAT-SPELLS-19.md)                                                                                                                           |
| SPELLS-25.1 | Covered elsewhere                                                                                                                                                  |
| SPELLS-26.1 | [UAT-SPELLS-20](SPELLS/UAT-SPELLS-20.md), [UAT-SPELLS-27](SPELLS/UAT-SPELLS-27.md)                                                                                 |
| SPELLS-28.1 | [UAT-SPELLS-20](SPELLS/UAT-SPELLS-20.md)                                                                                                                           |
| SPELLS-28.2 | [UAT-SPELLS-20](SPELLS/UAT-SPELLS-20.md)                                                                                                                           |
| SPELLS-27.1 | [UAT-SPELLS-21](SPELLS/UAT-SPELLS-21.md)                                                                                                                           |
| SPELLS-27.2 | [UAT-SPELLS-21](SPELLS/UAT-SPELLS-21.md)                                                                                                                           |
| SPELLS-29.1 | [UAT-SPELLS-21](SPELLS/UAT-SPELLS-21.md)                                                                                                                           |
| SPELLS-29.2 | [UAT-SPELLS-21](SPELLS/UAT-SPELLS-21.md)                                                                                                                           |
| SPELLS-30.1 | [UAT-SPELLS-15](SPELLS/UAT-SPELLS-15.md), [UAT-SPELLS-19](SPELLS/UAT-SPELLS-19.md), [UAT-SPELLS-21](SPELLS/UAT-SPELLS-21.md)                                       |
| SPELLS-31.1 | Covered elsewhere                                                                                                                                                  |
| SPELLS-31.2 | [UAT-SPELLS-26](SPELLS/UAT-SPELLS-26.md)                                                                                                                           |
| SPELLS-31.3 | [UAT-SPELLS-14](SPELLS/UAT-SPELLS-14.md)                                                                                                                           |
| SPELLS-32.1 | [UAT-SPELLS-27](SPELLS/UAT-SPELLS-27.md)                                                                                                                           |
| SPELLS-33.1 | [UAT-SPELLS-27](SPELLS/UAT-SPELLS-27.md)                                                                                                                           |
| SPELLS-34.1 | [UAT-SPELLS-1](SPELLS/UAT-SPELLS-1.md), [UAT-SPELLS-25](SPELLS/UAT-SPELLS-25.md)                                                                                   |
| SPELLS-34.2 | [UAT-SPELLS-22](SPELLS/UAT-SPELLS-22.md)                                                                                                                           |
| SPELLS-34.3 | [UAT-SPELLS-22](SPELLS/UAT-SPELLS-22.md)                                                                                                                           |
| SPELLS-34.4 | [UAT-SPELLS-22](SPELLS/UAT-SPELLS-22.md)                                                                                                                           |
| SPELLS-34.5 | [UAT-SPELLS-22](SPELLS/UAT-SPELLS-22.md)                                                                                                                           |
| SPELLS-35.1 | [UAT-SPELLS-22](SPELLS/UAT-SPELLS-22.md)                                                                                                                           |
| SPELLS-35.2 | [UAT-SPELLS-22](SPELLS/UAT-SPELLS-22.md)                                                                                                                           |
| SPELLS-35.3 | [UAT-SPELLS-22](SPELLS/UAT-SPELLS-22.md)                                                                                                                           |
| SPELLS-35.4 | [UAT-SPELLS-22](SPELLS/UAT-SPELLS-22.md)                                                                                                                           |
| SPELLS-35.5 | [UAT-SPELLS-22](SPELLS/UAT-SPELLS-22.md)                                                                                                                           |
| SPELLS-35.6 | [UAT-SPELLS-22](SPELLS/UAT-SPELLS-22.md)                                                                                                                           |

</details>

<details>
<summary>REACTION: 14 of 14 ACs in scenarios</summary>

| AC           | Scenarios                                                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| REACTION-1.1 | [UAT-REACTION-2](REACTION/UAT-REACTION-2.md), [UAT-REACTION-1](REACTION/UAT-REACTION-1.md), [UAT-REACTION-7](REACTION/UAT-REACTION-7.md) |
| REACTION-1.2 | [UAT-REACTION-2](REACTION/UAT-REACTION-2.md), [UAT-REACTION-1](REACTION/UAT-REACTION-1.md), [UAT-REACTION-7](REACTION/UAT-REACTION-7.md) |
| REACTION-1.3 | [UAT-REACTION-6](REACTION/UAT-REACTION-6.md)                                                                                             |
| REACTION-1.4 | [UAT-REACTION-2](REACTION/UAT-REACTION-2.md)                                                                                             |
| REACTION-2.1 | [UAT-REACTION-3](REACTION/UAT-REACTION-3.md)                                                                                             |
| REACTION-2.2 | [UAT-REACTION-3](REACTION/UAT-REACTION-3.md)                                                                                             |
| REACTION-2.3 | [UAT-REACTION-3](REACTION/UAT-REACTION-3.md)                                                                                             |
| REACTION-2.4 | [UAT-REACTION-3](REACTION/UAT-REACTION-3.md)                                                                                             |
| REACTION-3.1 | [UAT-REACTION-2](REACTION/UAT-REACTION-2.md), [UAT-REACTION-1](REACTION/UAT-REACTION-1.md)                                               |
| REACTION-4.1 | [UAT-REACTION-1](REACTION/UAT-REACTION-1.md), [UAT-REACTION-4](REACTION/UAT-REACTION-4.md)                                               |
| REACTION-4.2 | [UAT-REACTION-5](REACTION/UAT-REACTION-5.md)                                                                                             |
| REACTION-4.3 | [UAT-REACTION-4](REACTION/UAT-REACTION-4.md)                                                                                             |
| REACTION-4.4 | [UAT-REACTION-1](REACTION/UAT-REACTION-1.md)                                                                                             |
| REACTION-4.5 | [UAT-REACTION-1](REACTION/UAT-REACTION-1.md)                                                                                             |

</details>

<details>
<summary>PRIVACY: 10 of 11 ACs in scenarios</summary>

| AC          | Scenarios                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| PRIVACY-1.1 | [UAT-PRIVACY-1](PRIVACY/UAT-PRIVACY-1.md), [UAT-PRIVACY-2](PRIVACY/UAT-PRIVACY-2.md)                                            |
| PRIVACY-1.2 | [UAT-PRIVACY-4](PRIVACY/UAT-PRIVACY-4.md), [UAT-PRIVACY-3](PRIVACY/UAT-PRIVACY-3.md)                                            |
| PRIVACY-1.3 | Covered elsewhere                                                                                                               |
| PRIVACY-1.4 | [UAT-PRIVACY-1](PRIVACY/UAT-PRIVACY-1.md), [UAT-PRIVACY-2](PRIVACY/UAT-PRIVACY-2.md), [UAT-PRIVACY-5](PRIVACY/UAT-PRIVACY-5.md) |
| PRIVACY-1.5 | [UAT-PRIVACY-5](PRIVACY/UAT-PRIVACY-5.md)                                                                                       |
| PRIVACY-1.6 | [UAT-PRIVACY-1](PRIVACY/UAT-PRIVACY-1.md)                                                                                       |
| PRIVACY-1.7 | [UAT-PRIVACY-4](PRIVACY/UAT-PRIVACY-4.md)                                                                                       |
| PRIVACY-2.1 | [UAT-PRIVACY-6](PRIVACY/UAT-PRIVACY-6.md)                                                                                       |
| PRIVACY-3.1 | [UAT-PRIVACY-7](PRIVACY/UAT-PRIVACY-7.md)                                                                                       |
| PRIVACY-3.2 | [UAT-PRIVACY-8](PRIVACY/UAT-PRIVACY-8.md)                                                                                       |
| PRIVACY-4.1 | [UAT-PRIVACY-9](PRIVACY/UAT-PRIVACY-9.md)                                                                                       |

</details>

<details>
<summary>RELIABILITY: 36 of 92 ACs in scenarios</summary>

| AC                | Scenarios                                               |
| ----------------- | ------------------------------------------------------- |
| RELIABILITY-1.1   | [UAT-RELIABILITY-1](RELIABILITY/UAT-RELIABILITY-1.md)   |
| RELIABILITY-1.2   | [UAT-RELIABILITY-1](RELIABILITY/UAT-RELIABILITY-1.md)   |
| RELIABILITY-1.3   | [UAT-RELIABILITY-6](RELIABILITY/UAT-RELIABILITY-6.md)   |
| RELIABILITY-2.1   | [UAT-RELIABILITY-2](RELIABILITY/UAT-RELIABILITY-2.md)   |
| RELIABILITY-2.2   | [UAT-RELIABILITY-2](RELIABILITY/UAT-RELIABILITY-2.md)   |
| RELIABILITY-2.3   | [UAT-RELIABILITY-2](RELIABILITY/UAT-RELIABILITY-2.md)   |
| RELIABILITY-2.4   | [UAT-RELIABILITY-2](RELIABILITY/UAT-RELIABILITY-2.md)   |
| RELIABILITY-2.5   | [UAT-RELIABILITY-3](RELIABILITY/UAT-RELIABILITY-3.md)   |
| RELIABILITY-2.6   | [UAT-RELIABILITY-3](RELIABILITY/UAT-RELIABILITY-3.md)   |
| RELIABILITY-3.1   | [UAT-RELIABILITY-1](RELIABILITY/UAT-RELIABILITY-1.md)   |
| RELIABILITY-4.1   | [UAT-RELIABILITY-4](RELIABILITY/UAT-RELIABILITY-4.md)   |
| RELIABILITY-4.2   | [UAT-RELIABILITY-4](RELIABILITY/UAT-RELIABILITY-4.md)   |
| RELIABILITY-5.1   | [UAT-RELIABILITY-7](RELIABILITY/UAT-RELIABILITY-7.md)   |
| RELIABILITY-5.2   | Covered elsewhere                                       |
| RELIABILITY-6.1   | [UAT-RELIABILITY-8](RELIABILITY/UAT-RELIABILITY-8.md)   |
| RELIABILITY-6.2   | Covered elsewhere                                       |
| RELIABILITY-6.3   | [UAT-RELIABILITY-8](RELIABILITY/UAT-RELIABILITY-8.md)   |
| RELIABILITY-6.4   | Covered elsewhere                                       |
| RELIABILITY-6.5   | [UAT-RELIABILITY-10](RELIABILITY/UAT-RELIABILITY-10.md) |
| RELIABILITY-6.6   | Covered elsewhere                                       |
| RELIABILITY-6.7   | Covered elsewhere                                       |
| RELIABILITY-6.8   | Covered elsewhere                                       |
| RELIABILITY-6.9   | [UAT-RELIABILITY-9](RELIABILITY/UAT-RELIABILITY-9.md)   |
| RELIABILITY-6.10  | Covered elsewhere                                       |
| RELIABILITY-6.11  | Covered elsewhere                                       |
| RELIABILITY-6.12  | Covered elsewhere                                       |
| RELIABILITY-6.13  | [UAT-RELIABILITY-10](RELIABILITY/UAT-RELIABILITY-10.md) |
| RELIABILITY-6.14  | Covered elsewhere                                       |
| RELIABILITY-6.15  | [UAT-RELIABILITY-9](RELIABILITY/UAT-RELIABILITY-9.md)   |
| RELIABILITY-6.16  | Covered elsewhere                                       |
| RELIABILITY-6.17  | [UAT-RELIABILITY-10](RELIABILITY/UAT-RELIABILITY-10.md) |
| RELIABILITY-6.18  | Covered elsewhere                                       |
| RELIABILITY-6.19  | [UAT-RELIABILITY-8](RELIABILITY/UAT-RELIABILITY-8.md)   |
| RELIABILITY-7.1   | Covered elsewhere                                       |
| RELIABILITY-7.2   | [UAT-RELIABILITY-10](RELIABILITY/UAT-RELIABILITY-10.md) |
| RELIABILITY-8.1   | Covered elsewhere                                       |
| RELIABILITY-8.2   | [UAT-RELIABILITY-11](RELIABILITY/UAT-RELIABILITY-11.md) |
| RELIABILITY-8.3   | [UAT-RELIABILITY-5](RELIABILITY/UAT-RELIABILITY-5.md)   |
| RELIABILITY-8.4   | [UAT-RELIABILITY-11](RELIABILITY/UAT-RELIABILITY-11.md) |
| RELIABILITY-8.5   | Covered elsewhere                                       |
| RELIABILITY-8.6   | Covered elsewhere                                       |
| RELIABILITY-8.7   | [UAT-RELIABILITY-11](RELIABILITY/UAT-RELIABILITY-11.md) |
| RELIABILITY-9.1   | [UAT-RELIABILITY-5](RELIABILITY/UAT-RELIABILITY-5.md)   |
| RELIABILITY-9.2   | [UAT-RELIABILITY-11](RELIABILITY/UAT-RELIABILITY-11.md) |
| RELIABILITY-9.3   | Covered elsewhere                                       |
| RELIABILITY-9.4   | Covered elsewhere                                       |
| RELIABILITY-9.6   | [UAT-RELIABILITY-5](RELIABILITY/UAT-RELIABILITY-5.md)   |
| RELIABILITY-9.7   | Covered elsewhere                                       |
| RELIABILITY-9.8   | Covered elsewhere                                       |
| RELIABILITY-10.1  | Covered elsewhere                                       |
| RELIABILITY-10.2  | Covered elsewhere                                       |
| RELIABILITY-10.3  | [UAT-RELIABILITY-10](RELIABILITY/UAT-RELIABILITY-10.md) |
| RELIABILITY-11.1  | Covered elsewhere                                       |
| RELIABILITY-12.1  | Covered elsewhere                                       |
| RELIABILITY-12.2  | Covered elsewhere                                       |
| RELIABILITY-13.1  | Covered elsewhere                                       |
| RELIABILITY-14.1  | Covered elsewhere                                       |
| RELIABILITY-15.1  | Covered elsewhere                                       |
| RELIABILITY-15.2  | Covered elsewhere                                       |
| RELIABILITY-15.3  | Covered elsewhere                                       |
| RELIABILITY-16.1  | Covered elsewhere                                       |
| RELIABILITY-17.1  | Covered elsewhere                                       |
| RELIABILITY-18.1  | Covered elsewhere                                       |
| RELIABILITY-19.1  | Covered elsewhere                                       |
| RELIABILITY-19.2  | Covered elsewhere                                       |
| RELIABILITY-19.3  | Covered elsewhere                                       |
| RELIABILITY-20.1  | Covered elsewhere                                       |
| RELIABILITY-20.2  | Covered elsewhere                                       |
| RELIABILITY-20.3  | Covered elsewhere                                       |
| RELIABILITY-20.4  | Covered elsewhere                                       |
| RELIABILITY-20.5  | Covered elsewhere                                       |
| RELIABILITY-21.1  | [UAT-RELIABILITY-12](RELIABILITY/UAT-RELIABILITY-12.md) |
| RELIABILITY-21.2  | [UAT-RELIABILITY-12](RELIABILITY/UAT-RELIABILITY-12.md) |
| RELIABILITY-21.3  | [UAT-RELIABILITY-12](RELIABILITY/UAT-RELIABILITY-12.md) |
| RELIABILITY-21.4  | [UAT-RELIABILITY-12](RELIABILITY/UAT-RELIABILITY-12.md) |
| RELIABILITY-21.5  | Covered elsewhere                                       |
| RELIABILITY-21.6  | Covered elsewhere                                       |
| RELIABILITY-21.7  | Covered elsewhere                                       |
| RELIABILITY-21.8  | [UAT-RELIABILITY-13](RELIABILITY/UAT-RELIABILITY-13.md) |
| RELIABILITY-21.9  | Covered elsewhere                                       |
| RELIABILITY-21.10 | Covered elsewhere                                       |
| RELIABILITY-21.11 | Covered elsewhere                                       |
| RELIABILITY-21.12 | Covered elsewhere                                       |
| RELIABILITY-21.13 | Covered elsewhere                                       |
| RELIABILITY-21.14 | [UAT-RELIABILITY-5](RELIABILITY/UAT-RELIABILITY-5.md)   |
| RELIABILITY-21.15 | Covered elsewhere                                       |
| RELIABILITY-21.16 | Covered elsewhere                                       |
| RELIABILITY-21.17 | Covered elsewhere                                       |
| RELIABILITY-21.18 | Covered elsewhere                                       |
| RELIABILITY-21.19 | Covered elsewhere                                       |
| RELIABILITY-21.20 | Covered elsewhere                                       |
| RELIABILITY-21.21 | Covered elsewhere                                       |

</details>

<details>
<summary>VTT_UI: 12 of 13 ACs in scenarios</summary>

| AC         | Scenarios                              |
| ---------- | -------------------------------------- |
| VTT_UI-1.1 | [UAT-VTT_UI-1](VTT_UI/UAT-VTT_UI-1.md) |
| VTT_UI-1.2 | [UAT-VTT_UI-1](VTT_UI/UAT-VTT_UI-1.md) |
| VTT_UI-1.3 | [UAT-VTT_UI-1](VTT_UI/UAT-VTT_UI-1.md) |
| VTT_UI-2.1 | [UAT-VTT_UI-1](VTT_UI/UAT-VTT_UI-1.md) |
| VTT_UI-3.1 | [UAT-VTT_UI-2](VTT_UI/UAT-VTT_UI-2.md) |
| VTT_UI-3.2 | [UAT-VTT_UI-3](VTT_UI/UAT-VTT_UI-3.md) |
| VTT_UI-3.4 | [UAT-VTT_UI-3](VTT_UI/UAT-VTT_UI-3.md) |
| VTT_UI-3.5 | [UAT-VTT_UI-3](VTT_UI/UAT-VTT_UI-3.md) |
| VTT_UI-3.3 | [UAT-VTT_UI-2](VTT_UI/UAT-VTT_UI-2.md) |
| VTT_UI-4.1 | [UAT-VTT_UI-4](VTT_UI/UAT-VTT_UI-4.md) |
| VTT_UI-4.2 | [UAT-VTT_UI-4](VTT_UI/UAT-VTT_UI-4.md) |
| VTT_UI-5.1 | Covered elsewhere                      |
| VTT_UI-5.2 | [UAT-VTT_UI-3](VTT_UI/UAT-VTT_UI-3.md) |

</details>

<details>
<summary>PERF: 5 of 21 ACs in scenarios</summary>

| AC        | Scenarios                                  |
| --------- | ------------------------------------------ |
| PERF-1.1  | Covered elsewhere                          |
| PERF-1.2  | Covered elsewhere                          |
| PERF-1.3  | [UAT-PERF-2](PERF/UAT-PERF-2.md)           |
| PERF-2.1  | [UAT-PERF-1](PERF/UAT-PERF-1.md) (blocked) |
| PERF-3.1  | Covered elsewhere                          |
| PERF-3.2  | [UAT-PERF-2](PERF/UAT-PERF-2.md)           |
| PERF-3.3  | [UAT-PERF-2](PERF/UAT-PERF-2.md)           |
| PERF-3.4  | Covered elsewhere                          |
| PERF-3.5  | Covered elsewhere                          |
| PERF-3.6  | Covered elsewhere                          |
| PERF-3.7  | [UAT-PERF-2](PERF/UAT-PERF-2.md)           |
| PERF-3.8  | Covered elsewhere                          |
| PERF-3.9  | Covered elsewhere                          |
| PERF-3.10 | Covered elsewhere                          |
| PERF-3.11 | Covered elsewhere                          |
| PERF-3.12 | Covered elsewhere                          |
| PERF-3.14 | Covered elsewhere                          |
| PERF-4.1  | Covered elsewhere                          |
| PERF-4.2  | Covered elsewhere                          |
| PERF-4.3  | Covered elsewhere                          |
| PERF-4.4  | Covered elsewhere                          |

</details>

<details>
<summary>QUALITY: 0 of 2 ACs in scenarios</summary>

| AC          | Scenarios         |
| ----------- | ----------------- |
| QUALITY-1.1 | Covered elsewhere |
| QUALITY-3.1 | Covered elsewhere |

</details>

<details>
<summary>RELEASE: 5 of 19 ACs in scenarios</summary>

| AC          | Scenarios                                 |
| ----------- | ----------------------------------------- |
| RELEASE-1.1 | Covered elsewhere                         |
| RELEASE-1.2 | Covered elsewhere                         |
| RELEASE-1.3 | Covered elsewhere                         |
| RELEASE-2.1 | Covered elsewhere                         |
| RELEASE-2.2 | Covered elsewhere                         |
| RELEASE-2.3 | Covered elsewhere                         |
| RELEASE-3.1 | Not coverable                             |
| RELEASE-3.2 | Not coverable                             |
| RELEASE-4.1 | Not coverable                             |
| RELEASE-4.2 | Not coverable                             |
| RELEASE-5.1 | Covered elsewhere                         |
| RELEASE-6.1 | Covered elsewhere                         |
| RELEASE-7.1 | [UAT-RELEASE-1](RELEASE/UAT-RELEASE-1.md) |
| RELEASE-7.2 | [UAT-RELEASE-1](RELEASE/UAT-RELEASE-1.md) |
| RELEASE-7.3 | [UAT-RELEASE-1](RELEASE/UAT-RELEASE-1.md) |
| RELEASE-8.1 | [UAT-RELEASE-1](RELEASE/UAT-RELEASE-1.md) |
| RELEASE-8.2 | [UAT-RELEASE-1](RELEASE/UAT-RELEASE-1.md) |
| RELEASE-8.3 | Covered elsewhere                         |
| RELEASE-8.4 | Not coverable                             |

</details>
