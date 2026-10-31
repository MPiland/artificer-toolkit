// @vitest-environment node
import { makeFunctionReference } from 'convex/server'
import { convexTest } from '../../tests/convexTest'
import { describe, expect, it } from 'vitest'
import { authoredSubjectKindSchema } from '@artificer-toolkit/schema/projections/identity'
import { prepareSrdImport } from '@artificer-toolkit/source-data/srd/import.js'
import schema from '../schema'

const modules = import.meta.glob('/apps/apis/convex/**/*.*s')
const parseDocument = makeFunctionReference<
  'query',
  { subjectKind: string; documentJson: string },
  { subjectKind: string; parsedBytes: number }
>('content/schemaCostProbe:parseDocument')

describe('schema cost probe query', () => {
  it('parses a real SRD document of every authored subject kind with the product schemas', async () => {
    const t = convexTest(schema, modules)
    const { subjects } = prepareSrdImport()
    for (const subjectKind of authoredSubjectKindSchema.options) {
      const subject = subjects.find((candidate) => candidate.subjectKind === subjectKind)
      expect(subject, subjectKind).toBeDefined()
      const result = await t.query(parseDocument, {
        subjectKind,
        documentJson: JSON.stringify(subject?.document)
      })
      expect(result.subjectKind).toBe(subjectKind)
      expect(result.parsedBytes).toBeGreaterThan(0)
    }
  })

  it('rejects a document its schema does not accept', async () => {
    const t = convexTest(schema, modules)
    await expect(
      t.query(parseDocument, { subjectKind: 'SPELL', documentJson: JSON.stringify({ id: 1 }) })
    ).rejects.toThrow()
  })
})
