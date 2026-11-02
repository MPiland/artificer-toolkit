import { MAX_RULE_EXECUTION_AUTOMATIC_EVIDENCE_REQUESTS } from '@artificer-toolkit/schema/shared/ruleExecutionEvidence'
import { type CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import {
  checksumRuleDocument,
  RULE_GRAPH_LIMITS,
  selectNumberRuleOperation,
  type RuleGraphDefinition,
  type RuleInputBinding
} from '@artificer-toolkit/shared/rules'
import { CharacterRuleActionUnsupportedCompilationError } from '../../characterRuleActionSystemAdapter.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import {
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_MOVEMENT_INTERRUPTION_AUTHORIZATION_OPERATION_KEY,
  DND5E_ROLL_TABLE_REROLL_FACE_OPERATION_KEY,
  DND5E_ROLL_TABLE_ROW_GATE_OPERATION_KEY,
  ROLL_TABLE_DICE_NODE_PREFIX,
  conditionImmuneFactKey,
  rollTableFaceOutputName,
  rollTableTestNodeId,
  unsupported,
  uuid,
  type Dnd5eCompiledEffectActionSource
} from './effectActionContracts.js'
import {
  dnd5eMovementInterruptionAuthorizationOperation,
  dnd5eRollTableRerollFaceOperation,
  dnd5eRollTableRowGateOperation
} from './effectActionOperationRegistry.js'
import { narrowedActions } from './effectActionNarrowing.js'
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
type RepeatEntry = Extract<Entry, { resolutionKind: 'ROLL_TABLE_REPEAT' }>

/**
 * A table path: its die, and each row's faces with the row's outcomes in authored order. A row
 * lasts when one of its outcomes outlives the OUTCOME phase: a timed outcome, or a grant or a
 * repeated save, which only an active effect holds. A `repeat` row owns the faces that send the
 * die back to the table `count` more times, each roll landing on a face not in `rerollValues`; it
 * has no outcomes of its own.
 */
export type RollTable = Readonly<{
  pathCode: string
  term: BoundedDiceTerm
  rows: readonly Readonly<{
    min: number
    max: number
    lasts: boolean
    entries: readonly RowEntry[]
  }>[]
  repeat?: Readonly<{ min: number; max: number; count: number; rerollValues: readonly number[] }>
}>

function isRollTableEntry(entry: Entry): boolean {
  return entry.resolutionKind === 'ROLL_TABLE' || entry.resolutionKind === 'ROLL_TABLE_REPEAT'
}

function tablePathCodes(action: Dnd5eCompiledEffectActionSource): string[] {
  return [
    ...new Set(
      action.compiledEffect.entries.filter(isRollTableEntry).map(({ pathCode }) => pathCode)
    )
  ]
}

/** What a table path's template identity hashes: its rows, and the repeat that sends the die back to them. */
function rollTableChecksum(table: RollTable): string {
  return checksumRuleDocument(
    table.repeat ? { rows: table.rows, repeat: table.repeat } : table.rows
  )
}

/** The template identity of a result path's roll table, or null when the path holds none. */
export function rollTableTemplateChecksum(
  action: Dnd5eCompiledEffectActionSource,
  pathCode: string
): string | null {
  const table = rollTablePath(action, pathCode)
  return table && rollTableChecksum(table)
}

/** An authored row with no outcomes compiles to this placeholder: the face owes nothing. */
function isEmptyRow(entry: RowEntry): boolean {
  return entry.outcome.effectKind === 'NO_OUTCOME'
}

/** A grant, or the save that repeats, is held by the row's plan alone: the OUTCOME phase applies none. */
function isHeldByRowPlan(entry: RowEntry): boolean {
  return entry.outcome.effectKind === 'APPLY_GRANT' || entry.outcome.effectKind === 'FOLLOW_UP_SAVE'
}

function rowLasts(entry: RowEntry): boolean {
  return hasLifecycleOverride(entry) || isHeldByRowPlan(entry)
}

/**
 * The result paths an action resolves through a table, each refused unless it is one of the
 * saving throw's `savePaths` (or a test-less action's own path, see `directRollTableGraph`): an
 * attack's critical hit would fold its hit table into the critical result. Every table is compiled here, so a table path holds only its rows. A row that lasts is
 * refused unless the timed plan `rowPlan` makes of the row's action holds that row.
 */
