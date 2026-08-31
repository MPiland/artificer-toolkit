import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const repository = read('packages/db/src/domains/subjects/repositories/authoredVersion.ts')
const drafts = read('packages/db/src/domains/subjects/repositories/authoredContent.ts')
const baseline = read('packages/db/src/seed/baseline.ts')

const lowLevelRoots = {
  backgrounds: 'background',
  classes: 'class',
  creatures: 'creature',
  equipment: 'equipment',
  feats: 'feat',
  races: 'race',
  spells: 'spell',
  vehicles: 'vehicle'
} as const

describe('authored Content Source propagation', () => {
  it.each(Object.entries(lowLevelRoots))(
    '%s low-level upsert inserts, but never replaces, Content Source provenance',
    (root, fileName) => {
      const upsert = read(`packages/db/src/domains/subjects/upserts/${fileName}.ts`)

      expect(upsert).toContain('contentSourceId: string')
      expect(upsert).toContain('content_source_id: contentSourceId')
      expect(upsert).toMatch(
        new RegExp(`content_source_id:\\s*eb\\.ref\\(["']${root}\\.content_source_id["']\\)`)
      )
      expect(upsert).not.toContain("content_source_id: eb.ref('excluded.content_source_id')")
    }
  )

  it.each(Object.keys(lowLevelRoots))(
    '%s versioned root envelope preserves Content Source',
    (root) => {
      expect(repository).toMatch(
        new RegExp(`insert into public\\.${root} \\([\\s\\S]*?content_source_id`)
      )
      expect(repository).toContain(`content_source_id = ${root}.content_source_id`)
    }
  )

  it('requires exact default-source continuity for drafts and active roots', () => {
    expect(drafts).toContain('const contentSourceId = await requireDefaultUserContentSource')
    expect(drafts).toContain('cannot change Content Source')
    expect(drafts).toContain('and authored_drafts.content_source_id = excluded.content_source_id')
  })

  it('locks the authored root with its immutable Content Source before publishing', () => {
    expect(repository).toContain(
      'select id, system_id, content_source_id, status, active_version_id'
    )
    expect(repository).toContain('root.content_source_id !== input.contentSourceId')
  })

  it('seeds the deterministic SRD source and D&D 2014 catalogue relation', () => {
    expect(baseline).toContain("'dnd-2014'")
    expect(baseline).toContain("'srd-5.1'")
    expect(baseline).toContain('rules_catalogue_content_sources')
  })
})
