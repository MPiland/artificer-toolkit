import { resolveEncounterActionInputDtoSchema } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { StoredCommand } from './revertCommit.js'
import { revertUnavailable } from './targetMechanicsInverse.js'

/** One committed action an undo takes back, with the answers committed after it. */
export type RevertGroupRoot = {
  root: Extract<StoredCommand, { commandType: 'RESOLVE_ACTION' }>
  ruleOccurrenceId: string
  /** The answers committed after the root; each must settle one of the root's own children. */
  laterEntries: readonly StoredCommand[]
}

/** What raised a rule-raised action, or null for an action a player took. */
function storedSystemTrigger(root: { commandJson: string }) {
  const command = resolveEncounterActionInputDtoSchema.parse(JSON.parse(root.commandJson))
  return command.systemTrigger ?? null
}

/**
 * The committed actions one undo takes back as a group (D219: undo groups by occurrence), latest
 * first, from the Run's commands read latest first. `rootIndex` is the Run's last action.
 *
 * An action goes back with the reactions chosen against it, each its own action. A reaction chosen
 * while the action was held committed before it; one chosen from an offer raised once the action
 * had committed follows it. So the group is the run of commands, back from the last action, that are
 * that action and its reactions, whichever of them is last. A reaction whose action has no command
 * answered an action the GM voided, and goes back with that action's other reactions alone.
 *
 * Any other rule-raised action (a defeat trigger) goes back with the action that raised it, system
 * first: `raisedByCommandId` names the command that raised it, which is the last group's own or an
 * answer that settled it.
 */
export function revertGroupRoots(
  recent: readonly StoredCommand[],
  rootIndex: number
): { groupRoots: RevertGroupRoot[]; raisedByCommandId: string | null } {
  const root = recent[rootIndex]
  if (root?.commandType !== 'RESOLVE_ACTION' || root.root.kind !== 'RULE_OCCURRENCE')
    throw new Error('Stored Encounter command scan is invalid.')
  const rootTrigger = storedSystemTrigger(root)
  const rootIsReaction = rootTrigger?.trigger === 'REACTION'
  const reactedCommandId = rootIsReaction
    ? rootTrigger.parentCommandId.toLowerCase()
    : root.commandId
  const raisedByCommandId =
    rootTrigger && !rootIsReaction ? rootTrigger.parentCommandId.toLowerCase() : null
  const groupRoots: RevertGroupRoot[] = [
    { root, ruleOccurrenceId: root.root.ruleOccurrenceId, laterEntries: recent.slice(0, rootIndex) }
  ]
  let reactedInGroup = !rootIsReaction
  let answersFrom = rootIndex + 1
  for (let index = answersFrom; index < recent.length; index += 1) {
    const entry = recent[index]!
    if (entry.commandType === 'RESOLVE_RULE_OCCURRENCE') continue
    if (entry.commandType !== 'RESOLVE_ACTION' || entry.root.kind !== 'RULE_OCCURRENCE') break
    const trigger = storedSystemTrigger(entry)
    const reacted = !reactedInGroup && entry.commandId === reactedCommandId
    if (
      !reacted &&
      (trigger?.trigger !== 'REACTION' ||
        trigger.parentCommandId.toLowerCase() !== reactedCommandId)
    )
      break
    reactedInGroup ||= reacted
    groupRoots.push({
      root: entry,
      ruleOccurrenceId: entry.root.ruleOccurrenceId,
      laterEntries: recent.slice(answersFrom, index)
    })
    answersFrom = index + 1
  }
  if (raisedByCommandId) {
    const parentIndex = recent.findIndex(
      (entry, index) => index >= answersFrom && entry.commandType !== 'RESOLVE_RULE_OCCURRENCE'
    )
    const parent = recent[parentIndex]
    if (parent?.commandType !== 'RESOLVE_ACTION' || parent.root.kind !== 'RULE_OCCURRENCE')
      revertUnavailable('The action that raised this one changed after it; adjust manually.')
    groupRoots.push({
      root: parent,
      ruleOccurrenceId: parent.root.ruleOccurrenceId,
      laterEntries: recent.slice(answersFrom, parentIndex)
    })
  }
  return { groupRoots, raisedByCommandId }
}
