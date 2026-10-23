import {
  RULE_VALUE_KIND,
  type ProposalRuleOperationContract,
  type RuleGraphDefinition,
  type RuleInputBinding
} from '@artificer-toolkit/shared/rules'

type Bindings = Readonly<Record<string, RuleInputBinding>>

/**
 * A state the target must be in for an outcome to do anything (D173 Q1): a target that fails it raises
 * the shared overridable warning at admission, before any roll.
 */
export type EffectOutcomeTargetPrecondition = 'DYING' | 'DEAD'

/**
 * One outcome kind's proposal (ADR 0039 decision 1). Every phase that proposes the outcome (no test,
 * the selected outcome after a test, or a branch of an inline test) builds its node from this one
 * entry, so an outcome composes with any test phase without a per-kind ladder.
 */
export type EffectOutcomeDefinition<Outcome, Context> = Readonly<{
  operationKey: string
  /**
   * The same proposal gated on the test result path it is authored on. Null while the outcome's state
   * lives in an active-effect plan, which cannot yet be gated on a resolved path.
   */
  pathGatedOperationKey: string | null
  /** The bindings of the outcome's own payload (an amount, a damage type, a condition and its immunity fact). */
  payloadInputs: (outcome: Outcome, context: Context) => Bindings
  /** The payload ports a graph whose result is this proposal exposes as its outputs. */
  payloadOutputs: readonly string[]
  /** False when the outcome stores nothing on the target: an active effect or the room owns it. */
  changesTargetState: boolean
  targetPrecondition?: EffectOutcomeTargetPrecondition
}>

/** Where a proposal runs: unconditionally, or only when its test resolves to the path it is authored on. */
export type EffectOutcomePhase =
  | { kind: 'DIRECT'; contractVersion: number }
  | { kind: 'PATH_GATED'; resolvedPath: RuleInputBinding; authoredPath: string }

export function effectOutcomeProposalNode<Outcome, Context>(input: {
  id: string
  definition: EffectOutcomeDefinition<Outcome, Context>
  outcome: Outcome
  context: Context
  /** The System's target bindings: the target actor and its state checksum. */
  target: Bindings
  phase: EffectOutcomePhase
  /** Phase inputs the System adds, such as a hit-point gate; these override payload bindings. */
  extraInputs?: Bindings
}): RuleGraphDefinition['nodes'][number] {
  const { definition, phase } = input
  const operationKey =
    phase.kind === 'DIRECT' ? definition.operationKey : definition.pathGatedOperationKey
  if (operationKey === null)
    throw new Error('An outcome without a path-gated proposal cannot follow a test.')
  return {
    id: input.id,
    operation: {
      key: operationKey,
      contractVersion: phase.kind === 'DIRECT' ? phase.contractVersion : 1
    },
    inputs: {
      ...input.target,
      ...definition.payloadInputs(input.outcome, input.context),
      ...(phase.kind === 'PATH_GATED'
        ? {
            resolvedPath: phase.resolvedPath,
            authoredPath: { kind: 'LITERAL' as const, value: phase.authoredPath }
          }
        : {}),
      ...input.extraInputs
    }
  }
}

/** The outputs of a graph whose result is one outcome proposal: its target and its payload. */
export function effectOutcomeProposalOutputs(
  definition: Pick<EffectOutcomeDefinition<unknown, unknown>, 'payloadOutputs'>,
  nodeId: string
): RuleGraphDefinition['outputs'] {
  return Object.fromEntries(
    ['targetActorId', ...definition.payloadOutputs].map((port) => [
      port,
      { kind: 'NODE_OUTPUT' as const, nodeId, port }
    ])
  )
}

/**
 * A direct proposal gated on a test's result path: authorized only while the base proposal authorizes
 * and `pathSatisfies` holds for the resolved and authored paths, which it echoes as outputs.
 */
export function pathGatedProposalOperation(
  base: ProposalRuleOperationContract,
  key: string,
  pathSatisfies: (resolvedPath: string, authoredPath: string) => boolean
): ProposalRuleOperationContract {
  return {
    ...base,
    key,
    contractVersion: 1,
    inputs: {
      ...base.inputs,
      resolvedPath: RULE_VALUE_KIND.TEXT,
      authoredPath: RULE_VALUE_KIND.TEXT
    },
    outputs: {
      ...base.outputs,
      resolvedPath: RULE_VALUE_KIND.TEXT,
      authoredPath: RULE_VALUE_KIND.TEXT
    },
    execute(inputs) {
      const { resolvedPath, authoredPath } = inputs
      if (typeof resolvedPath !== 'string' || typeof authoredPath !== 'string')
        throw new Error(`${key} requires the resolved and authored result paths.`)
      const result = base.execute(inputs)
      return {
        ...result,
        resolvedPath,
        authoredPath,
        authorized: result.authorized === true && pathSatisfies(resolvedPath, authoredPath)
      }
    }
  }
}
