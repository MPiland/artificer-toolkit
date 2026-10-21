import type { ResultBlockGateAuthored } from '@artificer-toolkit/shared/authored'
import {
  RULE_VALUE_KIND,
  type CompiledRuleGraph,
  type RuleInputBinding,
  type RuleValue,
  type RuleValueKind
} from '@artificer-toolkit/shared/rules'
import type { CharacterRuleActionApplication } from '../../characterRuleActionSystemAdapter.js'
import {
  NO_HIT_POINT_CEILING,
  NO_HIT_POINT_FLOOR,
  hitPointGateBand,
  withinHitPointBand
} from '../../hitPointTiers.js'
import {
  DND5E_TARGET_CURRENT_HIT_POINTS_FACT_KEY,
  DND5E_TARGET_DAMAGE_TYPES_TAKEN_FACT_KEY
} from './effectActionContracts.js'

/** The authored gate fields of a direct entry: a hit-point gate and the damage types that suppress it. */
export type Dnd5eAuthoredGates = {
  gate?: ResultBlockGateAuthored
  /** A band computed by the compiler (a hit-point tier's), standing in for an authored gate. */
  hitPointBand?: { above: number; atMost: number }
  /** The node of the damage proposal the entry follows, resolved by the compiler from an authored `REDUCED_TO_ZERO_BY` gate. */
  reducedToZeroByNodeId?: string
  suppressedByDamageTypeIds?: readonly string[]
}

type GateInputs = Readonly<Record<string, RuleValue>>
type NodeInputs = CompiledRuleGraph['nodes'][number]['inputs']

/** What a committed gate is checked against: the evidence facts and the target's live hit points. */
type GateEvidence = {
  inputs: NodeInputs
  facts: Readonly<Record<string, RuleValue>>
  currentHitPoints: number
}

/**
 * One kind of condition on the target that a gated proposal's authorization follows from. Every
 * gate kind reads its own operation inputs, so a gated proposal is the conjunction of the table.
 * `admits` and `evidenceAdmits` answer null when the inputs or the evidence do not bind the gate.
 */
type GateKind = {
  inputKinds: Readonly<Record<string, RuleValueKind>>
  /** The node inputs an entry compiles for this gate; a gate it does not author is wide open. */
  nodeInputs(entry: Dnd5eAuthoredGates): Record<string, RuleInputBinding>
  /** Whether the operation's inputs admit the target. */
  admits(inputs: GateInputs): boolean | null
  /** Whether the committed evidence binds this gate faithfully, and what it admits. */
  evidenceAdmits(evidence: GateEvidence): boolean | null
}

function idList(value: unknown): string[] | null {
  if (typeof value !== 'string') return null
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) && parsed.every((id) => typeof id === 'string') ? parsed : null
  } catch {
    return null
  }
}

/** The one text form of a set of damage type ids, so an operation and its evidence agree on it. */
export function damageTypeIdsText(ids: readonly string[]): string {
  return JSON.stringify([...new Set(ids)].sort())
}

/** The band a version 2 gate's literals bound, or null when they do not bound a non-empty one. */
export function literalHitPointBand(
  inputs: Readonly<Record<string, unknown>>
): { above: number; atMost: number } | null {
  const { hitPointsAbove: above, hitPointsAtMost: atMost } = inputs
  return typeof above === 'number' &&
    typeof atMost === 'number' &&
    Number.isSafeInteger(above) &&
    Number.isSafeInteger(atMost) &&
    above >= NO_HIT_POINT_FLOOR &&
    atMost > Math.max(above, 0)
    ? { above, atMost }
    : null
}

/** The hit-point band an entry's gate bounds; open when it authors none. */
export function authoredHitPointBand(gate: Dnd5eAuthoredGates['gate']): {
  above: number
  atMost: number
} {
  return gate && gate.kind !== 'REDUCED_TO_ZERO_BY'
    ? hitPointGateBand(gate)
    : { above: NO_HIT_POINT_FLOOR, atMost: NO_HIT_POINT_CEILING }
}

/**
 * Whether a proposal's reduced-to-0 gate holds on the applications committed before it: the damage
 * proposal it names took the target from above 0 hit points to 0. A proposal with no such gate is
 * unaffected. Damage defenses resolve in interpretation, so only the applications can answer this.
 */
