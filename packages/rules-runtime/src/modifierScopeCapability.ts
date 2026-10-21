import type {
  CharacterGrantFoldModifier,
  CharacterGrantFoldOutput
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'

/** Where a System applies a folded modifier. */
export interface ModifierScopeCapabilityAdapter {
  readonly gameSystemId: string
  /** Whether it applies Character-wide, evaluating no source, item or spell. */
  appliesCharacterWide(modifier: CharacterGrantFoldOutput['modifiers'][number]): boolean
  /** Whether a saving-throw grant holds only while the saver sees the effect's source (D100). */
  saveRequiresSourceSight(
    modifier: Pick<CharacterGrantFoldModifier, 'valueDomainCode' | 'domain'>
  ): boolean
}
