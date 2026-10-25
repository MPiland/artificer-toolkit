import { MAX_RULE_EXECUTION_AUTOMATIC_EVIDENCE_REQUESTS } from '@artificer-toolkit/schema/shared/ruleExecutionEvidence'
import { type CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import { checksumRuleDocument, type RuleGraphDefinition } from '@artificer-toolkit/shared/rules'
import { CharacterRuleActionUnsupportedCompilationError } from '../../characterRuleActionSystemAdapter.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import {
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_ROLL_TABLE_ROW_GATE_OPERATION_KEY,
  ROLL_TABLE_DICE_NODE_PREFIX,
  conditionImmuneFactKey,
  unsupported,
  uuid,
  type Dnd5eCompiledEffectActionSource
} from './effectActionContracts.js'
import { dnd5eRollTableRowGateOperation } from './effectActionOperationRegistry.js'
import { publishedGraph } from './effectActionPublishedGraph.js'
import {
  boundedOutcome,
  damageMultiplier,
  damageTypeIdentity,
  multipliedDamage,
  pathGatedProposalNode,
  rolledDiceNodes
} from './effectActionOutcomeNodes.js'
import {
  boundedDiceTerm,
  parseBoundedDiceConfiguration,
  type BoundedDiceTerm
} from './effectActionScalingFacts.js'
import { hasLifecycleOverride } from './effectActionTestOutcomes.js'

type Entry = CompiledEffectGroup['entries'][number]
type RowEntry = Extract<Entry, { resolutionKind: 'ROLL_TABLE' }>

/** A table path: its die, and each row's faces with the row's outcomes in authored order. */
export type RollTable = Readonly<{
  pathCode: string
  term: BoundedDiceTerm
  rows: readonly Readonly<{ min: number; max: number; entries: readonly RowEntry[] }>[]
}>

function isRollTableEntry(entry: Entry): boolean {
  return entry.resolutionKind === 'ROLL_TABLE' || entry.resolutionKind === 'ROLL_TABLE_REPEAT'
}

/**
 * The result paths an action resolves through a table, each refused unless it is one of the
 * saving throw's `savePaths`: an attack's critical hit would fold its hit table into the critical
 * result. Every table is compiled here, so a table path holds only its rows.
 */
export function admitRollTablePaths(
  action: Dnd5eCompiledEffectActionSource,
  savePaths: readonly string[]
): ReadonlySet<string> {
  const paths = new Set(
    action.compiledEffect.entries.filter(isRollTableEntry).map(({ pathCode }) => pathCode)
  )
  for (const pathCode of paths) {
    if (!savePaths.includes(pathCode))
      unsupported('D&D roll table must resolve a saving throw result path.')
    rollTablePath(action, pathCode)
  }
  return paths
}

/** The OUTCOME template of a table path, or null when the path holds no table. */
export function rollTableOutcomeTemplate(
  action: Dnd5eCompiledEffectActionSource,
  pathCode: string
) {
  const table = rollTablePath(action, pathCode)
  return (
    table && {
      phase: 'OUTCOME' as const,
      published: publishedGraph(rollTableGraphDefinition(action, table)),
      templateChecksum: checksumRuleDocument(table.rows)
    }
  )
}

/**
 * The roll table a result path resolves through, or null when the path holds none. A table's rows
 * are settled once in the path's OUTCOME phase, so a row holds only outcomes that end there: a row
 * that repeats the table, lasts, or carries a rider is refused here, before the TEST is rolled.
 */
