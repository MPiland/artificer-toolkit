import type { CharacterBuilderGrantSummaryItemDto } from '@artificer-toolkit/schema/api/characterBuilder'
import type { AcquiredPresentation } from '@artificer-toolkit/schema/projections/acquiredEquipmentRules'
import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'
import type { CharacterAssemblyRegistry } from '@artificer-toolkit/shared/core'
import type {
  BackgroundAuthored,
  ClassAuthored,
  CreatureAuthored,
  FeatAuthored,
  SpellAuthored,
  VehicleAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import type { CompiledFeature } from '@artificer-toolkit/shared/compilers'
import type {
  CompiledBackground,
  CompiledClass,
  CompiledEquipment,
  CompiledFeat,
  CompiledRace,
  CompiledSpell,
  ResolvedEquipment,
  ResolvedRace
} from '@artificer-toolkit/shared/subjects/compilers'

/** Compiled current records; rules and commit read only these (D163). */
export interface CharacterRuleRegistry {
  races: readonly CompiledRace[]
  classes: readonly CompiledClass[]
  backgrounds: readonly CompiledBackground[]
  equipment: readonly CompiledEquipment[]
  acquiredEquipmentByItemId?: ReadonlyMap<
    string,
    { equipment: CompiledEquipment; versionId: string }
  >
  /** Resolved Equipment of the companion Creatures' loadouts, by Equipment id. */
  creatureLoadoutEquipmentById?: Readonly<Record<string, CompiledEquipment>>
  feats?: readonly CompiledFeat[]
  features: readonly CompiledFeature[]
  system: Pick<NonNullable<CharacterAssemblyRegistry['system']>, 'skills' | 'speeds'> | null
}

/**
 * Authored records by id, read only for their prose (descriptions, details, quotes). View surfaces
 * require it; commit evaluates without it, so no prose reaches readiness or a write (D163).
 */
export interface CharacterPresentationLookup {
  races: Readonly<Record<string, ResolvedRace>>
  classes: Readonly<Record<string, ClassAuthored>>
  backgrounds: Readonly<Record<string, BackgroundAuthored>>
  feats: Readonly<Record<string, FeatAuthored>>
  creatures: Readonly<Record<string, CreatureAuthored>>
  vehicles: Readonly<Record<string, VehicleAuthored>>
  features: Readonly<Record<string, FeatureAuthored>>
  /** Current resolved Equipment, or the prose a held item pinned when it was acquired. */
  equipment: Readonly<Record<string, ResolvedEquipment | AcquiredPresentation>>
  /** Spells only a held item's pinned rules supply, with their prose; the Sheet lists them (view only). */
  retainedSpells: Readonly<
    Record<string, { compiled: CompiledSpell; presentation: AcquiredPresentation }>
  >
}

export interface CharacterRuleContext {
  registry: CharacterRuleRegistry
  presentation?: CharacterPresentationLookup
  catalog: {
    spells: readonly Pick<SpellAuthored, 'id' | 'label' | 'level' | 'classIds' | 'attributes'>[]
  }
  vocabularySnapshot?: Pick<SystemVocabularySnapshot, 'document'>
}

function toDetailViews(
  details: readonly { id: string; label: string; description: string; order: number }[] | undefined
) {
  return details
    ?.slice()
    .sort((left, right) => left.order - right.order)
    .map((detail) => ({ id: detail.id, label: detail.label, description: detail.description }))
}

/** Grants carry rules facts only; their prose joins here from the presentation lookup by id (D163). */
export function withGrantProse(
  presentation: CharacterPresentationLookup,
  grant: CharacterBuilderGrantSummaryItemDto,
  kind: 'FEATURE' | 'RESOURCE' | 'SPELLCASTING'
): CharacterBuilderGrantSummaryItemDto {
  if (kind === 'FEATURE') {
    const feature = presentation.features[grant.id]
    if (!feature) throw new Error(`Character feature presentation is missing: ${grant.id}`)
    return { ...grant, description: feature.description, details: toDetailViews(feature.details) }
  }
  const ownerId =
    grant.source.kind === 'CLASS'
      ? grant.source.classId
      : grant.source.kind === 'SUBCLASS'
        ? grant.source.subclassId
        : undefined
  const owner = ownerId ? presentation.classes[ownerId] : undefined
  if (!owner) throw new Error(`Character class presentation is missing: ${grant.id}`)
  return kind === 'RESOURCE'
    ? { ...grant, description: owner.resources?.description }
    : { ...grant, details: toDetailViews(owner.spellcasting?.details) }
}
