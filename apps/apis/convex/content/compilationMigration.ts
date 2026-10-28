import { Migrations } from '@convex-dev/migrations'
import { SUBJECT_COMPILER_VERSION } from '@artificer-toolkit/schema/api/authoredPublication'
import { acquiredEquipmentRulesSchema } from '@artificer-toolkit/schema/projections/acquiredEquipmentRules'
import { characterCollectionRecord } from '@artificer-toolkit/schema/projections/characterOperationalState'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import * as z from 'zod/mini'
import {
  equipmentPresentation,
  spellPresentation
} from '@artificer-toolkit/rules-runtime/character/acquiredEquipmentRules'
import { components, internal } from '../_generated/api'
import type { QueryCtx } from '../_generated/server'
import { readCharacterDraftPayload, replaceCharacterDraftPayload } from '../characters/documents'
import schema from '../schema'
import { internalMutation } from '../lib/mutations'
import { authoredCatalogueMetadataSchema } from '@artificer-toolkit/schema/api/authoredCatalogue'
import { hasRootCatalogueFacts, rootCatalogueFacts } from './catalogueMetadata'
import {
  readAuthoredVersionCompilation,
  readPublishedRootDocument,
  readStoredAuthoredVersionDocument
} from './documents'
import { compileCurrentEquipment } from './equipmentRelationships'
import { compilePublicationDocument, parsePublicationDocument } from './publicationDocument'
import { compileCurrentRace } from './raceRelationships'

/**
 * PLATFORM-21.T1a: a stored compilation from a superseded compiler is recompiled from its version's
 * stored document, so evaluation can read every row at `SUBJECT_COMPILER_VERSION`. Equipment and
 * Race compile against their current parents, as publication does. Idempotent: current rows are
 * left alone.
 */
const migrations = new Migrations(components.migrations, { schema, internalMutation })

// A compilation can approach the document size limit.
export const recompileStaleCompilations = migrations.define({
  table: 'authoredVersionCompilations',
  batchSize: 1,
  migrateOne: async (ctx, row) => {
    if (row.compilation.compilerVersion === SUBJECT_COMPILER_VERSION) return undefined
    const version = await ctx.db
      .query('authoredVersions')
      .withIndex('by_versionId', (query) => query.eq('versionId', row.versionId))
      .unique()
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (query) => query.eq('id', row.subjectId))
      .unique()
    if (!version || !root) throw new Error('Stored compilation has no authored version.')
    const subject = parsePublicationDocument(
      version.subjectKind,
      await readStoredAuthoredVersionDocument(ctx, version)
    )
    const userId = root.ownerUserId ?? null
    const compilation =
      subject.subjectKind === 'EQUIPMENT'
        ? (await compileCurrentEquipment(ctx, subject.document, userId)).compilation
        : subject.subjectKind === 'RACE'
          ? (await compileCurrentRace(ctx, subject.document, userId)).compilation
          : compilePublicationDocument(subject)
    return { compilation }
  }
})

/**
 * D163 ruling #1: share and parent authorization and commit read catalogue facts from the root
 * alone. A root published before then gains its ACTIVE status and picker facts from its current
 * document. Idempotent: complete rows are left alone.
 */
export const backfillRootCatalogueFacts = migrations.define({
  table: 'authoredRoots',
  batchSize: 1,
  migrateOne: async (ctx, root) => {
    if (!root.catalogue) return undefined
    const existing = authoredCatalogueMetadataSchema.parse(root.catalogue)
    if (existing.checksum !== root.checksum) throw new Error('Stored catalogue checksum mismatch.')
    if (hasRootCatalogueFacts(root, existing)) return undefined
    const { document } = await readPublishedRootDocument(ctx, root)
    const facts = rootCatalogueFacts(root.subjectKind, document)
    return { catalogue: authoredCatalogueMetadataSchema.parse({ ...existing, ...facts }) }
  }
})

/**
 * D163 ruling C: retained rules stored before the pinned shape held raw authored documents. Each is
 * repinned to the current stored compilation of the same version, with its prose. Runs after
 * `recompileStaleCompilations`, so those rows are current. Idempotent: pinned rows are left alone.
 */
