import type { EncounterD20RollMode } from './encounterEvidenceAnswer.js'

/** One recorded d20 contributor, as the evidence policies store it. */
export type EncounterD20Contributor = {
  sourceId: string
  influence: 'ADVANTAGE' | 'DISADVANTAGE'
}

/**
 * Names why a d20 request has its rules-derived mode (ADR 0034, D13): the labels of the contributors
 * whose influence produced that mode. Pending summary builders call it where they read the policy.
 */
export type EncounterRollModeReasons = (input: {
  rollMode: EncounterD20RollMode
  contributors: readonly EncounterD20Contributor[]
}) => string[]

/** For summaries built where labels are not read; the pending read adds them. */
export const noEncounterRollModeReasons: EncounterRollModeReasons = () => []

/** The contributors behind a derived mode: none for Normal (advantage and disadvantage cancel). */
function modeContributors(input: Parameters<EncounterRollModeReasons>[0]) {
  return input.rollMode === 'NORMAL'
    ? []
    : input.contributors.filter((contributor) => contributor.influence === input.rollMode)
}

/** Records the contributors a summary asks about, so their labels can be read in one pass. */
export function collectEncounterRollModeContributors(
  sink: EncounterD20Contributor[]
): EncounterRollModeReasons {
  return (input) => {
    sink.push(...modeContributors(input))
    return []
  }
}

/** Labels the mode's contributors by source; unlabeled sources are left out, duplicates merged. */
export function labelEncounterRollModeReasons(
  labels: ReadonlyMap<string, string>
): EncounterRollModeReasons {
  return (input) => [
    ...new Set(
      modeContributors(input).flatMap((contributor) => {
        const label = labels.get(contributor.sourceId)
        return label ? [label] : []
      })
    )
  ]
}
