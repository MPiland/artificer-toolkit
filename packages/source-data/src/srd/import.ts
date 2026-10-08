import {
  jsonValueSchema,
  type AuthoredSubjectKind,
  type JsonValue
} from '@artificer-toolkit/schema/projections/identity'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import {
  reusableDefinitionDocumentDtoSchema,
  reusableDefinitionDocumentFamilyKey,
  type ReusableDefinitionDocumentDto
} from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { backgroundAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/background'
import { classAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/class'
import { creaturePublicationDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { featAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/feat'
import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { vehicleAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/vehicle'
import { systemAuthoredDtoSchema } from '@artificer-toolkit/schema/vocabulary/system'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { BaselineContentBundle } from '../content.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_REUSABLE_DEFINITIONS,
  SRD_RULES_CATALOGUE,
  type SrdReusableDefinitionSeed
} from './catalogue.js'
import { srdBaselineContent } from './index.js'

interface SrdImportSubject {
  subjectKind: AuthoredSubjectKind
  id: string
  systemId: string
  label: string
  checksum: string
  document: JsonValue
}

interface SrdImportManifest {
  systems: { id: string; checksum: string; document: JsonValue }[]
  subjects: SrdImportSubject[]
  definitions: (Omit<SrdReusableDefinitionSeed, 'document'> & {
    document: ReusableDefinitionDocumentDto
  })[]
  catalogue: typeof SRD_RULES_CATALOGUE
  contentSource: typeof SRD_CONTENT_SOURCE
  manifestChecksum: string
}

// Match the existing authored JSON representation: optional undefined fields are omitted.
function jsonDocument(value: unknown): JsonValue {
  return jsonValueSchema.parse(JSON.parse(JSON.stringify(value)))
}

function assertUnchanged(source: unknown, parsed: unknown, identity: string): JsonValue {
  const original = jsonDocument(source)
  const document = jsonDocument(parsed)
  if (checksumRuleDocument(original) !== checksumRuleDocument(document)) {
    throw new Error(`Import validation would change canonical source ${identity}.`)
  }
  return document
}

/** Pure preparation; persistence and deployment selection belong to the importer. */
export function prepareSrdImport(
  bundle: BaselineContentBundle = srdBaselineContent,
  definitionSeeds: readonly SrdReusableDefinitionSeed[] = SRD_REUSABLE_DEFINITIONS
): SrdImportManifest {
  const systems = bundle.vocabulary.systems
    .map((source) => {
      postgresUuidSchema.parse(source.id)
      const parsed = systemAuthoredDtoSchema.parse(source)
      const document = assertUnchanged(source, parsed, source.id)
      return { id: source.id, checksum: checksumRuleDocument(document), document }
    })
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
  const systemIds = new Set(systems.map((system) => system.id))
  if (systemIds.size !== systems.length) throw new Error('Duplicate canonical System UUID.')
  if (!systemIds.has(SRD_CONTENT_SOURCE.gameSystemId))
    throw new Error('Missing canonical SRD System.')

  const subjects: SrdImportSubject[] = []
  function add(
    subjectKind: AuthoredSubjectKind,
    sources: readonly { id: string; systemId: string; label: string }[],
    schema: { parse: (value: unknown) => unknown }
  ) {
    for (const source of sources) {
      postgresUuidSchema.parse(source.id)
      if (!systemIds.has(source.systemId)) throw new Error(`Missing System for ${source.id}.`)
      const document = assertUnchanged(source, schema.parse(source), source.id)
      subjects.push({
        subjectKind,
        id: source.id,
        systemId: source.systemId,
        label: source.label,
        checksum: checksumRuleDocument(document),
        document
      })
    }
  }
  add('BACKGROUND', bundle.subjects.backgrounds, backgroundAuthoredDtoSchema)
  add('CLASS', bundle.subjects.classes, classAuthoredDtoSchema)
  add('CREATURE', bundle.subjects.creatures, creaturePublicationDtoSchema)
  add('EQUIPMENT', bundle.subjects.equipment, equipmentAuthoredDtoSchema)
  add('FEAT', bundle.subjects.feats, featAuthoredDtoSchema)
  add('RACE', bundle.subjects.races, raceAuthoredDtoSchema)
  add('SPELL', bundle.subjects.spells, spellAuthoredDtoSchema)
  add('VEHICLE', bundle.subjects.vehicles, vehicleAuthoredDtoSchema)
  subjects.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
  const subjectIds = new Set(subjects.map((subject) => subject.id.toLowerCase()))
  if (subjectIds.size !== subjects.length) throw new Error('Duplicate canonical authored UUID.')

  const idsFor = (kind: AuthoredSubjectKind) =>
    new Set(subjects.filter((subject) => subject.subjectKind === kind).map((subject) => subject.id))
  const classIds = idsFor('CLASS')
  const equipmentIds = idsFor('EQUIPMENT')
  const raceIds = idsFor('RACE')
  const requireReference = (ids: Set<string>, id: string, sourceId: string) => {
    if (!ids.has(id)) throw new Error(`Canonical source ${sourceId} references missing ${id}.`)
  }
  for (const source of bundle.subjects.classes) {
    if (source.category === 'SUBCLASS') requireReference(classIds, source.parentClassId, source.id)
  }
  for (const source of bundle.subjects.spells) {
    for (const id of source.classIds) requireReference(classIds, id, source.id)
  }
  for (const source of bundle.subjects.equipment) {
    if (source.category === 'VARIANT')
      requireReference(equipmentIds, source.parentEquipmentId, source.id)
  }
  for (const source of bundle.subjects.races) {
    if (source.category === 'SUBRACE') requireReference(raceIds, source.parentRaceId, source.id)
  }
  for (const source of bundle.subjects.creatures) {
    for (const item of source.equipmentLoadout ?? [])
      requireReference(equipmentIds, item.equipmentId, source.id)
  }

  const definitions = definitionSeeds
    .map((source) => {
      const parsed = reusableDefinitionDocumentDtoSchema.parse(source.document)
      assertUnchanged(source.document, parsed, source.id)
      if (
        source.id !== parsed.id ||
        !systemIds.has(parsed.gameSystemId) ||
        source.definitionFamilyKey !== reusableDefinitionDocumentFamilyKey(parsed) ||
        source.checksum !== checksumRuleDocument(jsonDocument(parsed))
      ) {
        throw new Error(`Invalid canonical definition identity, family, or checksum: ${source.id}.`)
      }
      return { ...source, document: parsed }
    })
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
  if (new Set(definitions.map((definition) => definition.id)).size !== definitions.length) {
    throw new Error('Duplicate canonical reusable-definition UUID.')
  }

  // The payload checksum includes metadata as well as mechanics; ordering is stable across runs.
  const manifestChecksum = checksumRuleDocument(
    jsonDocument({
      systems,
      subjects,
      definitions,
      catalogue: SRD_RULES_CATALOGUE,
      contentSource: SRD_CONTENT_SOURCE
    })
  )
  return {
    systems,
    subjects,
    definitions,
    catalogue: SRD_RULES_CATALOGUE,
    contentSource: SRD_CONTENT_SOURCE,
    manifestChecksum
  }
}
