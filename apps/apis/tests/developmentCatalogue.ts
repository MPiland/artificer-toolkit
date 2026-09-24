import assert from 'node:assert/strict'
import { ConvexHttpClient } from 'convex/browser'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type {
  AuthoredCataloguePage,
  AuthoredCatalogueReadInput
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { api } from '../convex/_generated/api.js'
import { developmentTarget } from './developmentTarget'

// Read-only managed-runtime check. No accounts, invitations, source writes or cleanup.
const { deploymentUrl, selector } = developmentTarget(process.env)
const client = new ConvexHttpClient(deploymentUrl.origin, { logger: false })
for (const subjectKind of ['BACKGROUND', 'EQUIPMENT'] as const) {
  const expected =
    subjectKind === 'BACKGROUND'
      ? srdBaselineContent.subjects.backgrounds
      : srdBaselineContent.subjects.equipment
  const scope = { subjectKind, systemId: srdSystemRecord.id }
  const counts = await client.query(api.content.catalogue.counts, scope)
  assert.deepEqual(counts, {
    activeCount: expected.length,
    masterCount: expected.length,
    ownedCount: 0
  })
  const actual: AuthoredCataloguePage['page'] = []
  let cursor: string | null = null
  let finished = false
  for (let pageNumber = 0; pageNumber <= expected.length; pageNumber++) {
    const result: AuthoredCataloguePage = await client.query(api.content.catalogue.list, {
      ...scope,
      paginationOpts: { numItems: 48, cursor }
    })
    actual.push(...result.page)
    if (result.isDone) {
      finished = true
      break
    }
    assert.notEqual(result.continueCursor, cursor, 'Pagination must advance.')
    cursor = result.continueCursor
  }
  assert.ok(finished, 'Catalogue pagination did not complete.')
  assert.deepEqual(actual.map((item) => item.id).sort(), expected.map((item) => item.id).sort())
  const order = actual.map((item) => `${item.label.toLowerCase()}\0${item.id}`)
  assert.deepEqual(order, [...order].sort())
  for (const item of actual) {
    assert.equal(item.provenance.kind, 'MASTER')
    assert.deepEqual(item.permissions, {
      canView: true,
      canEdit: false,
      canCopy: false,
      canDelete: false
    })
    assert.equal('_id' in item || 'documentJson' in item || 'compilation' in item, false)
  }
  const owned = await client.query(api.content.catalogue.list, {
    ...scope,
    source: 'OWNED',
    paginationOpts: { numItems: 48, cursor: null }
  })
  assert.deepEqual(owned.page, [])
  assert.equal(owned.isDone, true)
  console.log(
    JSON.stringify({
      selector,
      subjectKind,
      summaries: actual.length,
      counts,
      readonly: true
    })
  )
}

const equipment = srdBaselineContent.subjects.equipment
const categories = [...new Set(equipment.map((item) => item.category))].sort()
for (const category of categories) {
  const expected = equipment.filter((item) => item.category === category)
  const summary = await client.query(api.content.catalogue.summary, {
    subjectKind: 'EQUIPMENT',
    source: 'MASTER',
    category
  })
  assert.deepEqual(summary, {
    activeCount: equipment.length,
    masterCount: equipment.length,
    ownedCount: 0,
    totalCount: expected.length,
    categories
  })
  assert.equal(
    (
      await client.query(api.content.catalogue.summary, {
        subjectKind: 'EQUIPMENT',
        source: 'OWNED',
        category
      })
    ).totalCount,
    0
  )
  for (const mode of ['name', 'category', ...(category === 'WEAPON' ? ['search'] : [])]) {
    const ids: string[] = []
    let cursor: string | null = null
    let finished = false
    let pages = 0
    for (; pages <= expected.length; pages++) {
      const request: AuthoredCatalogueReadInput & { source: 'MASTER' } = {
        subjectKind: 'EQUIPMENT' as const,
        source: 'MASTER' as const,
        category,
        paginationOpts: { cursor, numItems: 7 }
      }
      // Every WEAPON has the category token in its search text. A prefix search
      // therefore has an exact corpus oracle without reimplementing tokenization.
      const result: AuthoredCataloguePage =
        mode === 'search'
          ? await client.query(api.content.catalogue.search, {
              ...request,
              query: 'weap'
            })
          : await client.query(api.content.catalogue.list, {
              ...request,
              sort: mode === 'name' ? 'name' : 'category'
            })
      assert.ok(result.page.length <= 7, 'Catalogue page exceeded the requested size.')
      assert.ok(
        result.page.every((item) => item.category === category && item.provenance.kind === 'MASTER')
      )
      if (pages === 1) {
        const replay: AuthoredCataloguePage =
          mode === 'search'
            ? await client.query(api.content.catalogue.search, {
                ...request,
                query: 'weap'
              })
            : await client.query(api.content.catalogue.list, {
                ...request,
                sort: mode === 'name' ? 'name' : 'category'
              })
        assert.deepEqual(replay, result, 'Revisiting a continuation must preserve its page.')
      }
      ids.push(...result.page.map((item) => item.id))
      if (result.isDone) {
        finished = true
        pages++
        break
      }
      assert.notEqual(result.continueCursor, cursor, 'Filtered pagination must advance.')
      cursor = result.continueCursor
    }
    assert.ok(finished, 'Filtered catalogue pagination did not complete.')
    assert.equal(new Set(ids).size, ids.length, 'Filtered pages repeated a UUID.')
    assert.deepEqual([...ids].sort(), expected.map((item) => item.id).sort())
    if (mode !== 'search') {
      const ordered = [...expected].sort((left, right) => {
        const a = `${left.label.toLowerCase()}\0${left.id}`
        const b = `${right.label.toLowerCase()}\0${right.id}`
        return a < b ? -1 : a > b ? 1 : 0
      })
      assert.deepEqual(
        ids,
        ordered.map((item) => item.id)
      )
    }
    if (expected.length > 7) assert.ok(pages > 1, 'Expected real continuation coverage.')
    console.log(
      JSON.stringify({
        selector,
        category,
        mode,
        pages,
        matches: ids.length,
        readonly: true
      })
    )
  }
}
