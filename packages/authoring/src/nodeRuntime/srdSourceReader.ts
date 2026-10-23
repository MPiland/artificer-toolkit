import type { AuthoredNodeRuntimeSourceFacts } from '@artificer-toolkit/schema/api/nodeRuntimeSources'
import { authoredDocumentVersionSchema } from '@artificer-toolkit/schema/projections/authoredContent'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { SRD_REUSABLE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { authoredSourceFacts, authoredSourceKindsByTable } from './authoredSourceFacts.js'
import type { NodeRuntimeQueryRow, NodeRuntimeSourceReader } from './nodeRuntimeSourceContract.js'
import type { NodeRuntimeSourceTable } from './nodeRuntimeSourceManifest.js'
import {
  createNodeRuntimeSourceReader,
  sortAuthoredSourceRows,
  type NodeRuntimePolicyVocabulary
} from './systemSourceRows.js'

const { subjects } = srdBaselineContent
const fixtureVersionId = '00000000-0000-4000-8000-000000000f00'
const subjectsByKind = {
  BACKGROUND: subjects.backgrounds,
  CLASS: subjects.classes,
  CREATURE: subjects.creatures,
  EQUIPMENT: subjects.equipment,
  FEAT: subjects.feats,
  RACE: subjects.races,
  SPELL: subjects.spells,
  VEHICLE: subjects.vehicles
} as const
type SubjectKind = keyof typeof subjectsByKind

const factsByKind = new Map<SubjectKind, AuthoredNodeRuntimeSourceFacts[]>()

// Mirrors the production import: each SRD record is canonicalized, checksummed and parsed
// before the shared projection turns it into resolver source facts.
function readKindFacts(kind: SubjectKind) {
  const cached = factsByKind.get(kind)
  if (cached) return cached
  const facts = subjectsByKind[kind].map((subject) => {
    const document = jsonValueSchema.parse(JSON.parse(JSON.stringify(subject)))
    const checksum = checksumRuleDocument(document)
    return authoredSourceFacts(
      authoredDocumentVersionSchema.parse({
        subjectKind: kind,
        subjectId: subject.id,
        versionId: fixtureVersionId,
        version: 1,
        documentSchemaVersion: 1,
        checksum,
        document
      })
    )
  })
  factsByKind.set(kind, facts)
  return facts
}

const rowsByTable = new Map<NodeRuntimeSourceTable, NodeRuntimeQueryRow[]>()

// The reader runs once per option source per resolved node, so the sorted rows of a table are
// built once; the reader only projects columns from them and never mutates a row.
function readAuthoredRows(table: NodeRuntimeSourceTable): NodeRuntimeQueryRow[] {
  const cached = rowsByTable.get(table)
  if (cached) return cached
  const kinds = authoredSourceKindsByTable[table]
  if (!kinds) throw new Error(`Authoring source is not migrated: ${table}.`)
  const rows = sortAuthoredSourceRows(
    kinds.flatMap((kind) => readKindFacts(kind).flatMap((facts) => facts.rows[table] ?? []))
  )
  rowsByTable.set(table, rows)
  return rows
}

/** Builds every SRD source projection once so the first resolve stays inside UI wait timeouts. */
export function warmFixtureAuthoredSources() {
  for (const kind of Object.keys(subjectsByKind) as SubjectKind[]) readKindFacts(kind)
}

/**
 * The production reader (`createSystemSourceReader`) over the in-memory SRD, for tests that
 * resolve or normalize authored values as the server does.
 */
export function createSrdNodeRuntimeReader(
  coreCodes: NodeRuntimePolicyVocabulary,
  system: SystemAuthoredDto = srdSystemRecord
): NodeRuntimeSourceReader {
  return createNodeRuntimeSourceReader({
    system,
    coreCodes,
    readAuthoredRows,
    readReusableDefinitions: async () => SRD_REUSABLE_DEFINITIONS
  })
}