export function admitRollTablePaths(
  action: Dnd5eCompiledEffectActionSource,
  savePaths: readonly string[],
  rowPlan: (rowAction: Dnd5eCompiledEffectActionSource) => { compiledEntryId: string } | null
): ReadonlySet<string> {
  const paths = new Set(tablePathCodes(action))
  for (const pathCode of paths) {
    if (!savePaths.includes(pathCode))
      unsupported('D&D roll table must resolve a saving throw result path.')
    rollTablePath(action, pathCode)
  }
  for (const { rowId, lasts, rowAction } of rollTableRowActions(action) ?? [])
    if (lasts && !isRowPlanId(rowPlan(rowAction)?.compiledEntryId, rowAction, rowId))
      unsupported('D&D roll table row lasts beyond its outcome phase without a timed plan.')
  return paths
}

/**
 * A test-less action's table (ATTACK-16.T1c2a): its one path resolves through one table, rolled in
 * the action's single DIRECT graph, admitted as a save's table is. Null when the action rolls none.
 */
export function directRollTableGraph(
  action: Dnd5eCompiledEffectActionSource,
  rowPlan: Parameters<typeof admitRollTablePaths>[2]
) {
  const { entries } = action.compiledEffect
  if (!entries.some(isRollTableEntry)) return null
  const [pathCode, ...others] = new Set(entries.map((entry) => entry.pathCode))
  if (!pathCode || others.length > 0)
    unsupported('D&D roll table on a test-less action must be its only path.')
  admitRollTablePaths(action, [pathCode], rowPlan)
  const table = rollTablePath(action, pathCode)
  if (!table) unsupported('D&D roll table on a test-less action must be its only path.')
  // A repeat table rolls in a TEST, which a test-less action has none of.
  if (table.repeat) unsupported('D&D roll table repeats need a test to roll in.')
  return publishedGraph(rollTableGraphDefinition(action, table))
}

/**
 * The action narrowed to each row of its one table, the row's outcomes made direct results of the
 * table's path, so a row that lasts is planned as any direct result of that path is; the table
 * graph's `rollTableRoll` (OUTCOME, or a test-less action's DIRECT) then picks the row's plan. Null when no row lasts; a lasting row on an
 * action with two tables is refused, since one roll output picks the row.
 */
export function rollTableRowActions(action: Dnd5eCompiledEffectActionSource) {
  const tables = tablePathCodes(action).flatMap((pathCode) => rollTablePath(action, pathCode) ?? [])
  const lasting = tables.filter(({ rows }) => rows.some(({ lasts }) => lasts))
  if (lasting.length === 0) return null
  const [table, ...others] = lasting
  // The rolled row picks the plan, and a plan binds to the condition applications that match what
  // it holds: another table that applies one of those would bind its own face to the plan.
  const held = new Set(tableConditionIds(table))
  if (
    !table ||
    others.length > 0 ||
    tables.some((other) => other !== table && tableConditionIds(other).some((id) => held.has(id)))
  )
    unsupported('D&D roll table rows last only on an action with one table.')
  // A repeat row owns no outcome: the faces it rolls are rows of the table, narrowed on their own.
  const narrowed = narrowedActions(
    {
      ...action,
      compiledEffect: {
        ...action.compiledEffect,
        entries: action.compiledEffect.entries.filter(
          (entry) => entry.resolutionKind !== 'ROLL_TABLE_REPEAT'
        )
      }
    },
    (entry) => (entry.resolutionKind === 'ROLL_TABLE' ? entry.entryId : undefined),
    (entry) => (entry.resolutionKind === 'ROLL_TABLE' ? directRowEntry(entry) : entry)
  )
  return table.rows.map(({ min, max, lasts, entries: [first] }) => {
    const rowAction = narrowed?.find(({ key }) => key === first?.entryId)?.narrowed
    if (!first || !rowAction) unsupported('D&D roll table row has no outcomes to narrow.')
    return { rowId: first.entryId, row: { min, max }, lasts, rowAction }
  })
}

