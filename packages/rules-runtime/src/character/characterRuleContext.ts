import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'
import type { CharacterAssemblyRegistry } from '@artificer-toolkit/shared/core'
import type {
  BackgroundAuthored,
  ClassAuthored,
  FeatAuthored,
  SpellAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import type { ResolvedEquipment, ResolvedRace } from '@artificer-toolkit/shared/subjects/compilers'

export interface CharacterRuleRegistry {
  races: readonly ResolvedRace[]
  classes: readonly ClassAuthored[]
  backgrounds: readonly BackgroundAuthored[]
  equipment: readonly ResolvedEquipment[]
  acquiredEquipmentByItemId?: ReadonlyMap<
    string,
    { equipment: ResolvedEquipment; versionId: string }
  >
  feats?: readonly FeatAuthored[]
  features: readonly FeatureAuthored[]
  system: Pick<NonNullable<CharacterAssemblyRegistry['system']>, 'skills' | 'speeds'> | null
}

export interface CharacterRuleContext {
  registry: CharacterRuleRegistry
  catalog: {
    spells: readonly Pick<SpellAuthored, 'id' | 'label' | 'level' | 'classIds'>[]
  }
  vocabularySnapshot?: Pick<SystemVocabularySnapshot, 'document'>
}
