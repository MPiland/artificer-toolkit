/** The checks a creature may choose from: any listed skill check or ability check (D105). */
export type CheckChoiceAuthored = { skillIds: string[]; abilityDefinitionIds: string[] }

/** A fixed DC, or a contest against the opposing creature's own check (D105). */
export type CheckDcAuthored =
  | { kind: 'FIXED'; value: number }
  | { kind: 'CONTEST'; checks: CheckChoiceAuthored }

/** What the CHECK trigger rolls: the actor picks one listed check and rolls it against the DC. */
export type CheckAuthored = { checks: CheckChoiceAuthored; dc: CheckDcAuthored }