/** A row's plan is keyed by its entry, or by the result block it repeats a save for. */
export function isRowPlanId(
  id: string | undefined,
  rowAction: Dnd5eCompiledEffectActionSource,
  rowId: string
): boolean {
  return (
    id === rowId ||
    (id !== undefined &&
      rowAction.compiledEffect.entries.some(
        (entry) => 'resultBlockId' in entry && entry.resultBlockId === id
      ))
  )
}

function tableConditionIds(table: RollTable): string[] {
  return table.rows.flatMap(({ entries }) =>
    entries.flatMap(({ outcome }) =>
      outcome.effectKind === 'CONDITION' ? [outcome.conditionId] : []
    )
  )
}

/** A row's outcome as a direct result of the table's path. */
function directRowEntry(entry: RowEntry): Entry {
  if (entry.rollTableKind === 'RANGE') {
    const { die: _die, rollTableKind: _kind, rollRange: _range, ...direct } = entry
    return { ...direct, resolutionKind: 'DIRECT' }
  }
  const { die: _die, rollTableKind: _kind, rollValue: _value, ...direct } = entry
  return { ...direct, resolutionKind: 'DIRECT' }
}

/**
 * The OUTCOME template of a table path, or null when the path holds no table. A repeat table's
 * TEST rolled its faces (`rolled`: the first face, then each face a repeat sent the die back for),
 * and the OUTCOME holds only the rows they landed in.
 */
export function rollTableOutcomeTemplate(
  action: Dnd5eCompiledEffectActionSource,
  pathCode: string,
  facts: { rollTableFaces?: Readonly<Record<string, readonly number[]>> }
) {
  const table = rollTablePath(action, pathCode)
  if (!table) return null
  const rolled = facts.rollTableFaces?.[pathCode]
  if (table.repeat && !rolled) unsupported('D&D roll table repeat has no rolled faces.')
  return {
    phase: 'OUTCOME' as const,
    published: publishedGraph(rollTableGraphDefinition(action, table, rolled)),
    templateChecksum: rollTableChecksum(table)
  }
}

const faceSpan = (entry: RowEntry | RepeatEntry): [number, number] =>
  entry.rollTableKind === 'RANGE' ? entry.rollRange : [entry.rollValue, entry.rollValue]

/**
 * The roll table a result path resolves through, or null when the path holds none. A table's rows
 * are settled once in the path's OUTCOME phase: a row that lasts under a maintained effect or
 * carries a rider is refused here, before the TEST is rolled. A row that lasts otherwise is held by
 * its own timed plan (see `admitRollTablePaths`). One row may repeat the table: its faces send the
 * one die back to the table, and the die and those rerolls are rolled in the TEST (see
 * `withRollTableTestGraph`) so that the OUTCOME holds only the rows they landed in.
 */
