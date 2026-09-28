import type { AuthoredEquipmentOptionFacts } from '@artificer-toolkit/schema/api/authoredOptions'
import type { AuthoredPublicationDocument } from '@artificer-toolkit/schema/api/authoredPublication'
import {
  contentSnapshotDocumentsObjectSchema,
  contentSnapshotHeaderSchema,
  contentSnapshotIndexObjectSchema,
  type ContentSnapshotHeader,
  type ContentSnapshotIndexEntry,
  type ContentSnapshotKind,
  type ContentSnapshotPart,
  type ContentSnapshotRoot
} from '@artificer-toolkit/schema/api/contentSnapshots'
import { projectionChecksumSchema } from '@artificer-toolkit/schema/projections/identity'
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
  roots: readonly ContentSnapshotRoot<Kind, Part>[]
): { json: string; sha256: string; byteLength: number; rootCount: number } {
  const input = { ...contentSnapshotHeaderSchema.parse(header), roots }
  const object =
    input.part === 'index'
      ? contentSnapshotIndexObjectSchema.parse(input)
      : contentSnapshotDocumentsObjectSchema.parse(input)
  const ordered = [...object.roots].sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0
  )
  for (let index = 1; index < ordered.length; index++) {
    if (ordered[index]!.id === ordered[index - 1]!.id)
      throw new Error(`Duplicate content snapshot root ${ordered[index]!.id}.`)
  }
  const json = canonicalizeJson({ ...object, roots: ordered })
  return {
    json,
    sha256: sha256Hex(json),
    byteLength: encoder.encode(json).byteLength,
    rootCount: ordered.length
  }
}

export function contentSnapshotObjectKey(header: ContentSnapshotHeader, sha256: string): string {
  const { scope, scopeId, kind, part } = contentSnapshotHeaderSchema.parse(header)
  return `v1/${scope.toLowerCase()}/${scopeId}/${kind.toLowerCase()}/${part}/${projectionChecksumSchema.parse(sha256)}.json`
}

/** The inverse of `contentSnapshotObjectKey`; null for anything that is not a canonical key. */
export function parseContentSnapshotObjectKey(
  key: string
): { header: ContentSnapshotHeader; sha256: string } | null {
  const [, scope = '', scopeId, kind = '', part, hash] =
    /^v1\/([a-z]+)\/([^/]+)\/([a-z]+)\/([a-z]+)\/([^/]+)\.json$/.exec(key) ?? []
  const header = contentSnapshotHeaderSchema.safeParse({
    format: 1,
    scope: scope.toUpperCase(),
    scopeId,
    kind: kind.toUpperCase(),
    part
  })
  const sha256 = projectionChecksumSchema.safeParse(hash)
  if (!header.success || !sha256.success) return null
  return contentSnapshotObjectKey(header.data, sha256.data) === key
    ? { header: header.data, sha256: sha256.data }
    : null
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
