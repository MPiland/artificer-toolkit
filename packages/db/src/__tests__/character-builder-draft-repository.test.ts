import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const repositorySource = readFileSync(
  resolve(import.meta.dirname, '../domains/subjects/repositories/characterBuilderDraft.ts'),
  'utf8'
)

describe('Character Builder draft repository locking', () => {
  it('locks an exact bounded owner draft set deterministically', () => {
    const start = repositorySource.indexOf('async lockByIds(')
    const end = repositorySource.indexOf('async save(', start)
    const method = repositorySource.slice(start, end)

    expect(method).toContain('[...new Set(params.draftIds)].sort()')
    expect(method).toContain('where user_id = ${params.userId}')
    expect(method).toContain('and id in (')
    expect(method).toContain('order by id')
    expect(method).toContain('for update')
  })
})
