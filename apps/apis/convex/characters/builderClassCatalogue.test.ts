import { afterEach, expect, it, vi } from 'vitest'
import { createEmptyCharacterAuthored } from '@artificer-toolkit/shared/character'
import { canonicalizeRuleDocument } from '@artificer-toolkit/shared/rules'
import { createCharacterBuilderCatalog } from '@artificer-toolkit/rules-runtime/character/builderCatalog'
import { toContentSnapshotIndexEntry } from '@artificer-toolkit/rules-runtime/contentSnapshots'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { championMartialArchetype } from '@artificer-toolkit/source-data/srd/classes/champion.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'
import { deleteAuthoredVersion, insertAuthoredVersion } from '../content/documents'
import { parsePublicationDocument } from '../content/publicationDocumentRead'
import * as relationships from '../content/classRelationships'
import { loadCharacterBuilderContext } from './builderContext'

afterEach(() => vi.restoreAllMocks())

it.each(['valid', 'missing parent', 'non-base parent'] as const)(
  'validates Class catalogue parents from the complete authorized set: %s',
  async (scenario) => {
    const base = { ...fighter, label: 'Z base Class' }
    const child = { ...championMartialArchetype, label: 'A subclass', parentClassId: base.id }
    const { t, first } = await publicationFixture(
      import.meta.glob('/apps/apis/convex/**/*.*s'),
      import.meta.glob('../betterAuth/**/*.*s'),
      [
        [base, child].map((document) =>
          importedSubject({ subjectKind: 'CLASS', ...document, document })
        )
      ]
    )
    await t.run(async (ctx) => {
      if (scenario === 'valid') return
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) =>
          q.eq('id', scenario === 'missing parent' ? base.id : child.id)
        )
        .unique()
      if (!root) throw new Error('Missing Class fixture.')
      if (scenario === 'missing parent') await ctx.db.delete(root._id)
      else {
        const document = { ...child, parentClassId: child.id }
        const imported = importedSubject({ subjectKind: 'CLASS', ...document, document })
        const version = await ctx.db.get(root.currentVersionId)
        if (!version) throw new Error('Missing Class version fixture.')
        await deleteAuthoredVersion(ctx, version)
        const currentVersionId = await insertAuthoredVersion(
          ctx,
          {
            subjectKind: version.subjectKind,
            id: version.id,
            systemId: version.systemId,
            label: version.label,
            checksum: imported.checksum,
            contentSourceId: version.contentSourceId,
            versionId: version.versionId,
            version: version.version,
            documentSchemaVersion: version.documentSchemaVersion,
            compilation: version.compilation
          },
          canonicalizeRuleDocument(imported.document)
        )
        await ctx.db.patch(root._id, {
          parentClassId: child.id,
          checksum: imported.checksum,
          currentVersionId
        })
      }
    })
    const character = createEmptyCharacterAuthored({
      id: crypto.randomUUID(),
      systemId: srdSystemRecord.id,
      userId: first.userId
    })
    const readParent = vi.spyOn(relationships, 'requireClassParent')
    const result = t.run(
      async (ctx) =>
        (await loadCharacterBuilderContext(ctx, character, first.userId)).catalog.classes
    )
    if (scenario !== 'valid') {
      await expect(result).rejects.toThrow('A readable base class in the same System is required.')
      return
    }
    expect(await result).toEqual(
      createCharacterBuilderCatalog({
        system: srdSystemRecord,
        races: [],
        classes: [child, base].map((document) =>
          toContentSnapshotIndexEntry(parsePublicationDocument('CLASS', document))
        ),
        backgrounds: [],
        equipment: [],
        feats: [],
        spells: []
      }).classes
    )
    expect(readParent.mock.calls.length).toBe(0)
  }
)
