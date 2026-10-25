# Slice ENCOUNTER-6: Morale

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

- **ENCOUNTER-6.T1** closes ACs ENCOUNTER-6.1 to 6.3. This is the 2014 DMG Morale variant, approved for Phase 8.
  - Authored triggers: surprised, reduced to half hit points, cannot harm the opposition, half the group removed, leader removed or incapacitated.
  - A trigger offers the GM a morale save for the creature, or for its group's leader, or for the fallback roller.
  - A failed save proposes flee, or surrender when escape is impossible.
  - The GM confirms the outcome, and it is recorded on the actor.
  - Campaign settings offer Morale only once it resolves.
- The removed resolver is in `437b2dd15` (`optionalResolutionPolicy.ts`): trigger scopes, the leader and fallback roller, and overwhelming opposition. Use it as a reference, not as code to restore. Token presentation belongs to VTT_UI-2.1 and is out of scope.

## Log

- 2026-10-24: Synced to e3cb2ecfd. Exploration findings:
  - The MORALE definition contract and SRD seed already exist; nothing reads them at runtime.
  - Campaign settings and admission are gated by `INTEGRATED_OPTIONAL_COMBAT_RULE_MODULES` plus the policy registration (AC 6.3).
  - Encounters have no group, leader or surprise facts; the only grouping is the actor's `sideId`.
  - Encounter commands run only in the room.
- Design packet sent to Lane 1 (shared notes `encounter-6-t1-design-packet.md`): trigger offer (GM-declared vs automatic), the actor `morale` record, the `MORALE_SAVE`/`CONFIRM_MORALE` commands, side as the group with a per-check leader, Creature/Custom actors only. Waiting for the ruling before building.
- Lane 1 ruling:
  - Option A, plus derived offers. The GM projection derives the triggers that currently hold from Run state, as a pure function: an actor at or below half its hit points, the side's leader (named on an earlier check) defeated or incapacitated, and half the side removed.
  - No event subscriptions, no persisted offers list, no settlement change. The actor's morale record is the memory that a trigger already fired.
  - Surprised and cannot-harm stay GM-declared. The server validates every pick against the active definition.
  - Record, commands, side-as-group and Creature/Custom only are all approved. The save uses the normal d20 path, so the auto-roll and the receipt match any creature save.
  - AC 6.3: register with no new contract, and update the canonical doc's optional-combat section.
- Build decisions:
  - The d20: the GM's `MORALE_SAVE` click is the prompt. The command carries the roll (entered dice, or a server roll under the frozen mode). The server freezes it with `freezeD20Context` from the roller's System saving-throw row for the authored ability, and settles it with `settleEncounterD20Answer`. The receipt keeps the frozen d20 and the roll. No rule occurrence is opened, so the Encounter is not frozen. An app roll (SYSTEM_ROLL) is not offered, because app rolls bind to an occurrence.
  - Derivation limits, sent to Lane 1 as a fallback: the pure projection cannot read incapacitation (`encounterActorCannotAct` is async and needs definitions). So `GROUP_LEADER_REMOVED` is derived when the leader named on an earlier check is defeated or absent. `GROUP_LEADER_INCAPACITATED` and `GROUP_LEADER_TAKEN_PRISONER` stay GM-declared. The projection facts gain `sideId`.
- 2026-10-24 build (D-pending-encounter-6, all unlinted and untested; WIP commit, not pushed):
  - Done: schema (record with `commandId` identity, `MORALE_TRIGGER_SCOPE` shared by the policy and drawer), D&D `moralePolicy.ts`, `encounterMoraleSave.ts` (rollers + d20 settlement), `moraleCommands.ts` dispatched from `commands.ts` (GM-only, PENDING_DECISION refusal, receipt per covered actor, private-roll visibility), room parity entries, web drawer `CampaignTabletopMorale.tsx` + timeline labels, canonical doc paragraph, AC 6.3 test in `playSettingsOptions.test.ts`, policy unit tests `moralePolicy.test.ts`.
  - Undo (REVERT_LAST_ACTION) does not reverse a morale check; the GM confirms another outcome. Characters are refused.
  - Left: `encounterMoraleSave` test; persistence/room test and journey (MORALE_SAVE → CONFIRM_MORALE → GM projection); drawer test (mock `useGmRollVisibilityPreference` as the action-drawer test does); lint touched files; push `ci/encounter-6-t1`, watch CI, record red-proof run id; Opus reviewer; merge phase tip and newest `ci/merge-batch-*`; green-ready report.
- 2026-10-24 resume: added `encounterMoraleSave.test.ts`, `nativeRoomMorale.test.ts` (MORALE_SAVE → CONFIRM_MORALE journey, rule-off refusal) and `CampaignTabletopMorale.test.tsx`; formatted and linted the slice files. Local test runs cannot resolve the workspace links in this worktree, so CI is the first run.
- 2026-10-24 review round (c2615cf46 approved with fixes): the GM-declared GROUP_LEADER_INCAPACITATED and GROUP_LEADER_TAKEN_PRISONER ruling is accepted. Added the room journey (half-hit-point offer from Run state, save, confirm, offer gone), group check, refusal, replay, COMMAND_ID_REUSED and private-roll tests, the drawer confirm and leader-picker tests, and fixed the `basicActionCheckRollRecord` doc comment.
- 2026-10-24 CI round 3: the room test needs the Run's sides declared (`sides` on the movement room config, `SIDE_ID` exported from the SRD testing module); the leader picker is a combobox.
