import {
  EffectAuthored,
  DurationAuthored,
  type EffectPayloadAuthored
} from '#authored'
import {
  MOMENT_RESOLUTION_KIND,
  EFFECT_KIND,
  MOMENT_ROLL_TABLE_KIND,
  MOMENT_GROUP_TYPE,
  type MomentCode,
  MOMENTS_BY_TRIGGER,
  type Trigger,
  type ScalingSource,
  type MomentGroupType
} from '#core'
import { assertNever } from '#utils'

import {} from '#core'
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

export function compileMomentMap(
  moments: Partial<
    Record<MomentCode, CompilerMomentEntry<EffectPayloadAuthored>>
  >
): CompilerMomentMap<EffectPayloadAuthored> {
  return moments
}

export type CompiledMomentOutcome
  = | CompiledDamageEffect
    | CompiledConditionEffect

export function compileEffect<
  TScaling extends ScalingSource = ScalingSource,
  TTrigger extends Trigger = Trigger
>(effect: EffectAuthored<TScaling, TTrigger>): CompiledEffectGroup {
  const trigger = effect.invocation.triggerCode
  const allowedMoments = MOMENTS_BY_TRIGGER[trigger]
  const moments = compileMomentMap(effect.moments)

  const rules: CompiledEffect[] = []

  for (const momentCode of allowedMoments) {
    const moment = moments[momentCode]
    if (!moment) {
      continue
    }

    switch (moment.resolutionKind) {
      case MOMENT_RESOLUTION_KIND.DIRECT: {
        const effects: (CompiledConditionEffect | CompiledDamageEffect)[] = []
        const ruleBase = {
          moment: momentCode,
          resolutionKind: moment.resolutionKind,
          groupKind: moment.groupType
        }
        switch (moment.effectKind) {
          case EFFECT_KIND.CONDITION: {
            effects.push(...compileConditionEffect(moment))
            break
          }
          case EFFECT_KIND.DAMAGE: {
            effects.push(...compileDamageEffect(moment))
            break
          }
          default:
            assertNever(moment)
        }

        for (const effect of effects) {
          const duration = moment.duration
            ? compileDuration(moment.duration)
            : undefined
          rules.push({
            ...ruleBase,
            id: effect.id,
            order: rules.length,
            outcome: effect,
            duration
          })
        }
        break
      }

      case MOMENT_RESOLUTION_KIND.ROLL_TABLE: {
        switch (moment.rollTableKind) {
          case MOMENT_ROLL_TABLE_KIND.RANGE: {
            for (const t of moment.table) {
              const effects: (
                | CompiledConditionEffect
                | CompiledDamageEffect
              )[] = []
              const duration = t.duration
                ? compileDuration(t.duration)
                : undefined
              switch (t.effectKind) {
                case EFFECT_KIND.CONDITION: {
                  effects.push(...compileConditionEffect(t))
                  break
                }

                case EFFECT_KIND.DAMAGE: {
                  effects.push(...compileDamageEffect(t))
                  break
                }

                default:
                  assertNever(t)
              }

              for (const effect of effects) {
                rules.push({
                  id: effect.id,
                  moment: momentCode,
                  rollTableKind: moment.rollTableKind,
                  resolutionKind: moment.resolutionKind,
                  outcome: effect,
                  die: moment.die,
                  rollRange: t.rollRange,
                  order: rules.length,
                  duration
                })
              }
            }
            break
          }
          case MOMENT_ROLL_TABLE_KIND.EXACT: {
            for (const t of moment.table) {
              const effects: (
                | CompiledConditionEffect
                | CompiledDamageEffect
              )[] = []
              const duration = t.duration
                ? compileDuration(t.duration)
                : undefined
              switch (t.effectKind) {
                case EFFECT_KIND.CONDITION: {
                  effects.push(...compileConditionEffect(t))

                  break
                }

                case EFFECT_KIND.DAMAGE: {
                  effects.push(...compileDamageEffect(t))

                  break
                }

                default:
                  assertNever(t)
              }

              for (const effect of effects) {
                rules.push({
                  id: effect.id,
                  moment: momentCode,
                  rollTableKind: moment.rollTableKind,
                  resolutionKind: moment.resolutionKind,
                  outcome: effect,
                  die: moment.die,
                  rollValue: t.rollValue,
                  order: rules.length,
                  duration
                })
              }
            }
            break
          }
          default:
            assertNever(moment)
        }
        break
      }
      default:
        assertNever(moment)
    }
  }

  return rules
}