export function rollTablePath(
  action: Dnd5eCompiledEffectActionSource,
  pathCode: string
): RollTable | null {
  const entries = action.compiledEffect.entries.filter((entry) => entry.pathCode === pathCode)
  if (!entries.some(isRollTableEntry)) return null
  if (entries.some((entry) => entry.resolutionKind === 'ROLL_TABLE_REPEAT'))
    unsupported('D&D roll table repeats are not supported.')
  const rowEntries = entries.filter(
    (entry): entry is RowEntry => entry.resolutionKind === 'ROLL_TABLE'
  )
  if (rowEntries.length !== entries.length)
    unsupported('D&D roll table path must not mix direct outcomes with its rows.')
  const [first] = rowEntries
  if (
    !first ||
    rowEntries.some(
      (entry) => entry.die !== first.die || entry.rollTableKind !== first.rollTableKind
    )
  )
    unsupported('D&D roll table rows must share one die and one table kind.')
  const term = rollTableDie(first.die)
  const rows = new Map<string, { min: number; max: number; entries: RowEntry[] }>()
  for (const entry of rowEntries) {
    if (hasLifecycleOverride(entry) || entry.maintenanceDefinitionId)
      unsupported('D&D roll table row lasts beyond its outcome phase.')
    if (
      entry.gate ||
      entry.hitPointTier ||
      entry.failureMarginRider ||
      entry.optionalRider ||
      entry.rangeOverride ||
      entry.targetingOverride
    )
      unsupported('D&D roll table row carries a rider the table cannot gate.')
    uuid(entry.id, 'D&D roll table outcome identity')
    const [min, max] =
      entry.rollTableKind === 'RANGE' ? entry.rollRange : [entry.rollValue, entry.rollValue]
    const row = rows.get(entry.entryId)
    if (row && (row.min !== min || row.max !== max))
      unsupported('D&D roll table row has more than one face range.')
    if (row) row.entries.push(entry)
    else rows.set(entry.entryId, { min, max, entries: [entry] })
  }
  const ordered = [...rows.values()].sort((left, right) => left.min - right.min)
  // Publication refuses a gap or an overlap; the compiler refuses the table it cannot settle.
  let next = term.count
  for (const row of ordered) {
    if (row.min !== next || row.max < row.min)
      unsupported('D&D roll table rows must cover every face of the die exactly once.')
    next = row.max + 1
  }
  if (next !== term.count * term.die + 1)
    unsupported('D&D roll table rows must cover every face of the die exactly once.')
  const table = { pathCode, term, rows: ordered }
  // Validates every row, so a table the OUTCOME phase cannot compose is refused at source time.
  rollTableGraphDefinition(action, table)
  return table
}

function rollTableDie(die: string): BoundedDiceTerm {
  try {
    const { term, modifier } = parseBoundedDiceConfiguration(die)
    if (modifier === 0) return term
  } catch (error) {
    if (!(error instanceof CharacterRuleActionUnsupportedCompilationError)) throw error
  }
  unsupported('D&D roll table die must be one plain dice term.')
}

/**
 * A table path's OUTCOME graph: the table die, then for each row a gate that hands the path to the
 * row's outcomes only when the roll lands in the row. A row's own dice are asked for only then.
 */
