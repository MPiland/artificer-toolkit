import type { AuthoredRecordStatus } from '@artificer-toolkit/shared/core'
import {
  CharacterStartingEquipmentSource,
  type CharacterProvenance
} from '@artificer-toolkit/shared/subjects/authored'
import type { CompiledSpell } from '@artificer-toolkit/shared/subjects/compilers'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'
import type { ContentSnapshotIndexEntry } from '@artificer-toolkit/schema/api/contentSnapshots'
import type { CharacterBuilderCatalog } from './builderCatalog.js'
import type { CharacterBuilderChosenGrantChoice } from './chosenGrantChoiceResolver.js'
import type { CharacterPresentationLookup, CharacterRuleRegistry } from './characterRuleContext.js'
import type { CharacterRuleSpellPublication } from './contextPreparation.js'

type BuilderMode = 'create' | 'edit'

export type CharacterBuilderRegistry = Omit<CharacterRuleRegistry, 'system'> & {
  system: SystemAuthoredDto | null
}

export interface CharacterBuilderContext {
  catalog: CharacterBuilderCatalog
  registry: CharacterBuilderRegistry
  /** Prose by id for Builder views; commit runs without it (D163). */
  presentation?: CharacterPresentationLookup
  /** Compiled Spells the rules read: the current authorized ones, then pinned acquired ones. */
  spellsById?: ReadonlyMap<string, CompiledSpell>
  /** The current authorized Spell publications `spellsById` hydrated, for reuse and source pins. */
  currentSpellsById?: ReadonlyMap<string, CharacterRuleSpellPublication>
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
  abilities: Record<string, number>
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
  /** The Builder section that resolves this choice, set where the choice is produced. */
  sectionId: CharacterBuilderSectionId
  message: string
  sourceLabel: string
  source?: CharacterProvenance
  required: boolean
}

export interface CharacterBuilderValidation {
  code: string
  /** The Builder section that fixes this error, set where the error is produced. */
  sectionId: CharacterBuilderSectionId
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
