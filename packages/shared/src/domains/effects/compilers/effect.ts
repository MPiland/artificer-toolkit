import type {
  ApplyGrantAuthored,
  CommandManifestAuthored,
  EffectAuthored,
  EffectPathAuthored,
  ForcedMovementAuthored,
  HealAuthored,
  ManifestAuthored,
  PathLifecycleAuthored,
  ResultBlockAuthored
} from '#authored'
import {
  EFFECT_KIND,
  PATH_GROUP_TYPE,
  PATH_RESOLUTION_KIND,
  PATH_ROLL_TABLE_KIND,
  type PathRollTableKind,
  type Trigger,
  type PathCode,
  type PathGroupType
} from '#core'
import { assertNever, compileSuccess, unwrapCompileResult, type CompileResult } from '#utils'
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
  entryId: string
  pathGroupId: string
  pathCode: PathCode
  pathOrder: number
  entryOrder: number
  label?: string
  description?: string
  duration?: CompiledDuration
  lifecycle?: PathLifecycleAuthored
  outcome: CompiledEffectOutcome
} & (
  | {
      resolutionKind: typeof PATH_RESOLUTION_KIND.DIRECT
      groupKind: keyof typeof PATH_GROUP_TYPE
    }
  | ({
      resolutionKind: typeof PATH_RESOLUTION_KIND.ROLL_TABLE
      groupKind: PathGroupType
    } & (
      | {
          rollTableKind: typeof PATH_ROLL_TABLE_KIND.RANGE
          die: string
          rollRange: [number, number]
        }
      | {
          rollTableKind: typeof PATH_ROLL_TABLE_KIND.EXACT
          die: string
          rollValue: number
        }
    ))
)

export type CompiledEffectGroup = CompiledEffect[]

export type CompiledEffectOutcome =
  | CompiledDamageEffect
  | CompiledConditionEffect
  | HealAuthored
  | ApplyGrantAuthored
  | ForcedMovementAuthored
  | ManifestAuthored
  | import('#authored').MoveManifestAuthored
  | CommandManifestAuthored
  | import('#authored').TeleportAuthored
  | import('#authored').ManualAdjudicationAuthored

function compileOutcomePayload(
  outcome: import('#authored').OutcomeAuthored
): CompiledEffectOutcome[] {
  switch (outcome.effectKind) {
    case EFFECT_KIND.CONDITION:
      return compileConditionEffect(outcome)
    case EFFECT_KIND.DAMAGE:
      return compileDamageEffect(outcome)
    case EFFECT_KIND.HEAL:
    case EFFECT_KIND.APPLY_GRANT:
    case EFFECT_KIND.FORCED_MOVEMENT:
    case EFFECT_KIND.TELEPORT:
    case EFFECT_KIND.MANIFEST:
    case EFFECT_KIND.MOVE_MANIFEST:
    case EFFECT_KIND.COMMAND_MANIFEST:
    case EFFECT_KIND.MANUAL_ADJUDICATION:
      return [outcome]
    default:
      return assertNever(outcome)
  }
}

function groupKindFromResultKind(resultKind: 'SINGLE' | 'SEQUENCE'): PathGroupType {
  return resultKind === 'SEQUENCE' ? PATH_GROUP_TYPE.SEQUENTIAL : PATH_GROUP_TYPE.SINGLE
}

