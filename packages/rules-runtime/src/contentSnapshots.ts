import type { AuthoredEquipmentOptionFacts } from '@artificer-toolkit/schema/api/authoredOptions'
import type {
  AuthoredPublicationDocument,
  AuthoredStoredCompilation
} from '@artificer-toolkit/schema/api/authoredPublication'
import {
  contentSnapshotDocumentsObjectSchema,
  contentSnapshotHeaderSchema,
  contentSnapshotIndexObjectSchema,
  contentSnapshotListObjectSchema,
  type ContentSnapshotHeader,
  type ContentSnapshotIndexEntry,
  type ContentSnapshotKind,
  type ContentSnapshotListEntry,
  type ContentSnapshotPart,
  type ContentSnapshotPublicationVersion,
  type ContentSnapshotRoot
} from '@artificer-toolkit/schema/api/contentSnapshots'
import type { EquipmentAuthoredDto } from '@artificer-toolkit/schema/subjects/equipment'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import type { RaceAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getRaceAbilityScoreIncreaseFacts } from './character/builderCatalog.js'

const encoder = new TextEncoder()

/**
 * Validates one snapshot object against its header's part schema and returns its canonical JSON.
 * Roots are ordered by id, and the hash covers the header, so the key identifies the scope,
 * kind, part and exact published content.
 */
export function buildContentSnapshotPart<
  Kind extends ContentSnapshotKind,
  Part extends ContentSnapshotPart
>(
  header: ContentSnapshotHeader & { kind: Kind; part: Part },
  roots: readonly ContentSnapshotRoot<Kind, Part>[],
  pins?: {
    versions: readonly ContentSnapshotPublicationVersion[]
    compilations: readonly AuthoredStoredCompilation[]
  }
): { json: string; sha256: string; byteLength: number; rootCount: number } {
  const orderedRoots = [...roots].sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0
  )
  const byRoot = pins
    ? new Map(
        pins.versions.map((version, index) => [
          version.identity.subjectId,
          { version, compilation: pins.compilations[index] }
        ])
      )
    : null
  if (byRoot && byRoot.size !== pins!.versions.length)
    throw new Error('Duplicate content snapshot publication version.')
  if (
    header.part === 'documents' &&
    (!pins || pins.versions.length !== roots.length || pins.compilations.length !== roots.length)
  )
    throw new Error('Content snapshot publication versions or compilations are incomplete.')
  const input = {
    ...contentSnapshotHeaderSchema.parse(header),
    roots: orderedRoots,
    ...(header.part === 'documents'
      ? {
          versions: orderedRoots.map((root) => byRoot?.get(root.id)?.version),
          compilations: orderedRoots.map((root) => byRoot?.get(root.id)?.compilation)
        }
      : {})
  }
  const object =
    input.part === 'index'
      ? contentSnapshotIndexObjectSchema.parse(input)
      : input.part === 'list'
        ? contentSnapshotListObjectSchema.parse(input)
        : contentSnapshotDocumentsObjectSchema.parse(input)
  for (let index = 1; index < object.roots.length; index++) {
    if (object.roots[index]!.id === object.roots[index - 1]!.id)
      throw new Error(`Duplicate content snapshot root ${object.roots[index]!.id}.`)
  }
  const json = canonicalizeJson(object)
  return {
    json,
    sha256: sha256Hex(json),
    byteLength: encoder.encode(json).byteLength,
    rootCount: object.roots.length
  }
}

/** All three parts of one scope kind, from the same readable current publications. */
export function buildContentSnapshotKind(
  header: Omit<ContentSnapshotHeader, 'part'>,
  sources: readonly ContentSnapshotListSource[]
) {
  return {
    index: buildContentSnapshotPart(
      { ...header, part: 'index' },
      sources.map((source) => toContentSnapshotIndexEntry(source))
    ),
    list: buildContentSnapshotPart(
      { ...header, part: 'list' },
      sources.map((source) => toContentSnapshotListEntry(source))
    ),
    documents: buildContentSnapshotPart(
      { ...header, part: 'documents' },
      sources.map((source) => source.document),
      {
        versions: sources.map((source) => source.publicationVersion),
        compilations: sources.map((source) => source.compilation)
      }
    )
  }
}

/** Equipment picker facts come from the root's stored effective projection, not the variant alone. */
export type ContentSnapshotIndexSource =
  | Exclude<AuthoredPublicationDocument, { subjectKind: 'EQUIPMENT' }>
  | {
      subjectKind: 'EQUIPMENT'
      document: EquipmentAuthoredDto
      builder: NonNullable<AuthoredEquipmentOptionFacts['builder']>
    }

