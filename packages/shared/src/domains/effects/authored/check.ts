/** The checks a creature may choose from: any listed skill check or ability check (D105). */
export type CheckChoiceAuthored = { skillIds: string[]; abilityDefinitionIds: string[] }

/**
 * A fixed DC, a contest against the opposing creature's own check (D105), each observer's own
 * passive score (PASSIVE), or the check total of every concealment that hides a creature from the
 * checker (CONCEALMENT).
 */
export type CheckDcAuthored =
  | { kind: 'FIXED'; value: number }
  | { kind: 'CONTEST'; checks: CheckChoiceAuthored }
  | { kind: 'PASSIVE'; passiveDefinitionId: string }
  | { kind: 'CONCEALMENT' }

/** What the CHECK trigger rolls: the actor picks one listed check and rolls it against the DC. */
export type CheckAuthored = { checks: CheckChoiceAuthored; dc: CheckDcAuthored }
