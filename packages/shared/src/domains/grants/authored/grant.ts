import type {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  NodeSubjectCode
} from '#core'
import type { FacetAuthored, LevelScaledValue } from '#authored'
import type { SCALING } from '#core'

export type GrantBaseAuthored<N extends NodeSubjectCode = NodeSubjectCode> = {
  id: string
  restrictions?: FacetAuthored<N>
  order: number
}

export type GrantPayloadAuthored<TPayload>
  = | { authoringModeKind: typeof AUTHORING_MODE_KIND.ALL }
    | ({ authoringModeKind: typeof AUTHORING_MODE_KIND.SELECTED } & TPayload)

export type GrantScalingNone<TPayload>
  = | ({
    selectionKind: typeof AUTHORING_SELECTION_KIND.GRANTED
    scalingKind: typeof SCALING.NONE
  } & TPayload)
  | ({
    selectionKind: typeof AUTHORING_SELECTION_KIND.CHOSEN
    scalingKind: typeof SCALING.NONE
    count: number
  } & TPayload)

export type GrantScalingPerLevel<
  TPayload
>
  = | {
    selectionKind: typeof AUTHORING_SELECTION_KIND.GRANTED
    scalingKind: typeof SCALING.PER_LEVEL
    scaling: LevelScaledValue<TPayload>
  }
  | {
    selectionKind: typeof AUTHORING_SELECTION_KIND.CHOSEN
    scalingKind: typeof SCALING.PER_LEVEL
    scaling: LevelScaledValue<TPayload & { count: number }>
  }

export type GrantScaling<TPayload>
  = | GrantScalingNone<TPayload>
    | GrantScalingPerLevel<TPayload>

export type ChosenGrant<TPayload> = {
  selectionKind: typeof AUTHORING_SELECTION_KIND.CHOSEN
} & GrantScaling<{ count: number } & TPayload>

export type GrantedGrant<TPayload> = {
  selectionKind: typeof AUTHORING_SELECTION_KIND.GRANTED
} & GrantScaling<TPayload>

export type ScalingGrant<TPayload, N extends NodeSubjectCode = NodeSubjectCode> = (
  | ChosenGrant<GrantPayloadAuthored<TPayload>>
  | GrantedGrant<GrantPayloadAuthored<TPayload>>
)
& GrantBaseAuthored<N>

export type StaticGrant<TPayload, N extends NodeSubjectCode = NodeSubjectCode> = GrantScalingNone<
  GrantPayloadAuthored<TPayload>
>
& GrantBaseAuthored<N>
