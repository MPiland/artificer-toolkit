import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'

/** Whether a System applies a folded modifier Character-wide, evaluating no source, item or spell. */
export interface ModifierScopeCapabilityAdapter {
  readonly gameSystemId: string
  appliesCharacterWide(modifier: CharacterGrantFoldOutput['modifiers'][number]): boolean
}
