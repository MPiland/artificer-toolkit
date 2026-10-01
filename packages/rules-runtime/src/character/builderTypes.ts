import type { AbilityCode, AuthoredRecordStatus } from '@artificer-toolkit/shared/core'
import {
  CharacterStartingEquipmentSource,
  type BackgroundAuthored,
  type CharacterProvenance,
  type FeatAuthored,
  type ClassAuthored,
  type SpellAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import type { ResolvedEquipment, ResolvedRace } from '@artificer-toolkit/shared/subjects/compilers'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'
import type { ContentSnapshotIndexEntry } from '@artificer-toolkit/schema/api/contentSnapshots'
import type { CharacterBuilderCatalog } from './builderCatalog.js'
import type { CharacterBuilderChosenGrantChoice } from './chosenGrantChoiceResolver.js'

type BuilderMode = 'create' | 'edit'

export interface CharacterBuilderRegistry {
  system: SystemAuthoredDto | null
  races: ResolvedRace[]
  classes: ClassAuthored[]
  backgrounds: BackgroundAuthored[]
  equipment: ResolvedEquipment[]
  acquiredEquipmentByItemId?: ReadonlyMap<
    string,
    { equipment: ResolvedEquipment; versionId: string }
  >
  feats?: FeatAuthored[]
  features: FeatureAuthored[]
}

export interface CharacterBuilderContext {
  catalog: CharacterBuilderCatalog
  registry: CharacterBuilderRegistry
  /** Exact current Spell documents authorized for this Character context. */
  spellDocumentsById?: ReadonlyMap<string, SpellAuthored>
  currentSpellDocumentsById?: ReadonlyMap<string, SpellAuthored>
  spellCatalogueEntries?: readonly ContentSnapshotIndexEntry<'SPELL'>[]
  /** Exact server-loaded vocabulary snapshot that produced this registry. */
  vocabularySnapshot?: Pick<SystemVocabularySnapshot, 'document'>
}

export interface CharacterBuilderClassSummary {
  classId: string
  classLabel: string
  classLevel: number
  subclassId?: string
  subclassLabel?: string
  specializationId?: string
  specializationLabel?: string
  featureLabels: string[]
  resourceLabels: string[]
  spellcastingLabels: string[]
}

export interface CharacterBuilderSummary {
  totalLevel: number
  abilities: Partial<Record<AbilityCode, number>>
  selectedRace?: {
    raceId: string
    raceLabel: string
    subraceId?: string
    subraceLabel?: string
    ancestryId?: string
    ancestryLabel?: string
    ancestryOptionId?: string
    ancestryOptionLabel?: string
  }
  selectedBackground?: {
    backgroundId: string
    label: string
  }
  classes: CharacterBuilderClassSummary[]
}

export interface CharacterBuilderGrantSummaryItem {
  id: string
  label: string
  description?: string
  details?: Array<{ id: string; label: string; description: string }>
  sortOrder?: number
  availableAtLevel?: number
  attributes?: string[]
  sourceLabel: string
  source: CharacterProvenance
}

export interface CharacterBuilderGrantedContent {
  features: CharacterBuilderGrantSummaryItem[]
  resources: CharacterBuilderGrantSummaryItem[]
  spellcasting: CharacterBuilderGrantSummaryItem[]
}

export interface CharacterBuilderIssue {
  code: string
  message: string
  sourceLabel: string
  source?: CharacterProvenance
  required: boolean
}

export interface CharacterBuilderValidation {
  code: string
  message: string
  severity: 'blocking' | 'warning'
  sourceLabel?: string
  source?: CharacterProvenance
}

export interface CharacterBuilderReadiness {
  ready: boolean
  blockingIssues: string[]
  outstandingRequiredChoices: string[]
}

export type CharacterBuilderSectionId =
  | 'BASICS'
  | 'RACE'
  | 'CLASSES'
  | 'BACKGROUND'
  | 'DETAILS'
  | 'NOTES'
  | 'ABILITIES'
  | 'EQUIPMENT'
  | 'REVIEW'

export interface CharacterBuilderPreviewEntry {
  id: string
  label: string
}

export interface CharacterBuilderChangePreview {
  predictedStatus: AuthoredRecordStatus
  downgradesStatus: boolean
  removedAncestrySelections: CharacterBuilderPreviewEntry[]
  removedFeatureAcquisitions: CharacterBuilderPreviewEntry[]
  removedSpellSelections: CharacterBuilderPreviewEntry[]
  removedResourceGrants: CharacterBuilderPreviewEntry[]
  clearedStartingEquipmentSources: CharacterStartingEquipmentSource[]
  summaryLines: string[]
  destructive: boolean
}

export interface CharacterBuilderResolution {
  mode: BuilderMode
  catalog: CharacterBuilderCatalog
  registry: CharacterBuilderRegistry
  sourceRegistry: CharacterBuilderRegistry
  summary: CharacterBuilderSummary
  grants: CharacterBuilderGrantedContent
  chosenGrantChoices: CharacterBuilderChosenGrantChoice[]
  outstandingChoices: CharacterBuilderIssue[]
  validations: CharacterBuilderValidation[]
  readiness: CharacterBuilderReadiness
  recommendedSectionId: CharacterBuilderSectionId
}