export function rollTablePath(
  action: Dnd5eCompiledEffectActionSource,
  pathCode: string
): RollTable | null {
  const entries = action.compiledEffect.entries.filter((entry) => entry.pathCode === pathCode)
  if (!entries.some(isRollTableEntry)) return null
  const rowEntries = entries.filter(
    (entry): entry is RowEntry => entry.resolutionKind === 'ROLL_TABLE'
  )
  const repeatEntries = entries.filter(
    (entry): entry is RepeatEntry => entry.resolutionKind === 'ROLL_TABLE_REPEAT'
  )
  if (rowEntries.length + repeatEntries.length !== entries.length)
    unsupported('D&D roll table path must not mix direct outcomes with its rows.')
  if (repeatEntries.length > 1) unsupported('D&D roll table has more than one repeat row.')
  const [first] = [...rowEntries, ...repeatEntries]
  if (
    !first ||
    [...rowEntries, ...repeatEntries].some(
      (entry) => entry.die !== first.die || entry.rollTableKind !== first.rollTableKind
    )
  )
    unsupported('D&D roll table rows must share one die and one table kind.')
  const term = rollTableDie(first.die)
  const [repeatEntry] = repeatEntries
  const repeat = repeatEntry && repeatOfTable(repeatEntry, term)
  const rows = new Map<string, { min: number; max: number; lasts: boolean; entries: RowEntry[] }>()
  for (const entry of rowEntries) {
    if (entry.maintenanceDefinitionId)
      unsupported('D&D roll table row lasts under a maintained effect.')
    if (
      entry.gate ||
      entry.hitPointTier ||
      entry.failureMarginRider ||
      entry.optionalRider ||
      entry.rangeOverride ||
      entry.targetingOverride
    )
      unsupported('D&D roll table row carries a rider the table cannot gate.')
    if (!isEmptyRow(entry)) uuid(entry.id, 'D&D roll table outcome identity')
    const [min, max] = faceSpan(entry)
    const row = rows.get(entry.entryId)
    if (row && (row.min !== min || row.max !== max))
      unsupported('D&D roll table row has more than one face range.')
    if (row) {
      row.entries.push(entry)
      row.lasts ||= rowLasts(entry)
    } else rows.set(entry.entryId, { min, max, lasts: rowLasts(entry), entries: [entry] })
  }
  const ordered = [...rows.values()].sort((left, right) => left.min - right.min)
  // Publication refuses a gap or an overlap; the compiler refuses the table it cannot settle.
  let next = term.count
  for (const span of [...ordered, ...(repeat ? [repeat] : [])].sort(
    (left, right) => left.min - right.min
  )) {
    if (span.min !== next || span.max < span.min)
      unsupported('D&D roll table rows must cover every face of the die exactly once.')
    next = span.max + 1
  }
  if (next !== term.count * term.die + 1)
    unsupported('D&D roll table rows must cover every face of the die exactly once.')
  const table: RollTable = { pathCode, term, rows: ordered, ...(repeat ? { repeat } : {}) }
  // Validates every row, so a table the OUTCOME phase cannot compose is refused at source time.
  if (repeat) validateRepeatTable(action, table, repeat)
  else rollTableGraphDefinition(action, table)
  return table
}

/**
 * A repeat row's faces, checked against the table's one die: each reroll lands on a face the row
 * does not itself own, so a repeat never recurses, and some face is left to land on.
 */
function repeatOfTable(
  entry: RepeatEntry,
  term: BoundedDiceTerm
): NonNullable<RollTable['repeat']> {
  const [min, max] = faceSpan(entry)
  const { repeatCount: count, rerollValues } = entry
  const rerolled = new Set(rerollValues)
  if (term.count !== 1) unsupported('D&D roll table repeat needs a table of one die.')
  if (!Number.isInteger(count) || count < 1)
    unsupported('D&D roll table repeat must roll the table at least once more.')
  if (
    rerolled.size !== rerollValues.length ||
    rerollValues.some((face) => !Number.isInteger(face) || face < 1 || face > term.die)
  )
    unsupported('D&D roll table repeat must reroll distinct faces of the die.')
  for (let face = min; face <= max; face += 1)
    if (!rerolled.has(face)) unsupported('D&D roll table repeat must reroll its own faces.')
  if (term.die - rerolled.size < 2)
    unsupported('D&D roll table repeat leaves fewer than two faces to land on.')
  return { min, max, count, rerollValues: [...rerolled].sort((left, right) => left - right) }
}

/**
 * A repeat table's OUTCOME holds the rays its TEST rolled, so the table is validated at the
 * largest it can grow: every ray on the row that composes the most nodes.
 */
