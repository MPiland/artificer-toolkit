import { PROFICIENCY_KIND, type ProficiencyKind, type RoundingCode } from '#core'
import type { GrantBaseAuthored, GrantScalingNone } from '#authored'
import type { GRANT_KIND, NodeSubjectCode, SCALING_AMOUNT_KIND } from '#core'
import type { Selectable } from '#utils'

export type ProficiencyKindPayload = {
  [PROFICIENCY_KIND.SKILL]: Selectable<{ skillIds: string[] }, ProficiencyScaling>
  [PROFICIENCY_KIND.SAVE_ABILITY]: Selectable<{ abilities: string[] }, ProficiencyScaling>
  [PROFICIENCY_KIND.LANGUAGE]: Selectable<{ languageIds: string[] }, ProficiencyScaling>
  [PROFICIENCY_KIND.EQUIPMENT]: Selectable<
    { equipmentIds: string[] },
    { category?: string; properties?: string[] } & ProficiencyScaling
  >
  [PROFICIENCY_KIND.EQUIPMENT_PROPERTY]: Selectable<
    { properties: string[] },
    { category?: string } & ProficiencyScaling
  >
}

export type ProficiencyScaling =
  | {
      level: typeof SCALING_AMOUNT_KIND.HALF
      rounding: RoundingCode
    }
  | {
      level: typeof SCALING_AMOUNT_KIND.DOUBLE | typeof SCALING_AMOUNT_KIND.FULL
    }

export type ProficiencyGrantAuthored<N extends NodeSubjectCode = NodeSubjectCode> = {
  [K in ProficiencyKind]: {
    grantKind: typeof GRANT_KIND.PROFICIENCY_GRANT
    proficiencyKind: K
  } & GrantScalingNone<ProficiencyKindPayload[K]> &
    GrantBaseAuthored<N> &
    (
      | {
          level: typeof SCALING_AMOUNT_KIND.HALF
          rounding: RoundingCode
        }
      | {
          level: typeof SCALING_AMOUNT_KIND.DOUBLE | typeof SCALING_AMOUNT_KIND.FULL
        }
    )
}[ProficiencyKind]
