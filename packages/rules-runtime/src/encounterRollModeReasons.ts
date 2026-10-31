import {
  ROLL_MODE_RULE_SOURCE_IDS,
  type D20Contributor,
  type RollModeContributorSource
} from '@artificer-toolkit/shared/rules/contributors'
import { facingArcLabel } from '@artificer-toolkit/shared/vtt/facingArc'

import type { EncounterD20RollMode } from './encounterEvidenceAnswer.js'

/** One recorded d20 contributor, as the evidence policies store it. */
export type EncounterD20Contributor = Pick<
  D20Contributor,
  'sourceId' | 'domainKey' | 'influence' | 'source' | 'positional'
>

/** The key a reason label is stored under: the contributor's typed source, never its opaque ids. */
export function rollModeSourceKey(source: RollModeContributorSource): string {
  return `${source.kind}\u0000${source.id}`
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
export const ENCOUNTER_LONG_RANGE_CONTRIBUTOR_SOURCE_ID = `rule:${ROLL_MODE_RULE_SOURCE_IDS.LONG_RANGE}`

/** An attacker standing in an arc of its target's facing that the Facing rule names (ATTACK-12). */
export const ENCOUNTER_FACING_CONTRIBUTOR_SOURCE_ID = `rule:${ROLL_MODE_RULE_SOURCE_IDS.FACING}`

/** An attacker its target cannot see (SRD): advantage on the attack roll. */
export const ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID = `rule:${ROLL_MODE_RULE_SOURCE_IDS.UNSEEN_ATTACKER}`

/** A target its attacker cannot see (SRD): disadvantage on the attack roll. */
export const ENCOUNTER_UNSEEN_TARGET_CONTRIBUTOR_SOURCE_ID = `rule:${ROLL_MODE_RULE_SOURCE_IDS.UNSEEN_TARGET}`

/** A paid cast modifier that gives a named creature's save disadvantage (Heightened Spell). */
export const ENCOUNTER_CAST_MODIFIER_CONTRIBUTOR_SOURCE_ID = `rule:${ROLL_MODE_RULE_SOURCE_IDS.CAST_MODIFIER}`

/** The typed source of a rules-owned contributor. */
export function encounterRuleContributorSource(
  id: (typeof ROLL_MODE_RULE_SOURCE_IDS)[keyof typeof ROLL_MODE_RULE_SOURCE_IDS]
): RollModeContributorSource {
  return { kind: 'RULE', id, holderActorId: null }
}

/** The reason labels of rules-owned contributors, which no authored source names. */
const RULE_CONTRIBUTOR_LABELS: ReadonlyMap<string, string> = new Map([
  [ROLL_MODE_RULE_SOURCE_IDS.FACING, 'Facing'],
  [ROLL_MODE_RULE_SOURCE_IDS.LONG_RANGE, 'Long range'],
  [ROLL_MODE_RULE_SOURCE_IDS.UNSEEN_ATTACKER, 'Unseen attacker'],
  [ROLL_MODE_RULE_SOURCE_IDS.UNSEEN_TARGET, 'Unseen target'],
  [ROLL_MODE_RULE_SOURCE_IDS.CAST_MODIFIER, 'Spell modifier']
])

/** The reason a viewer reads for a contributor that comes from an actor hidden from them (D62). */
const ENCOUNTER_UNSEEN_SOURCE_REASON = 'Unseen source'

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
 * Labels the mode's contributors by their typed source (`labels` is keyed by `rollModeSourceKey`),
 * or by their rules-owned label; unlabeled sources are left out, duplicates merged. A contributor
 * from an actor hidden from the viewer keeps its place under the generic unseen-source reason,
 * never its own label.
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
          : contributor.source.kind === 'RULE'
            ? RULE_CONTRIBUTOR_LABELS.get(contributor.source.id)
            : labels.get(rollModeSourceKey(contributor.source))
        if (!label) return []
        return contributor.positional && !hidden(contributor)
          ? [`${label} (${facingArcLabel(contributor.positional.arc)} arc)`]
          : [label]
      })
    )
  ]
}

/** The influence an auto-failing condition's contributor carries, which no rolled mode shares. */
const AUTO_FAIL_INFLUENCE = 'AUTO_FAIL'

/**
 * A save request's `autoFail`: the conditions that fail the save unrolled, each with the label
 * `reasons` reads for it (D94). A condition with no label is left out, and the field is absent
 * when none is named. `holderActorId` is the saver, whose hidden conditions read generically.
 */
export function encounterAutoFailRequest(
  reasons: EncounterRollModeReasons,
  policy: { autoFailConditionIds?: readonly string[] },
  holderActorId: string | null
): { autoFail?: { conditionId: string; label: string }[] } {
  const autoFail = (policy.autoFailConditionIds ?? []).flatMap((conditionId) => {
    const [label] = reasons({
      rollMode: AUTO_FAIL_INFLUENCE,
      contributors: [
        {
          sourceId: `condition:${conditionId}`,
          domainKey: `condition:${holderActorId ?? ''}`,
          influence: AUTO_FAIL_INFLUENCE,
          source: { kind: 'CONDITION', id: conditionId, holderActorId }
        }
      ]
    })
    return label ? [{ conditionId, label }] : []
  })
  return autoFail.length ? { autoFail } : {}
}