export function reducedToZeroGateHolds(
  inputs: NodeInputs,
  applications: readonly CharacterRuleActionApplication[]
): boolean {
  const binding = inputs.reducedToZeroByNodeId
  if (binding?.kind !== 'LITERAL' || typeof binding.value !== 'string' || binding.value === '')
    return true
  return applications.some(
    (application) =>
      application.kind === 'DAMAGE' &&
      application.sourceNodeId === binding.value &&
      application.beforeCurrentHitPoints > 0 &&
      application.afterCurrentHitPoints === 0
  )
}

export const DND5E_GATE_KINDS = {
  HIT_POINT_BAND: {
    inputKinds: {
      targetCurrentHitPoints: RULE_VALUE_KIND.NUMBER,
      hitPointsAbove: RULE_VALUE_KIND.NUMBER,
      hitPointsAtMost: RULE_VALUE_KIND.NUMBER
    },
    nodeInputs: ({ gate, hitPointBand }) => {
      const band = hitPointBand ?? authoredHitPointBand(gate)
      return {
        targetCurrentHitPoints: { kind: 'FACT', factKey: DND5E_TARGET_CURRENT_HIT_POINTS_FACT_KEY },
        hitPointsAbove: { kind: 'LITERAL', value: band.above },
        hitPointsAtMost: { kind: 'LITERAL', value: band.atMost }
      }
    },
    admits: (inputs) => {
      const { targetCurrentHitPoints } = inputs
      const band = literalHitPointBand(inputs)
      return typeof targetCurrentHitPoints !== 'number' ||
        !Number.isSafeInteger(targetCurrentHitPoints) ||
        targetCurrentHitPoints < 0 ||
        !band
        ? null
        : withinHitPointBand(targetCurrentHitPoints, band.above, band.atMost)
    },
    evidenceAdmits: ({ inputs, facts, currentHitPoints }) => {
      const hitPoints = inputs.targetCurrentHitPoints
      const floor = inputs.hitPointsAbove
      const ceiling = inputs.hitPointsAtMost
      const band = literalHitPointBand({
        hitPointsAbove: floor?.kind === 'LITERAL' ? floor.value : undefined,
        hitPointsAtMost: ceiling?.kind === 'LITERAL' ? ceiling.value : undefined
      })
      return hitPoints?.kind === 'FACT' &&
        hitPoints.factKey === DND5E_TARGET_CURRENT_HIT_POINTS_FACT_KEY &&
        band !== null &&
        facts[DND5E_TARGET_CURRENT_HIT_POINTS_FACT_KEY] === currentHitPoints
        ? withinHitPointBand(currentHitPoints, band.above, band.atMost)
        : null
    }
  },
  /**
   * The target was taken from above 0 to 0 hit points by the named damage proposal of the same
   * graph. Damage defenses resolve only when a trace is interpreted, so the graph admits and the
   * interpreter holds the proposal back unless that damage application reduced the target
   * ({@link reducedToZeroGateNodeId}); '' leaves the proposal ungated by it.
   */
  REDUCED_TO_ZERO_BY: {
    inputKinds: { reducedToZeroByNodeId: RULE_VALUE_KIND.TEXT },
    nodeInputs: ({ reducedToZeroByNodeId }) => ({
      reducedToZeroByNodeId: { kind: 'LITERAL', value: reducedToZeroByNodeId ?? '' }
    }),
    admits: ({ reducedToZeroByNodeId }) =>
      typeof reducedToZeroByNodeId === 'string' ? true : null,
    evidenceAdmits: ({ inputs }) => {
      const binding = inputs.reducedToZeroByNodeId
      return binding?.kind === 'LITERAL' && typeof binding.value === 'string' ? true : null
    }
  },
  DAMAGE_TYPE_SUPPRESSION: {
    inputKinds: {
      targetDamageTypesTaken: RULE_VALUE_KIND.TEXT,
      suppressedDamageTypeIds: RULE_VALUE_KIND.TEXT
    },
    nodeInputs: ({ suppressedByDamageTypeIds }) => ({
      targetDamageTypesTaken: { kind: 'FACT', factKey: DND5E_TARGET_DAMAGE_TYPES_TAKEN_FACT_KEY },
      suppressedDamageTypeIds: {
        kind: 'LITERAL',
        value: damageTypeIdsText(suppressedByDamageTypeIds ?? [])
      }
    }),
    admits: (inputs) => {
      const taken = idList(inputs.targetDamageTypesTaken)
      const suppressed = idList(inputs.suppressedDamageTypeIds)
      return taken && suppressed ? !taken.some((id) => suppressed.includes(id)) : null
    },
    evidenceAdmits: ({ inputs, facts }) => {
      const taken = inputs.targetDamageTypesTaken
      const suppressed = inputs.suppressedDamageTypeIds
      const takenIds = idList(facts[DND5E_TARGET_DAMAGE_TYPES_TAKEN_FACT_KEY])
      const suppressedIds = suppressed?.kind === 'LITERAL' ? idList(suppressed.value) : null
      return taken?.kind === 'FACT' &&
        taken.factKey === DND5E_TARGET_DAMAGE_TYPES_TAKEN_FACT_KEY &&
        takenIds &&
        suppressedIds
        ? !takenIds.some((id) => suppressedIds.includes(id))
        : null
    }
  }
} satisfies Record<string, GateKind>

