import { dnd5eAttackKind } from './attackKind.js'
import {
  unsupported,
  type Dnd5eActionInvocation,
  type Dnd5eCompiledEffectActionSource,
  type SpecializedPath,
  type TestKind
} from './effectActionContracts.js'

type Invocation = Dnd5eCompiledEffectActionSource['compiledEffect']['invocation']
type CheckDc = Extract<Dnd5eActionInvocation, { triggerCode: 'CHECK' }>['check']['dc']

/** What an action's trigger rolls: nothing, an attack, a save or a check. */
export type Dnd5eTestKind = 'NONE' | TestKind | 'CHECK'

/**
 * What an Effect action rolls to decide its result, apart from how it is taken, what it targets or
 * what it leaves behind (ADR 0039 decision 1):
 * - `NONE`: nothing; its one result applies on use.
 * - `ATTACK` or `SAVE`: an attack roll against the target's defense, or the target's save against a
 *   DC, each resolving to one of its result paths.
 * - `CHECK`: its user's one check against a fixed DC, the target's own check in a contest, each
 *   observer's passive score (`PASSIVE`) or the total of the concealments it seeks (`CONCEALMENT`).
 *   A passive or concealment check settles its conceal or detect outcome itself; a fixed DC or a
 *   contest runs its success outcome after the check (D105, D173).
 */
export type Dnd5eTest =
  | Readonly<{ kind: 'NONE' | TestKind }>
  | Readonly<{ kind: 'CHECK'; dc: CheckDc['kind'] }>

/** The result paths each test resolves to; an action that rolls nothing resolves on use. */
export const DND5E_TEST_RESULT_PATHS = {
  NONE: ['ON_USE'],
  ATTACK: ['ON_HIT', 'ON_MISS', 'ON_CRIT'],
  SAVE: ['ON_SAVE_FAIL', 'ON_SAVE_SUCCESS'],
  CHECK: ['ON_CHECK_SUCCESS']
} as const satisfies Record<Dnd5eTestKind, readonly SpecializedPath[]>

/** An attack or save: a d20 test against the target, rolled once per target. */
export function isDnd5eRolledTest(kind: Dnd5eTestKind | null): kind is TestKind {
  return kind === 'ATTACK' || kind === 'SAVE'
}

/**
 * The test an action's trigger rolls, or null for a trigger no test compiles. It applies none of
 * the test aspect's rules, so a plan may read it before the action compiles.
 */
export function dnd5eTestKind(invocation: Invocation): Dnd5eTestKind | null {
  if (dnd5eAttackKind(invocation.triggerCode) !== null) return 'ATTACK'
  if (invocation.triggerCode === 'SAVING_THROW') return 'SAVE'
  if (invocation.triggerCode === 'CHECK') return 'CHECK'
  return invocation.triggerCode === 'ACTIVATED' ? 'NONE' : null
}

/**
 * The result paths on which an action holds its target under a relationship: a hit, a failed save,
 * a contest's win, or its use when it rolls nothing (Engulf). A check against anything but the
 * target's own check holds no one.
 */
export function dnd5eTestHoldPaths(invocation: Invocation): readonly SpecializedPath[] {
  switch (dnd5eTestKind(invocation)) {
    case 'NONE':
      return DND5E_TEST_RESULT_PATHS.NONE
    case 'ATTACK':
      return ['ON_HIT', 'ON_CRIT']
    case 'SAVE':
      return ['ON_SAVE_FAIL']
    case 'CHECK':
      return invocation.triggerCode === 'CHECK' && invocation.check.dc.kind === 'CONTEST'
        ? DND5E_TEST_RESULT_PATHS.CHECK
        : []
    case null:
      return []
  }
}

/**
 * The test aspect of an activated Effect action. A check lists the one check its user rolls, since
 * a resolution names no check choice, and a contest lists the checks its target may roll against it.
 */
export function compileDnd5eTest(invocation: Dnd5eActionInvocation): Dnd5eTest {
  if (invocation.triggerCode === 'CHECK') {
    const { checks, dc } = invocation.check
    if (checks.skillIds.length + checks.abilityDefinitionIds.length !== 1)
      unsupported('D&D check action must list exactly one check.')
    if (
      dc.kind === 'CONTEST' &&
      dc.checks.skillIds.length + dc.checks.abilityDefinitionIds.length === 0
    )
      unsupported('D&D contest check action must list the checks its target may roll.')
    return { kind: 'CHECK', dc: dc.kind }
  }
  const kind = dnd5eTestKind(invocation)
  if (kind === null || kind === 'CHECK')
    unsupported('D&D action trigger is not a test the Effect action compiler runs.')
  return { kind }
}