function rollTableGraphDefinition(
  action: Dnd5eCompiledEffectActionSource,
  table: RollTable
): RuleGraphDefinition {
  const roll = rolledDiceNodes(table.term, ROLL_TABLE_DICE_NODE_PREFIX)
  // An immunity fact names one condition, so rows that apply the same condition share its fact.
  const conditionOrdinals = new Map<string, number>()
  const conditionOrdinal = (conditionId: string) => {
    const ordinal = conditionOrdinals.get(conditionId) ?? conditionOrdinals.size + 1
    conditionOrdinals.set(conditionId, ordinal)
    return ordinal
  }
  let largestRowDice = 0
  const rows = table.rows.map((row, rowIndex) => {
    const gateId = `roll-table-row-${rowIndex + 1}`
    const gate = {
      id: gateId,
      operation: {
        key: DND5E_ROLL_TABLE_ROW_GATE_OPERATION_KEY,
        contractVersion: dnd5eRollTableRowGateOperation.contractVersion
      },
      inputs: {
        roll: roll.subtotal,
        rowMin: { kind: 'LITERAL' as const, value: row.min },
        rowMax: { kind: 'LITERAL' as const, value: row.max },
        resultPath: { kind: 'LITERAL' as const, value: table.pathCode }
      }
    }
    let rowDice = 0
    const outcomes = row.entries.map((entry, index) => {
      const id = `${gateId}-${index + 1}`
      const { outcome } = entry
      if (outcome.effectKind === 'DAMAGE' && outcome.valueKind === 'DICE') {
        const dice = rowOutcome(() => boundedDiceTerm(outcome.dice))
        if (outcome.scalingKind !== 'NONE' || outcome.bonuses?.length || dice.modifier !== 0)
          unsupported('D&D roll table row outcome is not supported: damage must be one plain roll.')
        rowDice += dice.term.count
        const rolled = rolledDiceNodes(dice.term, `${id}-`, {
          kind: 'NODE_OUTPUT',
          nodeId: gateId,
          port: 'authorized'
        })
        const multiplier = damageMultiplier(outcome)
        const multiplied = multipliedDamage(`${id}-multiplied`, rolled.subtotal, multiplier)
        const node = pathGatedProposalNode({
          id,
          pathCode: table.pathCode,
          testNodeId: gateId,
          outcome: {
            kind: 'ENTRY_DICE_DAMAGE',
            diceConfig: outcome.dice,
            damageTypeId: damageTypeIdentity(outcome.damageTypeId),
            entryId: entry.entryId,
            multiplier
          },
          conditionImmuneFactKey: undefined,
          amount: multiplied.amount
        })
        return { id, sourceEntryId: entry.id, nodes: [...rolled.nodes, ...multiplied.nodes, node] }
      }
      const bounded = rowOutcome(() => boundedOutcome(outcome, table.pathCode === 'ON_SAVE_FAIL'))
      if (
        bounded.kind === 'CONDITION_APPLY' &&
        !(action.conditionDefinitionIds ?? []).includes(bounded.conditionId)
      )
        unsupported('D&D roll table condition is not in the pinned System vocabulary.')
      const conditionKey =
        bounded.kind === 'CONDITION_APPLY'
          ? (conditionImmuneFactKey(table.pathCode, conditionOrdinal(bounded.conditionId)) ??
            unsupported('D&D roll table applies too many distinct conditions.'))
          : undefined
      const node = rowOutcome(() =>
        pathGatedProposalNode({
          id,
          pathCode: table.pathCode,
          testNodeId: gateId,
          outcome: bounded,
          conditionImmuneFactKey: conditionKey
        })
      )
      return { id, sourceEntryId: entry.id, nodes: [node] }
    })
    largestRowDice = Math.max(largestRowDice, rowDice)
    return { gate, outcomes }
  })
  // The TEST d20, the table dice and the rolled row's dice must fit the coordinator-wide bound.
  if (1 + table.term.count + largestRowDice > MAX_RULE_EXECUTION_AUTOMATIC_EVIDENCE_REQUESTS)
    unsupported('D&D roll table dice exceed the coordinator-wide evidence bound.')
  return {
    schemaVersion: 1,
    id: action.effectId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      ...roll.nodes,
      ...rows.flatMap(({ gate, outcomes }) => [gate, ...outcomes.flatMap(({ nodes }) => nodes)])
    ],
    outputs: { rollTableRoll: roll.subtotal },
    // Each outcome binds to its own compiled entry: a row's outcomes share the row's entryId.
    sourceEntryBindings: rows.flatMap(({ outcomes }) =>
      outcomes.map(({ id, sourceEntryId }) => ({ sourceEntryId, nodeId: id }))
    )
  }
}

/** Names a row outcome the path-gated registry refuses as the table's refusal. */
function rowOutcome<T>(compile: () => T): T {
  try {
    return compile()
  } catch (error) {
    if (!(error instanceof CharacterRuleActionUnsupportedCompilationError)) throw error
    unsupported(`D&D roll table row outcome is not supported: ${error.message}`)
  }
}