function validateRepeatTable(
  action: Dnd5eCompiledEffectActionSource,
  table: RollTable,
  repeat: NonNullable<RollTable['repeat']>
): void {
  const [largest] = table.rows
    .map((row) => ({
      row,
      nodes: rollTableGraphDefinition(action, table, [row.min]).nodes.length
    }))
    .sort((left, right) => right.nodes - left.nodes)
  if (!largest) unsupported('D&D roll table has no rows to repeat to.')
  const grown = rollTableGraphDefinition(action, table, [
    repeat.min,
    ...Array.from({ length: repeat.count }, () => largest.row.min)
  ])
  if (grown.nodes.length > RULE_GRAPH_LIMITS.NODES)
    unsupported('D&D roll table repeat exceeds the rule graph node bound.')
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
 * row's outcomes only when the roll lands in the row. A row's own dice are asked for only then. A
 * row's grant is left to the row's plan, which alone holds it.
 *
 * A repeat table's TEST rolled its die: `rolled` is the first face, then the faces its repeat sent
 * the die back for. The graph holds no die and gates only the rows those faces landed in, one
 * gate per roll (the first face when a row owns it, else each reroll), so that a table which
 * repeats stays within the graph's node bound.
 */
function rollTableGraphDefinition(
  action: Dnd5eCompiledEffectActionSource,
  table: RollTable,
  rolled?: readonly number[]
): RuleGraphDefinition {
  const { repeat } = table
  const roll = rolledDiceNodes(table.term, ROLL_TABLE_DICE_NODE_PREFIX)
  const [firstFace, ...rerolls] = rolled ?? []
  if (repeat && firstFace === undefined) unsupported('D&D roll table repeat has no rolled faces.')
  // The rows that apply: all of them, each behind a gate on the table's die; or a repeat table's
  // rows that its rolled faces landed in, each behind a gate on its own literal face.
  const gated: { gateId: string; rowIndex: number; face?: number }[] =
    repeat && firstFace !== undefined
      ? (firstFace >= repeat.min && firstFace <= repeat.max
          ? rerolls.slice(0, repeat.count)
          : [firstFace]
        ).map((face, ray) => ({
          gateId: `roll-table-ray-${ray + 1}`,
          rowIndex: table.rows.findIndex((row) => face >= row.min && face <= row.max),
          face
        }))
      : table.rows.map((_, rowIndex) => ({ gateId: `roll-table-row-${rowIndex + 1}`, rowIndex }))
  if (gated.some(({ rowIndex }) => rowIndex < 0))
    unsupported('D&D roll table repeat rolled a face no row owns.')
  // An immunity fact names one condition, so rows that apply the same condition share its fact.
  const conditionOrdinals = new Map<string, number>()
  const conditionOrdinal = (conditionId: string) => {
    const ordinal = conditionOrdinals.get(conditionId) ?? conditionOrdinals.size + 1
    conditionOrdinals.set(conditionId, ordinal)
    return ordinal
  }
  const rowGate = (id: string, min: number, max: number, face?: number) =>
    rollTableRowGateNode(
      id,
      face === undefined ? roll.subtotal : { kind: 'LITERAL', value: face },
      min,
      max,
      table.pathCode
    )
  const graphedEntries = table.rows.map((row) =>
    row.entries.filter((entry) => !isEmptyRow(entry) && !isHeldByRowPlan(entry))
  )
  // Adjacent rows that roll the same dice for the same multiplier share one set of dice, enabled
  // across all their faces, so a table of alike damage rows stays within the graph's node bound.
  const sharedDice = (repeat ? [] : sharedDiceRuns(graphedEntries)).map((run, index) => {
    const prefix = `roll-table-shared-${index + 1}-`
    const gate = rowGate(
      `${prefix}gate`,
      table.rows[run.rowIndexes[0] ?? 0]?.min ?? 0,
      table.rows[run.rowIndexes[run.rowIndexes.length - 1] ?? 0]?.max ?? 0
    )
    const rolled = rolledDiceNodes(run.term, prefix, {
      enabled: { kind: 'NODE_OUTPUT', nodeId: gate.id, port: 'authorized' }
    })
    const multiplied = multipliedDamage(`${prefix}multiplied`, rolled.subtotal, run.multiplier)
    return {
      at: run.at,
      amount: multiplied.amount,
      nodes: [gate, ...rolled.nodes, ...multiplied.nodes]
    }
  })
  const sharedAt = (rowIndex: number, entryIndex: number) =>
    sharedDice.find((run) => run.at.some((at) => at.row === rowIndex && at.entry === entryIndex))
  let appliedDice = 0
  let largestRowDice = 0
  const rows = gated.map(({ gateId, rowIndex, face }) => {
    const row = table.rows[rowIndex]
    if (!row) unsupported('D&D roll table row is unavailable.')
    const gate = rowGate(gateId, row.min, row.max, face)
    let rowDice = 0
    const graphed = graphedEntries[rowIndex] ?? []
    const outcomes = graphed.map((entry, index) => {
      const id = `${gateId}-${index + 1}`
      const { outcome } = entry
      if (outcome.effectKind === 'DAMAGE' && outcome.valueKind === 'DICE') {
        const dice = rowOutcome(() => boundedDiceTerm(outcome.dice))
        if (outcome.scalingKind !== 'NONE' || outcome.bonuses?.length || dice.modifier !== 0)
          unsupported('D&D roll table row outcome is not supported: damage must be one plain roll.')
        rowDice += dice.term.count
        const multiplier = damageMultiplier(outcome)
        const shared = sharedAt(rowIndex, index)
        const damage = shared
          ? { amount: shared.amount, nodes: [] }
          : rowDamageDice(id, gateId, dice.term, multiplier)
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
          amount: damage.amount
        })
        return { id, sourceEntryId: entry.id, nodes: [...damage.nodes, node] }
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
    appliedDice += rowDice
    largestRowDice = Math.max(largestRowDice, rowDice)
    return { gate, outcomes }
  })
  // The TEST d20, the table dice and the rolled rows' dice must fit the coordinator-wide bound: a
  // table's die is rolled beside one row's dice, a repeat table's rolled rows are all asked at once.
  if (
    (repeat ? 1 + appliedDice : 1 + table.term.count + largestRowDice) >
    MAX_RULE_EXECUTION_AUTOMATIC_EVIDENCE_REQUESTS
  )
    unsupported('D&D roll table dice exceed the coordinator-wide evidence bound.')
  return {
    schemaVersion: 1,
    id: action.effectId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      ...(repeat ? [] : roll.nodes),
      ...sharedDice.flatMap(({ nodes }) => nodes),
      ...rows.flatMap(({ gate, outcomes }) => [gate, ...outcomes.flatMap(({ nodes }) => nodes)])
    ],
    outputs: {
      rollTableRoll:
        repeat && firstFace !== undefined
          ? { kind: 'LITERAL' as const, value: firstFace }
          : roll.subtotal
    },
    // Each outcome binds to its own compiled entry: a row's outcomes share the row's entryId, and
    // a row that two rolls landed in binds once.
    sourceEntryBindings: [
      ...new Map(
        rows.flatMap(({ outcomes }) =>
          outcomes.map(
            ({ id, sourceEntryId }) => [sourceEntryId, { sourceEntryId, nodeId: id }] as const
          )
        )
      ).values()
    ]
  }
}

/** The gate that authorizes a row's outcomes only when the `roll` lands in the row's faces. */
function rollTableRowGateNode(
  id: string,
  roll: RuleInputBinding,
  min: number,
  max: number,
  pathCode: string
) {
  return {
    id,
    operation: {
      key: DND5E_ROLL_TABLE_ROW_GATE_OPERATION_KEY,
      contractVersion: dnd5eRollTableRowGateOperation.contractVersion
    },
    inputs: {
      roll,
      rowMin: { kind: 'LITERAL' as const, value: min },
      rowMax: { kind: 'LITERAL' as const, value: max },
      resultPath: { kind: 'LITERAL' as const, value: pathCode }
    }
  }
}

/**
 * The nodes a repeat table adds to its action's TEST graph, and the outputs that carry its rolled
 * faces to the OUTCOME's specialisation (see `rollTableOutcomeTemplate`). Per table path: the die,
 * rolled only when the TEST selects the path; whether it landed in the repeat row; and one reroll
 * per repeat, asked only then. A reroll is the index of an allowed face, so it can never land on a
 * rerolled one. The rolled die settles at 0 when not asked, a face no row owns.
 */
export function withRollTableTestGraph(
  action: Dnd5eCompiledEffectActionSource,
  definition: RuleGraphDefinition
): RuleGraphDefinition {
  const nodes: RuleGraphDefinition['nodes'][number][] = []
  const outputs: Record<string, RuleInputBinding> = {}
  for (const pathCode of tablePathCodes(action)) {
    const table = rollTablePath(action, pathCode)
    if (!table?.repeat) continue
    const { repeat, term } = table
    const id = (part: string) => rollTableTestNodeId(pathCode, part)
    const output = (nodeId: string, port: string): RuleInputBinding => ({
      kind: 'NODE_OUTPUT',
      nodeId,
      port
    })
    nodes.push(
      {
        id: id('enabled'),
        operation: {
          key: DND5E_MOVEMENT_INTERRUPTION_AUTHORIZATION_OPERATION_KEY,
          contractVersion: dnd5eMovementInterruptionAuthorizationOperation.contractVersion
        },
        inputs: {
          resultPath: output('test', 'resultPath'),
          authoredPath: { kind: 'LITERAL', value: pathCode }
        }
      },
      {
        id: id('die'),
        operation: { key: 'evidence.optional-integer-range', contractVersion: 1 },
        inputs: {
          min: { kind: 'LITERAL', value: 1 },
          max: { kind: 'LITERAL', value: term.die },
          enabled: output(id('enabled'), 'authorized')
        }
      },
      {
        id: id('live-roll'),
        operation: {
          key: selectNumberRuleOperation.key,
          contractVersion: selectNumberRuleOperation.contractVersion
        },
        inputs: {
          condition: output(id('enabled'), 'authorized'),
          whenTrue: output(id('die'), 'value'),
          whenFalse: { kind: 'LITERAL', value: 0 }
        }
      },
      rollTableRowGateNode(
        id('repeat'),
        output(id('live-roll'), 'value'),
        repeat.min,
        repeat.max,
        pathCode
      )
    )
    outputs[rollTableFaceOutputName(pathCode, 0)] = output(id('die'), 'value')
    for (let ray = 1; ray <= repeat.count; ray += 1) {
      nodes.push(
        {
          id: id(`ray-${ray}-index`),
          operation: { key: 'evidence.optional-integer-range', contractVersion: 1 },
          inputs: {
            min: { kind: 'LITERAL', value: 1 },
            max: { kind: 'LITERAL', value: term.die - repeat.rerollValues.length },
            enabled: output(id('repeat'), 'authorized')
          }
        },
        {
          id: id(`ray-${ray}`),
          operation: {
            key: DND5E_ROLL_TABLE_REROLL_FACE_OPERATION_KEY,
            contractVersion: dnd5eRollTableRerollFaceOperation.contractVersion
          },
          inputs: {
            index: output(id(`ray-${ray}-index`), 'value'),
            faces: { kind: 'LITERAL', value: term.die },
            excluded: { kind: 'LITERAL', value: repeat.rerollValues.join(',') }
          }
        }
      )
      outputs[rollTableFaceOutputName(pathCode, ray)] = output(id(`ray-${ray}`), 'face')
    }
  }
  return {
    ...definition,
    nodes: [...definition.nodes, ...nodes],
    outputs: { ...definition.outputs, ...outputs }
  }
}

/** A damage outcome's own dice, asked for only when its row's gate authorizes them. */
function rowDamageDice(id: string, gateId: string, term: BoundedDiceTerm, multiplier: number) {
  const rolled = rolledDiceNodes(term, `${id}-`, {
    enabled: { kind: 'NODE_OUTPUT', nodeId: gateId, port: 'authorized' }
  })
  const multiplied = multipliedDamage(`${id}-multiplied`, rolled.subtotal, multiplier)
  return { amount: multiplied.amount, nodes: [...rolled.nodes, ...multiplied.nodes] }
}

/**
 * The runs of adjacent rows whose same-position damage outcomes roll the same dice for the same
 * multiplier, each run longer than one row: those rows roll the dice once between them.
 */
function sharedDiceRuns(graphedEntries: readonly (readonly RowEntry[])[]) {
  type Run = {
    term: BoundedDiceTerm
    multiplier: number
    rowIndexes: number[]
    at: { row: number; entry: number }[]
  }
  const open = new Map<string, Run & { lastRow: number }>()
  const runs: Run[] = []
  graphedEntries.forEach((entries, rowIndex) => {
    entries.forEach((entry, entryIndex) => {
      const { outcome } = entry
      if (outcome.effectKind !== 'DAMAGE' || outcome.valueKind !== 'DICE') return
      const multiplier = damageMultiplier(outcome)
      const key = `${entryIndex}|${outcome.dice}|${multiplier}`
      let run = open.get(key)
      if (!run || run.lastRow !== rowIndex - 1) {
        const { term } = rowOutcome(() => boundedDiceTerm(outcome.dice))
        run = { term, multiplier, rowIndexes: [], at: [], lastRow: rowIndex }
        open.set(key, run)
        runs.push(run)
      }
      run.lastRow = rowIndex
      run.rowIndexes.push(rowIndex)
      run.at.push({ row: rowIndex, entry: entryIndex })
    })
  })
  return runs.filter((run) => run.rowIndexes.length > 1)
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
