import type { RestrictionCode, RestrictionPayload } from '#types/core'
import type { AuthoringConstraintCode } from '#types/core'
import { AUTHORING_MODE_KIND } from '#types/core'

export type RestrictionConditionAuthored<
  R extends RestrictionCode = RestrictionCode
> = {
  id: string
  order: number
  restrictionCode: R
  constraint: AuthoringConstraintCode
} & (
  | { authoringModeKind: typeof AUTHORING_MODE_KIND.ALL }
  | (
      { authoringModeKind: typeof AUTHORING_MODE_KIND.SELECTED }
      & RestrictionPayload<R>
    )
)

export type RestrictionGroupAuthored = {
  id: string
  conditions: RestrictionConditionAuthored[]
}
