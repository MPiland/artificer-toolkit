import { assertNever } from '@artificer-toolkit/functions/utils'
import type {
  ProficiencyGrantAuthored,
  ProficiencyScaling,
  GrantPayloadAuthored,
  ProficiencyKindPayload
} from '#authored'
import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  SCALING_AMOUNT_KIND,
  type ProficiencyKind
} from '#core'
import { compileTargetGroups } from '#compiler'
import type {
  CompiledStaticGrant,
  CompiledGrantTarget,
  CompiledTargetGroups
} from '#compiler'

export type CompiledProficiencyGrant<
  T extends ProficiencyKind = ProficiencyKind
> = CompiledStaticGrant<
  typeof GRANT_KIND.PROFICIENCY_GRANT,
  CompiledGrantTarget<ProficiencyKindPayload[T]>
> & {
  proficiencyKind: T
  target?: CompiledTargetGroups
} & ProficiencyScaling

function compileProficiencyLevel(authored: ProficiencyGrantAuthored) {
  switch (authored.level) {
    case SCALING_AMOUNT_KIND.DOUBLE:
    case SCALING_AMOUNT_KIND.FULL:
      return {
        level: authored.level
      }
    case SCALING_AMOUNT_KIND.HALF:
      return {
        level: authored.level,
        rounding: authored.rounding
      }
    default:
      assertNever(authored)
  }
}

function compileProficiencyMode<T extends ProficiencyKind>(
  authored: GrantPayloadAuthored<ProficiencyKindPayload[T]>
):
  | { authoringModeKind: typeof AUTHORING_MODE_KIND.ALL }
  | ({ authoringModeKind: typeof AUTHORING_MODE_KIND.SELECTED } & ProficiencyKindPayload[T]) {
  switch (authored.authoringModeKind) {
    case AUTHORING_MODE_KIND.ALL:
      return { authoringModeKind: AUTHORING_MODE_KIND.ALL }

    case AUTHORING_MODE_KIND.SELECTED:
      return authored
    default:
      return assertNever(authored)
  }
}

export function compileProficiencyGrant(
  authored: ProficiencyGrantAuthored
): CompiledProficiencyGrant {
  const base = {
    id: authored.id,
    restrictionGroups: authored.restrictionGroups ? compileTargetGroups(authored.restrictionGroups) : undefined,
    order: authored.order,
    proficiencyKind: authored.proficiencyKind
  }

  switch (authored.selectionKind) {
    case AUTHORING_SELECTION_KIND.GRANTED: {
      return {
        ...base,
        grantKind: GRANT_KIND.PROFICIENCY_GRANT,
        selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
        ...compileProficiencyMode(authored),
        ...compileProficiencyLevel(authored)
      }
    }

    case AUTHORING_SELECTION_KIND.CHOSEN: {
      return {
        ...base,
        grantKind: GRANT_KIND.PROFICIENCY_GRANT,
        selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
        ...compileProficiencyMode(authored),
        count: authored.count,
        ...compileProficiencyLevel(authored)
      }
    }

    default:
      return assertNever(authored)
  }
}
