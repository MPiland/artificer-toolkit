import type { EncounterD20RollMode } from './encounterEvidenceAnswer.js'

/** One recorded d20 contributor, as the evidence policies store it. */
export type EncounterD20Contributor = {
  sourceId: string
  domainKey: string | null
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

/** A ranged attack beyond its normal range (D62): a rules-owned contributor with no authored source. */
export const ENCOUNTER_LONG_RANGE_CONTRIBUTOR_SOURCE_ID = 'rule:long-range'

/** The reason labels of rules-owned contributors, which no authored source names. */
const RULE_CONTRIBUTOR_LABELS: ReadonlyMap<string, string> = new Map([
  [ENCOUNTER_LONG_RANGE_CONTRIBUTOR_SOURCE_ID, 'Long range']
])

/** The reason a viewer reads for a contributor that comes from an actor hidden from them (D62). */
export const ENCOUNTER_UNSEEN_SOURCE_REASON = 'Unseen source'

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

/**
 * Labels the mode's contributors by source, or by their rules-owned label; unlabeled sources are
 * left out, duplicates merged. A contributor from an actor hidden from the viewer keeps its place
 * under the generic unseen-source reason, never its own label.
 */
export function labelEncounterRollModeReasons(
  labels: ReadonlyMap<string, string>,
  hidden: (contributor: EncounterD20Contributor) => boolean = () => false
): EncounterRollModeReasons {
  return (input) => [
    ...new Set(
      modeContributors(input).flatMap((contributor) => {
        const label = hidden(contributor)
          ? ENCOUNTER_UNSEEN_SOURCE_REASON
          : (labels.get(contributor.sourceId) ?? RULE_CONTRIBUTOR_LABELS.get(contributor.sourceId))
        return label ? [label] : []
      })
    )
  ]
}