async function repinRetainedRules(ctx: QueryCtx, retainedRulesJson: string | undefined) {
  if (!retainedRulesJson) return undefined
  const stored: unknown = JSON.parse(retainedRulesJson)
  if (acquiredEquipmentRulesSchema.safeParse(stored).success) return undefined
  const legacy = legacyAcquiredEquipmentRulesSchema.parse(stored)
  const sources = []
  for (const source of legacy.sources) {
    // The pinned shape keeps the resolved leaf only; its compilation already holds the parents.
    if (source.subjectKind === 'EQUIPMENT' && source.subjectId !== legacy.equipmentId) continue
    const compilation = await readAuthoredVersionCompilation(ctx, source)
    if (!compilation || compilation.authoredChecksum !== source.checksum)
      throw new Error('Retained source has no stored compilation of its pinned version.')
    const document: unknown = JSON.parse(source.documentJson)
    const { documentJson: _documentJson, ...identity } = source
    sources.push({
      ...identity,
      compilation,
      presentation:
        source.subjectKind === 'EQUIPMENT'
          ? equipmentPresentation(equipmentAuthoredDtoSchema.parse(document))
          : spellPresentation(spellAuthoredDtoSchema.parse(document))
    })
  }
  return JSON.stringify(acquiredEquipmentRulesSchema.parse({ ...legacy, sources }))
}

const legacyAcquiredEquipmentRulesSchema = z.object({
  equipmentId: z.string(),
  systemId: z.string(),
  sources: z.array(
    z.object({
      subjectKind: z.enum(['EQUIPMENT', 'SPELL']),
      subjectId: z.string(),
      versionId: z.string(),
      version: z.number(),
      checksum: z.string(),
      documentJson: z.string()
    })
  )
})

export const repinCharacterRetainedRules = migrations.define({
  table: 'characterInventoryItems',
  batchSize: 1,
  migrateOne: async (ctx, row) => {
    const retainedRulesJson = await repinRetainedRules(ctx, row.value.retainedRulesJson)
    if (!retainedRulesJson) return undefined
    const { checksum, value } = characterCollectionRecord(row.characterId, row.id, row.position, {
      ...row.value,
      retainedRulesJson
    })
    return { checksum, value }
  }
})

// A draft keeps its own copy of held items; its payload is rewritten whole, as a save does.
export const repinCharacterDraftRetainedRules = migrations.define({
  table: 'characterDrafts',
  batchSize: 1,
  migrateOne: async (ctx, draft) => {
    const payload = await readCharacterDraftPayload(ctx, draft)
    const { inventory } = payload.character.state.equipment
    let changed = false
    const repinned = []
    for (const item of inventory) {
      const retainedRulesJson = await repinRetainedRules(ctx, item.retainedRulesJson)
      changed ||= retainedRulesJson !== undefined
      repinned.push(retainedRulesJson ? { ...item, retainedRulesJson } : item)
    }
    if (!changed) return undefined
    const { character } = payload
    const written = await replaceCharacterDraftPayload(
      ctx,
      draft,
      {
        ...payload,
        character: {
          ...character,
          state: {
            ...character.state,
            equipment: { ...character.state.equipment, inventory: repinned }
          }
        }
      },
      draft.updatedAt
    )
    return { payloadId: written.payloadId, checksum: written.checksum }
  }
})

export const repinPartyRetainedRules = migrations.define({
  table: 'campaignPartyItems',
  batchSize: 1,
  migrateOne: async (ctx, row) => {
    const retainedRulesJson = await repinRetainedRules(ctx, row.retainedRulesJson)
    return retainedRulesJson ? { retainedRulesJson } : undefined
  }
})

export const run = migrations.runner([
  internal.content.sourceMigrations.backfillAuthoringSources,
  internal.content.compilationMigration.recompileStaleCompilations,
  internal.content.compilationMigration.backfillRootCatalogueFacts,
  internal.content.compilationMigration.repinCharacterRetainedRules,
  internal.content.compilationMigration.repinCharacterDraftRetainedRules,
  internal.content.compilationMigration.repinPartyRetainedRules,
  // Encounter pins copy the stored compilations the steps above leave current.
  internal.encounters.equipmentPinMigration.blueprintEquipmentPins,
  internal.encounters.equipmentPinMigration.runActorEquipmentPins
])