const GATES: readonly GateKind[] = Object.values(DND5E_GATE_KINDS)

/** The operation input kinds a gated proposal adds to its base: every gate kind's. */
export const DND5E_GATE_INPUT_KINDS: Readonly<Record<string, RuleValueKind>> = Object.assign(
  {},
  ...GATES.map(({ inputKinds }) => inputKinds)
)

/** Whether an entry authors any gate, and so compiles to a gated (version 2) proposal. */
export function isGated(entry: Dnd5eAuthoredGates): boolean {
  return (
    entry.gate !== undefined ||
    entry.hitPointBand !== undefined ||
    entry.reducedToZeroByNodeId !== undefined ||
    (entry.suppressedByDamageTypeIds?.length ?? 0) > 0
  )
}

/** The node inputs of a gated entry: every gate kind binds its own, open when not authored. */
export function gateNodeInputs(entry: Dnd5eAuthoredGates): Record<string, RuleInputBinding> {
  return Object.assign({}, ...GATES.map((gate) => gate.nodeInputs(entry)))
}

/** Whether the target passes every gate, or null when an input does not bind one. */
export function gatesAdmit(inputs: GateInputs): boolean | null {
  const verdicts = GATES.map((gate) => gate.admits(inputs))
  return verdicts.includes(null) ? null : verdicts.every(Boolean)
}

/**
 * Whether a proposal's authorization follows from its gates on the evidence: an ungated (version
 * 1) proposal binds none and always authorizes; a gated one binds every gate kind and authorizes
 * exactly while the target passes them all (and `otherwiseAuthorized`, the proposal's own protection).
 */
export function gateEvidenceIsValid(
  input: { execution: { evidence: { facts: Readonly<Record<string, RuleValue>> } } } & {
    currentHitPoints: number
    /** The hit points the graph's facts were taken at, when earlier applications have moved `currentHitPoints`. */
    startingHitPoints?: number
  },
  publishedNode: { inputs: NodeInputs },
  trace: { operation: { contractVersion: number }; outputs: Record<string, unknown> },
  otherwiseAuthorized = true
): boolean {
  if (trace.operation.contractVersion === 1)
    return (
      Object.keys(DND5E_GATE_INPUT_KINDS).every((key) => publishedNode.inputs[key] === undefined) &&
      trace.outputs.authorized === true
    )
  const verdicts = GATES.map((gate) =>
    gate.evidenceAdmits({
      inputs: publishedNode.inputs,
      facts: input.execution.evidence.facts,
      currentHitPoints: input.startingHitPoints ?? input.currentHitPoints
    })
  )
  return (
    !verdicts.includes(null) &&
    trace.outputs.authorized === (otherwiseAuthorized && verdicts.every(Boolean))
  )
}

/** The facts a published graph's gate inputs read; a gate the graph does not bind adds none. */
export function gateFacts(
  graph: Pick<CompiledRuleGraph, 'nodes'>,
  target: { targetDamageTypesTaken?: readonly string[] }
): Record<string, RuleValue> {
  return graph.nodes.some((node) => node.inputs.targetDamageTypesTaken !== undefined)
    ? {
        [DND5E_TARGET_DAMAGE_TYPES_TAKEN_FACT_KEY]: damageTypeIdsText(
          target.targetDamageTypesTaken ?? []
        )
      }
    : {}
}
