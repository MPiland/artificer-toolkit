import type {
  ApplyGrantAuthored,
  CommandManifestAuthored,
  EffectAuthored,
  EffectInvocationAuthored,
  EffectPathAuthored,
  ForcedMovementAuthored,
  FollowUpCheckAuthored,
  FollowUpCheckBranchAuthored,
  FollowUpSaveAuthored,
  FollowUpSaveBranchAuthored,
  HealAuthored,
  ManifestAuthored,
  ManifestBehaviorAuthored,
  ManifestComponentAuthored,
  ManifestProximityRuleAuthored,
  ArmorClassFloorAuthored,
  HitPointMaximumReductionAuthored,
  ScalarReductionAuthored,
  TelepathicLinkAuthored,
  PlantPortalAuthored,
  TreeStrideAuthored,
  ActorRelationshipAuthored,
  ClosedRuleAuthored,
  PathLifecycleAuthored,
  RangeAuthored,
  ResultBlockAuthored,
  TargetingAuthored
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
  /** Exact authored result-block identity, distinct from option/row entry identity. */
  resultBlockId: string
  pathGroupId: string
  pathCode: PathCode
  pathOrder: number
  entryOrder: number
  label?: string
  description?: string
  maintenanceDefinitionId?: string
  duration?: CompiledDuration
  lifecycle?: PathLifecycleAuthored
  rangeOverride?: RangeAuthored
  targetingOverride?: TargetingAuthored
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

export type CompiledEffectGroup = {
  id: string
  order: number
  invocation: EffectInvocationAuthored
  entries: CompiledEffectEntry[]
  /** The Effect belongs to a spell that needs Concentration; set by the spell compiler. */
  requiresConcentration?: true
}

export type CompiledRollTableRepeat = {
  id: string
  entryId: string
  pathGroupId: string
  pathCode: PathCode
  pathOrder: number
  entryOrder: number
  resolutionKind: typeof PATH_RESOLUTION_KIND.ROLL_TABLE_REPEAT
  groupKind: PathGroupType
  die: string
  repeatCount: number
  rerollValues: number[]
} & (
  | {
      rollTableKind: typeof PATH_ROLL_TABLE_KIND.RANGE
      rollRange: [number, number]
    }
  | {
      rollTableKind: typeof PATH_ROLL_TABLE_KIND.EXACT
      rollValue: number
    }
)

export type CompiledEffectEntry = CompiledEffect | CompiledRollTableRepeat

type CreatureManifestAuthored = Extract<ManifestAuthored, { manifestKind: 'CREATURE' }>
type SummonManifestAuthored = Extract<ManifestAuthored, { manifestKind: 'SUMMON' }>
type NonCreatureManifestAuthored = Exclude<
  ManifestAuthored,
  CreatureManifestAuthored | SummonManifestAuthored
>

export type CompiledManifestComponent = Omit<ManifestComponentAuthored, 'behaviors'> & {
  behaviors?: CompiledEffectGroup[]
}

export type CompiledManifestProximityRule = Omit<ManifestProximityRuleAuthored, 'behavior'> & {
  behavior: CompiledEffectGroup
}

export type CompiledManifest =
  | CreatureManifestAuthored
  | (Omit<SummonManifestAuthored, 'behaviors'> & {
      behaviors?: CompiledEffectGroup[]
    })
  | (Omit<NonCreatureManifestAuthored, 'behaviors' | 'components' | 'proximityRule'> & {
      behaviors?: CompiledEffectGroup[]
      components?: CompiledManifestComponent[]
      proximityRule?: CompiledManifestProximityRule
    })

export type CompiledNoOutcome = {
  id: string
  effectKind: 'NO_OUTCOME'
}

export type CompiledFollowUpBranch =
  | Exclude<FollowUpSaveBranchAuthored, { kind: 'OUTCOMES' }>
  | {
      kind: 'OUTCOMES'
      endCurrent: boolean
      resultKind: 'SINGLE' | 'SEQUENCE'
      outcomes: CompiledEffectOutcome[]
    }

export type CompiledFollowUpSave = Omit<
  FollowUpSaveAuthored,
  'onSuccess' | 'onFailure' | 'onDurationComplete'
> & {
  /** Preserved immutable policy for a recurring d20; evaluation stays System-owned. */
  repeatRollInfluence?: FollowUpSaveAuthored['repeatRollInfluence']
  onSuccess: CompiledFollowUpBranch
  onFailure: CompiledFollowUpBranch
  onDurationComplete?: CompiledFollowUpBranch
}

export type CompiledFollowUpCheck = Omit<FollowUpCheckAuthored, 'onSuccess' | 'onFailure'> & {
  onSuccess: CompiledFollowUpBranch
  onFailure: CompiledFollowUpBranch
}

export type CompiledEffectOutcome =
  | CompiledNoOutcome
  | CompiledDamageEffect
  | HitPointMaximumReductionAuthored
  | ScalarReductionAuthored
  | CompiledConditionEffect
  | HealAuthored
  | ApplyGrantAuthored
  | ForcedMovementAuthored
  | CompiledManifest
  | import('#authored').MoveManifestAuthored
  | CommandManifestAuthored
  | CompiledFollowUpSave
  | CompiledFollowUpCheck
  | import('#authored').MovementRuleAuthored
  | import('#authored').ActionEconomyRuleAuthored
  | import('#authored').StabilizeAuthored
  | ArmorClassFloorAuthored
  | TelepathicLinkAuthored
  | PlantPortalAuthored
  | TreeStrideAuthored
  | ActorRelationshipAuthored
  | ClosedRuleAuthored
  | import('#authored').TeleportAuthored
  | import('#authored').ManualAdjudicationAuthored

function compileBehaviors(
  behaviors: ManifestBehaviorAuthored[] | undefined
): CompiledEffectGroup[] | undefined {
  return behaviors?.length ? behaviors.map(compileEffect) : undefined
}

function compileManifestOutcome(outcome: ManifestAuthored): CompiledManifest {
  if (outcome.manifestKind === 'CREATURE') return outcome

  if (outcome.manifestKind === 'SUMMON') {
    const { behaviors: authoredBehaviors, ...base } = outcome
    const behaviors = compileBehaviors(authoredBehaviors)
    return {
      ...base,
      ...(behaviors ? { behaviors } : {})
    }
  }

  const {
    behaviors: authoredBehaviors,
    components: authoredComponents,
    proximityRule: authoredProximityRule,
    ...base
  } = outcome
  const behaviors = compileBehaviors(authoredBehaviors)
  const components = authoredComponents?.map((component) => {
    const { behaviors: authoredComponentBehaviors, ...componentBase } = component
    const componentBehaviors = compileBehaviors(authoredComponentBehaviors)
    return {
      ...componentBase,
      ...(componentBehaviors ? { behaviors: componentBehaviors } : {})
    }
  })

  return {
    ...base,
    ...(behaviors ? { behaviors } : {}),
    ...(components ? { components } : {}),
    ...(authoredProximityRule
      ? {
          proximityRule: {
            ...authoredProximityRule,
            behavior: compileEffect(authoredProximityRule.behavior)
          }
        }
      : {})
  }
}

function compileFollowUpBranch(
  branch: FollowUpSaveBranchAuthored | FollowUpCheckBranchAuthored
): CompiledFollowUpBranch {
  return branch.kind === 'OUTCOMES'
    ? { ...branch, outcomes: branch.outcomes.flatMap(compileOutcomePayload) }
    : branch
}

function compileFollowUpSave(outcome: FollowUpSaveAuthored): CompiledFollowUpSave {
  const { onSuccess, onFailure, onDurationComplete, ...base } = outcome
  return {
    ...base,
    onSuccess: compileFollowUpBranch(onSuccess),
    onFailure: compileFollowUpBranch(onFailure),
    ...(onDurationComplete ? { onDurationComplete: compileFollowUpBranch(onDurationComplete) } : {})
  }
}

function compileFollowUpCheck(outcome: FollowUpCheckAuthored): CompiledFollowUpCheck {
  const { onSuccess, onFailure, ...base } = outcome
  return {
    ...base,
    onSuccess: compileFollowUpBranch(onSuccess),
    onFailure: compileFollowUpBranch(onFailure)
  }
}

function compileOutcomePayload(
  outcome: import('#authored').OutcomeAuthored
): CompiledEffectOutcome[] {
  switch (outcome.effectKind) {
    case EFFECT_KIND.CONDITION:
      return compileConditionEffect(outcome)
    case EFFECT_KIND.DAMAGE:
      return compileDamageEffect(outcome)
    case EFFECT_KIND.HIT_POINT_MAXIMUM_REDUCTION:
    case EFFECT_KIND.SCALAR_REDUCTION:
      return [outcome]
    case EFFECT_KIND.HEAL:
    case EFFECT_KIND.APPLY_GRANT:
    case EFFECT_KIND.FORCED_MOVEMENT:
    case EFFECT_KIND.TELEPORT:
    case EFFECT_KIND.MOVE_MANIFEST:
    case EFFECT_KIND.COMMAND_MANIFEST:
      return [outcome]
    case EFFECT_KIND.FOLLOW_UP_SAVE:
      return [compileFollowUpSave(outcome)]
    case EFFECT_KIND.FOLLOW_UP_CHECK:
      return [compileFollowUpCheck(outcome)]
    case EFFECT_KIND.MOVEMENT_RULE:
    case EFFECT_KIND.ACTION_ECONOMY_RULE:
    case EFFECT_KIND.STABILIZE:
    case EFFECT_KIND.ARMOR_CLASS_FLOOR:
    case EFFECT_KIND.TELEPATHIC_LINK:
    case EFFECT_KIND.PLANT_PORTAL:
    case EFFECT_KIND.TREE_STRIDE:
    case EFFECT_KIND.ACTOR_RELATIONSHIP:
    case EFFECT_KIND.CLOSED_RULE:
    case EFFECT_KIND.MANUAL_ADJUDICATION:
      return [outcome]
    case EFFECT_KIND.MANIFEST:
      return [compileManifestOutcome(outcome)]
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
  const outcomeGroups: Array<{
    sourceId: string
    outcomes: CompiledEffectOutcome[]
  }> =
    resultBlock.outcomes.length > 0
      ? resultBlock.outcomes.map((outcome) => ({
          sourceId: outcome.id,
          outcomes: compileOutcomePayload(outcome)
        }))
      : [
          {
            sourceId: resultBlock.id,
            outcomes: [{ id: resultBlock.id, effectKind: 'NO_OUTCOME' }]
          }
        ]

  for (const [index, outcomeGroup] of outcomeGroups.entries()) {
    for (const compiledOutcome of outcomeGroup.outcomes) {
      const base = {
        id: compiledOutcome.id,
        entryId: meta?.entryId ?? outcomeGroup.sourceId,
        resultBlockId: resultBlock.id,
        pathGroupId: path.id,
        pathCode: path.pathCode,
        pathOrder: path.order,
        entryOrder: meta?.entryOrderBase != null ? meta.entryOrderBase + index : index + 1,
        ...(meta?.label !== undefined ? { label: meta.label } : {}),
        ...(meta?.description !== undefined ? { description: meta.description } : {}),
        ...(resultBlock.maintenanceDefinitionId
          ? { maintenanceDefinitionId: resultBlock.maintenanceDefinitionId }
          : {}),
        outcome: compiledOutcome,
        ...(duration ? { duration } : {}),
        ...(resultBlock.lifecycle ? { lifecycle: resultBlock.lifecycle } : {}),
        ...(path.rangeOverride ? { rangeOverride: path.rangeOverride } : {}),
        ...(path.targetingOverride ? { targetingOverride: path.targetingOverride } : {})
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
  const rules: CompiledEffectEntry[] = []

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
          if (row.resolutionKind === 'REPEAT_TABLE') {
            const base = {
              id: row.id,
              entryId: row.id,
              pathGroupId: path.id,
              pathCode: path.pathCode,
              pathOrder: path.order,
              entryOrder: row.order * 1000,
              resolutionKind: PATH_RESOLUTION_KIND.ROLL_TABLE_REPEAT,
              groupKind: path.groupType,
              die: path.dieConfig,
              repeatCount: row.repeat.count,
              rerollValues: [...row.repeat.rerollValues]
                .sort((left, right) => left.order - right.order)
                .map(({ value }) => value)
            }

            rules.push(
              path.rollTableKind === PATH_ROLL_TABLE_KIND.RANGE
                ? {
                    ...base,
                    rollTableKind: PATH_ROLL_TABLE_KIND.RANGE,
                    rollRange: row.rollRange as [number, number]
                  }
                : {
                    ...base,
                    rollTableKind: PATH_ROLL_TABLE_KIND.EXACT,
                    rollValue: row.rollValue as number
                  }
            )
            continue
          }

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

  return compileSuccess({
    id: effect.id,
    order: effect.order,
    invocation: effect.invocation,
    entries: rules
  })
}

export function compileEffect<
  TTrigger extends Trigger = Trigger,
  TOutcome extends import('#authored').OutcomeAuthored = import('#authored').OutcomeAuthored
>(effect: EffectAuthored<TTrigger, TOutcome>): CompiledEffectGroup {
  return unwrapCompileResult(compileEffectResult(effect))
}
