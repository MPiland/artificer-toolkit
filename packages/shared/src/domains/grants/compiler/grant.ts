import type { CompiledTargetGroups } from '#compiler'
import type {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  GrantKind,
  SCALING,
  ScalingSourcePayload,
  ScalingPayload,
  Subject
} from '#core'

export type CompiledGrantBase = {
  id: string
  restrictionGroups?: CompiledTargetGroups<Subject>
  order: number
}

export type CompiledGrantTarget<TPayload>
  = | { authoringModeKind: typeof AUTHORING_MODE_KIND.ALL }
    | ({ authoringModeKind: typeof AUTHORING_MODE_KIND.SELECTED } & TPayload)

export type CompiledGrantScalingNone<TPayload> = (
  | {
    selectionKind: typeof AUTHORING_SELECTION_KIND.GRANTED
    scalingKind: typeof SCALING.NONE
  }
  | {
    selectionKind: typeof AUTHORING_SELECTION_KIND.CHOSEN
    scalingKind: typeof SCALING.NONE
    count: number
  }
)
& TPayload

export type CompiledScalingPerLevel<
  TPayload,
  TSource extends keyof ScalingSourcePayload
>
  = | ({
    selectionKind: typeof AUTHORING_SELECTION_KIND.GRANTED
    scalingKind: typeof SCALING.PER_LEVEL
    levels: ({ level: number, order: number } & TPayload)[]
  } & ScalingPayload<TSource>)
  | ({
    selectionKind: typeof AUTHORING_SELECTION_KIND.CHOSEN
    scalingKind: typeof SCALING.PER_LEVEL
    levels: ({ level: number, order: number, count: number } & TPayload)[]
  } & ScalingPayload<TSource>)

export type CompiledScalingGrant<
  TGrantKind extends GrantKind,
  TPayload
> = CompiledGrantBase & {
  grantKind: TGrantKind
} & (
  | CompiledGrantScalingNone<TPayload>
  | CompiledScalingPerLevel<TPayload, keyof ScalingSourcePayload>
  )

export type CompiledStaticGrant<
  TGrantKind extends GrantKind,
  TPayload
> = CompiledGrantBase & {
  grantKind: TGrantKind
} & (
  | {
    selectionKind: typeof AUTHORING_SELECTION_KIND.CHOSEN
    count: number
  }
  | {
    selectionKind: typeof AUTHORING_SELECTION_KIND.GRANTED
  }
  )
  & TPayload