export function toContentSnapshotIndexEntry<Source extends ContentSnapshotIndexSource>(
  source: Source
): ContentSnapshotIndexEntry<Source['subjectKind']>
export function toContentSnapshotIndexEntry(
  source: ContentSnapshotIndexSource
): ContentSnapshotIndexEntry {
  const { id, label } = source.document
  switch (source.subjectKind) {
    case 'RACE': {
      const race = source.document
      // Own features only: a subrace's reader joins its parent's facts, as resolution merges them.
      // Authored charge refinements narrow beyond the validated DTO's inferred type.
      const abilityScoreIncreaseFacts = getRaceAbilityScoreIncreaseFacts(race as RaceAuthored)
      return race.category === 'BASE'
        ? {
            id,
            label,
            category: race.category,
            description: race.description,
            selectionMode: race.selectionMode,
            size: race.size,
            speeds: race.speeds,
            abilityScoreIncreaseFacts
          }
        : {
            id,
            label,
            category: race.category,
            parentRaceId: race.parentRaceId,
            description: race.description,
            abilityScoreIncreaseFacts
          }
    }
    case 'CLASS': {
      const record = source.document
      return record.category === 'BASE'
        ? {
            id,
            label,
            category: record.category,
            description: record.description,
            subclassSelectionLevel: record.subclassSelectionLevel,
            hitpoint: record.hitpoint,
            requirementGroups: record.multiclass.requirementGroups,
            proficiencies: record.proficiencies
          }
        : {
            id,
            label,
            category: record.category,
            parentClassId: record.parentClassId,
            description: record.description,
            proficiencies: record.proficiencies
          }
    }
    case 'BACKGROUND':
      return {
        id,
        label,
        description: source.document.description,
        proficiencies: source.document.proficiencies,
        featureLabels: (source.document.features ?? []).map((feature) => feature.label)
      }
    case 'EQUIPMENT': {
      const { builder } = source
      return {
        id,
        label,
        parentEquipmentId: builder.parentEquipmentId,
        category: builder.category,
        isContainer: builder.isContainer,
        maxStack: builder.maxStack,
        properties: builder.properties,
        requiresAttunement: builder.requiresAttunement
      }
    }
    case 'SPELL': {
      const spell = source.document
      return {
        id,
        label,
        attributes: spell.attributes,
        castingTime: spell.castingTime,
        classIds: spell.classIds,
        components: spell.components,
        description: spell.description,
        level: spell.level,
        magicSchoolId: spell.magicSchoolId,
        materialDescription: spell.materialDescription
      }
    }
    case 'FEAT':
    case 'CREATURE':
    case 'VEHICLE':
      return { id, label }
  }
}

/** A Spell's School label comes from the System vocabulary and is carried into its list entry. */
export type ContentSnapshotListSource = ContentSnapshotIndexSource & {
  publicId: string
  magicSchoolLabel?: string
  publicationVersion: ContentSnapshotPublicationVersion
  compilation: AuthoredStoredCompilation
}

export function toContentSnapshotListEntry<Source extends ContentSnapshotListSource>(
  source: Source
): ContentSnapshotListEntry<Source['subjectKind']>
export function toContentSnapshotListEntry(
  source: ContentSnapshotListSource
): ContentSnapshotListEntry {
  const { id, label, description } = source.document
  const identity = { id, label, publicId: source.publicId, description: description ?? undefined }
  switch (source.subjectKind) {
    case 'RACE': {
      const race = source.document
      return race.category === 'BASE'
        ? { ...identity, category: race.category, selectionMode: race.selectionMode }
        : { ...identity, category: race.category, parentRaceId: race.parentRaceId }
    }
    case 'CLASS': {
      const record = source.document
      return record.category === 'BASE'
        ? { ...identity, category: record.category }
        : { ...identity, category: record.category, parentClassId: record.parentClassId }
    }
    case 'EQUIPMENT':
    case 'CREATURE':
    case 'VEHICLE':
      return { ...identity, category: source.document.category }
    case 'SPELL': {
      const spell = source.document
      if (!source.magicSchoolLabel)
        throw new Error('Spell list entry needs its magic school label.')
      return {
        ...identity,
        level: spell.level,
        magicSchoolId: spell.magicSchoolId,
        magicSchoolLabel: source.magicSchoolLabel,
        classIds: [...new Set(spell.classIds.map((classId) => classId.toLowerCase()))].sort(),
        castingTime: spell.castingTime
      }
    }
    case 'BACKGROUND':
    case 'FEAT':
      return identity
  }
}
