import type {
  DurationAuthored,
  EffectAuthored,
  MomentAuthored
} from '#authored'
import {
  EFFECT_KIND,
  MOMENT_GROUP_TYPE,
  MOMENT_ROLL_TABLE_KIND,
  MOMENT_RESOLUTION_KIND,
  type MomentCode,
  type MomentGroupType,
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
  moment: MomentCode
  duration?: CompiledDuration
  outcome: CompiledMomentOutcome
  order?: number
} & (
  | {
    resolutionKind: typeof MOMENT_RESOLUTION_KIND.DIRECT
    groupKind: keyof typeof MOMENT_GROUP_TYPE
  }
  | ({
    resolutionKind: typeof MOMENT_RESOLUTION_KIND.ROLL_TABLE
  } & (
    | {
      rollTableKind: typeof MOMENT_ROLL_TABLE_KIND.RANGE
      die: string
      rollRange: [number, number]
    }
    | {
      rollTableKind: typeof MOMENT_ROLL_TABLE_KIND.EXACT
      die: string
      rollValue: number
    }
    ))
)

export type CompiledEffectGroup = CompiledEffect[]

export type CompiledMomentDirect<TPayload> = {
  id: string
  groupType: MomentGroupType
  resolutionKind: typeof MOMENT_RESOLUTION_KIND.DIRECT
  duration?: DurationAuthored
} & TPayload

export type CompiledMomentRollTableEntry<TPayload> = {
  id: string
  label: string
  duration?: DurationAuthored
} & TPayload

export type CompiledMomentRollTableRange<TPayload> = {
  rollTableKind: typeof MOMENT_ROLL_TABLE_KIND.RANGE
  table: ({
    rollRange: [number, number]
  } & CompiledMomentRollTableEntry<TPayload>)[]
}

export type CompiledMomentRollTableExact<TPayload> = {
  rollTableKind: typeof MOMENT_ROLL_TABLE_KIND.EXACT
  table: ({ rollValue: number } & CompiledMomentRollTableEntry<TPayload>)[]
}

export type CompiledMomentRollTableKindPayload<TPayload>
  = | CompiledMomentRollTableRange<TPayload>
    | CompiledMomentRollTableExact<TPayload>

export type CompiledMomentRollTable<TPayload> = {
  resolutionKind: typeof MOMENT_RESOLUTION_KIND.ROLL_TABLE
  die: string
} & CompiledMomentRollTableKindPayload<TPayload>

export type CompilerMomentEntry<TPayload>
  = | CompiledMomentDirect<TPayload>
    | CompiledMomentRollTable<TPayload>

export type CompilerMomentMap<TPayload> = Partial<
  Record<MomentCode, CompilerMomentEntry<TPayload>>
>

export type CompiledMomentOutcome
  = | CompiledDamageEffect
    | CompiledConditionEffect

function compileMomentPayload(
  moment: Extract<MomentAuthored<Trigger>, { resolutionKind: typeof MOMENT_RESOLUTION_KIND.DIRECT }> | Extract<MomentAuthored<Trigger>, { resolutionKind: typeof MOMENT_RESOLUTION_KIND.ROLL_TABLE }>['table'][number]
): CompiledMomentOutcome[] {
  switch (moment.effectKind) {
    case EFFECT_KIND.CONDITION:
      return compileConditionEffect(moment)
    case EFFECT_KIND.DAMAGE:
      return compileDamageEffect(moment)
    default:
      return assertNever(moment)
  }
}

export function compileEffectResult<
  TTrigger extends Trigger = Trigger
>(effect: EffectAuthored<TTrigger>): CompileResult<CompiledEffectGroup> {
  const rules: CompiledEffect[] = []

  for (const moment of effect.moments) {
    switch (moment.resolutionKind) {
      case MOMENT_RESOLUTION_KIND.DIRECT: {
        const compiledOutcomes = compileMomentPayload(moment)
        const duration = moment.duration
          ? compileDuration(moment.duration)
          : undefined

        for (const outcome of compiledOutcomes) {
          rules.push({
            id: outcome.id,
            moment: moment.moment,
            resolutionKind: MOMENT_RESOLUTION_KIND.DIRECT,
            groupKind: moment.groupType,
            outcome,
            order: rules.length,
            duration
          })
        }
        break
      }

      case MOMENT_RESOLUTION_KIND.ROLL_TABLE: {
        switch (moment.rollTableKind) {
          case MOMENT_ROLL_TABLE_KIND.RANGE: {
            for (const entry of moment.table) {
              const compiledOutcomes = compileMomentPayload(entry)
              const duration = entry.duration
                ? compileDuration(entry.duration)
                : undefined

              for (const outcome of compiledOutcomes) {
                rules.push({
                  id: outcome.id,
                  moment: moment.moment,
                  resolutionKind: MOMENT_RESOLUTION_KIND.ROLL_TABLE,
                  rollTableKind: MOMENT_ROLL_TABLE_KIND.RANGE,
                  die: moment.dieConfig,
                  rollRange: entry.rollRange,
                  outcome,
                  order: rules.length,
                  duration
                })
              }
            }
            break
          }

          case MOMENT_ROLL_TABLE_KIND.EXACT: {
            for (const entry of moment.table) {
              const compiledOutcomes = compileMomentPayload(entry)
              const duration = entry.duration
                ? compileDuration(entry.duration)
                : undefined

              for (const outcome of compiledOutcomes) {
                rules.push({
                  id: outcome.id,
                  moment: moment.moment,
                  resolutionKind: MOMENT_RESOLUTION_KIND.ROLL_TABLE,
                  rollTableKind: MOMENT_ROLL_TABLE_KIND.EXACT,
                  die: moment.dieConfig,
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
            return assertNever(moment)
        }
        break
      }

      default:
        return assertNever(moment)
    }
  }

  return compileSuccess(rules)
}

export function compileEffect<
  TTrigger extends Trigger = Trigger
>(effect: EffectAuthored<TTrigger>): CompiledEffectGroup {
  return unwrapCompileResult(compileEffectResult(effect))
}
