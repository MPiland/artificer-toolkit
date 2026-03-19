import type {
  ApplyGrantAuthored,
  HealAuthored,
  ManifestAuthored,
  DurationAuthored,
  EffectAuthored,
  BranchAuthored
} from '#authored'
import {
  EFFECT_KIND,
  BRANCH_GROUP_TYPE,
  BRANCH_ROLL_TABLE_KIND,
  BRANCH_RESOLUTION_KIND,
  type BranchCode,
  type BranchGroupType,
  type Trigger
} from '#core'
import {
  assertNever,
  compileSuccess,
  unwrapCompileResult,
  type CompileResult
} from '#utils'
import {
  compileConditionEffect,
  compileDamageEffect,
  compileDuration,
  type CompiledConditionEffect,
  type CompiledDamageEffect,
  type CompiledDuration
} from '#compilers'

export type CompiledEffect = {
  id: string
  branch: BranchCode
  duration?: CompiledDuration
  outcome: CompiledBranchOutcome
  order?: number
} & (
  | {
    resolutionKind: typeof BRANCH_RESOLUTION_KIND.DIRECT
    groupKind: keyof typeof BRANCH_GROUP_TYPE
  }
  | ({
    resolutionKind: typeof BRANCH_RESOLUTION_KIND.ROLL_TABLE
  } & (
    | {
      rollTableKind: typeof BRANCH_ROLL_TABLE_KIND.RANGE
      die: string
      rollRange: [number, number]
    }
    | {
      rollTableKind: typeof BRANCH_ROLL_TABLE_KIND.EXACT
      die: string
      rollValue: number
    }
    ))
)

export type CompiledEffectGroup = CompiledEffect[]

export type CompiledBranchDirect<TPayload> = {
  id: string
  groupType: BranchGroupType
  resolutionKind: typeof BRANCH_RESOLUTION_KIND.DIRECT
  duration?: DurationAuthored
} & TPayload

export type CompiledBranchRollTableEntry<TPayload> = {
  id: string
  label: string
  duration?: DurationAuthored
} & TPayload

export type CompiledBranchRollTableRange<TPayload> = {
  rollTableKind: typeof BRANCH_ROLL_TABLE_KIND.RANGE
  table: ({
    rollRange: [number, number]
  } & CompiledBranchRollTableEntry<TPayload>)[]
}

export type CompiledBranchRollTableExact<TPayload> = {
  rollTableKind: typeof BRANCH_ROLL_TABLE_KIND.EXACT
  table: ({ rollValue: number } & CompiledBranchRollTableEntry<TPayload>)[]
}

export type CompiledBranchRollTableKindPayload<TPayload>
  = | CompiledBranchRollTableRange<TPayload>
    | CompiledBranchRollTableExact<TPayload>

export type CompiledBranchRollTable<TPayload> = {
  resolutionKind: typeof BRANCH_RESOLUTION_KIND.ROLL_TABLE
  die: string
} & CompiledBranchRollTableKindPayload<TPayload>

export type CompilerBranchEntry<TPayload>
  = | CompiledBranchDirect<TPayload>
    | CompiledBranchRollTable<TPayload>

export type CompilerBranchMap<TPayload> = Partial<
  Record<BranchCode, CompilerBranchEntry<TPayload>>
>

export type CompiledBranchOutcome
  = | CompiledDamageEffect
    | CompiledConditionEffect
    | HealAuthored
    | ApplyGrantAuthored
    | ManifestAuthored
    | import('#authored').TeleportAuthored
    | import('#authored').RuleAuthored

function compileBranchPayload(
  branch: Extract<BranchAuthored<Trigger>, { resolutionKind: typeof BRANCH_RESOLUTION_KIND.DIRECT }> | Extract<BranchAuthored<Trigger>, { resolutionKind: typeof BRANCH_RESOLUTION_KIND.ROLL_TABLE }>['table'][number]
): CompiledBranchOutcome[] {
  switch (branch.effectKind) {
    case EFFECT_KIND.CONDITION:
      return compileConditionEffect(branch)
    case EFFECT_KIND.DAMAGE:
      return compileDamageEffect(branch)
    case EFFECT_KIND.HEAL:
    case EFFECT_KIND.APPLY_GRANT:
    case EFFECT_KIND.TELEPORT:
    case EFFECT_KIND.MANIFEST:
    case EFFECT_KIND.RULE:
      return [branch]
    default:
      return assertNever(branch)
  }
}

export function compileEffectResult<
  TTrigger extends Trigger = Trigger
>(effect: EffectAuthored<TTrigger>): CompileResult<CompiledEffectGroup> {
  const rules: CompiledEffect[] = []

  for (const branch of effect.branches) {
    switch (branch.resolutionKind) {
      case BRANCH_RESOLUTION_KIND.DIRECT: {
        const compiledOutcomes = compileBranchPayload(branch)
        const duration = branch.duration
          ? compileDuration(branch.duration)
          : undefined

        for (const outcome of compiledOutcomes) {
          rules.push({
            id: outcome.id,
            branch: branch.branch,
            resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
            groupKind: branch.groupType,
            outcome,
            order: rules.length,
            duration
          })
        }
        break
      }

      case BRANCH_RESOLUTION_KIND.ROLL_TABLE: {
        switch (branch.rollTableKind) {
          case BRANCH_ROLL_TABLE_KIND.RANGE: {
            for (const entry of branch.table) {
              const compiledOutcomes = compileBranchPayload(entry)
              const duration = entry.duration
                ? compileDuration(entry.duration)
                : undefined

              for (const outcome of compiledOutcomes) {
                rules.push({
                  id: outcome.id,
                  branch: branch.branch,
                  resolutionKind: BRANCH_RESOLUTION_KIND.ROLL_TABLE,
                  rollTableKind: BRANCH_ROLL_TABLE_KIND.RANGE,
                  die: branch.dieConfig,
                  rollRange: entry.rollRange,
                  outcome,
                  order: rules.length,
                  duration
                })
              }
            }
            break
          }

          case BRANCH_ROLL_TABLE_KIND.EXACT: {
            for (const entry of branch.table) {
              const compiledOutcomes = compileBranchPayload(entry)
              const duration = entry.duration
                ? compileDuration(entry.duration)
                : undefined

              for (const outcome of compiledOutcomes) {
                rules.push({
                  id: outcome.id,
                  branch: branch.branch,
                  resolutionKind: BRANCH_RESOLUTION_KIND.ROLL_TABLE,
                  rollTableKind: BRANCH_ROLL_TABLE_KIND.EXACT,
                  die: branch.dieConfig,
                  rollValue: entry.rollValue,
                  outcome,
                  order: rules.length,
                  duration
                })
              }
            }
            break
          }

          default:
            return assertNever(branch)
        }
        break
      }

      default:
        return assertNever(branch)
    }
  }

  return compileSuccess(rules)
}

export function compileEffect<
  TTrigger extends Trigger = Trigger
>(effect: EffectAuthored<TTrigger>): CompiledEffectGroup {
  return unwrapCompileResult(compileEffectResult(effect))
}