function compileResultBlock(
  path: EffectPathAuthored<Trigger, import('#authored').OutcomeAuthored>,
  resultBlock: ResultBlockAuthored,
  meta?: {
    entryId?: string
    entryOrderBase?: number
    label?: string
    description?: string
  },
  rollTableMeta?: {
    rollTableKind: PathRollTableKind
    die: string
    rollRange?: [number, number]
    rollValue?: number
  }
): CompiledEffect[] {
  const duration = resultBlock.duration ? compileDuration(resultBlock.duration) : undefined

  const compiled: CompiledEffect[] = []

  for (const [index, outcome] of resultBlock.outcomes.entries()) {
    for (const compiledOutcome of compileOutcomePayload(outcome)) {
      const base = {
        id: compiledOutcome.id,
        entryId: meta?.entryId ?? outcome.id,
        pathGroupId: path.id,
        pathCode: path.pathCode,
        pathOrder: path.order,
        entryOrder: meta?.entryOrderBase != null ? meta.entryOrderBase + index : index + 1,
        ...(meta?.label !== undefined ? { label: meta.label } : {}),
        ...(meta?.description !== undefined ? { description: meta.description } : {}),
        outcome: compiledOutcome,
        ...(duration ? { duration } : {}),
        ...(resultBlock.lifecycle ? { lifecycle: resultBlock.lifecycle } : {})
      }

      if (rollTableMeta) {
        if (rollTableMeta.rollRange) {
          compiled.push({
            ...base,
            resolutionKind: PATH_RESOLUTION_KIND.ROLL_TABLE,
            groupKind: groupKindFromResultKind(resultBlock.resultKind),
            rollTableKind: PATH_ROLL_TABLE_KIND.RANGE,
            die: rollTableMeta.die,
            rollRange: rollTableMeta.rollRange
          })
        } else {
          compiled.push({
            ...base,
            resolutionKind: PATH_RESOLUTION_KIND.ROLL_TABLE,
            groupKind: groupKindFromResultKind(resultBlock.resultKind),
            rollTableKind: PATH_ROLL_TABLE_KIND.EXACT,
            die: rollTableMeta.die,
            rollValue: rollTableMeta.rollValue as number
          })
        }

        continue
      }

      compiled.push({
        ...base,
        resolutionKind: PATH_RESOLUTION_KIND.DIRECT,
        groupKind:
          path.selectionKind === 'CHOICE'
            ? PATH_GROUP_TYPE.CHOICE
            : groupKindFromResultKind(resultBlock.resultKind)
      })
    }
  }

  return compiled
}

export function compileEffectResult<
  TTrigger extends Trigger = Trigger,
  TOutcome extends import('#authored').OutcomeAuthored = import('#authored').OutcomeAuthored
>(effect: EffectAuthored<TTrigger, TOutcome>): CompileResult<CompiledEffectGroup> {
  const rules: CompiledEffect[] = []

  for (const path of effect.paths as EffectPathAuthored<
    Trigger,
    import('#authored').OutcomeAuthored
  >[]) {
    switch (path.selectionKind) {
      case 'FIXED':
        rules.push(...compileResultBlock(path, path.resultBlock))
        break
      case 'CHOICE':
        for (const option of path.options) {
          rules.push(
            ...compileResultBlock(path, option.resultBlock, {
              entryId: option.id,
              entryOrderBase: option.order * 1000,
              ...(option.label !== undefined ? { label: option.label } : {}),
              ...(option.description !== undefined ? { description: option.description } : {})
            })
          )
        }
        break
      case 'ROLL_TABLE':
        for (const row of path.rows) {
          rules.push(
            ...compileResultBlock(
              path,
              row.resultBlock,
              {
                entryId: row.id,
                entryOrderBase: row.order * 1000
              },
              {
                rollTableKind: path.rollTableKind,
                die: path.dieConfig,
                ...(row.rollRange
                  ? { rollRange: row.rollRange }
                  : { rollValue: row.rollValue as number })
              }
            )
          )
        }
        break
      default:
        return assertNever(path)
    }
  }

  return compileSuccess(rules)
}

export function compileEffect<
  TTrigger extends Trigger = Trigger,
  TOutcome extends import('#authored').OutcomeAuthored = import('#authored').OutcomeAuthored
>(effect: EffectAuthored<TTrigger, TOutcome>): CompiledEffectGroup {
  return unwrapCompileResult(compileEffectResult(effect))
}
